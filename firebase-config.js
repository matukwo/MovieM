import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, doc, setDoc, getDoc, arrayUnion, arrayRemove, deleteDoc, getDocs, updateDoc, serverTimestamp, writeBatch, limit, increment, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAn5N7m7EhICK2aZG4Nx8DIW9RZd9kK1DA",
    authDomain: "moviem-5b73d.firebaseapp.com",
    projectId: "moviem-5b73d",
    storageBucket: "moviem-5b73d.firebasestorage.app",
    messagingSenderId: "843796138544",
    appId: "1:843796138544:web:c2bde9b39d437b84d97bf5",
    measurementId: "G-7FH2FMPYZT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Firestore
window.db = db;
window.addDoc = addDoc;
window.collection = collection;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.onSnapshot = onSnapshot;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.arrayUnion = arrayUnion;
window.arrayRemove = arrayRemove;
window.deleteDoc = deleteDoc;
window.updateDoc = updateDoc;
window.serverTimestamp = serverTimestamp;
window.writeBatch = writeBatch;
window.limit = limit;
window.increment = increment;
window.deleteField = deleteField;

// Auth
window.auth = auth;
window.onAuthStateChanged = onAuthStateChanged;
