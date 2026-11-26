"use strict";

const CACHE_NAME = "engineer-field-guide-pwa-v4";
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/pwa.js",
  "./assets/daily-learning.js?v=voice-mocks-capstones-20261126",
  "./assets/cloud-hero.png",
  "./assets/security-hero.png",
  "./assets/ai-hero.png",
  "./assets/iot-blockchain-hero.png",
  "./assets/future-tech-hero.png",
  "./assets/landing-banner.png",
  "./assets/pwa-icon-192.png",
  "./assets/pwa-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = APP_FILES.map(path => new URL(path, self.registration.scope).href);
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("engineer-field-guide-pwa-") && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL("./index.html", self.registration.scope), response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(new URL("./index.html", self.registration.scope))) || (await caches.match(new URL("./", self.registration.scope)));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return new Response("This resource is not available offline yet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
