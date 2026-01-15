import { dom } from "./dom.js";
import { state } from "./state.js";
import { esc, formatDatePL } from "./utils.js";
import { updateEdgeChevrons } from "./edge_chevrons.js";

function kv(k, v){
  return `
    <div class="kv">
      <div class="k">${k}</div>
      <div class="v">${v || "<span style='opacity:.6'>(puste)</span>"}</div>
    </div>
  `;
}

function renderItems(note){
  const items = Array.isArray(note.pozycje) ? note.pozycje : [];
  if (!items.length) return `<div style="opacity:.6">(brak pozycji)</div>`;

  return items.map((it, idx) => {
    const wyd = (it.wydano ?? it.iloscPosiadana ?? "");
    return `
      <div class="kv" style="margin-top:${idx?8:0}px;">
        <div class="k">Pozycja ${idx+1}</div>
        <div class="v">
          <b>Dzianina:</b> ${esc(it.dzianina)}<br>
          <b>Kolor:</b> ${esc(it.kolor)}<br>
          <b>Ilość:</b> ${esc(it.ilosc)}<br>
          <b>Wydano:</b> ${esc(wyd)}
        </div>
      </div>
    `;
  }).join("");
}

export function updateNoteContent(el, note){
  const body = el.querySelector(".body");
  const title = el.querySelector(".titleText");
  const przed = el.querySelector(".przedBadge");

  const created = note.createdAt ? new Date(note.createdAt).toLocaleString("pl-PL") : "";
  const dueTxt = note.due ? formatDatePL(note.due) : "";

  const metaLine = (created || dueTxt) ? `
    <div style="margin:8px 0 10px 0; font-size:12px; opacity:.85;">
      ${created ? `Dodano: <b>${esc(created)}</b>` : ``}
      ${created && dueTxt ? ` &nbsp;•&nbsp; ` : ``}
      ${dueTxt ? `Termin: <b>${esc(dueTxt)}</b>` : ``}
      ${note.faktura ? ` &nbsp;•&nbsp; <b style="color:rgba(160,200,255,.95)">FAKTURA</b>` : ``}
    </div>
  ` : ``;

  title.textContent = note.klient ? note.klient : "(brak klienta)";
  przed.textContent = note.przedplata ? "PRZEDPŁATA" : "bez przedpłaty";
  przed.style.opacity = note.przedplata ? "1" : ".75";

  body.innerHTML = `
    ${metaLine}
    ${renderItems(note)}
    <div class="spacer"></div>
    <div class="grid3">
      ${kv("Kurier", esc(note.kurier))}
      ${kv("Waga", esc(note.waga))}
      ${kv("Dodatkowe", esc(note.info))}
    </div>
  `;
}

