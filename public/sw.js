// Recebe as notificações push (funciona com o site fechado e a tela apagada)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { corpo: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Marcos Magazine', {
    body: d.corpo || 'Você tem uma novidade na Negociação',
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    tag: d.tag || 'marcos-magazine',
    renotify: true,
    data: { url: d.url || '/negociacao?aba=entradas' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/negociacao?aba=entradas'
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of abertas) {
      if (c.url.includes('/negociacao')) { await c.focus(); c.navigate(url); return }
    }
    await self.clients.openWindow(url)
  })())
})
