import { open, realpath, lstat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const datasets = ['encountersdata.json','solutiondata.json','expansiondata.json','frames.json','portraits.json']
function reason(error) {
  if (error?.code === 'ENOENT') return 'MISSING'
  if (['EACCES','EPERM'].includes(error?.code)) return 'PERMISSION_DENIED'
  if (error instanceof SyntaxError) return 'INVALID_JSON'
  if (['UNSAFE_PATH','UNSAFE_FILE','FILE_TOO_LARGE','INVALID_STRUCTURE'].includes(error?.message)) return error.message
  return 'UNREADABLE'
}
export async function inspectContent(profile) {
  if (profile.kind !== 'local-files' || profile.projectId !== 'morkahja') return {ok:false,error:'UNSUPPORTED_PROFILE'}
  let root
  try {root=await realpath(profile.target)} catch{return {ok:false,error:'DIRECTORY_UNAVAILABLE'}}
  const files=[]
  for (const name of datasets) {
    const file=resolve(root,'game',name)
    try {
      const actual=await realpath(file)
      if (!actual.startsWith(root+sep) || (await lstat(file)).isSymbolicLink()) throw Error('UNSAFE_PATH')
      const handle=await open(file,'r')
      try {
        const info=await handle.stat()
        if (!info.isFile()) throw Error('UNSAFE_FILE')
        if (info.size>8*1024*1024) throw Error('FILE_TOO_LARGE')
        const data=JSON.parse(await handle.readFile('utf8'))
        if (!data || typeof data!=='object' || Array.isArray(data)) throw Error('INVALID_STRUCTURE')
        const content=name==='expansiondata.json' ? data.expansions
          : name==='frames.json' ? data.Frames : name==='portraits.json' ? data.Avatar : data
        if (!content || typeof content!=='object') throw Error('INVALID_STRUCTURE')
        files.push({name,status:'available',entries:Object.keys(content).filter(k=>k!=='_meta').length,bytes:info.size})
      } finally {await handle.close()}
    } catch(error) {
      files.push({name,status:'unavailable',reason:reason(error)})
    }
  }
  return {ok:true,readOnly:true,files}
}
