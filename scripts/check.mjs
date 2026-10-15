import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
let checked=0;
async function checkFolder(folder){
  for(const entry of await readdir(new URL(folder+'/',root),{withFileTypes:true})){
    const relative=`${folder}/${entry.name}`;
    if(entry.isDirectory()){await checkFolder(relative);continue;}
    if(!/\.(mjs|js)$/.test(entry.name))continue;
    const r=spawnSync(process.execPath,['--check',fileURLToPath(new URL(relative,root))],{encoding:'utf8'});
    if(r.status!==0){console.error(r.stderr);process.exit(1);}
    checked++;
  }
}
for(const folder of ['public','src','functions','scripts'])await checkFolder(folder);
const html=await readFile(new URL('public/index.html',root),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('HTMLに重複IDがあります');
const app=await readFile(new URL('public/app.js',root),'utf8');
for(const [,id]of app.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(id))throw new Error(`HTMLに存在しないID: ${id}`);
console.log(`${checked} JavaScriptファイルの構文・HTML IDの整合性: OK`);
