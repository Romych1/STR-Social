// --- КОНФИГУРАЦИЯ FIREBASE ---
// Вставь сюда свои данные из консоли Firebase (Settings -> General -> Your apps)
const firebaseConfig = {
    apiKey: "AIzaSyD-M25IGPV9xi4JDTGR3x8AVmwimN3jvBo",
    authDomain: "romashka-fe066.firebaseapp.com",
    databaseURL: "https://romashka-fe066-default-rtdb.firebaseio.com",
    projectId: "romashka-fe066",
    storageBucket: "romashka-fe066.firebasestorage.app",
    messagingSenderId: "60137958884",
    appId: "1:60137958884:web:60ebd3e589cd9cb84eabf1"

};

// Инициализируем только Realtime Database (Storage нам больше не нужен)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Дефолтная заглушка для аватара (если юзер ещё не загрузил свой)
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2324293e'/><circle cx='50' cy='35' r='20' fill='%237e8494'/><path d='M15,85 Q50,40 85,85 Z' fill='%237e8494'/></svg>";
const SECRET_DEV_CODE = "СТР_ДЕВ";

// Состояние приложения
let currentUser = localStorage.getItem('str_current_user') || null;
let viewedUser = currentUser;  
let activeDialog = null;       

// Локальные копии базы данных для рендеринга
let users = {};
let posts = [];
let messages = [];

