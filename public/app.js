const fsBtn = document.getElementById("fsBtn");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.innerHTML = text;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setStatus('Fullscreen enabled. Press <b>Esc</b> to exit.');
    } else {
      await document.exitFullscreen();
      setStatus('Fullscreen disabled. Press <b>F</b> to enable.');
    }
  } catch (e) {
    setStatus("Fullscreen failed (browser blocked it).");
  }
}

function start() {
  // Put your actual action here (navigate, connect, etc.)
  setStatus("Started ✅");
  startBtn.disabled = true;
  startBtn.style.opacity = "0.75";
  startBtn.style.cursor = "default";
}

fsBtn.addEventListener("click", toggleFullscreen);
startBtn.addEventListener("click", start);

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    fsBtn.querySelector("b").textContent = "Exit Fullscreen";
  } else {
    fsBtn.querySelector("b").textContent = "Fullscreen";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") toggleFullscreen();
  if (e.key === "Enter") start();
});
