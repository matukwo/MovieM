// notif-chat.js — MovieM · Chat + Notificaciones
// Se carga como <script type="module" src="notif-chat.js">
// Expone funciones en window._mm* para uso desde scripts normales

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs,
    query, where, orderBy, onSnapshot, updateDoc, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Firebase (reutiliza instancia existente si ya fue creada) ──────────
const FB_CFG = {
    apiKey: "AIzaSyAn5N7m7EhICK2aZG4Nx8DIW9RZd9kK1DA",
    authDomain: "moviem-5b73d.firebaseapp.com",
    projectId: "moviem-5b73d",
    storageBucket: "moviem-5b73d.firebasestorage.app",
    messagingSenderId: "843796138544",
    appId: "1:843796138544:web:c2bde9b39d437b84d97bf5"
};
const app  = getApps().length ? getApps()[0] : initializeApp(FB_CFG);
const db   = getFirestore(app);
const auth = getAuth(app);
const ADMIN = '41XWZR8OzwdpMHf54UIQEzAEt7s1';

// ── Estado ────────────────────────────────────────────────────────────
let miUID = null, miUser = null, miAv = null;
let unsubN = null, unsubL = null, unsubM = null;
let chatUID = null, chatNom = null;

// ── Helpers ───────────────────────────────────────────────────────────
const cid = (a, b) => [a, b].sort().join('_');

function ago(ts) {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const s = Math.floor((Date.now() - d) / 1000);
        if (s < 60) return 'ahora';
        if (s < 3600) return Math.floor(s / 60) + 'm';
        if (s < 86400) return Math.floor(s / 3600) + 'h';
        return Math.floor(s / 86400) + 'd';
    } catch (e) { return ''; }
}

