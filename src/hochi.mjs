import {canonicalUrl,classify} from '../public/core.js';

function text(html){
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(m,e)=>{
    if(e.startsWith('#')){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[e.toLowerCase()]||m;
  }).replace(/\s+/g,' ').trim();
}
function attr(attributes,name){return text(attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,'i'))?.[2]||'');}
function hasClass(attributes,name){return attr(attributes,'class').split(/\s+/).includes(name);}
function field(block,element,className){
  for(const [,attributes,content]of block.matchAll(new RegExp(`<${element}\\b([^>]*)>([\\s\\S]*?)<\\/${element}\\s*>`,'gi')))if(hasClass(attributes,className))return {attributes,content:text(content)};
  return null;
}
function publishedDate(time){
  if(!time)return null;
  const iso=attr(time.attributes,'datetime');
  if(iso&&/(Z|[+-]\d\d:\d\d)$/i.test(iso)&&Number.isFinite(Date.parse(iso)))return new Date(iso).toISOString();
  const m=time.content.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
  if(!m)return null;
  const [,y,mo,d,h,mi]=m,local=`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${mi}:00+09:00`;
  if(!Number.isFinite(Date.parse(local)))return null;
  return new Date(local).toISOString();
}
export function parseHochiList(html,source){
  const fetchedAt=new Date().toISOString(),articles=new Map();
  for(const [,attributes,content]of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)){
    if(!hasClass(attributes,'article-list__unit'))continue;
    let url;
    try{url=new URL(attr(attributes,'href'),source.url);if(url.hostname!=='hochi.news'||!/^\/articles\/[^/]+\.html$/.test(url.pathname))continue;url=canonicalUrl(url.href);}catch{continue;}
    const title=field(content,'h3','article-list__title')?.content;
    if(!title)continue;
    const publishedAt=publishedDate(field(content,'time','article-list__date'));
    const sourceItemId=new URL(url).pathname.split('/').pop().replace(/\.html$/,'');
    articles.set(url,{id:`${source.id}:${sourceItemId}`,sourceId:source.id,sourceName:source.name,sourceItemId,title:title.slice(0,3000),url,publishedAt,fetchedAt,...classify(title,'giants'),checked:false,starred:false});
    if(articles.size>=100)break;
  }
  if(!articles.size)throw new Error('スポーツ報知の一覧から記事を取得できません。ページ構造や接続状況を確認してください。');
  return [...articles.values()];
}
