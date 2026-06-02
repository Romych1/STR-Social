const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2324293e'/><circle cx='50' cy='35' r='20' fill='%237e8494'/><path d='M15,85 Q50,40 85,85 Z' fill='%237e8494'/></svg>";
const SECRET_DEV_CODE = "СТР_ДЕВ";

// Глобальные базы данных в localStorage
let users = JSON.parse(localStorage.getItem('str_users')) || {};
let posts = JSON.parse(localStorage.getItem('str_posts')) || [];
let messages = JSON.parse(localStorage.getItem('str_messages')) || []; // Массив личных сообщений

let currentUser = localStorage.getItem('str_current_user') || null;
let viewedUser = currentUser;  // Юзер, чью страницу мы смотрим прямо сейчас
let activeDialog = null;       // С кем открыт текущий диалог в ЛС

const authScreen = document.getElementById('auth-screen');
const authLoginInp = document.getElementById('auth-login');
const authPassInp = document.getElementById('auth-password');
const authErrors = document.getElementById('auth-errors');

function checkAuth() {
    if (currentUser && users[currentUser]) {
        authScreen.style.display = 'none';
        viewedUser = currentUser; // По умолчанию открываем свой профиль
        loadProfileData();
        renderPosts();
    } else {
        authScreen.style.display = 'flex';
    }
}

// Регистрация
document.getElementById('btn-signup').addEventListener('click', () => {
    const login = authLoginInp.value.trim();
    const pass = authPassInp.value.trim();
    
    if(login.length < 2 || pass.length < 4) {
        authErrors.innerText = "Логин от 2 симв., пароль от 4 симв.!";
        return;
    }
    if(users[login]) {
        authErrors.innerText = "Такой никнейм занят!";
        return;
    }
    
    users[login] = {
        password: pass,
        status: "Пользователь платформы СТР",
        avatar: DEFAULT_AVATAR,
        birthday: "Не указан",
        city: "Не указан",
        about: "Не указано",
        isDev: false
    };
    
    localStorage.setItem('str_users', JSON.stringify(users));
    currentUser = login;
    localStorage.setItem('str_current_user', currentUser);
    authErrors.innerText = "";
    checkAuth();
});

// Авторизация
document.getElementById('btn-signin').addEventListener('click', () => {
    const login = authLoginInp.value.trim();
    const pass = authPassInp.value.trim();
    
    if(!users[login] || users[login].password !== pass) {
        authErrors.innerText = "Неверный логин или пароль!";
        return;
    }
    
    currentUser = login;
    localStorage.setItem('str_current_user', currentUser);
    authErrors.innerText = "";
    checkAuth();
});

// Выход
document.getElementById('logout-zone').addEventListener('click', () => {
    if(confirm("Выйти из СТР?")) {
        localStorage.removeItem('str_current_user');
        currentUser = null;
        checkAuth();
    }
});

