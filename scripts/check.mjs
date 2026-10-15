import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
let checked=0;
for(const folder of ['public','src','scripts'])for(const name of await readdir(new URL(folder+'/',root))){
  if(!/\.(mjs|js)$/.test(name))continue;
  const file=new URL(`${folder}/${name}`,root),r=spawnSync(process.execPath,['--check',fileURLToPath(file)],{encoding:'utf8'});
  if(r.status!==0){console.error(r.stderr);process.exit(1);}
  checked++;
}
const html=await readFile(new URL('public/index.html',root),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('HTMLに重複IDがあります');
const app=await readFile(new URL('public/app.js',root),'utf8');
for(const [,id]of app.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(id))throw new Error(`HTMLに存在しないID: ${id}`);
console.log(`${checked} JavaScriptファイルの構文・HTML IDの整合性: OK`);
