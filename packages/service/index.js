// @htx/service

import compile from '@htx/compiler';

const on    = self.addEventListener;
const isHTX = (str) => str.endsWith('.htx') || str.endsWith('.htx.html');      

// 1. activate immediately during install phase
// 2. claim active clients immediately
on('install',  ()      => { self.skipWaiting(); });
on('activate', (event) => { event.waitUntil(self.clients.claim()); });

// 3. intercept request pipeline for .htx files
on('fetch', (event) => {
  const { request }  = event;
  const { pathname } = new URL(request.url);

  if (isHTX(pathname)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const rawHTX   = await response.text();
          const compiled = compile (rawHTX);

          return new Response (compiled, {
            headers: {
              'Content-Type': 'text/js; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (err) {
          console.error('[HTX SW] Interception failed:', err);
          return fetch (request);
        }
      })()
    );
  }
});
