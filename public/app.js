import {openDB,readAll,replaceAll} from './db.js';
import {VERSION,canonicalUrl,classify,mergeArticles,validateBackup,japanDay,chatText,markdownForNote,markdownForArticle} from './core.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>value?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'公開日時不明';
const fullDate=value=>value?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'まだありません';
let state={articles:[],notes:[],articleNotes:[],settings:{}}, view='articles', page=1,notePage=1,status='all',busy=false,ready=false;
let selected=new Set(), currentPage=[],editor=null,pendingRestore=null,toastTimer,outputName='野球記事ノート';
let media={sources:[{id:'full-count-npb',name:'Full-Count',home:'https://full-count.jp/category/npb/'}],sourceLinks:[]};
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('baseball-notes'):null;
function notify(text,error=false){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?9000:4000);}
function guard(fn){return async event=>{try{await fn(event);}catch(e){console.error(e);notify(e.message||'操作に失敗しました。',true);}};}
async function transaction(change){
  if(!ready)throw new Error('保存データの準備ができていません。');
  const run=async()=>{const next=await readAll();await change(next);await replaceAll(next);state=next;render();channel?.postMessage('updated');};
  if(navigator.locks)await navigator.locks.request('baseball-notes-write',run);else await run();
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function filename(title){return title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,90)||'野球記事ノート';}
function makeBackup(data=state){return JSON.stringify({version:VERSION,exportedAt:new Date().toISOString(),articles:data.articles,notes:data.notes,articleNotes:data.articleNotes,settings:data.settings},null,2);}
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
async function copy(text){try{await navigator.clipboard.writeText(text);notify('コピーしました');return true;}catch{return false;}}
async function showOutput(text,name,markdown=true,autoCopy=false){outputName=name;$('output-text').value=text;$('download-markdown').hidden=!markdown;$('text-dialog').showModal();if(autoCopy&&!await copy(text)){notify('下の内容を選択してコピーしてください。');$('output-text').select();}}
function showView(next){view=next;$('articles-view').hidden=view!=='articles';$('notes-view').hidden=view!=='notes';document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===view;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});render();}
function empty(title,text,action=''){return `<div class="empty"><img src="/favicon.svg" alt=""><h3>${escape(title)}</h3><p>${escape(text)}</p>${action}</div>`;}
function articleMatches(a){const q=$('article-search').value.trim().toLowerCase(),cat=$('category-filter').value;
  return (!q||`${a.title} ${a.sourceName} ${a.tags.join(' ')}`.toLowerCase().includes(q))&&(!cat||(cat==='npb'?['npb','giants'].includes(a.category):a.category===cat))&&(!$('source-filter').value||a.sourceName===$('source-filter').value)&&(!$('today-filter').checked||japanDay(a.publishedAt||a.fetchedAt)===japanDay())&&(status==='all'||(status==='unread'&&!a.checked)||(status==='read'&&a.checked)||(status==='star'&&a.starred));
}
function renderArticles(){
  const list=state.articles.filter(articleMatches).sort((a,b)=>($('sort-filter').value==='giants'?(Number(b.category==='giants')-Number(a.category==='giants')):0)||Date.parse(b.publishedAt||b.fetchedAt)-Date.parse(a.publishedAt||a.fetchedAt));
  const pages=Math.max(1,Math.ceil(list.length/15));page=Math.min(page,pages);currentPage=list.slice((page-1)*15,page*15);
  $('result-count').textContent=`${list.length.toLocaleString()}件の記事`;
  $('article-list').innerHTML=currentPage.map(a=>{
    const notes=state.articleNotes.filter(l=>l.articleId===a.id).map(l=>state.notes.find(n=>n.id===l.noteId)).filter(Boolean);
    return `<article class="article ${a.checked?'checked':''}" data-id="${escape(a.id)}"><label class="article-select"><input type="checkbox" data-action="select" ${selected.has(a.id)?'checked':''} aria-label="${escape(a.title)}を選択"></label><div class="article-main"><div class="article-meta"><span class="source-name">${escape(a.sourceName)}</span><time datetime="${escape(a.publishedAt||a.fetchedAt)}">${fmt(a.publishedAt||a.fetchedAt)}${a.publishedAt?'':' 取得'}</time><span class="category">${({giants:'巨人',npb:'NPB',other:'その他'})[a.category]}</span>${a.checked?'<span class="read-label">確認済み</span>':''}</div><h2 class="article-title"><a href="${escape(a.url)}" target="_blank" rel="noopener noreferrer">${escape(a.title)}</a></h2><div class="article-actions"><button data-action="check" class="check-button">${a.checked?'✓ 確認済み':'○ 未確認'}</button><a href="${escape(a.url)}" target="_blank" rel="noopener noreferrer">記事を開く ↗</a><button data-action="note">メモを作る</button><button data-action="copy">コピー</button><button data-action="markdown">Markdown</button></div>${notes.length?`<div class="related-notes"><span>関連メモ</span>${notes.map(n=>`<button data-action="edit-note" data-note="${escape(n.id)}">${escape(n.title)}</button>`).join('')}</div>`:''}</div><button class="star-button ${a.starred?'on':''}" data-action="star" aria-pressed="${a.starred}" aria-label="${a.starred?'保存を解除':'記事を保存'}">${a.starred?'★':'☆'}</button></article>`;
  }).join('')||empty(state.articles.length?'条件に合う記事はありません':'最初の記事を集めましょう',state.articles.length?'検索や絞り込みを変更してみてください。':busy?'新しい記事を取得しています。保存済みの記事は次回からすぐ表示されます。':'「今すぐ更新」で取得するか、元サイトで見つけた記事を追加できます。',state.articles.length?'':'<button class="secondary" data-action="add-manual">＋ 記事を追加</button>');
  $('article-pagination').innerHTML=list.length?`<button data-page="-1" ${page===1?'disabled':''}>前へ</button><span>${page} / ${pages} ページ</span><button data-page="1" ${page===pages?'disabled':''}>次へ</button>`:'';
  updateSelection();
}
function updateSelection(){
  selected=new Set([...selected].filter(id=>state.articles.some(a=>a.id===id)));
  $('selection-bar').hidden=!selected.size;$('selection-count').textContent=`${selected.size}件を選択中`;
  $('select-page').checked=currentPage.length>0&&currentPage.every(a=>selected.has(a.id));
  $('select-page').indeterminate=currentPage.some(a=>selected.has(a.id))&&!$('select-page').checked;
}
function renderNotes(){
  const q=$('note-search').value.trim().toLowerCase(),has=$('note-links-filter').value,sort=$('note-sort').value;
  const list=state.notes.filter(n=>{const linked=state.articleNotes.some(l=>l.noteId===n.id);return(!q||`${n.title} ${n.body} ${n.tags.join(' ')}`.toLowerCase().includes(q))&&(!has||(has==='yes'?linked:!linked));}).sort((a,b)=>Date.parse(b[sort])-Date.parse(a[sort]));
  const pages=Math.max(1,Math.ceil(list.length/12));notePage=Math.min(notePage,pages);
  $('note-count').textContent=`${list.length}件のメモ`;
  $('note-list').innerHTML=list.slice((notePage-1)*12,notePage*12).map(n=>{
    const count=state.articleNotes.filter(l=>l.noteId===n.id).length;
    return `<article class="note-card" data-note="${escape(n.id)}"><h3><button class="note-edit" data-action="edit">${escape(n.title)}</button></h3><p class="note-preview">${escape(n.body||'まだ本文がありません。')}</p><div class="tag-list">${n.tags.map(t=>`<span>#${escape(t)}</span>`).join('')}</div><div class="note-card-footer"><time datetime="${n.updatedAt}">${fmt(n.updatedAt)} 更新</time><span>関連記事 ${count}件</span><button data-action="markdown">Markdown</button></div></article>`;
  }).join('')||empty('考えを書き留めてみましょう',state.notes.length?'検索条件に合うメモがありません。':'記事の「メモを作る」からでも、ここからでも始められます。','<button data-action="new" class="secondary">＋ メモを作る</button>');
  $('note-pagination').innerHTML=list.length?`<button data-page="-1" ${notePage===1?'disabled':''}>前へ</button><span>${notePage} / ${pages} ページ</span><button data-page="1" ${notePage===pages?'disabled':''}>次へ</button>`:'';
}
function render(){
  $('nav-articles').textContent=state.articles.length;$('nav-notes').textContent=state.notes.length;
  $('unread-count').textContent=state.articles.filter(a=>!a.checked).length;$('starred-count').textContent=state.articles.filter(a=>a.starred).length;$('memo-count').textContent=state.notes.length;
  const currentSource=$('source-filter').value,names=[...new Set([...media.sources.map(s=>s.name),...state.articles.map(a=>a.sourceName)])];
  $('source-filter').innerHTML='<option value="">すべての媒体</option>'+names.map(n=>`<option value="${escape(n)}">${escape(n)}</option>`).join('');$('source-filter').value=names.includes(currentSource)?currentSource:'';
  renderArticles();renderNotes();renderSources();renderBackup();
}
function renderSources(){
  const statuses=state.settings.sourceStatus||[];
  $('source-status').innerHTML=media.sources.map(s=>{const r=statuses.find(x=>x.id===s.id);return `<div class="source-item"><h3>${escape(s.label||s.name)} <span class="category">自動取得</span></h3><p>${busy?'取得中…':r?(r.ok?`${r.count}件取得`:`取得失敗：${escape(r.error)}`):'未取得'}</p><p>${r?fullDate(r.at):'公式RSSから取得します'}</p><a href="${escape(s.home)}" target="_blank" rel="noopener noreferrer">元サイトを開く ↗</a></div>`;}).join('');
  $('source-links').innerHTML=media.sourceLinks.map(s=>`<div class="source-item"><h3><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a></h3><p>${escape(s.reason)}</p></div>`).join('');
}
function renderBackup(){
  $('backup-info').textContent=`記事 ${state.articles.length}件・メモ ${state.notes.length}件・関連付け ${state.articleNotes.length}件`;
  $('last-backup').textContent=`最終書き出し：${fullDate(state.settings.lastBackup)}`;
}
async function refresh(){
  if(busy||!ready)return;busy=true;$('refresh-button').disabled=true;$('refresh-label').textContent='取得中…';$('refresh-icon').classList.add('spinning');$('update-status').textContent='新しい記事を取得中…';renderArticles();renderSources();
  try{
    const response=await fetch('/api/news',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`記事取得APIに接続できません（${response.status}）`);
    const data=await response.json();if(!Array.isArray(data.articles)||!Array.isArray(data.sources))throw new Error('取得結果の形式が不正です。');
    // Validate incoming records using the same boundary as JSON restoration.
    const incoming=validateBackup({version:VERSION,articles:data.articles,notes:[],articleNotes:[]}).articles;
    let added=0;await transaction(next=>{const merged=mergeArticles(next.articles,incoming);next.articles=merged.articles;added=merged.added;next.settings.sourceStatus=data.sources;next.settings.lastFetch=data.fetchedAt;});
    const failed=data.sources.filter(s=>!s.ok).length;
    $('update-status').textContent=failed===data.sources.length?'取得できませんでした。取得状況を確認してください。':`${fmt(data.fetchedAt)} 更新 · 新着 ${added}件${failed?` · ${failed}媒体で取得失敗`:''}`;
    if(failed)notify('一部の記事を取得できませんでした。「取得状況」を確認できます。',true);
  }catch(e){$('update-status').textContent='取得に失敗しました。保存済みデータは利用できます。';notify(e.message,true);}
  finally{busy=false;$('refresh-button').disabled=false;$('refresh-label').textContent='今すぐ更新';$('refresh-icon').classList.remove('spinning');renderArticles();renderSources();}
}
function noteArticles(id){return state.articleNotes.filter(l=>l.noteId===id).map(l=>state.articles.find(a=>a.id===l.articleId)).filter(Boolean);}
function articleNotes(id){return state.articleNotes.filter(l=>l.articleId===id).map(l=>state.notes.find(n=>n.id===l.noteId)).filter(Boolean);}
function editorSnapshot(){return JSON.stringify({title:$('note-title').value,body:$('note-body').value,tags:$('note-tags').value,links:[...editor.links].sort()});}
function openEditor(noteId=null,articleId=null){
  const note=state.notes.find(n=>n.id===noteId);
  editor={id:note?.id||null,createdAt:note?.createdAt,links:new Set(note?noteArticles(note.id).map(a=>a.id):articleId?[articleId]:[])};
  $('note-title').value=note?.title||'';$('note-body').value=note?.body||'';$('note-tags').value=note?.tags.join(', ')||'';$('link-search').value='';
  $('editor-heading').textContent=note?'メモを編集':'メモを作る';$('delete-note').hidden=!note;
  $('note-dates').textContent=note?`作成：${fullDate(note.createdAt)} / 更新：${fullDate(note.updatedAt)}`:'';
  renderEditorLinks();editor.initial=editorSnapshot();$('note-dialog').showModal();
}
function renderEditorLinks(){
  $('editor-related').innerHTML=[...editor.links].map(id=>state.articles.find(a=>a.id===id)).filter(Boolean).map(a=>`<div class="related-item"><a href="${escape(a.url)}" target="_blank" rel="noopener noreferrer">${escape(a.title)}</a><button type="button" class="small" data-unlink="${escape(a.id)}">外す</button></div>`).join('')||'<p class="muted">関連記事はまだありません。</p>';
  const q=$('link-search').value.trim().toLowerCase();
  const found=state.articles.filter(a=>!editor.links.has(a.id)&&(!q||a.title.toLowerCase().includes(q))).sort((a,b)=>Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt)).slice(0,12);
  $('link-results').innerHTML=found.map(a=>`<div class="link-item"><span>${escape(a.title)}</span><button type="button" class="small" data-link="${escape(a.id)}">追加</button></div>`).join('')||'<p class="muted">追加できる記事がありません。</p>';
}
function closeDialog(id){if(id==='note-dialog'&&editor&&editorSnapshot()!==editor.initial&&!confirm('保存していない変更を破棄しますか？'))return;$(id).close();if(id==='note-dialog')editor=null;}
function openManual(){$('manual-form').reset();$('manual-dialog').showModal();}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
$('note-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog('note-dialog');});
$('refresh-button').addEventListener('click',refresh);
$('manual-button').addEventListener('click',openManual);
$('new-note').addEventListener('click',()=>openEditor());
$('backup-button').addEventListener('click',()=>{$('import-file').value='';$('restore-preview').hidden=true;pendingRestore=null;renderBackup();$('backup-dialog').showModal();});
$('sources-button').addEventListener('click',()=>{renderSources();$('sources-dialog').showModal();});
for(const id of ['article-search','source-filter','sort-filter','today-filter','category-filter'])$(id).addEventListener(id==='article-search'?'input':'change',()=>{page=1;renderArticles();});
for(const id of ['note-search','note-sort','note-links-filter'])$(id).addEventListener(id==='note-search'?'input':'change',()=>{notePage=1;renderNotes();});
$('status-filters').addEventListener('click',e=>{const b=e.target.closest('[data-status]');if(!b)return;status=b.dataset.status;page=1;document.querySelectorAll('[data-status]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderArticles();});
$('article-pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){page+=Number(b.dataset.page);renderArticles();$('articles-heading').scrollIntoView({block:'start'});}});
$('note-pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){notePage+=Number(b.dataset.page);renderNotes();}});
$('article-list').addEventListener('change',e=>{if(e.target.dataset.action==='select'){const id=e.target.closest('[data-id]').dataset.id;e.target.checked?selected.add(id):selected.delete(id);updateSelection();}});
$('select-page').addEventListener('change',e=>{currentPage.forEach(a=>e.target.checked?selected.add(a.id):selected.delete(a.id));renderArticles();});
$('clear-selection').addEventListener('click',()=>{selected.clear();renderArticles();});
$('bulk-copy').addEventListener('click',guard(()=>showOutput(chatText(state.articles.filter(a=>selected.has(a.id))),'選択した記事',false,true)));
$('bulk-check').addEventListener('click',guard(async()=>{await transaction(next=>{next.articles.forEach(a=>{if(selected.has(a.id))a.checked=true;});});selected.clear();renderArticles();notify('選択した記事を確認済みにしました');}));
$('article-list').addEventListener('click',guard(async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
  if(action==='add-manual'){openManual();return;}const id=b.closest('[data-id]')?.dataset.id,a=state.articles.find(x=>x.id===id);if(!a)return;
  if(action==='star'||action==='check'){await transaction(next=>{const item=next.articles.find(x=>x.id===id);if(item){const key=action==='star'?'starred':'checked';item[key]=!item[key];}});}
  if(action==='note')openEditor(null,id);
  if(action==='edit-note')openEditor(b.dataset.note);
  if(action==='copy')await showOutput(chatText([a]),a.title,false,true);
  if(action==='markdown')await showOutput(markdownForArticle(a,articleNotes(id)),a.title);
}));
$('note-list').addEventListener('click',guard(async e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='new'){openEditor();return;}const id=b.closest('[data-note]')?.dataset.note,note=state.notes.find(n=>n.id===id);if(!note)return;if(b.dataset.action==='edit')openEditor(id);else await showOutput(markdownForNote(note,noteArticles(id)),note.title);}));
$('link-search').addEventListener('input',()=>renderEditorLinks());
$('editor-related').addEventListener('click',e=>{const b=e.target.closest('[data-unlink]');if(b){editor.links.delete(b.dataset.unlink);renderEditorLinks();}});
$('link-results').addEventListener('click',e=>{const b=e.target.closest('[data-link]');if(b){editor.links.add(b.dataset.link);renderEditorLinks();}});
$('note-form').addEventListener('submit',guard(async e=>{
  e.preventDefault();const title=$('note-title').value.trim();if(!title){$('note-title').focus();throw new Error('メモのタイトルを入力してください。');}
  const id=editor.id||crypto.randomUUID(),now=new Date().toISOString(),links=[...editor.links];
  const note={id,title,body:$('note-body').value,tags:[...new Set($('note-tags').value.split(/[,、\s]+/).map(s=>s.replace(/^#+/,'')).filter(Boolean))],createdAt:editor.createdAt||now,updatedAt:now};
  if(note.tags.length>100||note.tags.some(t=>t.length>100))throw new Error('タグは100個まで、1個100文字以内にしてください。');
  await transaction(next=>{next.notes=next.notes.filter(n=>n.id!==id).concat(note);next.articleNotes=next.articleNotes.filter(l=>l.noteId!==id).concat(links.filter(a=>next.articles.some(x=>x.id===a)).map(articleId=>({articleId,noteId:id})));});
  $('note-dialog').close();editor=null;notify('メモを保存しました');
}));
$('delete-note').addEventListener('click',guard(async()=>{if(!editor?.id||!confirm('このメモを削除しますか？ 元記事は残ります。'))return;const id=editor.id;await transaction(next=>{next.notes=next.notes.filter(n=>n.id!==id);next.articleNotes=next.articleNotes.filter(l=>l.noteId!==id);});$('note-dialog').close();editor=null;notify('メモを削除しました');}));
$('manual-form').addEventListener('submit',guard(async e=>{
  e.preventDefault();const title=$('manual-title').value.trim(),sourceName=$('manual-source').value.trim();if(!title||!sourceName)throw new Error('タイトルと媒体名を入力してください。');
  const url=canonicalUrl($('manual-url').value),now=new Date().toISOString();
  const inputDate=$('manual-date').value;const publishedAt=inputDate?new Date(inputDate+':00+09:00').toISOString():null;
  const article={id:crypto.randomUUID(),sourceId:'manual',sourceName,sourceItemId:url,title,url,publishedAt,fetchedAt:now,...classify(title,$('manual-category').value),checked:false,starred:false};
  let added=0;await transaction(next=>{const r=mergeArticles(next.articles,[article]);next.articles=r.articles;added=r.added;});$('manual-dialog').close();notify(added?'記事を追加しました':'登録済みの記事情報を更新しました');
}));
$('export-backup').addEventListener('click',guard(async()=>{const fresh=await readAll();download(makeBackup(fresh),`baseball-backup-${stamp()}.json`,'application/json');await transaction(next=>{next.settings.lastBackup=new Date().toISOString();});notify('バックアップを書き出しました');}));
$('import-file').addEventListener('change',guard(async()=>{
  pendingRestore=null;$('restore-preview').hidden=true;const file=$('import-file').files[0];if(!file)return;if(file.size>50*1024*1024)throw new Error('JSONファイルは50MB以下にしてください。');
  const raw=JSON.parse(await file.text());pendingRestore=validateBackup(raw);$('restore-info').textContent=`記事 ${pendingRestore.articles.length}件・メモ ${pendingRestore.notes.length}件を復元します。現在のデータは置き換わります。`;$('restore-preview').hidden=false;
}));
$('restore-confirm').addEventListener('click',guard(async()=>{
  if(!pendingRestore)return;if(busy)throw new Error('記事取得が終わってから復元してください。');
  if(!confirm('現在のデータをJSONで書き出してから、選択したバックアップに置き換えますか？'))return;
  const data=pendingRestore;
  await transaction(next=>{download(makeBackup(next),`baseball-before-restore-${stamp()}.json`,'application/json');Object.assign(next,data);});
  pendingRestore=null;selected.clear();page=notePage=1;$('backup-dialog').close();render();notify('バックアップから復元しました');
}));
$('copy-output').addEventListener('click',guard(async()=>{if(!await copy($('output-text').value)){$('output-text').select();notify('内容を選択しました。端末のコピー操作を使ってください。');}}));
$('download-markdown').addEventListener('click',()=>download($('output-text').value,`${filename(outputName)}.md`,'text/markdown;charset=utf-8'));
window.addEventListener('beforeunload',e=>{if(editor&&editorSnapshot()!==editor.initial){e.preventDefault();e.returnValue='';}});
channel?.addEventListener('message',guard(async()=>{state=await readAll();render();}));

async function init(){
  try{
    await openDB();state=await readAll();ready=true;render();$('update-status').textContent=state.settings.lastFetch?`前回取得：${fmt(state.settings.lastFetch)}`:'まだ記事を取得していません';
    fetch('/api/sources').then(r=>r.ok?r.json():null).then(result=>{if(result){media=result;renderSources();}}).catch(()=>{});
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
    refresh();
  }catch(e){$('fatal').hidden=false;$('fatal').textContent='保存領域を開けませんでした。ブラウザのサイトデータ設定を確認し、再読み込みしてください。 '+e.message;$('refresh-button').disabled=true;notify('保存領域の初期化に失敗しました。',true);}
}
init();
