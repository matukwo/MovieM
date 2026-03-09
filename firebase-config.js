import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    doc, 
    getDoc, 
    setDoc, 
    arrayUnion, 
    arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Exportamos todo al objeto window para que pelicula.html pueda usarlo
window.db = db;
window.addDoc = addDoc;
window.collection = collection;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.onSnapshot = onSnapshot;

// --- NUEVAS FUNCIONES PARA LISTAS PERSONALIZADAS ---
window.doc = doc;
window.getDoc = getDoc;
window.setDoc = setDoc;
window.arrayUnion = arrayUnion;
window.arrayRemove = arrayRemove;
