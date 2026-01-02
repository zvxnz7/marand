(function () {
    const fsBtn = document.getElementById("fsBtn");
    const topbar = document.getElementById("topbar");
  
    if (!fsBtn || !topbar) return;
  
    function isFullscreen() {
      return !!document.fullscreenElement;
    }
  
    async function enterFullscreen() {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      } catch (e) {}
    }
  
    async function exitFullscreen() {
      try {
        await document.exitFullscreen();
      } catch (e) {}
    }
  
    fsBtn.addEventListener("click", async () => {
      if (!isFullscreen()) await enterFullscreen();
      else await exitFullscreen();
    });
  
    document.addEventListener("fullscreenchange", () => {
      const on = isFullscreen();
      fsBtn.textContent = on ? "Exit FS" : "Fullscreen";
  
  
      document.documentElement.style.setProperty("--top", on ? "0px" : "56px");
    });
  })();
  