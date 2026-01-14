// @ts-check

// v3 baseline app (runs immediately on import)
import "../app.js";
import { initShell } from "./shell.js";

initShell();

if("serviceWorker" in navigator){
  const swUrl = new URL("../sw.js", import.meta.url);
  const toast = document.getElementById("updateToast");
  const reloadBtn = document.getElementById("updateReload");
  let refreshing = false;

  const showUpdate = (registration) => {
    if(!registration || !toast || !reloadBtn) return;
    toast.hidden = false;
    reloadBtn.onclick = () => {
      if(registration && registration.waiting){
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };
  };

  navigator.serviceWorker.register(swUrl).then((registration) => {
    if(!registration) return;
    if(registration.waiting && navigator.serviceWorker.controller){
      showUpdate(registration);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if(!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if(newWorker.state === "installed" && navigator.serviceWorker.controller){
          showUpdate(registration);
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if(refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
