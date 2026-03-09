import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Reemplaza estos datos con los de tu Consola de Firebase -> Configuración del proyecto
  const firebaseConfig = {
    apiKey: "AIzaSyAn5N7m7EhICK2aZG4Nx8DIW9RZd9kK1DA",
    authDomain: "moviem-5b73d.firebaseapp.com",
    projectId: "moviem-5b73d",
    storageBucket: "moviem-5b73d.firebasestorage.app",
    messagingSenderId: "843796138544",
    appId: "1:843796138544:web:c2bde9b39d437b84d97bf5",
    measurementId: "G-7FH2FMPYZT"
  };

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Compartimos las funciones con el resto de tus archivos (pelicula.html)
window.db = db;
window.addDoc = addDoc;
window.collection = collection;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.onSnapshot = onSnapshot;