// Функция переключения вкладок на фронтенде
function switchTab(tabName) {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.tab-content');
    
    menuItems.forEach(i => i.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    
    const targetItem = document.querySelector(`.menu-item[data-tab="${tabName}"]`);
    if (targetItem) targetItem.classList.add('active');
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ФУНКЦИЯ ДЛЯ ПЕРЕХОДА НА ЛЮБОЙ ПРОФИЛЬ
window.viewProfile = function(username) {
    if (!users[username]) return; // Защита, если пользователя нет
    viewedUser = username;
    switchTab('profile');
    loadProfileData();
};

// Загрузка данных на страницу профиля (Своего или Чужого)
function loadProfileData() {
    const data = users[viewedUser];
    if (!data) return;
    
    // Заполняем анкету просматриваемого человека
    document.getElementById('profile-name').innerText = viewedUser;
    document.getElementById('profile-status').innerText = data.status || "Без статуса";
    document.getElementById('profile-birthday').innerText = data.birthday || "Не указан";
    document.getElementById('profile-city').innerText = data.city || "Не указан";
    document.getElementById('profile-about').innerText = data.about || "Не указано";
    document.getElementById('profile-avatar-img').src = data.avatar || DEFAULT_AVATAR;
    document.getElementById('profile-dev-badge').style.display = data.isDev ? 'inline-block' : 'none';

    const actionsZone = document.getElementById('profile-actions');
    const createPostBox = document.querySelector('.create-post');
    actionsZone.innerHTML = '';

    // Разделяем логику: Свой профиль или Чужой
    if (viewedUser === currentUser) {
        createPostBox.style.display = 'flex'; // Разрешаем постить себе на стену
        
        // Синхронизируем инпуты в Настройках
        document.getElementById('settings-status-input').value = data.status || "";
        document.getElementById('settings-birthday-input').value = data.birthday || "";
        document.getElementById('settings-city-input').value = data.city || "";
        document.getElementById('settings-about-input').value = data.about || "";
        document.getElementById('settings-dev-code').value = data.isDev ? SECRET_DEV_CODE : "";
    } else {
        createPostBox.style.display = 'none'; // Запрещаем писать посты на чужой стене
        
        // Добавляем интерактивные кнопки взаимодействия
        actionsZone.innerHTML = `
            <button onclick="openChatWith('${viewedUser}')">Написать ЛС</button>
            <button onclick="viewProfile('${currentUser}')" class="btn-secondary">К себе в профиль</button>
        `;
    }
    
    // Верхняя правая мини-панель всегда показывает ТЕКУЩЕГО залогиненного юзера
    const myData = users[currentUser];
    document.getElementById('nav-user-name').innerText = currentUser;
    document.getElementById('nav-user-avatar').src = myData.avatar || DEFAULT_AVATAR;
    document.getElementById('nav-user-badge').style.display = myData.isDev ? 'inline-block' : 'none';
}

// --- СТЕНА ПОСТОВ С КЛИКАБЕЛЬНЫМИ НИКАМИ ---
const postInput = document.getElementById('post-input');
const postButton = document.getElementById('post-button');
const postsFeed = document.getElementById('posts-feed');

function renderPosts() {
    postsFeed.innerHTML = '';
    posts.forEach((post, index) => {
        const authorData = users[post.author];
        const currentAvatar = authorData ? authorData.avatar : DEFAULT_AVATAR;
        
        if (!post.likedBy) post.likedBy = [];
        const hasLiked = post.likedBy.includes(currentUser);
        const activeClass = hasLiked ? 'active' : '';
        const isAuthorDev = authorData && authorData.isDev ? `<span class="dev-badge mini">DEV</span>` : '';

        const postElement = document.createElement('div');
        postElement.className = 'post';
        // Обернули имя автора в span с классом author-link и событием viewProfile
        postElement.innerHTML = `
            <div class="post-header">
                <img class="avatar-mini" src="${currentAvatar}" alt="">
                <div>
                    <h4><span class="author-link" onclick="viewProfile('${post.author}')">${post.author}</span> ${isAuthorDev}</h4>
                </div>
            </div>
            <div class="post-content">${post.text}</div>
            <div class="post-actions">
                <button class="like-button ${activeClass}" onclick="likePost(${index})">🔥 ${post.likedBy.length}</button>
            </div>
        `;
        postsFeed.appendChild(postElement);
    });
}

postButton.addEventListener('click', () => {
    const text = postInput.value.trim();
    if (text === '') return;
    
    posts.unshift({ author: currentUser, text: text, likedBy: [] });
    localStorage.setItem('str_posts', JSON.stringify(posts));
    postInput.value = '';
    renderPosts();
});

window.likePost = function(index) {
    let post = posts[index];
    if (!post.likedBy) post.likedBy = [];
    const userLikeIndex = post.likedBy.indexOf(currentUser);

    if (userLikeIndex === -1) {
        post.likedBy.push(currentUser);
    } else {
        post.likedBy.splice(userLikeIndex, 1);
    }

    localStorage.setItem('str_posts', JSON.stringify(posts));
    renderPosts();
};

// --- МОДУЛЬ ЛИЧНЫХ СООБЩЕНИЙ (ЛС) ---

// Функция открытия чата прямо из чужого профиля
window.openChatWith = function(username) {
    activeDialog = username;
    switchTab('messages');
    renderDialogs();
    renderMessages();
};

// Генерация списка диалогов слева
function renderDialogs() {
    const dialogsList = document.getElementById('dialogs-list');
    dialogsList.innerHTML = '';
    
    // Показываем в списке диалогов вообще всех зарегистрированных в системе, кроме себя
    Object.keys(users).forEach(username => {
        if (username === currentUser) return;
        
        const uData = users[username];
        const activeClass = (username === activeDialog) ? 'active' : '';
        
        // Достаем последнее сообщение диалога для подписи под ником
        const userMessages = messages.filter(m => 
            (m.from === currentUser && m.to === username) || 
            (m.from === username && m.to === currentUser)
        );
        const lastMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1].text : "Нет сообщений";

        const item = document.createElement('div');
        item.className = `dialog-item ${activeClass}`;
        item.onclick = () => {
            activeDialog = username;
            renderDialogs();
            renderMessages();
        };
        item.innerHTML = `
            <img class="avatar-mini" src="${uData.avatar || DEFAULT_AVATAR}" alt="">
            <div class="dialog-info">
                <h4>${username} ${uData.isDev ? '⚡' : ''}</h4>
                <p>${lastMsg}</p>
            </div>
        `;
        dialogsList.appendChild(item);
    });
}

// Рендеринг самих сообщений в окне переписки
function renderMessages() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    if (!activeDialog) {
        chatMessages.innerHTML = `<div class="msg system">Выберите диалог слева для начала общения</div>`;
        return;
    }
    
    // Фильтруем сообщения между currentUser и activeDialog
    const currentChat = messages.filter(m => 
        (m.from === currentUser && m.to === activeDialog) || 
        (m.from === activeDialog && m.to === currentUser)
    );
    
    if(currentChat.length === 0) {
        chatMessages.innerHTML = `<div class="msg system">Чат пуст. Напишите первое сообщение пользователю ${activeDialog}!</div>`;
    }
    
    currentChat.forEach(m => {
        const isOwn = m.from === currentUser;
        const msgClass = isOwn ? 'own' : '';
        
        const div = document.createElement('div');
        div.className = `msg ${msgClass}`;
        div.innerText = m.text;
        chatMessages.appendChild(div);
    });
    
    chatMessages.scrollTop = chatMessages.scrollHeight; // Автоскролл чата вниз
}

