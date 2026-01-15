import { state } from "./state.js";

export function noteMatchesSearch(note){
  const q = state.searchQ;
  if (!q) return true;

  const parts = [];
  parts.push(note.klient || "");
  parts.push(note.kurier || "");
  parts.push(note.waga || "");
  parts.push(note.info || "");
  parts.push(note.due || "");
  parts.push(note.createdAt || "");

  const items = Array.isArray(note.pozycje) ? note.pozycje : [];
  for (const it of items){
    parts.push(it.dzianina || "");
    parts.push(it.kolor || "");
    parts.push(it.ilosc || "");
    parts.push(it.wydano || it.iloscPosiadana || "");
  }

  return parts.join(" ").toLowerCase().includes(q);
}

export function noteMatchesStatus(note){
  const m = state.statusMode;
  if (m === "all") return true;
  if (m === "todo") return !note.done;
  if (m === "done") return !!note.done;
  return true;
}

export function isVisible(note){
  if (state.showTrash) {
    if (!note.trashed) return false;
  } else {
    if (note.trashed) return false;
  }

  if (!state.showTrash && !state.showArchived && note.archived) return false;
  if (!noteMatchesStatus(note)) return false;
  if (!noteMatchesSearch(note)) return false;
  return true;
}
