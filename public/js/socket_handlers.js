import { dom } from "./dom.js";
import { state } from "./state.js";
import { upsertNote, bumpZ } from "./render_note.js";
import { rerenderOfficeList } from "./render_office.js";
import { updateEdgeChevrons } from "./edge_chevrons.js";
import { isVisible } from "./filters.js";
import { addChatMsg, scrollChatToBottom, setChatBadge } from "./chat_ui.js";

export function bindSocket(socket){
  state.socket = socket;

  socket.on("connect", () => {
    dom.statusEl.textContent = "połączono";
    dom.dotEl.classList.remove("offline");
    dom.dotEl.classList.add("online");
    socket.emit("chat:join");
  });

  socket.on("disconnect", () => {
    dom.statusEl.textContent = "rozłączono";
    dom.dotEl.classList.remove("online");
    dom.dotEl.classList.add("offline");
  });

  socket.on("notes:init", (arr) => {
    dom.world.innerHTML = "";
    state.notes.clear();

    const maxZ = Math.max(0, ...(arr || []).map(n => Number(n.z || 0)));
    state.zCounter = maxZ;

    (arr || []).forEach(upsertNote);
    rerenderAll();
    updateEdgeChevrons();
  });

  socket.on("note:upsert", (note) => {
    upsertNote(note);
    rerenderAll();
  });

  socket.on("note:delete", ({ id }) => {
    const el = document.getElementById("note-" + id);
    if (el) el.remove();
    state.notes.delete(id);
    rerenderAll();
  });

  socket.on("chat:init", (arr) => {
    dom.chatMsgs.innerHTML = "";
    (arr || []).forEach(addChatMsg);
    scrollChatToBottom();
  });

  socket.on("chat:new", (m) => {
    addChatMsg(m);
    scrollChatToBottom();
    const isOpen = (dom.chatPanel.style.display === "block");
    if (!isOpen) setChatBadge(state.unread + 1);
  });

  // expose for other modules
  window.__bumpZ = bumpZ;
}

export function rerenderAll(){
  // show/hide + update classes for board notes
  for (const [id, note] of state.notes.entries()){
    const el = document.getElementById("note-" + id);
    if (!el) continue;
    el.style.display = isVisible(note) ? "block" : "none";
    el.classList.toggle("faktura", !!note.faktura);
  }
  rerenderOfficeList();
  updateEdgeChevrons();
}
