// ══════════════════════════════════════════════════════════
//  MovieM — Notificaciones + Chat
//  Usa window.db, window.addDoc, etc. de firebase-config.js
// ══════════════════════════════════════════════════════════

const ADMIN_UID = '41XWZR8OzwdpMHf54UIQEzAEt7s1';

let _miUID = null, _miUsername = null, _miAvatar = null;
let _notifUnsub = null, _chatListUnsub = null, _chatMsgUnsub = null;
let _chatUID = null, _chatUsername = null;
let _uiInyectada = false;

// ─── Esperar a que window.db esté listo ──────────────────
async function esperarDB() {
    for (let i = 0; i < 30; i++) {
        if (window.db && window.addDoc && window.updateDoc) return true;
        await new Promise(r => setTimeout(r, 100));
    }
    console.error('notif-chat: window.db no disponible');
    return false;
}

// ─── Helpers ─────────────────────────────────────────────
function chatId(a, b) { return [a, b].sort().join('_'); }

function timeAgo(ts) {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const s = Math.floor((Date.now() - d) / 1000);
        if (s < 60) return 'ahora';
        if (s < 3600) return Math.floor(s / 60) + 'm';
        if (s < 86400) return Math.floor(s / 3600) + 'h';
        return Math.floor(s / 86400) + 'd';
    } catch(e) { return ''; }
}

function esc(t) {
    return String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function avatarEl(avatar, username, size) {
    size = size || 36;
    const letra = (username || 'U').charAt(0).toUpperCase();
    if (avatar && avatar !== 'null' && avatar !== '') {
        return `<img src="${avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.1)">`;
    }
    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#dc2626').trim();
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.floor(size*0.38)}px;color:white;flex-shrink:0;border:1px solid rgba(255,255,255,.1)">${letra}</div>`;
}

// ─── Inyectar UI ──────────────────────────────────────────
function inyectarUI() {
    if (_uiInyectada) return;
    _uiInyectada = true;

    document.head.insertAdjacentHTML('beforeend', `<style id="mmCSS">
    #mmPanel{position:fixed;top:0;right:0;bottom:0;width:360px;max-width:100vw;background:#0c0c0c;border-left:1px solid rgba(255,255,255,.07);z-index:9999;transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;font-family:inherit}
    #mmPanel.abierto{transform:translateX(0)}
    #mmFondo{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0);pointer-events:none;transition:background .3s}
    #mmFondo.abierto{background:rgba(0,0,0,.65);pointer-events:all}
    .mm-tab{flex:1;padding:10px 0;border:none;background:none;cursor:pointer;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#71717a;transition:all .2s;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:5px}
    .mm-tab.on{background:rgba(255,255,255,.07);color:#fff}
    .mm-badge-bell{position:absolute;top:-5px;right:-5px;background:var(--accent-color,#dc2626);color:#fff;font-size:9px;font-weight:900;border-radius:999px;min-width:17px;height:17px;display:none;align-items:center;justify-content:center;padding:0 4px;pointer-events:none}
    .mm-notif{display:flex;align-items:flex-start;gap:10px;padding:11px 16px;cursor:pointer;transition:background .15s;border-left:2px solid transparent}
    .mm-notif:hover{background:rgba(255,255,255,.04)}
    .mm-notif.nueva{border-left-color:var(--accent-color,#dc2626)}
    .mm-conv{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;transition:background .15s}
    .mm-conv:hover{background:rgba(255,255,255,.04)}
    .mm-burbuja{max-width:75%;padding:9px 13px;border-radius:18px;font-size:13px;line-height:1.45;word-break:break-word}
    .mm-burbuja.mia{background:var(--accent-color,#dc2626);color:#fff;border-bottom-right-radius:4px;margin-left:auto}
    .mm-burbuja.suya{background:rgba(255,255,255,.08);color:#e4e4e7;border-bottom-left-radius:4px}
    .mm-scroll{overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
    .mm-scroll::-webkit-scrollbar{width:3px}
    .mm-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px}
    @media(max-width:480px){#mmPanel{width:100vw}}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="mmFondo"></div>
    <div id="mmPanel">
        <div style="padding:14px 14px 0;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.18em;color:#52525b">MovieM</span>
                <button onclick="mmCerrar()" style="color:#52525b;background:none;border:none;cursor:pointer;padding:4px;line-height:0" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#52525b'">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div style="display:flex;gap:3px">
                <button id="mmTabNotif" class="mm-tab on" onclick="mmTab('notif')">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    Notificaciones
                </button>
                <button id="mmTabChat" class="mm-tab" onclick="mmTab('chat')">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    Mensajes
                </button>
            </div>
        </div>

        <div id="mmVistaN" class="mm-scroll" style="flex:1;display:flex;flex-direction:column">
            <div id="mmListaN" style="flex:1"></div>
        </div>
        <div id="mmVistaL" class="mm-scroll" style="flex:1;display:none;flex-direction:column">
            <div id="mmListaL" style="flex:1"></div>
        </div>

        <div id="mmVistaC" style="flex:1;display:none;flex-direction:column;overflow:hidden">
            <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px;flex-shrink:0">
                <button onclick="mmVolverLista()" style="color:#71717a;background:none;border:none;cursor:pointer;padding:2px;line-height:0" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#71717a'">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div id="mmChatAv"></div>
                <div style="flex:1;min-width:0">
                    <p id="mmChatNombre" style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff"></p>
                </div>
                <a id="mmChatLink" href="#" style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#52525b;text-decoration:none" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#52525b'">Perfil</a>
            </div>
            <div id="mmMensajes" class="mm-scroll" style="flex:1;padding:14px 12px;display:flex;flex-direction:column;gap:5px"></div>
            <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:8px;flex-shrink:0;background:#0c0c0c">
                <input id="mmInput" type="text" placeholder="Escribí un mensaje..."
                    style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 13px;font-size:13px;color:#fff;outline:none;font-family:inherit"
                    onfocus="this.style.borderColor='var(--accent-color,#dc2626)'"
                    onblur="this.style.borderColor='rgba(255,255,255,.1)'"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();mmEnviar()}">
                <button onclick="mmEnviar()" style="background:var(--accent-color,#dc2626);border:none;border-radius:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
                    <svg width="15" height="15" fill="none" stroke="#fff" viewBox="0 0 24 24"><path stroke-width="2.5" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
            </div>
        </div>
    </div>`);

    document.getElementById('mmFondo').onclick = mmCerrar;
}

