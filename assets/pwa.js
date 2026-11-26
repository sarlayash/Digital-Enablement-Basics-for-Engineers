"use strict";

(() => {
  if (!("serviceWorker" in navigator)) return;

  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const topbar = document.querySelector(".top");
  const profile = document.querySelector(".profile");
  if (!standalone && topbar && profile) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pwa-install-button";
    button.textContent = "Install app";
    button.setAttribute("aria-label", "Install Engineer Field Guide on this device");
    button.style.cssText = "margin-left:auto;margin-right:18px;border:1px solid #d8deeb;background:#fff;color:#23345b;padding:9px 13px;border-radius:10px;font-size:12px;font-weight:700;white-space:nowrap";
    topbar.insertBefore(button, profile);

    let installPrompt = null;
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
    });

    button.addEventListener("click", async () => {
      if (!installPrompt) {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        window.alert(ios
          ? "To install: open the Share menu in Safari, then choose ‘Add to Home Screen’."
          : "To install: open your browser menu and choose ‘Install app’ or ‘Add to Home screen’. The portal can then open like an app and its study notes will be available offline after the first visit.");
        return;
      }
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
    });

    window.addEventListener("appinstalled", () => button.remove());
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(error => {
      console.warn("Offline install support could not start:", error);
    });
  }, { once: true });
})();