export function renderNote(note){
  const el = document.createElement("div");
  el.className = "note";
  el.id = "note-" + note.id;

  el.innerHTML = `
    <header>
      <div class="left">
        <!-- checkbox controls FAKTURA -->
        <input class="factCheck" type="checkbox" ${note.faktura ? "checked" : ""} title="Faktura" />
        <div style="min-width:0">
          <div class="titleText" style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
          <div class="pill przedBadge" style="display:inline-block; margin-top:6px;"></div>
        </div>
      </div>
      <div class="right">
        <button class="btn archBtn" title="Archiwizuj / Przywróć">🗄</button>
        <button class="btn editBtn" title="Edytuj">Edytuj</button>
        <button class="btn danger delBtn" title="Do kosza">🗑 Do kosza</button>
      </div>
    </header>
    <div class="body"></div>
  `;

  // Faktura toggle
  const factCheck = el.querySelector(".factCheck");
  factCheck.addEventListener("change", () => {
    state.socket.emit("note:update", { id: note.id, faktura: factCheck.checked });
  });

  // Edit
  el.querySelector(".editBtn").onclick = () => window.__openModalEdit(note.id);

  // Archive button
  el.querySelector(".archBtn").onclick = () => {
    const cur = state.notes.get(note.id) || note;

    if (cur.trashed){
      state.socket.emit("note:update", { id: note.id, trashed: false });
      return;
    }

    const goingToArchive = !cur.archived;
    if (goingToArchive) {
      el.classList.add("archiving");
      setTimeout(() => {
        state.socket.emit("note:update", { id: note.id, archived: true });
        el.classList.remove("archiving");
      }, 200);
    } else {
      state.socket.emit("note:update", { id: note.id, archived: false });
    }
  };

  // Trash button
  el.querySelector(".delBtn").onclick = () => {
    const cur = state.notes.get(note.id) || note;

    if (!cur.trashed){
      state.socket.emit("note:update", { id: note.id, trashed: true });
      return;
    }

    if (confirm("Usunąć TRWALE z kosza?")) {
      state.socket.emit("note:delete", { id: note.id });
    }
  };

  // Dragging the note (smoothed + fixed)
  let dragging = false;
  let start = null;

  // smooth dragging (raf throttle)
  let raf = 0;
  let pending = null;

  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("input, textarea, select, button, label")) return;
    e.stopPropagation();

    dragging = true;
    state.isDraggingNote = true;

    bumpZ(note.id);

    el.style.cursor = "grabbing";
    el.setPointerCapture(e.pointerId);

    const cur = state.notes.get(note.id) || note;
    start = { px: e.clientX, py: e.clientY, nx: cur.x, ny: cur.y };
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = (e.clientX - start.px) / state.cam.z;
    const dy = (e.clientY - start.py) / state.cam.z;

    pending = { x: start.nx + dx, y: start.ny + dy };

    if (!raf){
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!pending) return;
        el.style.left = pending.x + "px";
        el.style.top  = pending.y + "px";
        updateEdgeChevrons();
      });
    }
  });

  function endDrag(){
    if (!dragging) return;
    dragging = false;
    state.isDraggingNote = false;
    el.style.cursor = "grab";

    if (raf){
      cancelAnimationFrame(raf);
      raf = 0;
    }

    // commit last position
    const left = pending ? pending.x : (parseFloat(el.style.left) || 0);
    const top  = pending ? pending.y : (parseFloat(el.style.top) || 0);
    pending = null;

    state.socket.emit("note:update", { id: note.id, x: left, y: top });
    updateEdgeChevrons();
  }

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  updateNoteContent(el, note);
  return el;
}

/**
 * ✅ NEW: upsertNote(note)
 * This is what your socket_handlers expects.
 */
export function upsertNote(note){
  if (!note || !note.id) return;

  // keep data in sync
  state.notes.set(note.id, note);

  // must have world container
  const world = dom.world;
  if (!world) return;

  // ensure element exists
  let el = document.getElementById("note-" + note.id);
  if (!el){
    el = renderNote(note);
    world.appendChild(el);
  }

  // position + z
  el.style.left = (Number(note.x ?? 80)) + "px";
  el.style.top  = (Number(note.y ?? 80)) + "px";
  el.style.zIndex = String(Number(note.z ?? 0));

  // classes
  el.classList.toggle("done", !!note.done);
  el.classList.toggle("faktura", !!note.faktura);
  el.classList.toggle("archived", !!note.archived);
  el.classList.toggle("trashed", !!note.trashed);

  // update content
  updateNoteContent(el, note);

  updateEdgeChevrons();
}

/**
 * ✅ Optional helper (often used by socket handlers too)
 */
export function removeNote(id){
  state.notes.delete(id);
  const el = document.getElementById("note-" + id);
  if (el) el.remove();
  updateEdgeChevrons();
}

/**
 * Backwards-compatible export: bumpZ
 * (fixed recursion / stack overflow)
 */
export function bumpZ(noteId){
  state.zCounter = (state.zCounter ?? 0) + 1;
  const z = state.zCounter;

  const el = document.getElementById("note-" + noteId);
  if (el) el.style.zIndex = String(z);

  state.socket?.emit("note:update", { id: noteId, z });
}
