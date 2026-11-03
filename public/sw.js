// Makes the panel installable. It deliberately caches nothing: the panel always
// loads fresh from the network, so an installed copy can never show an old version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
