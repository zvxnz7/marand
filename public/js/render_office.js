import { dom } from "./dom.js";
import { state } from "./state.js";
import { isVisible } from "./filters.js";
import { esc, formatDatePL, coveredBadgeHTML } from "./utils.js";

export function rerenderOfficeList(){
  if (state.currentView !== "biuro") return;

  const visible = [];
  for (const note of state.notes.values()){
    if (isVisible(note)) visible.push(note);
  }

  visible.sort((a,b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1; // todo first
    return (b.z||0) - (a.z||0);
  });

  dom.officeCount.textContent = `${visible.length} szt.`;

  dom.officeList.innerHTML = visible.map(n => {
    const items = Array.isArray(n.pozycje) ? n.pozycje : [];
    const itemsHtml = items.length
      ? items.map(it => {
          const wyd = (it.wydano ?? it.iloscPosiadana ?? "");
          return `
            <div class="kv" style="margin-top:8px;">
              <div class="k">Pozycja</div>
              <div class="v">
                <b>Dzianina:</b> ${esc(it.dzianina)}<br>
                <b>Kolor:</b> ${esc(it.kolor)}<br>
                <b>Ilość:</b> ${esc(it.ilosc)}<br>
                <b>Wydano:</b> ${esc(wyd)}<br>
                <div class="spacer"></div>
                ${coveredBadgeHTML(!!it.covered)}
              </div>
            </div>
          `;
        }).join("")
      : `<div style="opacity:.6; margin-top:8px;">(brak pozycji)</div>`;

    const archLabel = n.trashed ? "♻ Przywróć z kosza" : (n.archived ? "♻ Przywróć" : "🗄 Archiwizuj");
    const trashLabel = n.trashed ? "🗑 Usuń trwale" : "🗑 Do kosza";
    const dueTxt = n.due ? formatDatePL(n.due) : "";

    return `
      <div class="
        officeCard
        ${n.done ? "done":""}
        ${n.faktura ? "faktura":""}
        ${n.archived ? "archived":""}
        ${n.trashed ? "trashed":""}
      ">
        <div class="rowTop">
          <div style="margin-top:2px">
            <input type="checkbox" ${n.done ? "checked":""} data-act="done" data-id="${n.id}">
          </div>
          <div style="flex:1; min-width:0">
            <div class="title">${esc(n.klient || "(brak klienta)")}</div>
            <div class="meta">
              ${n.przedplata ? "PRZEDPŁATA" : "bez przedpłaty"}
              • ${esc(n.kurier || "(brak kuriera)")}
              • ${esc(n.waga || "(brak wagi)")}
              ${dueTxt ? ` • <b>Termin:</b> ${esc(dueTxt)}` : ``}
              ${n.faktura ? ` • <b style="color:rgba(160,200,255,.95)">FAKTURA</b>` : ``}
            </div>
          </div>
          <button class="btn" data-act="bump" data-id="${n.id}" title="Podbij na górę">⬆</button>
        </div>

        ${itemsHtml}

        <div class="actions">
          <button class="btn archBtn" data-act="arch" data-id="${n.id}">${archLabel}</button>
          <button class="btn editBtn" data-act="edit" data-id="${n.id}">Edytuj</button>
          <button class="btn danger" data-act="trash" data-id="${n.id}">${trashLabel}</button>
        </div>
      </div>
    `;
  }).join("");

  // delegation (click)
  dom.officeList.onclick = (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const cur = state.notes.get(id);
    if (!cur) return;

    if (act === "edit") window.__openModalEdit(id);
    if (act === "bump") window.__bumpZ(id);

    if (act === "arch") {
      if (cur.trashed) state.socket.emit("note:update", { id, trashed:false });
      else state.socket.emit("note:update", { id, archived: !cur.archived });
    }

    if (act === "trash") {
      if (!cur.trashed) state.socket.emit("note:update", { id, trashed:true });
      else if (confirm("Usunąć TRWALE z kosza?")) state.socket.emit("note:delete", { id });
    }
  };

  // delegation (done checkbox)
  dom.officeList.onchange = (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-act="done"]');
    if (!cb) return;
    const id = cb.getAttribute("data-id");
    state.socket.emit("note:update", { id, done: cb.checked });
  };
}
