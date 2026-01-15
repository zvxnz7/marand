import { dom } from "./dom.js";
import { state } from "./state.js";
import { bindCameraControls, applyCam } from "./camera.js";
import { bindSocket, rerenderAll } from "./socket_handlers.js";
import { bindChatUI } from "./chat_ui.js";
import { addItemRow, setItemsToUI, getItemsFromUI } from "./items_ui.js";
import { updateEdgeChevrons } from "./edge_chevrons.js";
import { bindBoardInteractions } from "./board_interactions.js";

// socket.io
const socket = io();
bindSocket(socket);

// init view
state.currentView = dom.viewSel.value;

// ✅ board panning + pinch zoom
bindBoardInteractions();

// search + status
dom.searchBox.addEventListener("input", () => {
  state.searchQ = (dom.searchBox.value || "").trim().toLowerCase();
  rerenderAll();
});
dom.statusFilter.addEventListener("change", () => {
  state.statusMode = dom.statusFilter.value;
  rerenderAll();
});

// trash toggle
function refreshTrashUI(){
  dom.trashBtn.textContent = state.showTrash ? "Kosz: ON" : "Kosz: OFF";
  dom.emptyTrashBtn.style.display = state.showTrash ? "inline-block" : "none";
}
refreshTrashUI();

dom.trashBtn.onclick = () => { state.showTrash = !state.showTrash; refreshTrashUI(); rerenderAll(); };
dom.emptyTrashBtn.onclick = () => {
  if (!confirm("Na pewno opróżnić kosz? (trwałe usunięcie)")) return;
  state.socket.emit("trash:empty");
};

// archive toggle
function refreshArchiveBtn(){
  dom.archiveBtn.textContent = state.showArchived ? "Archiwum: ON" : "Archiwum: OFF";
}
refreshArchiveBtn();
dom.archiveBtn.onclick = () => { state.showArchived = !state.showArchived; refreshArchiveBtn(); rerenderAll(); };

// view switch
dom.viewSel.addEventListener("change", () => {
  state.currentView = dom.viewSel.value;
  const inOffice = (state.currentView === "biuro");
  dom.officePanel.style.display = inOffice ? "block" : "none";
  dom.viewport.style.display    = inOffice ? "none" : "block";
  rerenderAll();
  updateEdgeChevrons();
});
dom.officePanel.style.display = (state.currentView === "biuro") ? "block" : "none";
dom.viewport.style.display    = (state.currentView === "biuro") ? "none" : "block";

// camera
bindCameraControls();
applyCam();

// chat
bindChatUI();

// modal open/close
dom.addBtn.onclick = () => openModalCreate();
dom.cancelBtn.onclick = closeModal;
dom.backdrop.addEventListener("click", (e) => { if (e.target === dom.backdrop) closeModal(); });

dom.addItemBtn.onclick = () => addItemRow({ dzianina:"", kolor:"", ilosc:"", wydano:"", covered:false });

// expose for render_note.js usage
window.__openModalEdit = (id) => openModalEdit(id);

function fillForm(note){
  dom.f_klient.value = note.klient || "";
  dom.f_przedplata.checked = !!note.przedplata;
  setItemsToUI(note.pozycje);
  dom.f_kurier.value = note.kurier || "";
  dom.f_waga.value = note.waga || "";
  dom.f_info.value = note.info || "";
  dom.f_due.value = (note.due || "");
  dom.f_done.checked = !!note.done;
  dom.f_faktura.checked = !!note.faktura;
}

function readForm(){
  return {
    klient: dom.f_klient.value.trim(),
    przedplata: dom.f_przedplata.checked,
    pozycje: getItemsFromUI(),
    kurier: dom.f_kurier.value.trim(),
    waga: dom.f_waga.value.trim(),
    info: dom.f_info.value.trim(),
    due: (dom.f_due.value || "").trim(),
    done: dom.f_done.checked,
    faktura: dom.f_faktura.checked,
  };
}

function openModalCreate(){
  state.editingId = null;
  dom.modalTitle.textContent = "Dodaj notatkę";
  dom.deleteBtn.style.display = "none";

  fillForm({
    klient:"",
    przedplata:false,
    pozycje:[{ dzianina:"", kolor:"", ilosc:"", wydano:"", covered:false }],
    kurier:"",
    waga:"",
    info:"",
    due:"",
    done:false,
    faktura:false,
  });

  dom.backdrop.style.display = "flex";
  setTimeout(() => dom.f_klient.focus(), 0);
}

function openModalEdit(noteId){
  const note = state.notes.get(noteId);
  if (!note) return;
  state.editingId = noteId;

  dom.modalTitle.textContent = "Edytuj notatkę";
  dom.deleteBtn.style.display = "inline-block";
  dom.deleteBtn.textContent = "Do kosza";
  fillForm(note);

  dom.backdrop.style.display = "flex";
  setTimeout(() => dom.f_klient.focus(), 0);
}

function closeModal(){
  dom.backdrop.style.display = "none";
  state.editingId = null;
}

dom.saveBtn.onclick = () => {
  const payload = readForm();
  if (state.editingId) {
    state.socket.emit("note:update", { id: state.editingId, ...payload });
  } else {
    payload.x = 120 + Math.random() * 220;
    payload.y = 120 + Math.random() * 180;
    payload.z = ++state.zCounter;
    payload.createdAt = new Date().toISOString();
    state.socket.emit("note:create", payload);
  }
  closeModal();
};

dom.deleteBtn.onclick = () => {
  if (!state.editingId) return;
  state.socket.emit("note:update", { id: state.editingId, trashed: true });
  closeModal();
};