// --- ЖИВАЯ СИНХРОНИЗАЦИЯ С ОБЛАКОМ ---
function initFirebaseSync() {
    // 1. Слушаем пользователей
    db.ref('users').on('value', (snapshot) => {
        users = snapshot.val() || {};
        loadProfileData();
        renderDialogs();
    });

    // 2. Слушаем посты (новые всегда будут вверху)
    db.ref('posts').on('value', (snapshot) => {
        posts = [];
        snapshot.forEach((childSnapshot) => {
            posts.unshift({
                key: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        renderPosts();
    });

    // 3. Слушаем сообщения в ЛС
    db.ref('messages').on('value', (snapshot) => {
        messages = [];
        snapshot.forEach((childSnapshot) => {
            messages.push(childSnapshot.val());
        });
        renderMessages();
        renderDialogs();
    });
}

// Проверка авторизации при старте страницы
function checkAuth() {
    if (currentUser) {
        document.getElementById('auth-screen').style.display = 'none';
        viewedUser = currentUser;
        initFirebaseSync(); // Запускаем realtime-слушатели
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
}

// --- СИСТЕМА ВХОДА И РЕГИСТРАЦИИ ---

// Регистрация нового аккаунта
document.getElementById('btn-signup').addEventListener('click', () => {
    const login = document.getElementById('auth-login').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    const authErrors = document.getElementById('auth-errors');
    
    if(login.length < 2 || pass.length < 4) {
        authErrors.innerText = "Логин от 2 симв., пароль от 4 симв.!";
        return;
    }

    db.ref(`users/${login}`).once('value', (snapshot) => {
        if(snapshot.exists()) {
            authErrors.innerText = "Такой никнейм занят!";
        } else {
            const newUser = {
                password: pass,
                status: "Пользователь платформы СТР",
                avatar: DEFAULT_AVATAR,
                birthday: "Не указан",
                city: "Не указан",
                about: "Не указано",
                isDev: false
            };
            db.ref(`users/${login}`).set(newUser).then(() => {
                currentUser = login;
                localStorage.setItem('str_current_user', currentUser);
                authErrors.innerText = "";
                checkAuth();
            });
        }
    });
});

// Вход в существующий аккаунт
document.getElementById('btn-signin').addEventListener('click', () => {
    const login = document.getElementById('auth-login').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    const authErrors = document.getElementById('auth-errors');
    
    db.ref(`users/${login}`).once('value', (snapshot) => {
        const userData = snapshot.val();
        if(!userData || userData.password !== pass) {
            authErrors.innerText = "Неверный логин или пароль!";
            return;
        }
        currentUser = login;
        localStorage.setItem('str_current_user', currentUser);
        authErrors.innerText = "";
        checkAuth();
    });
});

// Выход из профиля
document.getElementById('logout-zone').addEventListener('click', () => {
    if(confirm("Выйти из СТР?")) {
        localStorage.removeItem('str_current_user');
        currentUser = null;
        location.reload();
    }
});

// --- НАВИГАЦИЯ ПО ВКЛАДКАМ ---
function switchTab(tabName) {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.tab-content');
    menuItems.forEach(i => i.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    
    const targetItem = document.querySelector(`.menu-item[data-tab="${tabName}"]`);
    if (targetItem) targetItem.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

window.viewProfile = function(username) {
    if (!users[username]) return;
    viewedUser = username;
    switchTab('profile');
    loadProfileData();
};

// --- ОТОБРАЖЕНИЕ ДАННЫХ ПРОФИЛЯ ---
function loadProfileData() {
    const data = users[viewedUser];
    if (!data) return;
    
    // Заполняем главную карточку профиля
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

    // Если смотрим свой профиль
    if (viewedUser === currentUser) {
        createPostBox.style.display = 'flex';
        // Предзаполняем инпуты в настройках текущими значениями
        document.getElementById('settings-status-input').value = data.status || "";
        document.getElementById('settings-birthday-input').value = data.birthday || "";
        document.getElementById('settings-city-input').value = data.city || "";
        document.getElementById('settings-about-input').value = data.about || "";
        document.getElementById('settings-dev-code').value = data.isDev ? SECRET_DEV_CODE : "";
    } else {
        // Если смотрим чужой профиль
        createPostBox.style.display = 'none';
        actionsZone.innerHTML = `
            <button onclick="openChatWith('${viewedUser}')">Написать ЛС</button>
            <button onclick="viewProfile('${currentUser}')" class="btn-secondary">К себе в профиль</button>
        `;
    }
    
    // Обновляем мини-профиль в верхней шапке сайта
    const myData = users[currentUser];
    if(myData) {
        document.getElementById('nav-user-name').innerText = currentUser;
        document.getElementById('nav-user-avatar').src = myData.avatar || DEFAULT_AVATAR;
        document.getElementById('nav-user-badge').style.display = myData.isDev ? 'inline-block' : 'none';
    }
}

// --- ЛЕНТА ПУБЛИКАЦИЙ (СТЕНА) ---
function renderPosts() {
    const postsFeed = document.getElementById('posts-feed');
    postsFeed.innerHTML = '';
    
    posts.forEach((post) => {
        const authorData = users[post.author];
        const currentAvatar = authorData ? authorData.avatar : DEFAULT_AVATAR;
        
        const likesCount = post.likedBy ? Object.keys(post.likedBy).length : 0;
        const hasLiked = post.likedBy && post.likedBy[currentUser] ? 'active' : '';
        const isAuthorDev = authorData && authorData.isDev ? `<span class="dev-badge mini">DEV</span>` : '';

        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.innerHTML = `
            <div class="post-header">
                <img class="avatar-mini" src="${currentAvatar}" alt="">
                <div>
                    <h4><span class="author-link" onclick="viewProfile('${post.author}')">${post.author}</span> ${isAuthorDev}</h4>
                </div>
            </div>
            <div class="post-content">${post.text}</div>
            <div class="post-actions">
                <button class="like-button ${hasLiked}" onclick="likePost('${post.key}')">🔥 ${likesCount}</button>
            </div>
        `;
        postsFeed.appendChild(postElement);
    });
}

// Создание нового поста
document.getElementById('post-button').addEventListener('click', () => {
    const postInput = document.getElementById('post-input');
    const text = postInput.value.trim();
    if (text === '') return;
    
    db.ref('posts').push({
        author: currentUser,
        text: text,
        timestamp: Date.now()
    }).then(() => {
        postInput.value = '';
    });
});

// Система лайков через Firebase
window.likePost = function(postKey) {
    const likedRef = db.ref(`posts/${postKey}/likedBy/${currentUser}`);
    likedRef.once('value', (snapshot) => {
        if(snapshot.exists()) {
            likedRef.remove(); // Если лайк уже стоял — убираем его
        } else {
            likedRef.set(true); // Если не было — ставим
        }
    });
};

// --- МОДУЛЬ ДИАЛОГОВ И ЛС ---
window.openChatWith = function(username) {
    activeDialog = username;
    switchTab('messages');
    renderDialogs();
    renderMessages();
};

function renderDialogs() {
    const dialogsList = document.getElementById('dialogs-list');
    dialogsList.innerHTML = '';
    
    Object.keys(users).forEach(username => {
        if (username === currentUser) return;
        const uData = users[username];
        const activeClass = (username === activeDialog) ? 'active' : '';
        
        const userMessages = messages.filter(m => 
            (m.from === currentUser && m.to === username) || (m.from === username && m.to === currentUser)
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

function renderMessages() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    if (!activeDialog) {
        chatMessages.innerHTML = `<div class="msg system">Выберите диалог слева для начала общения</div>`;
        return;
    }
    
    const currentChat = messages.filter(m => 
        (m.from === currentUser && m.to === activeDialog) || (m.from === activeDialog && m.to === currentUser)
    );
    
    if(currentChat.length === 0) {
        chatMessages.innerHTML = `<div class="msg system">Чат пуст. Напишите сообщение пользователю ${activeDialog}!</div>`;
    }
    
    currentChat.forEach(m => {
        const div = document.createElement('div');
        div.className = `msg ${m.from === currentUser ? 'own' : ''}`;
        div.innerText = m.text;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight; // Скролл вниз
}

function sendDirectMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !activeDialog) return;
    
    db.ref('messages').push({
        from: currentUser,
        to: activeDialog,
        text: text,
        timestamp: Date.now()
    }).then(() => {
        input.value = '';
    });
}

document.getElementById('chat-send').addEventListener('click', sendDirectMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendDirectMessage();
});

// --- СОХРАНЕНИЕ НАСТРОЕК (КОДИРОВАНИЕ АВАТАРА В BASE64) ---
document.getElementById('save-settings-button').addEventListener('click', () => {
    const newStatus = document.getElementById('settings-status-input').value.trim();
    const newBirthday = document.getElementById('settings-birthday-input').value.trim();
    const newCity = document.getElementById('settings-city-input').value.trim();
    const newAbout = document.getElementById('settings-about-input').value.trim();
    const devCodeEntered = document.getElementById('settings-dev-code').value.trim();
    const file = document.getElementById('avatar-upload').files[0];

    // Базовый объект с текстовыми изменениями
    const updatedData = {
        status: newStatus || "Пользователь платформы СТР",
        birthday: newBirthday || "Не указан",
        city: newCity || "Не указан",
        about: newAbout || "Не указано",
        isDev: (devCodeEntered === SECRET_DEV_CODE)
    };

    // Если загружен новый файл картинки
    if (file) {
        // Ограничение в 500 КБ, чтобы бесплатная база данных не тормозила
        if (file.size > 500 * 1024) { 
            alert('Файл слишком тяжелый! Пожалуйста, сожми картинку или выбери файл до 500 КБ.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = function () {
            // Превращаем картинку в текстовую строку Base64
            updatedData.avatar = reader.result; 

            // Сохраняем всё вместе (и текст, и аватарку) в базу данных
            db.ref(`users/${currentUser}`).update(updatedData).then(() => {
                alert('Профиль и аватарка успешно синхронизированы через облачную БД!');
            }).catch(err => {
                console.error(err);
                alert('Ошибка при сохранении данных в базу.');
            });
        };
        reader.readAsDataURL(file); // Запуск чтения файла устройством
    } else {
        // Если аватарку не меняли, просто обновляем текстовые поля
        db.ref(`users/${currentUser}`).update(updatedData).then(() => {
            alert('Данные профиля успешно обновлены!');
        });
    }
});

// Слушатели для бокового меню навигации
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = item.getAttribute('data-tab');
        if (targetTab === 'profile') viewedUser = currentUser;
        switchTab(targetTab);
        loadProfileData();
    });
});

// Запуск проверки сессии при загрузке страницы
checkAuth();