import {
  existsSync, lstatSync, mkdirSync, openSync, writeFileSync,
  readFileSync, closeSync, renameSync, unlinkSync, realpathSync, fsyncSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const editableDatasets=Object.freeze({
  encounters:'encountersdata.json',
  solutions:'solutiondata.json',
  expansions:'expansiondata.json',
  frames:'frames.json',
  portraits:'portraits.json',
})
const validProfile=profile=>profile?.projectId==='morkahja' &&
  profile.kind==='local-files' && /^[0-9a-f-]{36}$/i.test(profile.id)
const allowed=dataset=>Object.prototype.hasOwnProperty.call(editableDatasets,dataset)
const folder=()=>process.env.BABUNI_TEST_CONTENT_GRANT_DIR ||
  join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'babuni-admin','content-grants')
function pathFor(profile,dataset) {
  if(!validProfile(profile)||!allowed(dataset))throw Error('CONTENT_SCOPE_DENIED')
  return join(folder(),profile.id+'-'+dataset+'.json')
}
export function createContentGrant(profile,dataset,minutes=15) {
  if(!Number.isInteger(minutes)||minutes<1||minutes>60)throw Error('INVALID_GRANT_DURATION')
  const path=pathFor(profile,dataset)
  const root=realpathSync(profile.target)
  const game=realpathSync(join(root,'game'))
  if(game!==join(root,'game'))throw Error('UNSAFE_GAME_DIRECTORY')
  const grant={profileId:profile.id,root,dataset,
    expiresAt:new Date(Date.now()+minutes*60000).toISOString()}
  mkdirSync(dirname(path),{recursive:true,mode:0o700})
  if((lstatSync(dirname(path)).mode&0o077)!==0)throw Error('INSECURE_GRANT_DIRECTORY')
  if(existsSync(path) && (lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile()))
    throw Error('UNSAFE_GRANT_FILE')
  const tmp=path+'.'+randomUUID()+'.tmp'
  let fd
  try {
    fd=openSync(tmp,'wx',0o600)
    writeFileSync(fd,JSON.stringify(grant,null,2)+'\n')
    fsyncSync(fd)
    closeSync(fd);fd=undefined
    renameSync(tmp,path)
  } finally {
    if(fd!==undefined)closeSync(fd)
    if(existsSync(tmp))unlinkSync(tmp)
  }
  return grant
}
export function hasContentGrant(profile,dataset) {
  let path
  try {path=pathFor(profile,dataset)}
  catch{return false}
  if(!existsSync(path))return false
  try {
    const file=lstatSync(path)
    if(!file.isFile()||file.isSymbolicLink()||(file.mode&0o077)!==0)return false
    const grant=JSON.parse(readFileSync(path,'utf8'))
    return grant.profileId===profile.id && grant.dataset===dataset &&
      typeof grant.expiresAt==='string' &&
      Number.isFinite(Date.parse(grant.expiresAt)) &&
      Date.parse(grant.expiresAt)>Date.now() &&
      grant.root===realpathSync(profile.target)
  } catch {return false}
}
export function revokeContentGrant(profile,dataset) {
  const path=pathFor(profile,dataset)
  if(!existsSync(path))return false
  if(lstatSync(path).isSymbolicLink())throw Error('UNSAFE_GRANT_FILE')
  unlinkSync(path)
  return true
}
export function revokeAllContentGrants(profile) {
  if(!validProfile(profile))return
  for(const dataset of Object.keys(editableDatasets))revokeContentGrant(profile,dataset)
}
