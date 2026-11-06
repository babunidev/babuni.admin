import {useEffect,useRef,useState} from 'react'
import {localConnectionApi} from '../../../shared/services/localConnectionClient'

export type RemoteImageKind = 'encounter'|'solution'|'expansion'|'frame'|'portrait'
const cache=new Map<string,string>()
const pending=new Map<string,Promise<string>>()
const queue:Array<()=>void>=[]
let active=0
function schedule<T>(task:()=>Promise<T>):Promise<T> {
  return new Promise((resolve,reject)=>{
    const start=()=>{
      active++
      void task().then(resolve,reject).finally(()=>{
        active--
        queue.shift()?.()
      })
    }
    if(active<2)start()
    else queue.push(start)
  })
}
function getImage(profileId:string,kind:RemoteImageKind,name:string):Promise<string> {
  const file=name.endsWith('.webp')?name:name+'.webp'
  const key=profileId+':'+kind+':'+file
  const found=cache.get(key)
  if(found)return Promise.resolve(found)
  const current=pending.get(key)
  if(current)return current
  const request=schedule(async()=>{
    const response=await localConnectionApi<{ok:true;base64:string;contentType:string}>(
      'POST','/'+profileId+'/content-image',{kind,name:file})
    if(response.contentType!=='image/webp'||!response.base64)
      throw new Error('IMAGE_INVALID_RESPONSE')
    const src='data:image/webp;base64,'+response.base64
    cache.set(key,src)
    // Avoid retaining unbounded remote images in the desktop browser.
    if(cache.size>48)cache.delete(cache.keys().next().value!)
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

  useEffect(()=>{
    const node=element.current
    if(!node)return
    if(typeof IntersectionObserver==='undefined') {
      const frame=requestAnimationFrame(()=>setVisible(true))
      return ()=>cancelAnimationFrame(frame)
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        setVisible(true)
        observer.disconnect()
      }
    },{rootMargin:'250px'})
    observer.observe(node)
    return ()=>observer.disconnect()
  },[name,kind,profileId])

  useEffect(()=>{
    let cancelled=false
    if(!profileId||!visible||!name)return
    void getImage(profileId,kind,name).then(src=>{
      if(!cancelled)setImage({key:profileId+':'+kind+':'+name,src,failed:false})
    }).catch(()=>{
      if(!cancelled)setImage({key:profileId+':'+kind+':'+name,src:'',failed:true})
    })
    return ()=>{cancelled=true}
  },[profileId,kind,name,visible])

  const current=image.key===profileId+':'+kind+':'+name
  const failed=current && image.failed
  const src=profileId?(current && !failed?image.src:''):fallbackSrc
  return <span ref={element} className="contents">
    {src?<img src={src} alt={alt} loading="lazy" className={className}/>:
      <span className={`flex items-center justify-center bg-void/30 text-[10px] text-fog ${className}`}
        title={failed?'Image unavailable on server':undefined}>
        {failed?'Image unavailable':visible?'Loading image…':''}
      </span>}
  </span>
}
