// إعدادات Firebase

// يجب استبدال هذه القيم بالقيم الفعلية من مشروع Firebase الخاص بك
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
const firebaseConfig = {
  apiKey: "AIzaSyDWMLMeT8XS5PU6rYH7JLM9rFI-hDkXR2c",
  authDomain: "talknow-70037.firebaseapp.com",
  projectId: "talknow-70037",
  storageBucket: "talknow-70037.firebasestorage.app",
  messagingSenderId: "973338492116",
  appId: "1:973338492116:web:e127d0bac8478c3f5f8f41",
  measurementId: "G-SEPKG7VER2"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);

// الحصول على مراجع قواعد البيانات
const db = firebase.firestore();
const realtimeDb = firebase.database();
const auth = firebase.auth();

// إعدادات Firestore
db.settings({
    timestampsInSnapshots: true
});

console.log('Firebase initialized successfully');