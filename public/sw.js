const CACHE='crypto-radar-shell-v1'
const CORE=['/','/manifest.webmanifest']

self.addEventListener('install',(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(CORE)).catch(()=>null))
  self.skipWaiting()
})

self.addEventListener('activate',(event)=>{
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch',(event)=>{
  if(event.request.method!=='GET') return
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then((r)=>r||caches.match('/'))))
})

self.addEventListener('push',(event)=>{
  let data={}
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||''}}
  const title=data.title||'Crypto Radar · algo está ocurriendo'
  const options={
    body:data.body||'Tocá para abrir Crypto Radar y ver qué cambió.',
    tag:data.tag||'crypto-radar-push',
    renotify:true,
    data:{url:data.url||'/?tab=ahora'}
  }
  event.waitUntil(self.registration.showNotification(title,options))
})

self.addEventListener('notificationclick',(event)=>{
  event.notification.close()
  const target=event.notification.data?.url||'/?tab=ahora'
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then((windows)=>{
    for(const client of windows){
      if('focus' in client){client.navigate(target);return client.focus()}
    }
    return clients.openWindow(target)
  }))
})
