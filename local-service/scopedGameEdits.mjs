import {
  existsSync, lstatSync, readFileSync, mkdirSync, appendFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createHash } from 'node:crypto'
import { writeFileWithBackup, restoreBackup } from '../vite/atomicGameWrites.ts'
import { hasContentGrant, editableDatasets } from './contentGrant.mjs'

const maxFileBytes=8*1024*1024
const maxRecordBytes=256*1024
const active=new Set()
const sha=data=>createHash('sha256').update(data).digest('hex')
const isRecord=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const allowedKey=k=>typeof k==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(k) &&
  !['__proto__','prototype','constructor','_meta'].includes(k)

function target(profile,dataset) {
  if(profile?.projectId!=='morkahja'||profile.kind!=='local-files' ||
    !Object.prototype.hasOwnProperty.call(editableDatasets,dataset))throw Error('CONTENT_SCOPE_DENIED')
  const root=join(profile.target)
  const directory=join(root,'game')
  const info=lstatSync(directory)
  if(!info.isDirectory()||info.isSymbolicLink())throw Error('UNSAFE_GAME_DIRECTORY')
  const file=join(directory,editableDatasets[dataset])
  const stat=lstatSync(file)
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxFileBytes)throw Error('UNSAFE_GAME_FILE')
  return file
}
function parseDocument(bytes,dataset) {
  let data
  try {data=JSON.parse(bytes.toString('utf8'))}
  catch {throw Error('INVALID_GAME_JSON')}
  if(!isRecord(data))throw Error('INVALID_GAME_STRUCTURE')
  const collection=dataset==='expansions'?data.expansions:
    dataset==='frames'?data.Frames:dataset==='portraits'?data.Avatar:data
  if(!collection || typeof collection!=='object' ||
    (['frames','portraits'].includes(dataset)? !Array.isArray(collection):Array.isArray(collection))) {
    throw Error('INVALID_GAME_STRUCTURE')
  }
  return {data,collection}
}
function indexFor(dataset,key) {
  if(!allowedKey(key))throw Error('INVALID_RECORD_KEY')
  if(['frames','portraits'].includes(dataset)){
    if(!/^(0|[1-9][0-9]{0,4})$/.test(key)||Number(key)>10000)throw Error('INVALID_RECORD_KEY')
    return Number(key)
  }
  return key
}
function readDocument(profile,dataset,key) {
  const index=indexFor(dataset,key)
  const path=target(profile,dataset)
  const bytes=readFileSync(path)
  if(bytes.length>maxFileBytes)throw Error('GAME_FILE_TOO_LARGE')
  const document=parseDocument(bytes,dataset)
  return {path,revision:sha(bytes),index,...document}
}
function recordPayload(data,dataset,index) {
  if(!isRecord(data) || Buffer.byteLength(JSON.stringify(data))>maxRecordBytes ||
    Object.keys(data).some(k=>['__proto__','prototype','constructor'].includes(k)))
    throw Error('INVALID_RECORD_DATA')
  if(dataset==='frames' && data.frameID!==index)throw Error('RECORD_ID_MISMATCH')
  if(dataset==='portraits' && data.avatarID!==index)throw Error('RECORD_ID_MISMATCH')
  return data
}
function audit(operation) {
  const base=process.env.BABUNI_TEST_ACTION_LOG_DIR ||
    join(process.env.XDG_STATE_HOME||join(homedir(),'.local','state'),'babuni-admin')
  mkdirSync(base,{recursive:true,mode:0o700})
  const file=join(base,'content-actions.jsonl')
  if(existsSync(file) && (lstatSync(file).isSymbolicLink()||!lstatSync(file).isFile()||
    (lstatSync(file).mode&0o077)!==0))
    throw Error('AUDIT_LOG_UNSAFE')
  // Never log record contents, credentials, paths to secrets or player data.
  appendFileSync(file,JSON.stringify({at:new Date().toISOString(),...operation})+'\n',
    {encoding:'utf8',mode:0o600,flush:true})
}
function requirePermission(profile,dataset) {
  if(!hasContentGrant(profile,dataset))throw Error('CONTENT_WRITE_NOT_AUTHORIZED')
}
function withLock(profile,dataset,task) {
  const key=profile.id+':'+dataset
  if(active.has(key))throw Error('CONTENT_OPERATION_BUSY')
  active.add(key)
  try{return task()}finally{active.delete(key)}
}
export function previewEntry(profile,dataset,key) {
  const {revision,index,collection}=readDocument(profile,dataset,key)
  return {ok:true,readOnly:true,dataset,key:String(index),revision,
    record:collection[index]??null}
}
export function saveEntry(profile,dataset,key,input) {
  return withLock(profile,dataset,()=>{
    requirePermission(profile,dataset)
    if(!isRecord(input)||Object.keys(input).some(k=>!['expectedRevision','data','confirm'].includes(k)) ||
      input.confirm!==true||typeof input.expectedRevision!=='string'||
      !/^[0-9a-f]{64}$/.test(input.expectedRevision))throw Error('CONFIRMATION_REQUIRED')
    const doc=readDocument(profile,dataset,key)
    if(input.expectedRevision!==doc.revision)throw Error('REVISION_CONFLICT')
    const data=recordPayload(input.data,dataset,doc.index)
    doc.collection[doc.index]=data
    const next=JSON.stringify(doc.data,null,2)+'\n'
    if(Buffer.byteLength(next)>maxFileBytes)throw Error('GAME_FILE_TOO_LARGE')
    const nextRevision=sha(Buffer.from(next))
    audit({type:'write-requested',profileId:profile.id,dataset,key,from:doc.revision,to:nextRevision})
    // Grant must still be active immediately before replacement.
    requirePermission(profile,dataset)
    const backup=writeFileWithBackup(doc.path,next)
    try {
      audit({type:'write-complete',profileId:profile.id,dataset,key,from:doc.revision,
        to:nextRevision,backup:backup?basename(backup):null})
    } catch {
      if(backup) {
        try {restoreBackup(doc.path,backup)}catch{throw Error('PARTIAL_WRITE_NEEDS_RECOVERY')}
      }
      throw Error('WRITE_REVERTED_AUDIT_FAILURE')
    }
    return {ok:true,dataset,key,revision:nextRevision,previousRevision:doc.revision,
      backup:backup?basename(backup):null}
  })
}
export function restoreEntry(profile,dataset,key,input) {
  return withLock(profile,dataset,()=>{
    requirePermission(profile,dataset)
    if(!isRecord(input) || Object.keys(input).some(k=>!['expectedRevision','backup','confirm'].includes(k)) ||
      input.confirm!==true ||typeof input.expectedRevision!=='string' ||
      !/^[0-9a-f]{64}$/.test(input.expectedRevision) ||
      typeof input.backup!=='string' ||
      !/^[-a-zA-Z0-9_.]+\.bak-[0-9]+-[0-9a-f-]{36}$/.test(input.backup))throw Error('CONFIRMATION_REQUIRED')
    const doc=readDocument(profile,dataset,key)
    if(doc.revision!==input.expectedRevision)throw Error('REVISION_CONFLICT')
    const backup=join(join(profile.target,'game'),input.backup)
    if(!input.backup.startsWith(basename(doc.path)+'.bak-'))throw Error('INVALID_BACKUP_PATH')
    const backupInfo=lstatSync(backup)
    if(!backupInfo.isFile()||backupInfo.isSymbolicLink()||backupInfo.size>maxFileBytes)
      throw Error('INVALID_BACKUP_FILE')
    parseDocument(readFileSync(backup),dataset)
    audit({type:'restore-requested',profileId:profile.id,dataset,key,from:doc.revision,
      backup:input.backup})
    requirePermission(profile,dataset)
    const recoveryBackup=restoreBackup(doc.path,backup)
    const nextRevision=sha(readFileSync(doc.path))
    try {
      audit({type:'restore-complete',profileId:profile.id,dataset,key,
        from:doc.revision,to:nextRevision})
    } catch {
      if(recoveryBackup) {
        try {restoreBackup(doc.path,recoveryBackup)} catch {throw Error('PARTIAL_WRITE_NEEDS_RECOVERY')}
        throw Error('RESTORE_REVERTED_AUDIT_FAILURE')
      }
      throw Error('PARTIAL_WRITE_NEEDS_RECOVERY')
    }
    return {ok:true,restored:true,dataset,key,revision:nextRevision}
  })
}
