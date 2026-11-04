#!/usr/bin/env node
import { LocalConnectionRegistry } from '../vite/localConnectionRegistry.ts'
import { createContentGrant, revokeContentGrant } from '../local-service/contentGrant.mjs'

const [action,id,dataset]=process.argv.slice(2)
if(!['grant','revoke'].includes(action)||!id||!dataset) {
  console.error('Usage: npm run morkahja:content-grant -- grant|revoke <local-files-profile-uuid> encounters|solutions|expansions|frames|portraits')
  process.exit(2)
}
try {
  const profile=new LocalConnectionRegistry().list().find(p=>p.id===id)
  if(!profile)throw Error('PROFILE_NOT_FOUND')
  if(action==='revoke'){
    const removed=revokeContentGrant(profile,dataset)
    console.log(removed?'Scoped content permission revoked.':'No matching permission was found.')
  }else{
    const grant=createContentGrant(profile,dataset)
    console.log('Scoped permission granted:',dataset,'for 15 minutes.')
    console.log('Directory:',grant.root)
    console.log('No game content was modified; each write also requires an exact revision and explicit confirmation.')
  }
}catch(error){
  console.error('Content authorization rejected:',error?.message||'CONTENT_SCOPE_DENIED')
  process.exitCode=1
}