// ─── Abrir / cerrar / tabs ────────────────────────────────
window.mmAbrir = function(tab) {
    if (!_miUID) return;
    inyectarUI();
    document.getElementById('mmPanel').classList.add('abierto');
    document.getElementById('mmFondo').classList.add('abierto');
    mmTab(tab || 'notif');
};

window.mmCerrar = function() {
    const p = document.getElementById('mmPanel');
    const f = document.getElementById('mmFondo');
    if (p) p.classList.remove('abierto');
    if (f) f.classList.remove('abierto');
    if (_chatMsgUnsub) { _chatMsgUnsub(); _chatMsgUnsub = null; }
};

window.mmTab = function(tab) {
    inyectarUI();
    document.getElementById('mmVistaN').style.display = 'none';
    document.getElementById('mmVistaL').style.display = 'none';
    document.getElementById('mmVistaC').style.display = 'none';
    document.getElementById('mmTabNotif').classList.remove('on');
    document.getElementById('mmTabChat').classList.remove('on');
    if (tab === 'notif') {
        document.getElementById('mmVistaN').style.display = 'flex';
        document.getElementById('mmTabNotif').classList.add('on');
        cargarNotifs();
    } else {
        document.getElementById('mmVistaL').style.display = 'flex';
        document.getElementById('mmTabChat').classList.add('on');
        cargarListaChats();
    }
};

window.mmVolverLista = function() {
    if (_chatMsgUnsub) { _chatMsgUnsub(); _chatMsgUnsub = null; }
    _chatUID = null;
    document.getElementById('mmVistaC').style.display = 'none';
    document.getElementById('mmVistaL').style.display = 'flex';
    cargarListaChats();
};

// ─── Badge campanita ──────────────────────────────────────
function setBadge(n) {
    document.querySelectorAll('.mm-badge-bell').forEach(el => {
        el.textContent = n > 9 ? '9+' : n;
        el.style.display = n > 0 ? 'flex' : 'none';
    });
}

