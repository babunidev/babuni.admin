import {useEffect,useRef,useState} from 'react'
import {localConnectionApi} from '../../../shared/services/localConnectionClient'
import {useMorkahjaImageCacheStatus} from '../../../shared/services/morkahjaImageCacheStatus'

export type RemoteImageKind = 'encounter'|'solution'|'expansion'|'frame'|'portrait'

// Browser memory is only a fast first layer. The authoritative image cache
// persists on the operator's disk in the local service across browser restarts.
const cache=new Map<string,string>()
const pending=new Map<string,Promise<string>>()
const queue:Array<()=>void>=[]
let active=0
let bytesInMemory=0
const MAX_MEMORY=512*1024*1024

function schedule<T>(task:()=>Promise<T>):Promise<T> {
  return new Promise((resolve,reject)=>{
    const start=()=>{
      active++
      void task().then(resolve,reject).finally(()=>{
        active--
        queue.shift()?.()
      })
    }
    if(active<16)start()
    else queue.push(start)
  })
}
function put(key:string,src:string) {
  const old=cache.get(key)
  if(old)bytesInMemory-=old.length
  cache.delete(key)
  cache.set(key,src)
  bytesInMemory+=src.length
  // Storage evictions here do not delete any cached file on disk.
  while(bytesInMemory>MAX_MEMORY && cache.size>1) {
    const oldest=cache.keys().next().value
    if(!oldest)break
    const oldSrc=cache.get(oldest)
    if(oldSrc)bytesInMemory-=oldSrc.length
    cache.delete(oldest)
  }
}
function getImage(
  profileId:string,kind:RemoteImageKind,name:string,generation:number,
):Promise<string> {
  const file=name.endsWith('.webp')?name:name+'.webp'
  const key=profileId+':'+kind+':'+file+':'+generation
  const cached=cache.get(key)
  if(cached) {
    cache.delete(key)
    cache.set(key,cached)
    return Promise.resolve(cached)
  }
  const inflight=pending.get(key)
  if(inflight)return inflight
  const request=schedule(async()=>{
    const response=await localConnectionApi<{ok:true;base64:string;contentType:string}>(
      'POST','/'+profileId+'/content-image',{kind,name:file})
    if(response.contentType!=='image/webp'||!response.base64)
      throw new Error('IMAGE_INVALID_RESPONSE')
    const src='data:image/webp;base64,'+response.base64
    put(key,src)
    return src
  }).finally(()=>pending.delete(key))
  pending.set(key,request)
  return request
}
interface RemoteContentImageProps {
  profileId?: string
  kind: RemoteImageKind
  name: string
  fallbackSrc?: string
  alt?: string
  className?: string
}
export function RemoteContentImage({
  profileId,kind,name,fallbackSrc='',alt='',className='',
}:RemoteContentImageProps) {
  const element=useRef<HTMLSpanElement>(null)
  const [visible,setVisible]=useState(false)
  const [image,setImage]=useState({key:'',src:'',failed:false})
  const {generation}=useMorkahjaImageCacheStatus()
  const key=profileId+':'+kind+':'+name+':'+generation

  useEffect(()=>{
    const node=element.current
    if(!node)return
    if(typeof IntersectionObserver==='undefined'){
      const frame=requestAnimationFrame(()=>setVisible(true))
      return ()=>cancelAnimationFrame(frame)
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        setVisible(true)
        observer.disconnect()
      }
    },{rootMargin:'350px'})
    observer.observe(node)
    return ()=>observer.disconnect()
  },[profileId,kind,name])

  useEffect(()=>{
    if(!profileId||!visible||!name)return
    let cancelled=false
    let retry:ReturnType<typeof setTimeout>|undefined
    const attempt=()=>{
      void getImage(profileId,kind,name,generation).then(src=>{
        if(!cancelled)setImage({key,src,failed:false})
      }).catch(error=>{
        if(cancelled)return
        if(error instanceof Error && error.message==='IMAGE_CACHE_PENDING'){
          retry=setTimeout(attempt,2000)
        }else setImage({key,src:'',failed:true})
      })
    }
    attempt()
    return ()=>{
      cancelled=true
      if(retry)clearTimeout(retry)
    }
  },[profileId,kind,name,generation,visible,key])

  const current=image.key===key
  const failed=current && image.failed
  const src=profileId?(current&&!failed?image.src:''):fallbackSrc
  return <span ref={element} className="block min-h-px min-w-px">
    {src?<img src={src} alt={alt} loading="lazy" className={className}/>:
      <span className={`flex items-center justify-center bg-void/30 text-[10px] text-fog ${className}`}
        title={failed?'Image not present in the local or remote catalog':undefined}>
        {failed?'Image unavailable':visible?'Loading image…':''}
      </span>}
  </span>
}
