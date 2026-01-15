import { dom } from "./dom.js";
import { state } from "./state.js";
import { isVisible } from "./filters.js";

function screenRectForViewport(){ return dom.viewport.getBoundingClientRect(); }

function worldToScreen(wx, wy){
  const vr = screenRectForViewport();
  const sxInViewport = (wx * state.cam.z) + state.cam.x;
  const syInViewport = (wy * state.cam.z) + state.cam.y;
  return { x: vr.left + sxInViewport, y: vr.top + syInViewport };
}

function pointInsideRect(x, y, r, margin=0){
  return x >= r.left - margin && x <= r.right + margin && y >= r.top - margin && y <= r.bottom + margin;
}

function ensureChev(id){
  const key = "edgeChev_" + id;
  let el = document.getElementById(key);
  if (!el){
    el = document.createElement("div");
    el.className = "edgeChev";
    el.id = key;
    dom.edgeLayer.appendChild(el);
  }
  return el;
}

function hideAllChevs(){
  dom.edgeLayer.querySelectorAll(".edgeChev").forEach(e => e.style.display = "none");
}

function clamp01(v, a, b){ return Math.max(a, Math.min(b, v)); }

function clampToRect(x, y, r, pad=16){
  const left = r.left + pad, right = r.right - pad;
  const top  = r.top  + pad, bottom = r.bottom - pad;
  return { x: clamp01(x, left, right), y: clamp01(y, top, bottom), left, right, top, bottom };
}

export function updateEdgeChevrons(){
  if (state.currentView !== "magazyn" || dom.viewport.style.display === "none"){
    hideAllChevs();
    return;
  }

  const vr = screenRectForViewport();
  hideAllChevs();

  for (const [id, n] of state.notes.entries()){
    if (!isVisible(n)) continue;

    const noteEl = document.getElementById("note-" + id);
    if (!noteEl || noteEl.style.display === "none") continue;

    const w = noteEl.offsetWidth || 340;
    const h = noteEl.offsetHeight || 170;

    const wx = n.x + w/2;
    const wy = n.y + h/2;

    const sp = worldToScreen(wx, wy);
    if (pointInsideRect(sp.x, sp.y, vr, 20)) continue;

    const ROT_OFFSET = 270;
    const pad = 16;
    const cl = clampToRect(sp.x, sp.y, vr, pad);

    const outL = (vr.left  + pad) - sp.x;
    const outR = sp.x - (vr.right - pad);
    const outT = (vr.top   + pad) - sp.y;
    const outB = sp.y - (vr.bottom - pad);

    let edge = null;
    let best = 0;
    if (outL > best){ best = outL; edge = "L"; }
    if (outR > best){ best = outR; edge = "R"; }
    if (outT > best){ best = outT; edge = "T"; }
    if (outB > best){ best = outB; edge = "B"; }
    if (!edge) continue;

    let hitX = cl.x, hitY = cl.y;
    if (edge === "L") hitX = cl.left;
    if (edge === "R") hitX = cl.right;
    if (edge === "T") hitY = cl.top;
    if (edge === "B") hitY = cl.bottom;

    const ang = Math.atan2(sp.y - hitY, sp.x - hitX);
    const deg = ang * 180 / Math.PI;

    const chev = ensureChev(id);
    chev.style.display = "block";
    chev.style.left = (hitX - 7) + "px";
    chev.style.top  = (hitY - 7) + "px";
    chev.style.transform = `rotate(${deg + ROT_OFFSET}deg)`;
  }
}

window.addEventListener("resize", updateEdgeChevrons);