// ─── Escuchar notificaciones en tiempo real ───────────────
async function escucharNotifs(uid) {
    if (!await esperarDB()) return;
    if (_notifUnsub) _notifUnsub();
    const q = window.query(
        window.collection(window.db, 'notificaciones', uid, 'items'),
        window.orderBy('fecha', 'desc'),
        window.limit(50)
    );
    _notifUnsub = window.onSnapshot(q, snap => {
        let n = 0;
        snap.forEach(d => { if (!d.data().leida) n++; });
        setBadge(n);
    });
}

// ─── Cargar notificaciones ────────────────────────────────
async function cargarNotifs() {
    const lista = document.getElementById('mmListaN');
    if (!lista) return;
    lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:48px 0;font-style:italic">Cargando...</p>';
    if (!await esperarDB()) return;
    try {
        const q = window.query(
            window.collection(window.db, 'notificaciones', _miUID, 'items'),
            window.orderBy('fecha', 'desc'),
            window.limit(40)
        );
        const snap = await window.getDocs(q);
        snap.forEach(async d => {
            if (!d.data().leida) {
                try { await window.updateDoc(d.ref, { leida: true }); } catch(e) {}
            }
        });
        setBadge(0);
        if (snap.empty) {
            lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:48px 0;font-style:italic">Sin notificaciones.</p>';
            return;
        }
        lista.innerHTML = '';
        snap.forEach(d => {
            const n = d.data();
            const div = document.createElement('div');
            div.className = 'mm-notif' + (n.leida ? '' : ' nueva');
            let icono = '', onclick = '';
            if (n.tipo === 'seguidor') {
                icono = avatarEl(n.deAvatar, n.deUsername, 38);
                onclick = `location.href='perfil.html?user=${encodeURIComponent(n.deUsername)}'`;
            } else if (n.tipo === 'mensaje') {
                icono = avatarEl(n.deAvatar, n.deUsername, 38);
                onclick = `mmAbrirChat('${n.de}','${esc(n.deUsername)}','${n.deAvatar||''}')`;
            } else {
                icono = `<div style="width:38px;height:38px;border-radius:50%;background:var(--accent-color,#dc2626);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg></div>`;
            }
            div.innerHTML = icono + `<div style="flex:1;min-width:0"><p style="font-size:12px;font-weight:700;color:#e4e4e7;line-height:1.4">${esc(n.texto||'')}</p><p style="font-size:10px;color:#52525b;margin-top:2px">${timeAgo(n.fecha)}</p></div>`;
            if (onclick) div.setAttribute('onclick', onclick);
            lista.appendChild(div);
        });
    } catch(e) {
        lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:48px 0">Error al cargar.</p>';
        console.error('cargarNotifs error', e);
    }
}

// ─── Crear notificación ───────────────────────────────────
async function crearNotif(paraUID, tipo, datos) {
    if (!await esperarDB()) return;
    try {
        await window.addDoc(window.collection(window.db, 'notificaciones', paraUID, 'items'), {
            tipo, leida: false, fecha: window.serverTimestamp(), ...datos
        });
    } catch(e) { console.warn('crearNotif error', e); }
}

window.mmNotifSeguidor = function(paraUID, deUsername, deAvatar) {
    crearNotif(paraUID, 'seguidor', {
        de: _miUID, deUsername: deUsername, deAvatar: deAvatar || null,
        texto: `${deUsername} empezó a seguirte`
    });
};