// Отправка ЛС
function sendDirectMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !activeDialog) return;
    
    messages.push({
        from: currentUser,
        to: activeDialog,
        text: text
    });
    
    localStorage.setItem('str_messages', JSON.stringify(messages));
    input.value = '';
    renderDialogs();
    renderMessages();
}

document.getElementById('chat-send').addEventListener('click', sendDirectMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendDirectMessage();
});


// --- СОХРАНЕНИЕ НАСТРОЕК ---
const avatarUpload = document.getElementById('avatar-upload');
const saveSettingsBtn = document.getElementById('save-settings-button');

saveSettingsBtn.addEventListener('click', () => {
    const newStatus = document.getElementById('settings-status-input').value.trim();
    const newBirthday = document.getElementById('settings-birthday-input').value.trim();
    const newCity = document.getElementById('settings-city-input').value.trim();
    const newAbout = document.getElementById('settings-about-input').value.trim();
    const devCodeEntered = document.getElementById('settings-dev-code').value.trim();
    const file = avatarUpload.files[0];

    users[currentUser].status = newStatus || "Пользователь платформы СТР";
    users[currentUser].birthday = newBirthday || "Не указан";
    users[currentUser].city = newCity || "Не указан";
    users[currentUser].about = newAbout || "Не указано";

    if (devCodeEntered === SECRET_DEV_CODE) {
        users[currentUser].isDev = true;
    } else {
        users[currentUser].isDev = false;
    }

    if (file) {
        const reader = new FileReader();
        reader.onloadend = function() {
            users[currentUser].avatar = reader.result;
            localStorage.setItem('str_users', JSON.stringify(users));
            loadProfileData();
            renderPosts();
            alert('Все изменения сохранены на СТР!');
        }
        reader.readAsDataURL(file);
    } else {
        localStorage.setItem('str_users', JSON.stringify(users));
        loadProfileData();
        renderPosts();
        alert('Данные профиля обновлены!');
    }
});

// Клик по вкладкам бокового меню
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = item.getAttribute('data-tab');
        
        if (targetTab === 'profile') {
            viewedUser = currentUser; // Сбрасываем просмотр на самого себя
        }
        
        switchTab(targetTab);
        loadProfileData();
        
        if (targetTab === 'messages') {
            renderDialogs();
            renderMessages();
        }
    });
});

checkAuth();