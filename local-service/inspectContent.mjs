import { open, realpath, lstat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const datasets = ['encountersdata.json','solutiondata.json','expansiondata.json','frames.json','portraits.json']
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
        if (!info.isFile() || info.size>8*1024*1024) throw Error('UNSAFE_FILE')
        const data=JSON.parse(await handle.readFile('utf8'))
        if (!data || typeof data!=='object') throw Error('INVALID_STRUCTURE')
        const content=name==='expansiondata.json' ? data.expansions : name==='frames.json' ? data.Frames : name==='portraits.json' ? data.Portraits : data
        if (!content || typeof content!=='object') throw Error('INVALID_STRUCTURE')
        files.push({name,status:'available',entries:Object.keys(content).filter(k=>k!=='_meta').length,bytes:info.size})
      } finally {await handle.close()}
    } catch(error) {
      files.push({name,status:'unavailable',reason:error?.code==='ENOENT'?'MISSING':error instanceof SyntaxError?'INVALID_JSON':'UNREADABLE'})
    }
  }
  return {ok:true,readOnly:true,files}
}
