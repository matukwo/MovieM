// Función para cargar la lista de chats activos (como el "Inbox")
async function cargarListaMensajes() {
    const contenedor = document.getElementById('listaMensajes'); // Asegurate que este ID exista en tu HTML
    if (!miUID || !contenedor) return;

    // Buscamos los chats donde participa el usuario actual
    const q = query(
        collection(db, "chats"),
        where("participantes", "array-contains", miUID),
        orderBy("ultimaVez", "desc")
    );

    onSnapshot(q, (snapshot) => {
        contenedor.innerHTML = "";
        
        if (snapshot.empty) {
            contenedor.innerHTML = `<p class="text-zinc-500 text-center text-xs py-10">No tienes mensajes todavía</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const chat = docSnap.data();
            const chatID = docSnap.id;
            
            // Buscamos la info del otro usuario (el que no soy yo)
            const otroUsuarioID = chat.participantes.find(id => id !== miUID);
            const nombreMostrar = chat.nombres?.[otroUsuarioID] || "Usuario";
            const fotoMostrar = chat.fotos?.[otroUsuarioID] || "https://via.placeholder.com/50";
            const ultimoTexto = chat.ultimoMensaje || "Enviado un archivo";

            // Creamos el diseño del chat "apilado"
            const item = document.createElement('div');
            item.className = "flex items-center p-4 hover:bg-white/5 cursor-pointer border-b border-white/5 transition active:scale-95";
            
            // ESTO ES LO QUE PEDÍAS: Al tocar, abre el chat con ese usuario
            item.onclick = () => window._mmAbrirChat(otroUsuarioID, chatID);

            item.innerHTML = `
                <div class="relative">
                    <img src="${fotoMostrar}" class="w-12 h-12 rounded-full object-cover mr-3 border border-white/10">
                    ${chat.unread ? '<div class="absolute top-0 right-2 w-3 h-3 bg-red-600 rounded-full border-2 border-black"></div>' : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline">
                        <h4 class="text-sm font-bold text-white truncate">${nombreMostrar}</h4>
                        <span class="text-[10px] text-zinc-500">Reciente</span>
                    </div>
                    <p class="text-xs text-zinc-400 truncate mt-0.5">${ultimoTexto}</p>
                </div>
            `;
            contenedor.appendChild(item);
        });
    });
}
