import { dom } from "./dom.js";
import { escAttr } from "./utils.js";

export function addItemRow(item){
  const row = document.createElement("div");
  row.className = "itemRow";
  row.innerHTML = `
    <input class="i_dz" type="text" placeholder="Dzianina" value="${escAttr(item.dzianina || "")}">
    <input class="i_ko" type="text" placeholder="Kolor" value="${escAttr(item.kolor || "")}">
    <input class="i_il" type="text" placeholder="Ilość" value="${escAttr(item.ilosc || "")}">
    <input class="i_wy" type="text" placeholder="Wydano" value="${escAttr(item.wydano ?? item.iloscPosiadana ?? "")}">
    <label style="display:flex; gap:6px; align-items:center; font-size:12px; opacity:.9;">
      <input class="i_cov" type="checkbox" ${item.covered ? "checked" : ""}>
      zrobione
    </label>
    <button class="btn danger smallBtn" type="button">Usuń</button>
  `;
  row.querySelector("button").onclick = () => row.remove();
  dom.itemsEl.appendChild(row);
}

export function setItemsToUI(items){
  dom.itemsEl.innerHTML = "";
  const arr = (Array.isArray(items) && items.length)
    ? items
    : [{ dzianina:"", kolor:"", ilosc:"", wydano:"", covered:false }];
  arr.forEach(addItemRow);
}

export function getItemsFromUI(){
  const rows = [...dom.itemsEl.querySelectorAll(".itemRow")];
  const items = rows.map(r => ({
    dzianina: (r.querySelector(".i_dz")?.value || "").trim(),
    kolor: (r.querySelector(".i_ko")?.value || "").trim(),
    ilosc: (r.querySelector(".i_il")?.value || "").trim(),
    wydano: (r.querySelector(".i_wy")?.value || "").trim(),
    covered: !!(r.querySelector(".i_cov")?.checked),
  })).filter(x => x.dzianina || x.kolor || x.ilosc || x.wydano);
  return items.length ? items : [{ dzianina:"", kolor:"", ilosc:"", wydano:"", covered:false }];
}
