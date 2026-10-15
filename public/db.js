const DB_NAME='pro-baseball-news-checker';
let database;
export function openDB() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      db.createObjectStore('articles',{keyPath:'id'});
      db.createObjectStore('notes',{keyPath:'id'});
      db.createObjectStore('articleNotes',{keyPath:['articleId','noteId']});
      db.createObjectStore('settings',{keyPath:'key'});
    };
    request.onsuccess=()=>{database=request.result;database.onversionchange=()=>database.close();resolve();};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('別のタブを閉じて再読み込みしてください。'));
  });
}
export async function readAll() {
  const names=['articles','notes','articleNotes','settings'];
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(names,'readonly'), result={};
    names.forEach(name=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>{result[name]=r.result;};});
    tx.oncomplete=()=>resolve({...result,settings:Object.fromEntries(result.settings.map(s=>[s.key,s.value]))});
    tx.onerror=()=>reject(tx.error);
  });
}
export function writeStores(stores, replace=false) {
  return new Promise((resolve,reject)=>{
    let tx;
    try {
      tx=database.transaction(Object.keys(stores),'readwrite');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存を中止しました'));
      for(const [name,values]of Object.entries(stores)){
        const store=tx.objectStore(name);if(replace)store.clear();
        for(const item of values)store.put(item);
      }
    }catch(e){if(tx)tx.abort();reject(e);}
  });
}
export function replaceAll(data) {
  return writeStores({articles:data.articles,notes:data.notes,articleNotes:data.articleNotes,settings:Object.entries(data.settings||{}).map(([key,value])=>({key,value}))},true);
}