function esc(t) {
    return String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function avEl(src, nombre, sz) {
    sz = sz || 36;
    const l = (nombre || 'U')[0].toUpperCase();
    const c = (getComputedStyle(document.documentElement).getPropertyValue('--accent-color')
            || getComputedStyle(document.documentElement).getPropertyValue('--accent')
            || '#dc2626').trim();
    if (src && src !== 'null' && src !== '')
        return `<img src="${src}" style="width:${sz}px;height:${sz}px;border-radius:50%;object-fit:cover;flex-shrink:0">`;
    return `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.round(sz*.38)}px;color:#fff;flex-shrink:0">${l}</div>`;
}

// ── UI: inyectar panel una sola vez ───────────────────────────────────
let uiOk = false;
function inyectar() {
    if (uiOk) return;
    uiOk = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #mmP{position:fixed;top:0;right:0;bottom:0;width:360px;max-width:100vw;
         background:#0d0d0d;border-left:1px solid rgba(255,255,255,.07);
         z-index:99999;transform:translateX(110%);
         transition:transform .28s cubic-bezier(.4,0,.2,1);
         display:flex;flex-direction:column;font-family:inherit}
    #mmP.on{transform:translateX(0)}
    #mmOv{position:fixed;inset:0;z-index:99998;background:transparent;
          pointer-events:none;transition:background .28s}
    #mmOv.on{background:rgba(0,0,0,.6);pointer-events:all}
    .mmt{flex:1;padding:9px 0;border:none;background:none;cursor:pointer;
         font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;
         color:#71717a;border-radius:8px;display:flex;align-items:center;
         justify-content:center;gap:5px;transition:all .18s;font-family:inherit}
    .mmt.on{background:rgba(255,255,255,.07);color:#fff}
    .mmni{display:flex;align-items:flex-start;gap:10px;padding:11px 16px;
          cursor:pointer;border-left:2px solid transparent;transition:background .15s}
    .mmni:hover{background:rgba(255,255,255,.04)}
    .mmni.unread{border-left-color:var(--accent-color,#dc2626)}
    .mmci{display:flex;align-items:center;gap:10px;padding:11px 16px;
          cursor:pointer;transition:background .15s}
    .mmci:hover{background:rgba(255,255,255,.04)}
    .mmb{max-width:75%;padding:8px 13px;border-radius:18px;font-size:13px;
         line-height:1.45;word-break:break-word}
    .mmb.yo{background:var(--accent-color,#dc2626);color:#fff;
            border-bottom-right-radius:4px;margin-left:auto}
    .mmb.el{background:rgba(255,255,255,.08);color:#e4e4e7;border-bottom-left-radius:4px}
    .mmsc{overflow-y:auto}
    .mmsc::-webkit-scrollbar{width:3px}
    .mmsc::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:9px}
    @media(max-width:500px){#mmP{width:100vw}}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="mmOv"></div>
    <div id="mmP">
      <div style="padding:14px 14px 0;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.18em;color:#52525b">MovieM</span>
          <button id="mm-x" style="color:#52525b;background:none;border:none;cursor:pointer;padding:4px;line-height:0">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style="display:flex;gap:3px">
          <button id="mm-tn" class="mmt on">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            Notificaciones
          </button>
          <button id="mm-tc" class="mmt">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Mensajes
          </button>
        </div>
      </div>

      <div id="mm-vn" class="mmsc" style="flex:1;display:flex;flex-direction:column">
        <div id="mm-ln"></div></div>
      <div id="mm-vl" class="mmsc" style="flex:1;display:none;flex-direction:column">
        <div id="mm-ll"></div></div>

      <div id="mm-vc" style="flex:1;display:none;flex-direction:column;overflow:hidden">
        <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px;flex-shrink:0">
          <button id="mm-bk" style="color:#71717a;background:none;border:none;cursor:pointer;padding:2px;line-height:0">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div id="mm-hav"></div>
          <p id="mm-hn" style="flex:1;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></p>
          <a id="mm-hl" href="#" style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#52525b;text-decoration:none">Perfil</a>
        </div>
        <div id="mm-msgs" class="mmsc" style="flex:1;padding:14px 12px;display:flex;flex-direction:column;gap:5px"></div>
        <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:8px;flex-shrink:0;background:#0d0d0d">
          <input id="mm-in" type="text" placeholder="Escribí un mensaje..."
            style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 13px;font-size:13px;color:#fff;outline:none;font-family:inherit"
            onfocus="this.style.borderColor='var(--accent-color,#dc2626)'"
            onblur="this.style.borderColor='rgba(255,255,255,.1)'">
          <button id="mm-send" style="background:var(--accent-color,#dc2626);border:none;border-radius:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
            <svg width="15" height="15" fill="none" stroke="#fff" viewBox="0 0 24 24"><path stroke-width="2.5" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>`);

    // Listeners — todos con addEventListener, NUNCA onclick inline en módulos
    document.getElementById('mm-x').addEventListener('click', cerrar);
    document.getElementById('mmOv').addEventListener('click', cerrar);
    document.getElementById('mm-tn').addEventListener('click', () => tab('n'));
    document.getElementById('mm-tc').addEventListener('click', () => tab('c'));
    document.getElementById('mm-bk').addEventListener('click', volverLista);
    document.getElementById('mm-send').addEventListener('click', enviar);
    document.getElementById('mm-in').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); enviar(); }
    });
}

// ── Panel open/close/tab ──────────────────────────────────────────────
function abrir(t) {
    if (!miUID) return;
    inyectar();
    document.getElementById('mmP').classList.add('on');
    document.getElementById('mmOv').classList.add('on');
    tab(t || 'n');
}

function cerrar() {
    document.getElementById('mmP')?.classList.remove('on');
    document.getElementById('mmOv')?.classList.remove('on');
    if (unsubM) { unsubM(); unsubM = null; }
}

function tab(t) {
    inyectar();
    document.getElementById('mm-vn').style.display = 'none';
    document.getElementById('mm-vl').style.display = 'none';
    document.getElementById('mm-vc').style.display = 'none';
    document.getElementById('mm-tn').classList.toggle('on', t === 'n');
    document.getElementById('mm-tc').classList.toggle('on', t === 'c');
    if (t === 'n') { document.getElementById('mm-vn').style.display = 'flex'; cargarNotifs(); }
    else           { document.getElementById('mm-vl').style.display = 'flex'; cargarChats(); }
}

function volverLista() {
    if (unsubM) { unsubM(); unsubM = null; }
    chatUID = null;
    document.getElementById('mm-vc').style.display = 'none';
    document.getElementById('mm-vl').style.display = 'flex';
    cargarChats();
}

// ── Badge ─────────────────────────────────────────────────────────────
function setBadge(n) {
    // Actualiza todos los badges con id bellBadge o clase mmBadge
    ['bellBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = n > 9 ? '9+' : n;
        el.style.display = n > 0 ? 'flex' : 'none';
    });
    document.querySelectorAll('.mm-badge').forEach(el => {
        el.textContent = n > 9 ? '9+' : n;
        el.style.display = n > 0 ? 'flex' : 'none';
    });
}

// ── Notificaciones ────────────────────────────────────────────────────
function escucharNotifs() {
    if (unsubN) unsubN();
    const q = query(collection(db,'notificaciones',miUID,'items'), orderBy('fecha','desc'), limit(50));
    unsubN = onSnapshot(q, snap => {
        let n = 0; snap.forEach(d => { if (!d.data().leida) n++; });
        setBadge(n);
    });
}

async function cargarNotifs() {
    const el = document.getElementById('mm-ln');
    el.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic">Cargando...</p>';
    try {
        const q = query(collection(db,'notificaciones',miUID,'items'), orderBy('fecha','desc'), limit(40));
        const snap = await getDocs(q);
        snap.forEach(async d => {
            if (!d.data().leida) { try { await updateDoc(d.ref, {leida:true}); } catch(e){} }
        });
        setBadge(0);
        if (snap.empty) { el.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic">Sin notificaciones.</p>'; return; }
        el.innerHTML = '';
        snap.forEach(d => {
            const n = d.data();
            const div = document.createElement('div');
            div.className = 'mmni' + (n.leida ? '' : ' unread');
            let ico = '';
            let texto = '';
            if (n.tipo === 'mensaje') {
                ico = avEl(n.deAvatar, n.deUsername, 38);
                texto = `<strong>${esc(n.deUsername)}</strong> te envió un mensaje`;
            } else if (n.tipo === 'seguidor') {
                ico = avEl(n.deAvatar, n.deUsername, 38);
                texto = `<strong>${esc(n.deUsername)}</strong> empezó a seguirte`;
            } else {
                ico = `<div style="width:38px;height:38px;border-radius:50%;background:var(--accent-color,#dc2626);display:flex;align-items:center;justify-content:center;flex-shrink:0">📢</div>`;
                texto = esc(n.texto || '');
            }
            div.innerHTML = ico + `<div style="flex:1;min-width:0">
                <p style="font-size:12px;font-weight:700;color:#e4e4e7;line-height:1.4">${texto}</p>
                <p style="font-size:10px;color:#52525b;margin-top:2px">${ago(n.fecha)}</p>
            </div>`;
            if (n.tipo === 'seguidor') div.addEventListener('click', () => location.href = 'perfil.html?user=' + encodeURIComponent(n.deUsername));
            if (n.tipo === 'mensaje')  div.addEventListener('click', () => { tab('c'); abrirChat(n.de, n.deUsername, n.deAvatar||''); });
            el.appendChild(div);
        });
    } catch(e) {
        el.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0">Error al cargar.</p>';
        console.error('cargarNotifs', e);
    }
}

async function crearNotif(para, tipo, datos) {
    try {
        await addDoc(collection(db,'notificaciones',para,'items'), {
            tipo, leida: false, fecha: serverTimestamp(), ...datos
        });
    } catch(e) { console.warn('crearNotif', e); }
}

// ── Lista chats ───────────────────────────────────────────────────────
function cargarChats() {
    const el = document.getElementById('mm-ll');
    el.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic">Cargando...</p>';
    if (unsubL) { unsubL(); unsubL = null; }
    const q = query(collection(db,'chats'), where('participantes','array-contains',miUID), limit(30));
    unsubL = onSnapshot(q, snap => {
        if (snap.empty) { el.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 16px;font-style:italic">Sin conversaciones.<br><span style="font-size:10px">Visitá un perfil → Mensaje.</span></p>'; return; }
        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
            const fa = a.ultimaFecha?.toMillis?.() || a.ultimaFecha || 0;
            const fb = b.ultimaFecha?.toMillis?.() || b.ultimaFecha || 0;
            return fb - fa;
        });
        el.innerHTML = '';
        docs.forEach(c => {
            const otro = (c.participantes||[]).find(u => u !== miUID) || '';
            const nom  = (c.usernames||{})[otro] || 'Usuario';
            const src  = (c.avatars||{})[otro] || '';
            const nl   = (c.noLeidos||{})[miUID] || 0;
            const div  = document.createElement('div');
            div.className = 'mmci';
            div.style.borderBottom = '1px solid rgba(255,255,255,.04)';
            div.innerHTML = `
                <div style="position:relative;flex-shrink:0">
                    ${avEl(src, nom, 42)}
                    ${nl > 0 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:var(--accent-color,#dc2626);color:#fff;font-size:8px;font-weight:900;border-radius:999px;min-width:15px;height:15px;display:flex;align-items:center;justify-content:center;padding:0 3px">${nl}</span>` : ''}
                </div>
                <div style="flex:1;min-width:0;margin-left:10px">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px">
                        <p style="font-size:12px;font-weight:${nl>0?900:700};color:${nl>0?'#fff':'#a1a1aa'};text-transform:uppercase;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nom)}</p>
                        <span style="font-size:9px;color:#3f3f46;flex-shrink:0">${ago(c.ultimaFecha)}</span>
                    </div>
                    <p style="font-size:11px;color:${nl>0?'#a1a1aa':'#52525b'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${esc(c.ultimoMensaje||'')}</p>
                </div>`;
            div.addEventListener('click', () => abrirChat(otro, nom, src));
            el.appendChild(div);
        });
    }, err => { el.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0">Error: ' + (err.code||err.message) + '</p>'; console.error(err); });
}

// ── Abrir chat ────────────────────────────────────────────────────────
async function abrirChat(oUID, oNom, oAv) {
    if (!miUID) return;
    inyectar();
    chatUID = oUID; chatNom = oNom;

    document.getElementById('mmP').classList.add('on');
    document.getElementById('mmOv').classList.add('on');
    document.getElementById('mm-vn').style.display = 'none';
    document.getElementById('mm-vl').style.display = 'none';
    document.getElementById('mm-vc').style.display = 'flex';
    document.getElementById('mm-tn').classList.remove('on');
    document.getElementById('mm-tc').classList.add('on');
    document.getElementById('mm-hav').innerHTML = avEl(oAv, oNom, 30);
    document.getElementById('mm-hn').textContent = oNom;
    document.getElementById('mm-hl').href = 'perfil.html?user=' + encodeURIComponent(oNom);

    const id = cid(miUID, oUID);

    try {
        const ref = doc(db,'chats',id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, {
                participantes: [miUID, oUID],
                usernames: { [miUID]: miUser, [oUID]: oNom },
                avatars:   { [miUID]: miAv||null, [oUID]: oAv||null },
                noLeidos:  { [miUID]: 0, [oUID]: 0 },
                ultimoMensaje: '',
                ultimaFecha: serverTimestamp()
            });
        } else {
            const upd = {}; upd[`noLeidos.${miUID}`] = 0;
            await updateDoc(ref, upd);
        }
    } catch(e) { console.error('abrirChat doc', e); }

    if (unsubM) { unsubM(); unsubM = null; }
    const msgs = document.getElementById('mm-msgs');
    msgs.innerHTML = '';

    const q = query(collection(db,'chats',id,'mensajes'), orderBy('fecha','asc'), limit(100));
    unsubM = onSnapshot(q, snap => {
        msgs.innerHTML = '';
        snap.forEach(d => {
            const m = d.data(), yo = m.de === miUID;
            const w = document.createElement('div');
            w.style.cssText = `display:flex;flex-direction:column;align-items:${yo?'flex-end':'flex-start'}`;
            w.innerHTML = `<div class="mmb ${yo?'yo':'el'}">${esc(m.texto)}</div>
                           <span style="font-size:9px;color:#3f3f46;margin-top:2px;padding:0 3px">${ago(m.fecha)}</span>`;
            msgs.appendChild(w);
        });
        msgs.scrollTop = msgs.scrollHeight;
    });

    setTimeout(() => document.getElementById('mm-in')?.focus(), 100);
}

// ── Enviar mensaje ────────────────────────────────────────────────────
async function enviar() {
    const inp = document.getElementById('mm-in');
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt || !miUID || !chatUID) return;
    inp.value = '';
    inp.focus();

    const id = cid(miUID, chatUID);
    try {
        await addDoc(collection(db,'chats',id,'mensajes'), {
            de: miUID, texto: txt, fecha: serverTimestamp()
        });
        let nl = 0;
        try {
            const s = await getDoc(doc(db,'chats',id));
            nl = (s.data()?.noLeidos || {})[chatUID] || 0;
        } catch(e){}
        const upd = { ultimoMensaje: txt.slice(0,50), ultimaFecha: serverTimestamp() };
        upd[`noLeidos.${chatUID}`] = nl + 1;
        upd[`noLeidos.${miUID}`] = 0;
        await updateDoc(doc(db,'chats',id), upd);
        crearNotif(chatUID, 'mensaje', {
            de: miUID, deUsername: miUser, deAvatar: miAv||null,
            texto: `${miUser}: ${txt.slice(0,40)}${txt.length>40?'...':''}`
        });
    } catch(e) {
        console.error('enviar error', e);
        inp.value = txt;
    }
}

// ── Admin anuncio ─────────────────────────────────────────────────────
async function anuncio() {
    if (miUID !== ADMIN) return;
    const txt = prompt('📢 Mensaje para todos los usuarios:');
    if (!txt?.trim()) return;
    try {
        const snap = await getDocs(collection(db,'usuarios'));
        await Promise.all(snap.docs.filter(d => d.id !== miUID).map(d =>
            crearNotif(d.id, 'anuncio', { texto: '📢 ' + txt.trim() })
        ));
        alert(`Anuncio enviado a ${snap.docs.length - 1} usuarios ✓`);
    } catch(e) { alert('Error: ' + e.message); }
}

// ── Exponer en window para scripts no-módulo ──────────────────────────
window._mmAbrir    = abrir;
window._mmCerrar   = cerrar;
window._mmAbrirChat = abrirChat;
window._mmAnuncio  = anuncio;

// ── Init: escuchar auth ───────────────────────────────────────────────
inyectar();

onAuthStateChanged(auth, async user => {
    if (!user) return;
    miUID = user.uid;
    try {
        const snap = await getDoc(doc(db,'usuarios',miUID));
        miUser = snap.exists() ? (snap.data().username || user.email.split('@')[0]) : user.email.split('@')[0];
        miAv   = snap.exists() ? (snap.data().avatar || null) : null;
    } catch(e) { miUser = user.email.split('@')[0]; }

    // Señal para el script poller de perfil.html
    window._mmReady = true;

    escucharNotifs();
});
