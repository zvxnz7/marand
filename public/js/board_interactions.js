import { dom } from "./dom.js";
import { state } from "./state.js";
import { applyCam, zoomAt } from "./camera.js";

function dist(a, b){
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}
function mid(a, b){
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export function bindBoardInteractions(){
  const viewport = dom.viewport;

  viewport.addEventListener("pointerdown", (e) => {
    // no board interaction in biuro view
    if (state.currentView === "biuro") return;

    // track pointers for pinch
    state.pointers.set(e.pointerId, e);

    // ignore when clicking UI elements
    if (e.target.closest("input, textarea, select, button, label")) return;

    // If 2 pointers -> start pinch
    if (state.pointers.size === 2) {
      const [p1, p2] = [...state.pointers.values()];
      state.pinch.active = true;
      state.pinch.id1 = p1.pointerId;
      state.pinch.id2 = p2.pointerId;
      state.pinch.d0 = dist(p1, p2);
      state.pinch.z0 = state.cam.z;
      state.panning = false;
      return;
    }

    // Only start panning if not pressing a note
    const onNote = !!e.target.closest(".note");
    if (!onNote && !state.isDraggingNote) {
      state.panning = true;
      viewport.setPointerCapture(e.pointerId);
      state.panStart = { x: e.clientX, y: e.clientY, camX: state.cam.x, camY: state.cam.y };
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (state.currentView === "biuro") return;

    if (state.pointers.has(e.pointerId)) state.pointers.set(e.pointerId, e);

    // pinch zoom
    if (state.pinch.active && state.pointers.size === 2) {
      const p1 = state.pointers.get(state.pinch.id1);
      const p2 = state.pointers.get(state.pinch.id2);
      if (!p1 || !p2) return;

      const d = dist(p1, p2);
      const factor = d / state.pinch.d0;
      const targetZ = state.pinch.z0 * factor;

      const m = mid(p1, p2);
      zoomAt(targetZ / state.cam.z, m.x, m.y);
      return;
    }

    // pan
    if (!state.panning || state.isDraggingNote) return;

    state.cam.x = state.panStart.camX + (e.clientX - state.panStart.x);
    state.cam.y = state.panStart.camY + (e.clientY - state.panStart.y);
    applyCam();
  });

  function endPointer(e){
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) state.pinch.active = false;
    state.panning = false;
  }

  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
}
