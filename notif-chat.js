// ══════════════════════════════════════════════════════════
//  MovieM — Sistema de Notificaciones + Chat en Tiempo Real
//  Requiere: firebase-config.js cargado antes
// ══════════════════════════════════════════════════════════

import {
    initializeApp, getApps
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs,
    query, where, orderBy, onSnapshot, updateDoc, serverTimestamp,
    limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Reutilizar instancia Firebase ya iniciada ─────────────
const FB_CONFIG = {
    apiKey: "AIzaSyAn5N7m7EhICK2aZG4Nx8DIW9RZd9kK1DA",
    authDomain: "moviem-5b73d.firebaseapp.com",
    projectId: "moviem-5b73d",
    storageBucket: "moviem-5b73d.firebasestorage.app",
    messagingSenderId: "843796138544",
    appId: "1:843796138544:web:c2bde9b39d437b84d97bf5"
};
const app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
const db  = getFirestore(app);
const auth = getAuth(app);

const ADMIN_UID = '41XWZR8OzwdpMHf54UIQEzAEt7s1';

// ─────────────────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────────────────
let miUID = null, miUsername = null, miAvatar = null;
let notifUnsub = null, chatListUnsub = null, chatMsgUnsub = null;
let chatAbiertoConUID = null, chatAbiertoConUsername = null;
let notifNoLeidas = 0;

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────
function chatId(a, b) { return [a, b].sort().join('_'); }

function timeAgo(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return 'ahora';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
}

function avatarHTML(avatar, username, size = 'w-9 h-9', text = 'text-xs') {
    const letra = (username || 'U').charAt(0).toUpperCase();
    if (avatar) return `<img src="${avatar}" class="${size} rounded-full object-cover shrink-0 border border-white/10">`;
    return `<div class="${size} rounded-full shrink-0 flex items-center justify-center font-black ${text} text-white border border-white/10" style="background-color:var(--accent-color,var(--accent,#dc2626))">${letra}</div>`;
}

// ─────────────────────────────────────────────────────────
//  NOTIFICACIONES — escritura
// ─────────────────────────────────────────────────────────
export async function crearNotif(paraUID, tipo, datos) {
    // tipo: 'seguidor' | 'mensaje' | 'anuncio'
    try {
        await addDoc(collection(db, 'notificaciones', paraUID, 'items'), {
            tipo,
            leida: false,
            fecha: serverTimestamp(),
            ...datos
        });
    } catch(e) { console.warn('crearNotif error', e); }
}

// Helper público para que perfil.html lo use al hacer toggleSeguir
window.notifNuevoSeguidor = async function(paraUID, deUsername, deAvatar) {
    await crearNotif(paraUID, 'seguidor', {
        de: miUID,
        deUsername,
        deAvatar: deAvatar || null,
        texto: `${deUsername} empezó a seguirte`
    });
};

// ─────────────────────────────────────────────────────────
//  INJECT UI — Campanita + Panel lateral
// ─────────────────────────────────────────────────────────
function injectUI() {
    if (document.getElementById('mmChatPanel')) return; // ya inyectado

    const css = `
    <style id="mmChatCSS">
    :root { --accent-color: #dc2626; --accent: #dc2626; }
    #mmSidePanel {
        position: fixed; top: 0; right: 0; bottom: 0; width: 380px; max-width: 100vw;
        background: #0a0a0a; border-left: 1px solid rgba(255,255,255,0.07);
        z-index: 9000; transform: translateX(100%);
        transition: transform .32s cubic-bezier(.4,0,.2,1);
        display: flex; flex-direction: column; overflow: hidden;
    }
    #mmSidePanel.open { transform: translateX(0); }
    #mmOverlay {
        position: fixed; inset: 0; z-index: 8999;
        background: rgba(0,0,0,0); pointer-events: none;
        transition: background .32s;
    }
    #mmOverlay.open { background: rgba(0,0,0,.6); pointer-events: all; }
    .mm-tab-btn { transition: all .2s; }
    .mm-tab-btn.active {
        background: rgba(255,255,255,0.06);
        color: white;
    }
    .mm-notif-item { transition: background .15s; }
    .mm-notif-item:hover { background: rgba(255,255,255,0.04); }
    .mm-notif-item.unread { border-left: 2px solid var(--accent-color, #dc2626); }
    .mm-chat-item { transition: background .15s; cursor: pointer; }
    .mm-chat-item:hover { background: rgba(255,255,255,0.04); }
    .mm-chat-item.active { background: rgba(255,255,255,0.07); }
    #mmMsgList { scroll-behavior: smooth; }
    .mm-msg-bubble {
        max-width: 72%; padding: 9px 13px; border-radius: 18px;
        font-size: 13px; line-height: 1.45; word-break: break-word;
    }
    .mm-msg-bubble.mine {
        background: var(--accent-color, #dc2626);
        color: white; border-bottom-right-radius: 4px; margin-left: auto;
    }
    .mm-msg-bubble.theirs {
        background: rgba(255,255,255,0.07);
        color: #e4e4e7; border-bottom-left-radius: 4px;
    }
    .mm-badge {
        position: absolute; top: -4px; right: -4px;
        background: var(--accent-color, #dc2626);
        color: white; font-size: 9px; font-weight: 900;
        border-radius: 999px; min-width: 17px; height: 17px;
        display: flex; align-items: center; justify-content: center;
        padding: 0 4px; pointer-events: none;
        animation: mmPop .25s cubic-bezier(.34,1.56,.64,1) both;
    }
    @keyframes mmPop { from { transform: scale(0); } to { transform: scale(1); } }
    #mmBellBtn { position: relative; }
    .mm-scroll::-webkit-scrollbar { width: 3px; }
    .mm-scroll::-webkit-scrollbar-track { background: transparent; }
    .mm-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
    @media (max-width: 480px) {
        #mmSidePanel { width: 100vw; }
    }
    </style>`;

    // Panel lateral
    const panel = `
    <div id="mmOverlay"></div>
    <div id="mmSidePanel">
        <!-- Header del panel -->
        <div style="padding:16px 16px 0; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
                <span style="font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.18em; color:#71717a;">MovieM</span>
                <button id="mmClosePanelBtn" style="color:#52525b; padding:4px; transition:color .15s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#52525b'">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <!-- Tabs -->
            <div style="display:flex; gap:4px; padding-bottom:0;">
                <button id="mmTabNotif" class="mm-tab-btn active" onclick="window.mmAbrirTab('notif')"
                    style="flex:1; padding:8px 0; border-radius:10px; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#a1a1aa; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    Notificaciones
                </button>
                <button id="mmTabChat" class="mm-tab-btn" onclick="window.mmAbrirTab('chat')"
                    style="flex:1; padding:8px 0; border-radius:10px; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#a1a1aa; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    Mensajes
                </button>
            </div>
        </div>

        <!-- Vista: Notificaciones -->
        <div id="mmViewNotif" style="flex:1; overflow-y:auto; display:flex; flex-direction:column;" class="mm-scroll">
            <div id="mmNotifList" style="flex:1; padding:8px 0;">
                <p style="color:#52525b; font-size:11px; text-align:center; padding:40px 0; font-style:italic;">Cargando...</p>
            </div>
        </div>

        <!-- Vista: Lista de chats -->
        <div id="mmViewChatList" style="flex:1; overflow-y:auto; display:none; flex-direction:column;" class="mm-scroll">
            <div id="mmChatList" style="flex:1; padding:8px 0;">
                <p style="color:#52525b; font-size:11px; text-align:center; padding:40px 0; font-style:italic;">Sin conversaciones aún.</p>
            </div>
        </div>

        <!-- Vista: Chat abierto -->
        <div id="mmViewChat" style="flex:1; display:none; flex-direction:column; overflow:hidden;">
            <!-- Header del chat -->
            <div id="mmChatHeader" style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:10px; flex-shrink:0;">
                <button onclick="window.mmVolverChats()" style="color:#71717a; padding:2px; margin-right:2px;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#71717a'">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div id="mmChatHeaderAvatar"></div>
                <div style="flex:1; min-width:0;">
                    <p id="mmChatHeaderName" style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:.05em; truncate;"></p>
                </div>
                <a id="mmChatHeaderPerfil" href="#" style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:.1em; color:#71717a; transition:color .15s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#71717a'">Ver perfil</a>
            </div>
            <!-- Mensajes -->
            <div id="mmMsgList" style="flex:1; overflow-y:auto; padding:16px 14px; display:flex; flex-direction:column; gap:6px;" class="mm-scroll"></div>
            <!-- Input -->
            <div style="padding:12px 14px; border-top:1px solid rgba(255,255,255,0.06); display:flex; gap:8px; flex-shrink:0;">
                <input id="mmMsgInput" type="text" placeholder="Escribí un mensaje..."
                    style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 14px; font-size:13px; color:white; outline:none; transition:border .2s;"
                    onfocus="this.style.borderColor='var(--accent-color,#dc2626)'"
                    onblur="this.style.borderColor='rgba(255,255,255,0.08)'"
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window.mmEnviarMensaje();}">
                <button onclick="window.mmEnviarMensaje()" id="mmSendBtn"
                    style="background:var(--accent-color,#dc2626); border:none; border-radius:12px; width:42px; height:42px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:opacity .15s;"
                    onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
                    <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-width="2.5" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
            </div>
        </div>
    </div>`;

    // Bell button HTML — se inserta en los navs
    document.head.insertAdjacentHTML('beforeend', css);
    document.body.insertAdjacentHTML('beforeend', panel);

    // Event listeners del panel
    document.getElementById('mmOverlay').addEventListener('click', window.mmCerrarPanel);
    document.getElementById('mmClosePanelBtn').addEventListener('click', window.mmCerrarPanel);
}

// ─────────────────────────────────────────────────────────
//  PANEL — abrir / cerrar / tabs
// ─────────────────────────────────────────────────────────
window.mmAbrirPanel = function(tab) {
    if (!miUID) return;
    injectUI();
    document.getElementById('mmSidePanel').classList.add('open');
    document.getElementById('mmOverlay').classList.add('open');
    window.mmAbrirTab(tab || 'notif');
};

window.mmCerrarPanel = function() {
    const p = document.getElementById('mmSidePanel');
    const o = document.getElementById('mmOverlay');
    if (p) p.classList.remove('open');
    if (o) o.classList.remove('open');
    if (chatMsgUnsub) { chatMsgUnsub(); chatMsgUnsub = null; }
};

window.mmAbrirTab = function(tab) {
    const tabs = ['notif','chatList','chat'];
    tabs.forEach(t => {
        const v = document.getElementById('mmView' + t.charAt(0).toUpperCase() + t.slice(1));
        if (v) v.style.display = 'none';
    });
    // Botones tab
    ['notif','chat'].forEach(t => {
        const btn = document.getElementById('mmTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) btn.classList.remove('active');
    });

    if (tab === 'notif') {
        document.getElementById('mmViewNotif').style.display = 'flex';
        document.getElementById('mmTabNotif').classList.add('active');
        cargarNotificaciones();
    } else if (tab === 'chat') {
        document.getElementById('mmViewChatList').style.display = 'flex';
        document.getElementById('mmTabChat').classList.add('active');
        cargarListaChats();
    }
};

window.mmVolverChats = function() {
    if (chatMsgUnsub) { chatMsgUnsub(); chatMsgUnsub = null; }
    document.getElementById('mmViewChat').style.display = 'none';
    document.getElementById('mmViewChatList').style.display = 'flex';
    chatAbiertoConUID = null;
};

// ─────────────────────────────────────────────────────────
//  NOTIFICACIONES — leer y renderizar
// ─────────────────────────────────────────────────────────
function escucharNotificaciones(uid) {
    if (notifUnsub) notifUnsub();
    const q = query(
        collection(db, 'notificaciones', uid, 'items'),
        orderBy('fecha', 'desc'),
        limit(30)
    );
    notifUnsub = onSnapshot(q, snap => {
        notifNoLeidas = 0;
        snap.forEach(d => { if (!d.data().leida) notifNoLeidas++; });
        actualizarBadgeBell(notifNoLeidas);
    });
}

function actualizarBadgeBell(n) {
    document.querySelectorAll('.mm-bell-badge').forEach(el => {
        if (n > 0) {
            el.textContent = n > 9 ? '9+' : n;
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
}

async function cargarNotificaciones() {
    const lista = document.getElementById('mmNotifList');
    if (!lista) return;
    lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic;animation:pulse 1.5s infinite;">Cargando...</p>';

    try {
        const q = query(
            collection(db, 'notificaciones', miUID, 'items'),
            orderBy('fecha', 'desc'),
            limit(40)
        );
        const snap = await getDocs(q);

        // Marcar todas como leídas
        const batch = writeBatch(db);
        snap.forEach(d => {
            if (!d.data().leida) batch.update(d.ref, { leida: true });
        });
        await batch.commit();
        notifNoLeidas = 0;
        actualizarBadgeBell(0);

        if (snap.empty) {
            lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic;">Sin notificaciones aún.</p>';
            return;
        }

        lista.innerHTML = '';
        snap.forEach(d => {
            const n = d.data();
            const item = document.createElement('div');
            item.className = 'mm-notif-item' + (n.leida ? '' : ' unread');
            item.style.cssText = 'display:flex;align-items:flex-start;gap:11px;padding:12px 16px;cursor:pointer;';

            let icon = '', clickFn = '';
            if (n.tipo === 'seguidor') {
                icon = avatarHTML(n.deAvatar, n.deUsername, 'w-10 h-10', 'text-sm');
                clickFn = `location.href='perfil.html?user=${encodeURIComponent(n.deUsername)}'`;
            } else if (n.tipo === 'mensaje') {
                icon = avatarHTML(n.deAvatar, n.deUsername, 'w-10 h-10', 'text-sm');
                clickFn = `window.mmAbrirChatCon('${n.de}','${n.deUsername}','${n.deAvatar||''}')`;
            } else if (n.tipo === 'anuncio') {
                icon = `<div style="width:40px;height:40px;border-radius:50%;background:var(--accent-color,#dc2626);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                </div>`;
                clickFn = '';
            }

            item.innerHTML = icon + `<div style="flex:1;min-width:0;">
                <p style="font-size:12px;font-weight:700;color:#e4e4e7;line-height:1.4;">${n.texto || ''}</p>
                <p style="font-size:10px;color:#52525b;margin-top:3px;">${timeAgo(n.fecha)}</p>
            </div>`;
            if (clickFn) item.setAttribute('onclick', clickFn);
            lista.appendChild(item);
        });
    } catch(e) {
        lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;">Error al cargar.</p>';
    }
}

// ─────────────────────────────────────────────────────────
//  CHAT — Lista de conversaciones
// ─────────────────────────────────────────────────────────
async function cargarListaChats() {
    const lista = document.getElementById('mmChatList');
    if (!lista) return;
    lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic;animation:pulse 1.5s infinite;">Cargando...</p>';

    if (chatListUnsub) chatListUnsub();

    const q = query(
        collection(db, 'chats'),
        where('participantes', 'array-contains', miUID),
        orderBy('ultimaFecha', 'desc'),
        limit(30)
    );

    chatListUnsub = onSnapshot(q, snap => {
        if (snap.empty) {
            lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:40px 0;font-style:italic;">Sin conversaciones aún.<br><span style="font-size:10px;">Visitá un perfil y mandá un mensaje.</span></p>';
            return;
        }
        lista.innerHTML = '';
        snap.forEach(d => {
            const chat = d.data();
            const otroUID = chat.participantes.find(u => u !== miUID);
            const otroUsername = chat.usernames?.[otroUID] || 'Usuario';
            const otroAvatar = chat.avatars?.[otroUID] || null;
            const ultimo = chat.ultimoMensaje || '';
            const noLeidos = chat.noLeidos?.[miUID] || 0;
            const esActivo = chatAbiertoConUID === otroUID;

            const item = document.createElement('div');
            item.className = 'mm-chat-item' + (esActivo ? ' active' : '');
            item.style.cssText = 'display:flex;align-items:center;gap:11px;padding:11px 16px;';
            item.innerHTML = `
                <div style="position:relative;flex-shrink:0;">
                    ${avatarHTML(otroAvatar, otroUsername, 'w-11 h-11', 'text-sm')}
                    ${noLeidos > 0 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:var(--accent-color,#dc2626);color:white;font-size:8px;font-weight:900;border-radius:999px;min-width:15px;height:15px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${noLeidos}</span>` : ''}
                </div>
                <div style="flex:1;min-width:0;">
                    <p style="font-size:12px;font-weight:${noLeidos > 0 ? '900' : '700'};color:${noLeidos > 0 ? '#fff' : '#a1a1aa'};text-transform:uppercase;letter-spacing:.04em;truncate;">${otroUsername}</p>
                    <p style="font-size:11px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${ultimo}</p>
                </div>
                <span style="font-size:9px;color:#3f3f46;flex-shrink:0;">${timeAgo(chat.ultimaFecha)}</span>`;
            item.onclick = () => window.mmAbrirChatCon(otroUID, otroUsername, otroAvatar || '');
            lista.appendChild(item);
        });
    });
}

// ─────────────────────────────────────────────────────────
//  CHAT — Abrir conversación
// ─────────────────────────────────────────────────────────
window.mmAbrirChatCon = async function(otroUID, otroUsername, otroAvatar) {
    if (!miUID) { alert('Iniciá sesión para chatear.'); return; }
    injectUI();

    chatAbiertoConUID = otroUID;
    chatAbiertoConUsername = otroUsername;

    // Asegurarse de que el panel esté abierto
    document.getElementById('mmSidePanel').classList.add('open');
    document.getElementById('mmOverlay').classList.add('open');

    // Actualizar header del chat
    document.getElementById('mmChatHeaderAvatar').innerHTML = avatarHTML(otroAvatar, otroUsername, 'w-8 h-8', 'text-xs');
    document.getElementById('mmChatHeaderName').textContent = otroUsername;
    document.getElementById('mmChatHeaderPerfil').href = `perfil.html?user=${encodeURIComponent(otroUsername)}`;

    // Mostrar vista chat
    document.getElementById('mmViewNotif').style.display = 'none';
    document.getElementById('mmViewChatList').style.display = 'none';
    document.getElementById('mmViewChat').style.display = 'flex';

    // Actualizar tab activo
    document.querySelectorAll('.mm-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mmTabChat').classList.add('active');

    // Crear/actualizar doc del chat con metadatos
    const cid = chatId(miUID, otroUID);
    try {
        const chatRef = doc(db, 'chats', cid);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
            // Crear el documento del chat por primera vez
            await setDoc(chatRef, {
                participantes: [miUID, otroUID],
                usernames: { [miUID]: miUsername, [otroUID]: otroUsername },
                avatars: { [miUID]: miAvatar || null, [otroUID]: otroAvatar || null },
                noLeidos: { [miUID]: 0, [otroUID]: 0 },
                ultimoMensaje: '',
                ultimaFecha: serverTimestamp()
            });
        } else {
            // Solo resetear no leídos del usuario actual y actualizar metadatos
            const upd = {};
            upd[`noLeidos.${miUID}`] = 0;
            upd[`usernames.${miUID}`] = miUsername;
            upd[`avatars.${miUID}`] = miAvatar || null;
            upd[`usernames.${otroUID}`] = otroUsername;
            upd[`avatars.${otroUID}`] = otroAvatar || null;
            await updateDoc(chatRef, upd);
        }
    } catch(e) { console.warn('Error creando chat doc', e); }

    // Escuchar mensajes en tiempo real
    if (chatMsgUnsub) chatMsgUnsub();
    const msgList = document.getElementById('mmMsgList');
    msgList.innerHTML = '';

    const q = query(
        collection(db, 'chats', cid, 'mensajes'),
        orderBy('fecha', 'asc'),
        limit(80)
    );

    chatMsgUnsub = onSnapshot(q, snap => {
        msgList.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const esMio = m.de === miUID;
            const burbuja = document.createElement('div');
            burbuja.style.cssText = `display:flex;flex-direction:column;align-items:${esMio ? 'flex-end' : 'flex-start'};`;
            burbuja.innerHTML = `
                <div class="mm-msg-bubble ${esMio ? 'mine' : 'theirs'}">${escapeHtml(m.texto)}</div>
                <span style="font-size:9px;color:#3f3f46;margin-top:3px;padding:0 4px;">${timeAgo(m.fecha)}</span>`;
            msgList.appendChild(burbuja);
        });
        msgList.scrollTop = msgList.scrollHeight;
    });

    setTimeout(() => document.getElementById('mmMsgInput')?.focus(), 200);
};

// ─────────────────────────────────────────────────────────
//  CHAT — Enviar mensaje
// ─────────────────────────────────────────────────────────
window.mmEnviarMensaje = async function() {
    const input = document.getElementById('mmMsgInput');
    if (!input || !miUID || !chatAbiertoConUID) return;
    const texto = input.value.trim();
    if (!texto) return;
    input.value = '';

    const cid = chatId(miUID, chatAbiertoConUID);
    try {
        // Agregar mensaje
        await addDoc(collection(db, 'chats', cid, 'mensajes'), {
            de: miUID,
            texto,
            fecha: serverTimestamp()
        });
        // Actualizar metadata — dot-notation keys en updateDoc son soportados por Firestore
        const noLeidosActuales = await getNoLeidos(cid, chatAbiertoConUID);
        const upd = {
            ultimoMensaje: texto.length > 50 ? texto.slice(0, 47) + '...' : texto,
            ultimaFecha: serverTimestamp()
        };
        upd[`noLeidos.${chatAbiertoConUID}`] = noLeidosActuales + 1;
        upd[`noLeidos.${miUID}`] = 0;
        await updateDoc(doc(db, 'chats', cid), upd);
        // Notificación al destinatario
        await crearNotif(chatAbiertoConUID, 'mensaje', {
            de: miUID,
            deUsername: miUsername,
            deAvatar: miAvatar || null,
            texto: `${miUsername}: ${texto.length > 40 ? texto.slice(0, 37) + '...' : texto}`
        });
    } catch(e) { console.warn('Error enviando mensaje', e); }
};

async function getNoLeidos(cid, uid) {
    try {
        const snap = await getDoc(doc(db, 'chats', cid));
        return snap.exists() ? (snap.data().noLeidos?.[uid] || 0) : 0;
    } catch(e) { return 0; }
}

function escapeHtml(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────
//  ADMIN — Enviar anuncio a todos los usuarios
// ─────────────────────────────────────────────────────────
window.mmEnviarAnuncio = async function(texto) {
    if (!miUID || miUID !== ADMIN_UID) return;
    try {
        const snap = await getDocs(collection(db, 'usuarios'));
        const batch = writeBatch(db);
        snap.forEach(d => {
            if (d.id === miUID) return;
            const ref = doc(collection(db, 'notificaciones', d.id, 'items'));
            batch.set(ref, {
                tipo: 'anuncio',
                leida: false,
                fecha: serverTimestamp(),
                texto: `📢 ${texto}`
            });
        });
        await batch.commit();
        return true;
    } catch(e) { console.error(e); return false; }
};

// ─────────────────────────────────────────────────────────
//  BELL BUTTON — crea el botón campanita
// ─────────────────────────────────────────────────────────
export function crearBellButton(clases = '') {
    const btn = document.createElement('button');
    btn.id = 'mmBellBtn';
    btn.setAttribute('onclick', "window.mmAbrirPanel('notif')");
    btn.className = clases;
    btn.style.cssText = 'position:relative;background:rgba(39,39,42,1);border:1px solid rgba(63,63,70,.5);border-radius:9999px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s;flex-shrink:0;';
    btn.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" style="color:#a1a1aa;pointer-events:none;">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span class="mm-bell-badge mm-badge" style="display:none;">0</span>`;
    btn.addEventListener('mouseover', () => btn.style.background = 'rgba(63,63,70,1)');
    btn.addEventListener('mouseout', () => btn.style.background = 'rgba(39,39,42,1)');
    return btn;
}

// ─────────────────────────────────────────────────────────
//  INIT — esperar auth y arrancar todo
// ─────────────────────────────────────────────────────────
export function iniciarSistema() {
    injectUI();
    onAuthStateChanged(auth, async user => {
        if (!user) return;
        miUID = user.uid;

        // Cargar datos del usuario
        try {
            const snap = await getDoc(doc(db, 'usuarios', miUID));
            if (snap.exists()) {
                const d = snap.data();
                miUsername = d.username || user.email.split('@')[0];
                miAvatar   = d.avatar || null;
            }
        } catch(e) {}

        // Escuchar notificaciones en tiempo real
        escucharNotificaciones(miUID);

        // Exponer función para abrir chat desde perfil ajeno
        window.mmUID = miUID;
        window.mmUsername = miUsername;
        window.mmAvatar = miAvatar;

        // Botón de anuncio para admin
        if (miUID === ADMIN_UID) {
            window.mmMostrarAnuncio = function() {
                const txt = prompt('📢 Escribe el mensaje del anuncio para todos los usuarios:');
                if (txt && txt.trim()) {
                    window.mmEnviarAnuncio(txt.trim()).then(ok => {
                        if (ok) alert('Anuncio enviado a todos los usuarios ✓');
                    });
                }
            };
        }
    });
}
