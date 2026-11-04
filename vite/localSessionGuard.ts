import type { Plugin } from 'vite'
import { timingSafeEqual } from 'node:crypto'

const isLoopback = (address?:string) =>
  address==='127.0.0.1' || address==='::1' || address==='::ffff:127.0.0.1'
function equal(a:unknown,b:string):boolean {
  if(typeof a!=='string')return false
  const left=Buffer.from(a)
  const right=Buffer.from(b)
  return left.length===right.length && timingSafeEqual(left,right)
}

export function localSessionGuard(token:string, port:number):Plugin {
  if (token.length<32) throw new Error('Missing per-run UI session')
  return {
    name:'babuni-local-session-guard',apply:'serve',
    configureServer(server) {
      server.middlewares.use((req,res,next)=>{
        if (!req.url?.startsWith('/local-connections-api')) return next()
        const host=req.headers.host
        if (!isLoopback(req.socket.remoteAddress) ||
          !['127.0.0.1:'+port,'localhost:'+port].includes(host)) {
          res.writeHead(403);res.end();return
        }
        const requestedOrigin='http://'+host
        const origin=req.headers.origin
        if (origin && origin!==requestedOrigin) {res.writeHead(403);res.end();return}
        if (req.headers['sec-fetch-site'] &&
          !['same-origin','none'].includes(req.headers['sec-fetch-site'])) {
          res.writeHead(403);res.end();return
        }
        if (req.headers['x-babuni-local']!=='1') {res.writeHead(403);res.end();return}
        if (req.method!=='GET' && origin!==requestedOrigin) {
          res.writeHead(403);res.end();return
        }
        const path=new URL(req.url,'http://127.0.0.1').pathname
        if (path==='/local-connections-api/session') {
          if (req.method!=='GET') {res.writeHead(405);res.end();return}
          res.writeHead(200,{
            'Content-Type':'application/json; charset=utf-8',
            'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
          })
          res.end(JSON.stringify({session:token}))
          return
        }
        if (!equal(req.headers['x-babuni-session'],token)) {
          res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'})
          res.end(JSON.stringify({error:'LOCAL_SESSION_REQUIRED'}))
          return
        }
        next()
      })
    },
  }
}
