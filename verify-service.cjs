const assert=require('node:assert/strict');
const {createBakeryService}=require('./bakery-service.cjs');
const {createRecipeBox}=require('./recipe-core.js');
const {createWalletAuth}=require('./wallet-auth.cjs');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
let market={status:'open',seed:'seed-one',special:{seed:'seed-one',ingredient:'cocoa'},offers:[{recipe:'butter-paws',price:7}]};
let wall=Date.parse('2026-11-06T12:00:00Z');const now=()=>new Date(wall).toISOString();
const service=createBakeryService({chain:{snapshot:async()=>market},now});
let count=0;
function check(name,value){assert.ok(value,name);console.log(`PASS ${name}`);count++;}
// These tests exercise rewarded play; signature verification has its own auth suite.
function linkRewardFixture(target,id){createWalletAuth({service:target});target.db.prepare('INSERT INTO wallet_accounts VALUES (?,?)').run(`0x${id.slice(0,40)}`,id);}
(async()=>{
  const id=service.session();check('Sessions use random opaque identifiers',/^[a-f0-9]{64}$/.test(id)&&service.session(id)===id&&service.session('invalid')!==id);
  check('Fresh profile requests allow one-time import',service.profile(id).needsImport);
  linkRewardFixture(service,id);
  const memory=new Map(),store={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
  const old=createRecipeBox(store);old.rename('Isaac');old.bake('butter-paws');
  let result=await service.command(id,'import',[JSON.parse([...memory.values()][0])]);
  check('Legacy import keeps the name and local save without minting inventory',result.result.ok&&result.profile.name==='Isaac'&&result.profile.food['butter-paws']===0&&!result.profile.recipes['butter-paws'].firstBaked&&old.snapshot().food['butter-paws']===2);
  check('Migration cannot overwrite a used bakery',!(await service.command(id,'import',[old.snapshot()])).result.ok);
  await service.command(id,'bake',['butter-paws']);
  result=await service.sell(id,{recipe:'butter-paws',quantity:1,seed:'seed-one'});
  check('Sales deduct food and award server-priced points',result.result.ok&&result.profile.food['butter-paws']===1&&result.profile.bakeryPoints===7);
  check('Overselling leaves inventory unchanged',!(await service.sell(id,{recipe:'butter-paws',quantity:2,seed:'seed-one'})).result.ok&&service.profile(id).profile.food['butter-paws']===1);
  check('Stale market quote cannot sell',!(await service.sell(id,{recipe:'butter-paws',quantity:1,seed:'old'})).result.ok);
  check('Fractions and unknown recipes cannot sell',!(await service.sell(id,{recipe:'butter-paws',quantity:.5,seed:'seed-one'})).result.ok&&!(await service.sell(id,{recipe:'no',quantity:1,seed:'seed-one'})).result.ok);
  market={...market,status:'closed'};check('Resting hamster closes sales',!(await service.sell(id,{recipe:'butter-paws',quantity:1,seed:'seed-one'})).result.ok);
  market={...market,status:'unknown'};check('Stale or unavailable telemetry pauses sales',!(await service.sell(id,{recipe:'butter-paws',quantity:1,seed:'seed-one'})).result.ok);
  const special=await service.command(id,'startSpecial',['seed-one']);
  check('Special Batch can start while bakery is resting',special.result.ok&&!!special.result.runId);
  wall+=10000;result=await service.command(id,'awardSpecial',[special.result.runId,10]);
  check('Special reward grants featured ingredient independently of campaign',result.result.ok&&result.profile.pantry.cocoa===3&&result.profile.clears===0);
  check('Special clear cannot be claimed twice',!(await service.command(id,'awardSpecial',[special.result.runId,10])).result.ok);
  const replay=await service.command(id,'startSpecial',['seed-one']);wall+=5000;const replayed=await service.command(id,'awardSpecial',[replay.result.runId,5]);
  check('Special replays improve times without repeating ingredient rewards',replayed.result.ok&&replayed.result.rewards.length===0&&replayed.profile.pantry.cocoa===3&&(await service.leaderboard('special',id)).viewer.time===5);
  check('Unknown commands roll back without losing data',await service.command(id,'invalid').then(()=>false,()=>service.profile(id).profile.bakeryPoints===7));
  market={...market,status:'open'};
  const simultaneous=await Promise.all([service.sell(id,{recipe:'butter-paws',quantity:1,seed:'seed-one'}),service.sell(id,{recipe:'butter-paws',quantity:1,seed:'seed-one'})]);
  check('Concurrent sales cannot consume the same last treat',simultaneous.filter(r=>r.result.ok).length===1&&service.profile(id).profile.food['butter-paws']===0&&service.profile(id).profile.bakeryPoints===14);
  const next=service.session();await service.command(next,'startRun');check('Starting a run prevents later import overwrite',!(await service.command(next,'import',[old.snapshot()])).result.ok);
  service.close();
  // Unique disposable test database: never opens or deletes a player's database.
  const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'hamster-bakery-test-')),'profile.sqlite');
  let disk=createBakeryService({filename,chain:{snapshot:async()=>market},now});
  const diskId=disk.session();await disk.command(diskId,'import',[old.snapshot()]);
  linkRewardFixture(disk,diskId);
  await disk.command(diskId,'bake',['butter-paws']);
  await disk.sell(diskId,{recipe:'butter-paws',quantity:1,seed:'seed-one'});
  const diskSpecial=await disk.command(diskId,'startSpecial',['seed-one']);wall+=10000;await disk.command(diskId,'awardSpecial',[diskSpecial.result.runId,10]);
  disk.close();disk=createBakeryService({filename,chain:{snapshot:async()=>market},now});
  const restored=disk.profile(diskId);
  check('SQLite reopen preserves session, collection, inventory and points',disk.session(diskId)===diskId&&!restored.needsImport&&restored.profile.name==='Isaac'&&restored.profile.food['butter-paws']===1&&restored.profile.bakeryPoints===7&&!!restored.profile.recipes['butter-paws'].firstBaked);
  const restoredReplay=await disk.command(diskId,'startSpecial',['seed-one']);wall+=5000;const restoredReward=await disk.command(diskId,'awardSpecial',[restoredReplay.result.runId,5]);
  check('Special claim ledger survives server restart',restoredReward.result.ok&&restoredReward.result.rewards.length===0&&restoredReward.profile.pantry.cocoa===3);
  disk.close();console.log(`${count} bakery service checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
