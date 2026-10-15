import { canonicalUrl, classify } from '../public/core.js';
import {parseHochiList} from './hochi.mjs';
function decode(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m,e) => {
    if(e[0]==='#') { const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''; }
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[e.toLowerCase()] || m;
  }).trim();
}
function tag(block,name) { return decode(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1] || ''); }
export function parseFeed(xml, source) {
  if (!/<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('RSS/Atom形式ではありません');
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  const fetchedAt = new Date().toISOString();
  return blocks.slice(0,200).flatMap(([,type,block]) => {
    const title=tag(block,'title').slice(0,3000);
    let link=tag(block,'link');
    if(type.toLowerCase()==='entry') {
      const links=[...block.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]);
      const preferred=links.find(l=>/rel\s*=\s*["']alternate["']/i.test(l)) || links.find(l=>!/rel\s*=/.test(l));
      link=decode(preferred?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || '');
    }
    let url; try { url=canonicalUrl(link); } catch { return []; }
    if (!title) return [];
    const raw=tag(block,'pubDate')||tag(block,'published')||tag(block,'updated')||tag(block,'dc:date');
    const publishedAt=raw && Number.isFinite(Date.parse(raw))?new Date(raw).toISOString():null;
    const id=`${source.id}:${url}`;
    return [{id,sourceId:source.id,sourceName:source.name,sourceItemId:tag(block,'guid')||tag(block,'id')||url,title,url,publishedAt,fetchedAt,...classify(title,source.category||'npb'),checked:false,starred:false}];
  });
}
async function boundedText(response) {
  const max=2*1024*1024;
  if(Number(response.headers.get('content-length'))>max) throw new Error('フィードのサイズが上限を超えました');
  const reader=response.body?.getReader(); if(!reader) return '';
  const chunks=[];let size=0;
  try { for(;;) { const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('フィードのサイズが上限を超えました');chunks.push(value); } }
  catch(e) { await reader.cancel().catch(()=>{});throw e; }
  const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return new TextDecoder().decode(all);
}
export async function collectNews(sources, fetcher = fetch) {
  const results=await Promise.all(sources.map(async source=>{
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetcher(source.url,{signal:controller.signal,headers:{Accept:source.type==='hochi-list'?'text/html':'application/rss+xml, application/atom+xml, application/xml, text/xml','User-Agent':'PersonalBaseballReader/1.0'},redirect:'follow'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const content=await boundedText(response);
      const articles=source.type==='hochi-list'?parseHochiList(content,source):parseFeed(content,source);
      return {articles,status:{id:source.id,name:source.label||source.name,ok:true,count:articles.length,at:new Date().toISOString()}};
    } catch(e) {return {articles:[],status:{id:source.id,name:source.label||source.name,ok:false,count:0,error:e.name==='AbortError'?'取得がタイムアウトしました':e.message,at:new Date().toISOString()}};}
    finally{clearTimeout(timer);}
  }));
  const unique=new Map();
  for(const item of results.flatMap(r=>r.articles)) {
    const old=unique.get(item.url);
    if(!old || item.category==='giants') unique.set(item.url,item);
  }
  return {articles:[...unique.values()],sources:results.map(r=>r.status),fetchedAt:new Date().toISOString()};
}
