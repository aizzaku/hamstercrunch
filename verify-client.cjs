const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {createRecipeBox}=require('./recipe-core.js');
let count=0;
function check(name,value){assert.ok(value,name);console.log('PASS '+name);count++;}
async function main(){
  const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const original=createRecipeBox(storage);original.rename('Pip');
  let profile=original.snapshot(),calls=[],changes=0;
  const context=vm.createContext({createRecipeBox,console,fetch:async(url,options)=>{
    const input=options.body?JSON.parse(options.body):null;calls.push(input?.action||url);
    if(input?.action==='startRun')return {ok:true,json:async()=>({profile,result:42})};
    if(input?.action==='awardLevel'){check('Clear resolves its server-created run ID',input.args[0]===42&&input.args[2]===12.5);return {ok:true,json:async()=>({profile,result:['+1 Flour']})};}
    return {ok:true,json:async()=>({profile,needsImport:!input,result:{ok:true}})};
  }});
  vm.runInContext(fs.readFileSync('bakery-client.js','utf8'),context);
  const client=context.createBakeryClient(storage,()=>changes++);
  await client.ready;
  check('Legacy save is handled by the server before play',calls.join(',')==='/api/profile,import'&&client.snapshot().name==='Pip');
  const run=client.startRun();await client.awardLevel(run,0,12.5);
  check('Commands stay in order',calls.slice(-2).join(',')==='startRun,awardLevel');
  check('Server changes notify UI',changes===4);
  check('Original local collection remains available',JSON.parse(storage.getItem('hamster-crunch-recipe-box-v1')).name==='Pip');
  context.fetch=async()=>{throw new Error('Connection lost');};
  const offline=context.createBakeryClient(storage,()=>{});await offline.ready.catch(()=>{});
  check('Offline profile cannot silently grant local-only rewards',offline.snapshot().readOnly&&offline.snapshot().warning.includes('Connection lost'));
  console.log(`${count} bakery client checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
