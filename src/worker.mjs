import {collectNews} from './news.mjs';
import {sources,sourceLinks} from './sources.mjs';
let cached=null, expires=0, pending=null;
export async function api(request) {
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return null;
  if(request.method!=='GET')return Response.json({error:'GETのみ利用できます。'},{status:405,headers:{Allow:'GET'}});
  if(url.pathname==='/api/sources')return Response.json({sources:sources.map(({id,name,label,home})=>({id,name,label,home})),sourceLinks});
  if(url.pathname!=='/api/news')return Response.json({error:'見つかりません'},{status:404});
  if(!cached||Date.now()>expires){
    pending ||= collectNews(sources).then(result=>{cached=result;expires=Date.now()+300000;return result;}).finally(()=>{pending=null;});
    await pending;
  }
  return Response.json(cached,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export default {async fetch(request,env){return await api(request)||env.ASSETS.fetch(request);}};
