import { dom } from "./dom.js";
import { state } from "./state.js";
import { clamp } from "./utils.js";
import { updateEdgeChevrons } from "./edge_chevrons.js";

export function applyCam(){
  state.cam.z = clamp(state.cam.z, 0.35, 2.5);
  dom.world.style.transform = `translate(${state.cam.x}px, ${state.cam.y}px) scale(${state.cam.z})`;

  const base = 22;
  dom.viewport.style.backgroundSize = `${base * state.cam.z}px ${base * state.cam.z}px`;
  dom.viewport.style.backgroundPosition = `${state.cam.x}px ${state.cam.y}px`;

  updateEdgeChevrons();
}

export function zoomAt(factor, clientX, clientY){
  const prevZ = state.cam.z;
  const nextZ = clamp(prevZ * factor, 0.35, 2.5);
  const realFactor = nextZ / prevZ;
  if (realFactor === 1) return;

  const wx = (clientX - state.cam.x) / prevZ;
  const wy = (clientY - state.cam.y) / prevZ;

  state.cam.z = nextZ;
  state.cam.x = clientX - wx * nextZ;
  state.cam.y = clientY - wy * nextZ;

  applyCam();
}

export function bindCameraControls(){
  dom.zoomInBtn.onclick = () => zoomAt(1.15, dom.viewport.clientWidth/2, dom.viewport.clientHeight/2);
  dom.zoomOutBtn.onclick = () => zoomAt(1/1.15, dom.viewport.clientWidth/2, dom.viewport.clientHeight/2);
  dom.centerBtn.onclick = () => { state.cam = { x: 20, y: 20, z: 1.0 }; applyCam(); };

  dom.viewport.addEventListener("wheel", (e) => {
    if (state.currentView === "biuro") return;
    e.preventDefault();
    const zf = e.deltaY < 0 ? 1.10 : 1/1.10;
    zoomAt(zf, e.clientX, e.clientY);
  }, { passive:false });
}
