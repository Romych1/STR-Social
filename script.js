// Твоя база данных Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD-M25IGPV9xi4JDTGR3x8AVmwimN3jvBo",
    authDomain: "romashka-fe066.firebaseapp.com",
    databaseURL: "https://romashka-fe066-default-rtdb.firebaseio.com",
    projectId: "romashka-fe066",
    storageBucket: "romashka-fe066.firebasestorage.app",
    messagingSenderId: "60137958884",
    appId: "1:60137958884:web:60ebd3e589cd9cb84eabf1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231f2937'/><circle cx='50' cy='35' r='20' fill='%234b5563'/><path d='M15,85 Q50,40 85,85 Z' fill='%234b5563'/></svg>";
const SECRET_DEV_CODE = "СТР_ДЕВ";

let currentUser = localStorage.getItem('str_current_user') || null;
let viewedUser = null;  
let activeDialog = null;       

let users = {};
let posts = [];
let messages = [];
let verifyRequests = {};
let userReports = {};
let friendRequests = {};
let lastNotificationTimestamp = Date.now();

// Системные пуши браузера
if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

function sendNativeOSNotification(text) {
    if (window.Notification && Notification.permission === "granted") {
        new Notification("СТР Уведомление", { body: text, tag: "str-social" });
    }
}

// --- СИНХРОНИЗАЦИЯ С FIREBASE ---
function initFirebaseSync() {
    db.ref('users').on('value', (snapshot) => {
        users = snapshot.val() || {};
        renderMyProfile();
        if(viewedUser) renderViewedProfile();
        renderDialogs();
    });

    db.ref('posts').on('value', (snapshot) => {
        posts = [];
        snapshot.forEach((childSnapshot) => {
            posts.unshift({ key: childSnapshot.key, ...childSnapshot.val() });
        });
        renderPosts();
    });

    db.ref('messages').on('value', (snapshot) => {
        messages = [];
        snapshot.forEach((childSnapshot) => {
            messages.push(childSnapshot.val());
        });
        renderMessages();
    });

    db.ref('badge_requests').on('value', (snapshot) => {
        verifyRequests = snapshot.val() || {};
        updateVerificationUI();
        renderAdminRequests();
    });

    db.ref('reports').on('value', (snapshot) => {
        userReports = snapshot.val() || {};
        renderAdminReports();
    });

    // Мониторинг входящих заявок в друзья для текущего юзера
    db.ref(`friend_requests/${currentUser}`).on('value', (snapshot) => {
        friendRequests = snapshot.val() || {};
        if(viewedUser) renderViewedProfile();
    });

    // Слушатель системных уведомлений
    db.ref(`notifications/${currentUser}`).on('value', (snapshot) => {
        const notifies = snapshot.val() || {};
        renderNotificationsUI(notifies);
        
        Object.keys(notifies).forEach(key => {
            const item = notifies[key];
            if (item.timestamp > lastNotificationTimestamp) {
                sendNativeOSNotification(item.text);
                lastNotificationTimestamp = item.timestamp;
            }
        });
    });
}

