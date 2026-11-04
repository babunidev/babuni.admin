import {
  existsSync, lstatSync, mkdirSync, readFileSync, openSync, writeFileSync,
  fsyncSync, closeSync, renameSync, unlinkSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

const idPattern=/^[0-9a-f-]{36}$/i
const userPattern=/^[a-z_][a-z0-9_-]{0,62}$/i
const dbPattern=/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/
const configRoot=()=>process.env.BABUNI_TEST_MORKAHJA_CONFIG_DIR ||
  join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'babuni-admin','morkahja-postgres')
function fileFor(id) {
  if (typeof id!=='string'||!idPattern.test(id)) throw Error('INVALID_PROFILE')
  return join(configRoot(),id+'.json')
}
function validate(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) ||
    Object.keys(value).some(k=>!['sshUser','databaseUser','databaseName','identityFile'].includes(k)) ||
    typeof value.sshUser!=='string' || !userPattern.test(value.sshUser) ||
    typeof value.databaseUser!=='string' || !userPattern.test(value.databaseUser) ||
    typeof value.databaseName!=='string' || !dbPattern.test(value.databaseName)) {
    throw Error('INVALID_DB_CONFIG')
  }
  const config={
    sshUser:value.sshUser,databaseUser:value.databaseUser,databaseName:value.databaseName,
  }
  if (value.identityFile !== undefined) {
    if (typeof value.identityFile!=='string') throw Error('INVALID_DB_CONFIG')
    const root=resolve(homedir(),'.ssh')+sep
    const file=resolve(value.identityFile)
    if (!file.startsWith(root)) throw Error('IDENTITY_OUTSIDE_SSH_DIRECTORY')
    const info=lstatSync(file)
    if (!info.isFile() || info.isSymbolicLink() || (info.mode&0o077)!==0) {
      throw Error('INSECURE_IDENTITY_FILE')
    }
    config.identityFile=file
  }
  return config
}
export function saveMorkahjaConfig(profile,value) {
  if (profile?.kind!=='postgres-ssh' || profile.projectId!=='morkahja') throw Error('UNSUPPORTED_PROFILE')
  const config=validate(value)
  const path=fileFor(profile.id)
  mkdirSync(dirname(path),{recursive:true,mode:0o700})
  const dir=lstatSync(dirname(path))
  if(!dir.isDirectory()||(dir.mode&0o077)!==0)throw Error('INSECURE_CONFIG_DIRECTORY')
  if(existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()))
    throw Error('UNSAFE_CONFIG_PATH')
  const tmp=path+'.'+randomUUID()+'.tmp'
  let fd
  try{
    fd=openSync(tmp,'wx',0o600)
    writeFileSync(fd,JSON.stringify(config,null,2)+'\n')
    fsyncSync(fd)
    closeSync(fd);fd=undefined
    renameSync(tmp,path)
  }finally{
    if(fd!==undefined)closeSync(fd)
    if(existsSync(tmp))unlinkSync(tmp)
  }
  return config
}
export function readMorkahjaConfig(profile) {
  if(profile?.kind!=='postgres-ssh'||profile.projectId!=='morkahja')throw Error('UNSUPPORTED_PROFILE')
  const path=fileFor(profile.id)
  if(!existsSync(path))throw Error('DB_CONFIG_MISSING')
  const info=lstatSync(path)
  if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)throw Error('INSECURE_DB_CONFIG')
  return validate(JSON.parse(readFileSync(path,'utf8')))
}
export function removeMorkahjaConfig(profile) {
  if(profile?.kind!=='postgres-ssh'||profile.projectId!=='morkahja')return
  const path=fileFor(profile.id)
  if(!existsSync(path))return
  const info=lstatSync(path)
  if(!info.isFile()||info.isSymbolicLink())throw Error('UNSAFE_CONFIG_PATH')
  unlinkSync(path)
}
