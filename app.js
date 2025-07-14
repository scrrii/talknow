// متغيرات عامة
let currentUser = null;
let currentChatRoom = null;
let chatTimer = null;
let inactivityTimer = null;
let currentRating = 0;
let isMuted = false;

// عناصر DOM
const pages = {
    registration: document.getElementById('registration-page'),
    waiting: document.getElementById('waiting-page'),
    chat: document.getElementById('chat-page'),
    rating: document.getElementById('rating-page')
};

const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const timerDisplay = document.getElementById('timer');

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // إخفاء جميع الصفحات عدا صفحة التسجيل
    showPage('registration');
    
    // التحقق من وجود مستخدم مسجل مسبقاً
    const savedUser = localStorage.getItem('talknow_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showPage('waiting');
        findMatch();
    }
}

function setupEventListeners() {
    // نموذج التسجيل
    document.getElementById('registration-form').addEventListener('submit', handleRegistration);
    
    // أزرار الانتظار
    document.getElementById('cancel-waiting').addEventListener('click', cancelWaiting);
    
    // أزرار المحادثة
    document.getElementById('send-message').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    document.getElementById('end-chat').addEventListener('click', endChat);
    document.getElementById('reveal-identity').addEventListener('click', requestIdentityReveal);
    document.getElementById('add-favorite').addEventListener('click', addToFavorites);
    document.getElementById('mute-chat').addEventListener('click', toggleMute);
    document.getElementById('report-user').addEventListener('click', reportUser);
    
    // أزرار التقييم
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', function() {
            setRating(parseInt(this.dataset.rating));
        });
    });
    
    document.getElementById('want-again-yes').addEventListener('click', () => submitRating(true));
    document.getElementById('want-again-no').addEventListener('click', () => submitRating(false));
    document.getElementById('start-new-chat').addEventListener('click', startNewChat);
    
    // القائمة الجانبية
    menuToggle.addEventListener('click', toggleSidebar);
    document.getElementById('close-sidebar').addEventListener('click', closeSidebar);
    
    // روابط القائمة الجانبية
    document.getElementById('home-link').addEventListener('click', goHome);
    document.getElementById('logout-link').addEventListener('click', logout);
    
    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', function(e) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            closeSidebar();
        }
    });
}

// وظائف التسجيل
function handleRegistration(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        gender: document.getElementById('gender').value,
        age: document.getElementById('age').value || null,
        preferredGender: document.getElementById('preferred-gender').value
    };
    
    // التحقق من صحة البيانات
    if (!formData.name || !formData.email || !formData.gender) {
        showError('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    if (!isValidEmail(formData.email)) {
        showError('يرجى إدخال بريد إلكتروني صحيح');
        return;
    }
    
    registerUser(formData);
}

function registerUser(userData) {
    // إنشاء معرف فريد للمستخدم
    const userId = generateUserId();
    
    currentUser = {
        id: userId,
        ...userData,
        createdAt: new Date().toISOString(),
        isOnline: true
    };
    
    // حفظ المستخدم في Firestore
    db.collection('users').doc(userId).set(currentUser)
        .then(() => {
            // حفظ في التخزين المحلي
            localStorage.setItem('talknow_user', JSON.stringify(currentUser));
            
            showPage('waiting');
            findMatch();
        })
        .catch(error => {
            console.error('خطأ في التسجيل:', error);
            showError('حدث خطأ في التسجيل. يرجى المحاولة مرة أخرى.');
        });
}