// ─── Lista de chats ───────────────────────────────────────
async function cargarListaChats() {
    const lista = document.getElementById('mmListaL');
    if (!lista) return;
    lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:48px 0;font-style:italic">Cargando...</p>';
    if (!await esperarDB()) return;
    if (_chatListUnsub) { _chatListUnsub(); _chatListUnsub = null; }
    try {
        const q = window.query(
            window.collection(window.db, 'chats'),
            window.where('participantes', 'array-contains', _miUID),
            window.orderBy('ultimaFecha', 'desc'),
            window.limit(30)
        );
        _chatListUnsub = window.onSnapshot(q, snap => {
            if (snap.empty) {
                lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:48px 16px;font-style:italic">Sin conversaciones.<br><span style="font-size:10px">Visitá un perfil y hacé clic en Mensaje.</span></p>';
                return;
            }
            lista.innerHTML = '';
            snap.forEach(d => {
                const c = d.data();
                const otroUID = (c.participantes || []).find(u => u !== _miUID) || '';
                const otroNombre = (c.usernames || {})[otroUID] || 'Usuario';
                const otroAv = (c.avatars || {})[otroUID] || '';
                const noLeidos = (c.noLeidos || {})[_miUID] || 0;
                const div = document.createElement('div');
                div.className = 'mm-conv';
                div.innerHTML = `<div style="position:relative;flex-shrink:0">${avatarEl(otroAv, otroNombre, 42)}${noLeidos > 0 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:var(--accent-color,#dc2626);color:#fff;font-size:8px;font-weight:900;border-radius:999px;min-width:15px;height:15px;display:flex;align-items:center;justify-content:center;padding:0 3px">${noLeidos}</span>` : ''}</div><div style="flex:1;min-width:0"><p style="font-size:12px;font-weight:${noLeidos>0?'900':'700'};color:${noLeidos>0?'#fff':'#a1a1aa'};text-transform:uppercase;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(otroNombre)}</p><p style="font-size:11px;color:#52525b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.ultimoMensaje||'')}</p></div><span style="font-size:9px;color:#3f3f46;flex-shrink:0">${timeAgo(c.ultimaFecha)}</span>`;
                div.onclick = () => mmAbrirChat(otroUID, otroNombre, otroAv);
                lista.appendChild(div);
            });
        });
    } catch(e) {
        lista.innerHTML = '<p style="color:#52525b;font-size:11px;text-align:center;padding:48px 0">Error.</p>';
        console.error('cargarListaChats', e);
    }
}

// ─── Abrir chat ───────────────────────────────────────────
window.mmAbrirChat = async function(otroUID, otroNombre, otroAv) {
    if (!_miUID) { alert('Iniciá sesión para chatear.'); return; }
    if (!await esperarDB()) return;

    inyectarUI();
    _chatUID = otroUID;
    _chatUsername = otroNombre;

    document.getElementById('mmPanel').classList.add('abierto');
    document.getElementById('mmFondo').classList.add('abierto');
    document.getElementById('mmVistaN').style.display = 'none';
    document.getElementById('mmVistaL').style.display = 'none';
    document.getElementById('mmVistaC').style.display = 'flex';
    document.getElementById('mmTabNotif').classList.remove('on');
    document.getElementById('mmTabChat').classList.add('on');

    document.getElementById('mmChatAv').innerHTML = avatarEl(otroAv, otroNombre, 30);
    document.getElementById('mmChatNombre').textContent = otroNombre;
    document.getElementById('mmChatLink').href = 'perfil.html?user=' + encodeURIComponent(otroNombre);

    const cid = chatId(_miUID, otroUID);

    // Crear o actualizar doc del chat
    try {
        const ref = window.doc(window.db, 'chats', cid);
        const snap = await window.getDoc(ref);
        if (!snap.exists()) {
            await window.setDoc(ref, {
                participantes: [_miUID, otroUID],
                usernames: { [_miUID]: _miUsername, [otroUID]: otroNombre },
                avatars: { [_miUID]: _miAvatar || null, [otroUID]: otroAv || null },
                noLeidos: { [_miUID]: 0, [otroUID]: 0 },
                ultimoMensaje: '',
                ultimaFecha: window.serverTimestamp()
            });
        } else {
            const upd = {};
            upd[`noLeidos.${_miUID}`] = 0;
            await window.updateDoc(ref, upd);
        }
    } catch(e) { console.warn('mmAbrirChat init doc error', e); }

    // Escuchar mensajes
    if (_chatMsgUnsub) { _chatMsgUnsub(); _chatMsgUnsub = null; }
    const msgDiv = document.getElementById('mmMensajes');
    msgDiv.innerHTML = '';

    try {
        const q = window.query(
            window.collection(window.db, 'chats', cid, 'mensajes'),
            window.orderBy('fecha', 'asc'),
            window.limit(100)
        );
        _chatMsgUnsub = window.onSnapshot(q, snap => {
            msgDiv.innerHTML = '';
            snap.forEach(d => {
                const m = d.data();
                const mia = m.de === _miUID;
                const wrap = document.createElement('div');
                wrap.style.cssText = `display:flex;flex-direction:column;align-items:${mia?'flex-end':'flex-start'}`;
                wrap.innerHTML = `<div class="mm-burbuja ${mia?'mia':'suya'}">${esc(m.texto)}</div><span style="font-size:9px;color:#3f3f46;margin-top:2px;padding:0 3px">${timeAgo(m.fecha)}</span>`;
                msgDiv.appendChild(wrap);
            });
            msgDiv.scrollTop = msgDiv.scrollHeight;
        });
    } catch(e) { console.error('onSnapshot mensajes error', e); }

    setTimeout(() => { const inp = document.getElementById('mmInput'); if (inp) inp.focus(); }, 150);
};