function checkAuth() {
    if (currentUser) {
        document.getElementById('auth-screen').style.display = 'none';
        initFirebaseSync();
        switchTab('feed');
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
}

// Регистрация (по умолчанию ранг — "beginner")
document.getElementById('btn-signup').addEventListener('click', () => {
    const login = document.getElementById('auth-login').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    const authErrors = document.getElementById('auth-errors');
    
    if(login.length < 2 || pass.length < 4) {
        authErrors.innerText = "Логин от 2 знаков, пароль от 4 знаков!";
        return;
    }

    db.ref(`users/${login}`).once('value', (snapshot) => {
        if(snapshot.exists()) {
            authErrors.innerText = "Этот никнейм уже занят!";
        } else {
            const newUser = {
                password: pass,
                status: "Пользователь СТР",
                avatar: DEFAULT_AVATAR,
                birthday: "Не указан",
                city: "Не указан",
                about: "Не указано",
                isDev: false,
                devRank: "beginner", // Начинающий (белая галочка)
                devBadgeColor: "#00f5d4"
            };
            db.ref(`users/${login}`).set(newUser).then(() => {
                currentUser = login;
                localStorage.setItem('str_current_user', currentUser);
                checkAuth();
            });
        }
    });
});

document.getElementById('btn-signin').addEventListener('click', () => {
    const login = document.getElementById('auth-login').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    const authErrors = document.getElementById('auth-errors');
    
    db.ref(`users/${login}`).once('value', (snapshot) => {
        const userData = snapshot.val();
        if(!userData || userData.password !== pass) {
            authErrors.innerText = "Неверные данные!";
            return;
        }
        currentUser = login;
        localStorage.setItem('str_current_user', currentUser);
        checkAuth();
    });
});

// --- ГЕНЕРАЦИЯ СТИЛИЗОВАННЫХ ГАЛОЧЕК ---
function getBadgesHTML(username) {
    const uData = users[username];
    if (!uData) return '';
    let html = '';
    
    const rank = uData.devRank || "beginner";
    let checkmarkClass = "checkmark-beginner";
    let titleText = "Начинающий разработчик";

    if (rank === "experienced") {
        checkmarkClass = "checkmark-experienced";
        titleText = "Опытный разработчик";
    } else if (rank === "second_dev") {
        checkmarkClass = "checkmark-second-dev";
        titleText = "Второй разработчик";
    }

    // Рендерим SVG иконку галочки
    html += `
        <svg class="str-checkmark ${checkmarkClass}" viewBox="0 0 24 24" title="${titleText}">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
    `;

    if (uData.isDev) {
        const col = uData.devBadgeColor || "#00f5d4";
        html += ` <span class="badge-dev" style="color:${col}; border-color:${col};">DEV</span>`;
    }
    return html;
}

// --- ОТРИСОВКА ДРУЗЕЙ ---
function renderFriendsListUI(username, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const uData = users[username];
    if(!uData || !uData.friends) {
        container.innerHTML = '<p class="label" style="font-size:12px; color:var(--str-text-muted)">Друзей пока нет</p>';
        return;
    }
    Object.keys(uData.friends).forEach(frName => {
        if(uData.friends[frName] === true) {
            const frData = users[frName];
            const av = frData ? frData.avatar : DEFAULT_AVATAR;
            const item = document.createElement('div');
            item.className = 'friend-mini-item';
            item.innerHTML = `<img class="avatar-micro" src="${av}"> <span>${frName}</span>`;
            item.onclick = () => viewProfile(frName);
            container.appendChild(item);
        }
    });
}

function renderMyProfile() {
    const data = users[currentUser];
    if (!data) return;
    
    document.getElementById('my-profile-name').innerText = currentUser;
    document.getElementById('my-profile-badges-zone').innerHTML = getBadgesHTML(currentUser);
    document.getElementById('my-profile-status').innerText = data.status || "";
    document.getElementById('my-profile-birthday').innerText = data.birthday || "Не указан";
    document.getElementById('my-profile-city').innerText = data.city || "Не указан";
    document.getElementById('my-profile-about').innerText = data.about || "Не указано";
    document.getElementById('my-profile-avatar-img').src = data.avatar || DEFAULT_AVATAR;

    renderFriendsListUI(currentUser, 'my-friends-grid');

    if(document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        document.getElementById('settings-status-input').value = data.status || "";
        document.getElementById('settings-birthday-input').value = data.birthday || "";
        document.getElementById('settings-city-input').value = data.city || "";
        document.getElementById('settings-about-input').value = data.about || "";
        document.getElementById('settings-dev-code').value = data.isDev ? SECRET_DEV_CODE : "";
    }

    document.getElementById('nav-user-name').innerText = currentUser;
    document.getElementById('nav-user-avatar').src = data.avatar || DEFAULT_AVATAR;

    document.getElementById('dev-admin-section').style.display = data.isDev ? 'block' : 'none';
}

// --- УПРАВЛЕНИЕ ЗАЯВКАМИ В ДРУЗЬЯ (ПРОСМОТР ЧУЖОГО ПРОФИЛЯ) ---
function renderViewedProfile() {
    const data = users[viewedUser];
    if (!data) return;

    document.getElementById('view-name').innerText = viewedUser;
    document.getElementById('view-badges-zone').innerHTML = getBadgesHTML(viewedUser);
    document.getElementById('view-status').innerText = data.status || "";
    document.getElementById('view-birthday').innerText = data.birthday || "Не указан";
    document.getElementById('view-city').innerText = data.city || "Не указан";
    document.getElementById('view-about').innerText = data.about || "Не указано";
    document.getElementById('view-avatar-img').src = data.avatar || DEFAULT_AVATAR;

    renderFriendsListUI(viewedUser, 'view-friends-grid');

    const myData = users[currentUser];
    
    // Проверяем статусы отношений
    const isAlreadyFriend = myData && myData.friends && myData.friends[viewedUser] === true;
    const hasIncomingRequest = friendRequests && friendRequests[viewedUser] === "pending"; 
    
    // Проверяем, не отправили ли мы уже заявку им
    let hasOutgoingRequest = false;
    if (users[viewedUser] && users[viewedUser].incoming_requests && users[viewedUser].incoming_requests[currentUser] === "pending") {
        hasOutgoingRequest = true;
    }

    let actionsHTML = '';

    if (isAlreadyFriend) {
        actionsHTML = `<button class="str-btn btn-secondary" onclick="removeFriend('${viewedUser}')">Удалить из друзей</button>`;
    } else if (hasIncomingRequest) {
        // Человек отправил нам заявку, выводим КНОПКИ ДЕЙСТВИЯ: Добавить или нет
        actionsHTML = `
            <div class="friend-action-row">
                <button class="str-btn" onclick="acceptFriend('${viewedUser}')">Принять</button>
                <button class="str-btn btn-danger" onclick="declineFriend('${viewedUser}')">Отклонить</button>
            </div>
        `;
    } else if (hasOutgoingRequest) {
        actionsHTML = `<button class="str-btn btn-secondary" disabled>Заявка отправлена...</button>`;
    } else {
        actionsHTML = `<button class="str-btn" onclick="sendFriendRequest('${viewedUser}')">Добавить в друзья</button>`;
    }

    const actionBox = document.getElementById('view-profile-actions');
    actionBox.innerHTML = `
        ${actionsHTML}
        <button class="str-btn btn-secondary" onclick="openChatWith('${viewedUser}')" style="margin-top:6px;">Написать сообщение</button>
        <button class="str-btn btn-danger" onclick="sendReportOnUser('${viewedUser}')" style="margin-top:6px;">Пожаловаться</button>
    `;
}

// 1. Нажатие кнопки "Добавить в друзья" -> создание заявки
window.sendFriendRequest = function(target) {
    db.ref(`friend_requests/${target}/${currentUser}`).set("pending");
    db.ref(`users/${target}/incoming_requests/${currentUser}`).set("pending");
    
    // Отправляем СМС/Уведомление в систему человека
    sendSystemNotification(target, `Пользователь ${currentUser} хочет добавить вас в друзья!`);
    alert("Заявка успешно отправлена пользователю.");
    renderViewedProfile();
};

// 2. Принять заявку
window.acceptFriend = function(target) {
    db.ref(`users/${currentUser}/friends/${target}`).set(true);
    db.ref(`users/${target}/friends/${currentUser}`).set(true);
    
    // Стираем заявки
    db.ref(`friend_requests/${currentUser}/${target}`).remove();
    db.ref(`users/${currentUser}/incoming_requests/${target}`).remove();
    
    sendSystemNotification(target, `Пользователь ${currentUser} принял вашу заявку в друзья! 🎉`);
    alert("Вы успешно добавили пользователя в друзья.");
    renderViewedProfile();
};

// 3. Отклонить заявку
window.declineFriend = function(target) {
    db.ref(`friend_requests/${currentUser}/${target}`).remove();
    db.ref(`users/${currentUser}/incoming_requests/${target}`).remove();
    alert("Заявка отклонена.");
    renderViewedProfile();
};

// 4. Удалить из друзей
window.removeFriend = function(target) {
    if(confirm(`Исключить ${target} из списка друзей?`)) {
        db.ref(`users/${currentUser}/friends/${target}`).remove();
        db.ref(`users/${target}/friends/${currentUser}`).remove();
        alert("Пользователь удален из друзей.");
        renderViewedProfile();
    }
};

// --- ФУНКЦИОНАЛ ПОДАЧИ ЗАЯВЛЕНИЙ НА РАНГИ ---
document.getElementById('btn-request-verify').addEventListener('click', () => {
    const currentRank = users[currentUser].devRank || "beginner";
    if (currentRank !== "beginner") return;
    db.ref(`badge_requests/${currentUser}`).set({ status: "pending", timestamp: Date.now() });
});

function updateVerificationUI() {
    const statusText = document.getElementById('verify-request-status');
    const requestBtn = document.getElementById('btn-request-verify');
    const rank = users[currentUser] ? users[currentUser].devRank : "beginner";
    
    if (rank === "experienced") {
        statusText.innerText = "Ваш текущий статус: Опытный разработчик (Серая галочка)";
        statusText.style.color = "#8a8a93";
        requestBtn.style.display = "none";
    } else if (rank === "second_dev") {
        statusText.innerText = "Ваш текущий статус: Второй разработчик (Черная галочка) 👑";
        statusText.style.color = "var(--str-accent-mint)";
        requestBtn.style.display = "none";
    } else if (verifyRequests[currentUser] && verifyRequests[currentUser].status === "pending") {
        statusText.innerText = "Заявление на ранг 'Опытный' на рассмотрении у DEV.";
        statusText.style.color = "#ffb703";
        requestBtn.style.display = "none";
    } else {
        statusText.innerText = "У вас белая галочка (Начинающий).";
        statusText.style.color = "#ffffff";
        requestBtn.style.display = "inline-block";
    }
}

// Рендер заявок в панели управления
function renderAdminRequests() {
    const container = document.getElementById('dev-requests-list');
    container.innerHTML = '';
    const pendings = Object.keys(verifyRequests).filter(name => verifyRequests[name].status === 'pending');

    if(pendings.length === 0) { container.innerHTML = '<p style="font-size:12px; color:var(--str-text-muted)">Заявлений нет</p>'; return; }
    pendings.forEach(username => {
        const div = document.createElement('div');
        div.className = 'dev-req-item';
        div.innerHTML = `
            <span>Никнейм: <b>${username}</b></span>
            <div>
                <button class="str-btn mini-btn" onclick="processRankApplication('${username}', true)">Одобрить Опытного</button>
                <button class="str-btn mini-btn btn-danger" onclick="processRankApplication('${username}', false)">Х</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.processRankApplication = function(targetUser, isApproved) {
    if (isApproved) {
        db.ref(`users/${targetUser}`).update({ devRank: "experienced" });
        sendSystemNotification(targetUser, "Ваше заявление одобрено! Вам присвоен статус: Опытный разработчик (Серая галочка)");
    }
    db.ref(`badge_requests/${targetUser}`).remove();
};

// Назначение Второго разработчика (Черная галочка) вручную из админки
document.getElementById('btn-grant-second-dev').addEventListener('click', () => {
    const nameInput = document.getElementById('input-second-dev-name');
    const username = nameInput.value.trim();
    if(!username) return;

    db.ref(`users/${username}`).once('value', (snapshot) => {
        if(snapshot.exists()) {
            db.ref(`users/${username}`).update({ devRank: "second_dev" });
            sendSystemNotification(username, "Вам вручен высший статус ранга: Второй разработчик (Черная галочка)!");
            alert(`Пользователю ${username} успешно выдана черная галочка.`);
            nameInput.value = '';
        } else {
            alert("Пользователь не найден в базе данных СТР.");
        }
    });
});

// --- СИСТЕМНЫЕ УВЕДОМЛЕНИЯ ВНУТРИ СТРАНИЦЫ ---
function sendSystemNotification(targetUser, textMessage) {
    db.ref(`notifications/${targetUser}`).push({ text: textMessage, timestamp: Date.now() });
}

function renderNotificationsUI(notifies) {
    const container = document.getElementById('notifications-list');
    const countBadgePc = document.getElementById('notify-count-badge');
    const countBadgeMob = document.getElementById('notify-count-mob');
    
    container.innerHTML = '';
    const keys = Object.keys(notifies);
    const total = keys.length;

    if(total > 0) {
        countBadgePc.innerText = total; countBadgePc.style.display = 'inline-block';
        countBadgeMob.innerText = total; countBadgeMob.style.display = 'block';
    } else {
        countBadgePc.style.display = 'none'; countBadgeMob.style.display = 'none';
        container.innerHTML = '<p class="label" style="font-size:13px; color:var(--str-text-muted)">Новых уведомлений нет.</p>';
        return;
    }

    keys.reverse().forEach(key => {
        const item = notifies[key];
        const div = document.createElement('div');
        div.className = 'notification-item';
        div.innerHTML = `
            <span>${item.text}</span>
            <span class="notification-time">${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        `;
        container.appendChild(div);
    });
}

document.getElementById('btn-clear-notifications').addEventListener('click', () => { db.ref(`notifications/${currentUser}`).remove(); });

// --- ОСТАЛЬНОЙ ФУНКЦИОНАЛ СТР (ПОСТЫ, ЧАТЫ, НАСТРОЙКИ) ---
function renderPosts() {
    const feed = document.getElementById('posts-feed');
    feed.innerHTML = '';
    const isMeDev = users[currentUser] ? users[currentUser].isDev : false;

    posts.forEach((post) => {
        const authorData = users[post.author];
        const avatar = authorData ? authorData.avatar : DEFAULT_AVATAR;
        const likesCount = post.likedBy ? Object.keys(post.likedBy).length : 0;
        const hasLiked = post.likedBy && post.likedBy[currentUser] ? 'active' : '';

        let deleteButtonHTML = '';
        if(post.author === currentUser || isMeDev) {
            deleteButtonHTML = `<button class="str-btn mini-btn btn-danger" onclick="deletePost('${post.key}')">Удалить</button>`;
        }

        const postBox = document.createElement('div');
        postBox.className = 'post';
        postBox.innerHTML = `
            <div class="post-header">
                <div class="author-info-block">
                    <img class="avatar-mini" src="${avatar}">
                    <div class="post-meta-line">
                        <span class="author-name" onclick="viewProfile('${post.author}')">${post.author}</span>
                        ${getBadgesHTML(post.author)}
                    </div>
                </div>
                ${deleteButtonHTML}
            </div>
            <div class="post-content">${post.text}</div>
            <div class="post-footer-actions">
                <button class="like-button ${hasLiked}" onclick="likePost('${post.key}', '${post.author}')">Лайк ${likesCount}</button>
            </div>
        `;
        feed.appendChild(postBox);
    });
}

document.getElementById('post-button').addEventListener('click', () => {
    const input = document.getElementById('post-input');
    const text = input.value.trim();
    if (text === '') return;
    db.ref('posts').push({ author: currentUser, text: text, timestamp: Date.now() });
    input.value = '';
});

window.deletePost = function(key) { if(confirm("Удалить пост?")) db.ref(`posts/${key}`).remove(); };
window.likePost = function(key, author) {
    const r = db.ref(`posts/${key}/likedBy/${currentUser}`);
    r.once('value', snapshot => {
        if(snapshot.exists()) r.remove();
        else { r.set(true); if(author !== currentUser) sendSystemNotification(author, `Пользователю ${currentUser} понравился ваш пост!`); }
    });
};

document.getElementById('save-settings-button').addEventListener('click', () => {
    const updatedData = {
        status: document.getElementById('settings-status-input').value.trim() || "Пользователь СТР",
        birthday: document.getElementById('settings-birthday-input').value.trim() || "Не указан",
        city: document.getElementById('settings-city-input').value.trim() || "Не указан",
        about: document.getElementById('settings-about-input').value.trim() || "Не указано",
        isDev: (document.getElementById('settings-dev-code').value.trim() === SECRET_DEV_CODE)
    };
    const file = document.getElementById('avatar-upload').files[0];
    if (file) {
        const r = new FileReader();
        r.onloadend = () => { updatedData.avatar = r.result; db.ref(`users/${currentUser}`).update(updatedData).then(() => alert('Успешно!')); };
        r.readAsDataURL(file);
    } else {
        db.ref(`users/${currentUser}`).update(updatedData).then(() => alert('Данные сохранены в базе СТР.'));
    }
});

window.sendReportOnUser = function(target) {
    const reason = prompt("Причина жалобы:");
    if(reason) db.ref('reports').push({ reporter: currentUser, reportedUser: target, reason: reason, timestamp: Date.now() });
};

function renderAdminReports() {
    const container = document.getElementById('dev-reports-list'); container.innerHTML = '';
    Object.keys(userReports).forEach(k => {
        const r = userReports[k];
        container.innerHTML += `<div class="dev-req-item"><span><b>${r.reporter}</b> на <b>${r.reportedUser}</b>: ${r.reason}</span><button class="str-btn mini-btn btn-danger" onclick="closeReport('${k}')">Ок</button></div>`;
    });
}
window.closeReport = function(k) { db.ref(`reports/${k}`).remove(); };
document.getElementById('btn-save-badge-color').addEventListener('click', () => { db.ref(`users/${currentUser}`).update({ devBadgeColor: document.getElementById('dev-badge-color-picker').value }); });

window.openChatWith = function(username) { activeDialog = username; switchTab('messages'); document.getElementById('chat-header-title').innerText = `Чат с ${username}`; renderDialogs(); renderMessages(); };
function renderDialogs() {
    const list = document.getElementById('dialogs-list'); list.innerHTML = '';
    Object.keys(users).forEach(u => {
        if (u === currentUser) return;
        list.innerHTML += `<div class="dialog-item ${u === activeDialog ? 'active' : ''}" onclick="openChatWith('${u}')"><img class="avatar-micro" src="${users[u].avatar || DEFAULT_AVATAR}"><span>${u}</span></div>`;
    });
}
function renderMessages() {
    const box = document.getElementById('chat-messages'); box.innerHTML = ''; if (!activeDialog) return;
    messages.filter(m => (m.from === currentUser && m.to === activeDialog) || (m.from === activeDialog && m.to === currentUser)).forEach(m => {
        box.innerHTML += `<div class="msg ${m.from === currentUser ? 'own' : ''}">${m.text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
}
document.getElementById('chat-send').addEventListener('click', () => {
    const i = document.getElementById('chat-input'); if(!i.value.trim()) return;
    db.ref('messages').push({ from: currentUser, to: activeDialog, text: i.value.trim(), timestamp: Date.now() });
    sendSystemNotification(activeDialog, `Вам пришло новое сообщение от ${currentUser}`);
    i.value = '';
});

function switchTab(t) {
    document.querySelectorAll('.menu-item, .nav-item, .tab-content').forEach(el => el.classList.remove('active'));
    const p = document.querySelector(`.menu-item[data-tab="${t}"]`), m = document.querySelector(`.nav-item[data-tab="${t}"]`), target = document.getElementById(`tab-${t}`);
    if(p) p.classList.add('active'); if(m) m.classList.add('active'); if(target) target.classList.add('active');
}
document.querySelectorAll('.menu-item, .nav-item').forEach(item => item.addEventListener('click', (e) => { e.preventDefault(); switchTab(item.getAttribute('data-tab')); }));
window.viewProfile = function(u) { if(u===currentUser){ switchTab('profile'); } else { viewedUser=u; switchTab('view-profile'); renderViewedProfile(); } };
document.getElementById('global-search').addEventListener('keypress', e => { if(e.key==='Enter' && users[e.target.value.trim()]) { viewProfile(e.target.value.trim()); e.target.value=''; } });

checkAuth();