// وظائف البحث عن مطابقة
function findMatch() {
    if (!currentUser) return;
    
    // إضافة المستخدم إلى قائمة الانتظار
    const waitingRef = realtimeDb.ref('waiting_queue').push();
    const waitingKey = waitingRef.key;
    
    waitingRef.set({
        userId: currentUser.id,
        gender: currentUser.gender,
        preferredGender: currentUser.preferredGender,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // البحث عن مطابقة
    const queueRef = realtimeDb.ref('waiting_queue');
    queueRef.on('child_added', (snapshot) => {
        const waitingUser = snapshot.val();
        
        if (waitingUser.userId !== currentUser.id && isCompatible(currentUser, waitingUser)) {
            // تم العثور على مطابقة
            createChatRoom(currentUser.id, waitingUser.userId);
            
            // إزالة كلا المستخدمين من قائمة الانتظار
            snapshot.ref.remove();
            waitingRef.remove();
            
            // إيقاف الاستماع
            queueRef.off();
        }
    });
    
    // حفظ مرجع قائمة الانتظار للإلغاء لاحقاً
    currentUser.waitingRef = waitingRef;
}

function isCompatible(user1, user2) {
    // التحقق من التوافق بناءً على تفضيلات الجنس
    const user1Compatible = user1.preferredGender === 'any' || user1.preferredGender === user2.gender;
    const user2Compatible = user2.preferredGender === 'any' || user2.preferredGender === user1.gender;
    
    return user1Compatible && user2Compatible;
}

function createChatRoom(userId1, userId2) {
    const chatRoomId = generateChatRoomId(userId1, userId2);
    
    const chatRoomData = {
        participants: [userId1, userId2],
        createdAt: new Date().toISOString(),
        isActive: true,
        messages: []
    };
    
    // إنشاء غرفة المحادثة في Firestore
    db.collection('chat_rooms').doc(chatRoomId).set(chatRoomData)
        .then(() => {
            currentChatRoom = chatRoomId;
            showPage('chat');
            setupChatListeners();
            startChatTimer();
        })
        .catch(error => {
            console.error('خطأ في إنشاء غرفة المحادثة:', error);
            showError('حدث خطأ في بدء المحادثة');
        });
}

// وظائف المحادثة
function setupChatListeners() {
    if (!currentChatRoom) return;
    
    // الاستماع للرسائل الجديدة
    const messagesRef = realtimeDb.ref(`chat_messages/${currentChatRoom}`);
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
        resetInactivityTimer();
    });
}

