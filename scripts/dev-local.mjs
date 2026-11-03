import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
const servicePort = 5191
const args=process.argv.slice(2)
const portIndex=args.findIndex(x=>x==='--port')
const uiPort=portIndex>=0 ? Number(args[portIndex+1]) : 5180
if (!Number.isInteger(uiPort)||uiPort<1024||uiPort>65535) throw Error('Invalid Vite port')
const env={...process.env,BABUNI_LOCAL_SERVICE_PORT:String(servicePort),
  BABUNI_UI_PORT:String(uiPort),BABUNI_LOCAL_SERVICE_TOKEN:randomBytes(32).toString('hex')}
const service=spawn(process.execPath,['--experimental-strip-types','local-service/server.mjs'],{env,stdio:'inherit'})
let stopped=false
function stop(signal='SIGTERM') {
  if(stopped)return
  stopped=true
  service.kill(signal)
  if(vite) vite.kill(signal)
}
let vite
process.on('SIGINT',()=>stop('SIGINT'))
process.on('SIGTERM',()=>stop('SIGTERM'))
service.on('error',err=>{console.error('Local service failed to start:',err.message);stop()})
service.on('exit',(code)=>{if(!stopped){console.error('Local service stopped unexpectedly:',code);stop();process.exitCode=1}})
await sleep(700)
if (stopped) process.exit(1)
vite=spawn(process.execPath,['node_modules/vite/bin/vite.js',...args],{env,stdio:'inherit'})
vite.on('exit',(code)=>{if(!stopped){process.exitCode=code||0;stop()}})
vite.on('error',(err)=>{console.error('Vite failed:',err.message);stop();process.exitCode=1})