// ─── Enviar mensaje ───────────────────────────────────────
window.mmEnviar = async function() {
    const inp = document.getElementById('mmInput');
    if (!inp) return;
    const texto = inp.value.trim();
    if (!texto || !_miUID || !_chatUID) return;
    inp.value = '';
    inp.focus();

    if (!await esperarDB()) return;
    const cid = chatId(_miUID, _chatUID);

    try {
        await window.addDoc(
            window.collection(window.db, 'chats', cid, 'mensajes'),
            { de: _miUID, texto: texto, fecha: window.serverTimestamp() }
        );

        // Calcular no leídos del otro
        let noLeidosOtro = 0;
        try {
            const chatSnap = await window.getDoc(window.doc(window.db, 'chats', cid));
            if (chatSnap.exists()) noLeidosOtro = (chatSnap.data().noLeidos || {})[_chatUID] || 0;
        } catch(e) {}

        const upd = {
            ultimoMensaje: texto.length > 50 ? texto.slice(0,47)+'...' : texto,
            ultimaFecha: window.serverTimestamp()
        };
        upd[`noLeidos.${_chatUID}`] = noLeidosOtro + 1;
        upd[`noLeidos.${_miUID}`] = 0;
        await window.updateDoc(window.doc(window.db, 'chats', cid), upd);

        crearNotif(_chatUID, 'mensaje', {
            de: _miUID, deUsername: _miUsername, deAvatar: _miAvatar || null,
            texto: `${_miUsername}: ${texto.length > 40 ? texto.slice(0,37)+'...' : texto}`
        });
    } catch(e) {
        console.error('mmEnviar error:', e);
        inp.value = texto;
    }
};

// ─── Admin: anuncio ───────────────────────────────────────
window.mmAnuncio = async function() {
    if (_miUID !== ADMIN_UID) return;
    const texto = prompt('📢 Mensaje para todos los usuarios:');
    if (!texto || !texto.trim()) return;
    if (!await esperarDB()) return;
    try {
        const snap = await window.getDocs(window.collection(window.db, 'usuarios'));
        const promesas = [];
        snap.forEach(d => {
            if (d.id === _miUID) return;
            promesas.push(crearNotif(d.id, 'anuncio', { texto: '📢 ' + texto.trim() }));
        });
        await Promise.all(promesas);
        alert('Anuncio enviado a ' + promesas.length + ' usuarios ✓');
    } catch(e) { alert('Error: ' + e.message); }
};

// ─── Init ─────────────────────────────────────────────────
async function init() {
    inyectarUI();
    if (!await esperarDB()) return;

    window.onAuthStateChanged(window.auth, async user => {
        if (!user) return;
        _miUID = user.uid;
        try {
            const snap = await window.getDoc(window.doc(window.db, 'usuarios', _miUID));
            if (snap.exists()) {
                _miUsername = snap.data().username || user.email.split('@')[0];
                _miAvatar   = snap.data().avatar || null;
            } else {
                _miUsername = user.email.split('@')[0];
            }
        } catch(e) { _miUsername = user.email.split('@')[0]; }

        window.mmUID      = _miUID;
        window.mmUsername = _miUsername;
        window.mmAvatar   = _miAvatar;

        await escucharNotifs(_miUID);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