function sendMessage() {
    const messageText = messageInput.value.trim();
    
    if (!messageText || !currentChatRoom || isMuted) return;
    
    // التحقق من عدم وجود روابط أو محتوى غير مرغوب
    if (containsInappropriateContent(messageText)) {
        showError('لا يمكن إرسال روابط أو محتوى غير مناسب');
        return;
    }
    
    const message = {
        text: messageText,
        senderId: currentUser.id,
        timestamp: new Date().toISOString(),
        id: generateMessageId()
    };
    
    // إرسال الرسالة إلى Firebase
    realtimeDb.ref(`chat_messages/${currentChatRoom}`).push(message)
        .then(() => {
            messageInput.value = '';
            resetInactivityTimer();
        })
        .catch(error => {
            console.error('خطأ في إرسال الرسالة:', error);
            showError('فشل في إرسال الرسالة');
        });
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUser.id ? 'sent' : 'received'}`;
    messageDiv.textContent = message.text;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startChatTimer() {
    let timeLeft = 3600; // ساعة واحدة بالثواني
    
    chatTimer = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            endChat();
        }
    }, 1000);
    
    resetInactivityTimer();
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    
    inactivityTimer = setTimeout(() => {
        endChat();
    }, 300000); // 5 دقائق
}

function endChat() {
    if (chatTimer) {
        clearInterval(chatTimer);
        chatTimer = null;
    }
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    // إنهاء المحادثة في قاعدة البيانات
    if (currentChatRoom) {
        db.collection('chat_rooms').doc(currentChatRoom).update({
            isActive: false,
            endedAt: new Date().toISOString()
        });
        
        // حذف الرسائل بعد 24 ساعة
        setTimeout(() => {
            realtimeDb.ref(`chat_messages/${currentChatRoom}`).remove();
        }, 86400000); // 24 ساعة
    }
    
    showPage('rating');
}

// وظائف التقييم
function setRating(rating) {
    currentRating = rating;
    
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function submitRating(wantAgain) {
    if (currentRating === 0) {
        showError('يرجى اختيار تقييم أولاً');
        return;
    }
    
    const ratingData = {
        chatRoomId: currentChatRoom,
        raterId: currentUser.id,
        rating: currentRating,
        wantAgain: wantAgain,
        timestamp: new Date().toISOString()
    };
    
    // حفظ التقييم في قاعدة البيانات
    db.collection('ratings').add(ratingData)
        .then(() => {
            currentRating = 0;
            document.querySelectorAll('.star').forEach(star => {
                star.classList.remove('active');
            });
        })
        .catch(error => {
            console.error('خطأ في حفظ التقييم:', error);
        });
}

function startNewChat() {
    currentChatRoom = null;
    chatMessages.innerHTML = '';
    showPage('waiting');
    findMatch();
}

// وظائف إضافية
function requestIdentityReveal() {
    // إرسال طلب كشف الهوية
    showInfo('تم إرسال طلب كشف الهوية. في انتظار موافقة الطرف الآخر.');
}

function addToFavorites() {
    showInfo('تم إضافة هذا الشخص إلى قائمة المفضلين.');
}

function toggleMute() {
    isMuted = !isMuted;
    const muteButton = document.getElementById('mute-chat');
    muteButton.textContent = isMuted ? 'إلغاء الكتم' : 'كتم المحادثة';
    
    if (isMuted) {
        messageInput.disabled = true;
        messageInput.placeholder = 'المحادثة مكتومة مؤقتاً';
    } else {
        messageInput.disabled = false;
        messageInput.placeholder = 'اكتب رسالتك هنا...';
    }
}

function reportUser() {
    if (confirm('هل أنت متأكد من الإبلاغ عن هذا المستخدم؟')) {
        // إرسال تقرير الإساءة
        const reportData = {
            reporterId: currentUser.id,
            chatRoomId: currentChatRoom,
            timestamp: new Date().toISOString(),
            reason: 'inappropriate_behavior'
        };
        
        db.collection('reports').add(reportData)
            .then(() => {
                showInfo('تم الإبلاغ بنجاح. سيتم مراجعة التقرير.');
                endChat();
            })
            .catch(error => {
                console.error('خطأ في الإبلاغ:', error);
            });
    }
}

function cancelWaiting() {
    if (currentUser && currentUser.waitingRef) {
        currentUser.waitingRef.remove();
    }
    showPage('registration');
}

// وظائف القائمة الجانبية
function toggleSidebar() {
    sidebar.classList.toggle('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
}

function goHome() {
    closeSidebar();
    showPage('registration');
}

function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('talknow_user');
        currentUser = null;
        currentChatRoom = null;
        
        if (chatTimer) {
            clearInterval(chatTimer);
            chatTimer = null;
        }
        
        closeSidebar();
        showPage('registration');
    }
}

// وظائف مساعدة
function showPage(pageName) {
    Object.values(pages).forEach(page => {
        page.classList.remove('active');
    });
    
    if (pages[pageName]) {
        pages[pageName].classList.add('active');
    }
}

function showError(message) {
    alert('خطأ: ' + message);
}

function showInfo(message) {
    alert('معلومة: ' + message);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function containsInappropriateContent(text) {
    // التحقق من وجود روابط
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
}

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateChatRoomId(userId1, userId2) {
    const sortedIds = [userId1, userId2].sort();
    return 'chat_' + sortedIds.join('_') + '_' + Date.now();
}

function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// معالجة الأخطاء العامة
window.addEventListener('error', function(e) {
    console.error('خطأ في التطبيق:', e.error);
});

// تنظيف الموارد عند إغلاق الصفحة
window.addEventListener('beforeunload', function() {
    if (currentUser && currentUser.waitingRef) {
        currentUser.waitingRef.remove();
    }
    
    if (currentChatRoom) {
        db.collection('chat_rooms').doc(currentChatRoom).update({
            isActive: false
        });
    }
});