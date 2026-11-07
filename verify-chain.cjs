const assert=require('node:assert/strict');
const {normalizeStatus,selectSettlement,createBatch,createChainAdapter}=require('./squeek-chain.cjs');
let tests=0;
function check(name,fn){fn();tests++;console.log(`PASS ${name}`);}
const now=Date.parse('2026-11-06T12:00:00Z');
function status(patch={}){return {schemaVersion:1,installationId:'test-wheel',measurement:{receivedAt:new Date(now-1000).toISOString(),staleAfterSeconds:120,freshness:'online',provenance:'hardware',coreStatus:'ACTIVE',rpmMilli:1000,...patch}};}
function settlements(){return {schemaVersion:3,installationId:'test-wheel',status:'available',chain:{chainId:'11155111',target:'sepolia',safeThroughBlock:'100',confirmations:'12'},recentSettlements:[{transactionHash:'0x'+'a'.repeat(64),settledThroughRound:'10',ethereumBlockNumber:'90',confirmationStatus:'safe',workAdded:'20'}]};}
check('fresh active hardware opens',()=>assert.equal(normalizeStatus(status(),now).status,'open'));
check('idle closes even with residual speed',()=>assert.equal(normalizeStatus(status({coreStatus:'IDLE'}),now).status,'closed'));
check('zero-speed active is unknown',()=>assert.equal(normalizeStatus(status({rpmMilli:0}),now).status,'unknown'));
check('stale timestamps override online label',()=>assert.equal(normalizeStatus(status({receivedAt:new Date(now-121000).toISOString()}),now).status,'unknown'));
check('stale label fails closed',()=>assert.equal(normalizeStatus(status({freshness:'stale'}),now).status,'unknown'));
check('future timestamps fail closed',()=>assert.equal(normalizeStatus(status({receivedAt:new Date(now+6000).toISOString()}),now).status,'unknown'));
check('simulated readings never open market',()=>assert.equal(normalizeStatus(status({provenance:'simulated'}),now).status,'unknown'));
check('counter faults are unknown',()=>assert.equal(normalizeStatus(status({coreStatus:'COUNTER_FAULT'}),now).status,'unknown'));
check('unavailable and unsupported schemas unknown',()=>{assert.equal(normalizeStatus(null,now).status,'unknown');assert.equal(normalizeStatus({...status(),schemaVersion:2},now).status,'unknown');});
check('safe settlement is selected',()=>assert.equal(selectSettlement(settlements()).round,'10'));
check('unsafe settlement cannot seed offers',()=>{const s=settlements();s.recentSettlements[0].confirmationStatus='pending';assert.equal(selectSettlement(s),null);});
check('future block cannot seed offers',()=>{const s=settlements();s.recentSettlements[0].ethereumBlockNumber='101';assert.equal(selectSettlement(s),null);});
check('empty rounds do not churn batch seed',()=>{const s=settlements();s.recentSettlements.unshift({...s.recentSettlements[0],settledThroughRound:'11',workAdded:'0'});assert.equal(selectSettlement(s).round,'10');});
check('sorts arbitrary precision round IDs',()=>{const s=settlements();s.recentSettlements.push({...s.recentSettlements[0],settledThroughRound:'900719925474099399'});assert.equal(selectSettlement(s).round,'900719925474099399');});
check('shared batch is deterministic',()=>{const s=selectSettlement(settlements());assert.deepEqual(createBatch(s),createBatch(s));assert.equal(createBatch(s).offers.length,12);assert.ok(createBatch(s).offers.every(o=>Number.isInteger(o.price)&&o.price>0));});
check('missing anchor never invents batch',()=>assert.deepEqual(createBatch(null),{seed:null,special:null,offers:[]}));
async function verify(){
  let clock=now,calls=0,fail=false;
  const adapter=createChainAdapter({now:()=>clock,fetch:async url=>{calls++;if(fail)throw new Error('offline');return {ok:true,json:async()=>url.endsWith('status')?status():settlements()};}});
  assert.equal((await adapter.snapshot()).status,'open');tests++;
  await adapter.snapshot();assert.equal(calls,2);tests++;
  await adapter.snapshot({force:true});assert.equal(calls,4);tests++;
  clock+=121000;assert.equal((await adapter.snapshot()).status,'unknown');tests++;
  const previous=(await adapter.snapshot()).seed;fail=true;
  const failed=await adapter.snapshot({force:true});assert.equal(failed.status,'unknown');assert.equal(failed.seed,previous);tests++;
  const mismatch=createChainAdapter({now:()=>now,fetch:async url=>({ok:true,json:async()=>url.endsWith('status')?status():{...settlements(),installationId:'other'}})});
  assert.equal((await mismatch.snapshot()).status,'unknown');tests++;
  console.log(`${tests} chain integration checks passed.`);
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
