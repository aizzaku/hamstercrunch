// Public, read-only Squeekchain integration. No wallet or token operations.
const {createHash}=require('node:crypto');
const {RecipeData}=require('./recipe-core.js');
const BASE='https://api.squeekchain.com/v1/';
const uint=value=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value);

function normalizeStatus(body,now=Date.now()){
  const m=body?.measurement;
  const unknown=reason=>({status:'unknown',reason,measurementAt:m?.receivedAt||null,expiresAt:null});
  if(body?.schemaVersion!==1||body.status==='unavailable'||!m)return unknown('Wheel telemetry is unavailable.');
  const at=Date.parse(m.receivedAt);
  const seconds=Number.isInteger(m.staleAfterSeconds)&&m.staleAfterSeconds>0?Math.min(120,m.staleAfterSeconds):0;
  if(m.freshness!=='online'||!Number.isFinite(at)||!seconds||now-at>seconds*1000||at-now>5000)return unknown('Wheel telemetry is stale.');
  if(m.provenance!=='hardware')return unknown('Waiting for live hardware telemetry.');
  if(!Number.isInteger(m.rpmMilli)||m.rpmMilli<0)return unknown('Wheel speed is unavailable.');
  if(m.coreStatus==='COUNTER_FAULT')return unknown('The wheel sensor needs attention.');
  const common={measurementAt:m.receivedAt,expiresAt:new Date(at+seconds*1000).toISOString()};
  if(m.coreStatus==='ACTIVE'&&m.rpmMilli>0)return {...common,status:'open',reason:'Squeektoshi is running. The bakery is open!'};
  if(m.coreStatus==='IDLE')return {...common,status:'closed',reason:'Squeektoshi is resting. Gather ingredients and bake for the next opening.'};
  return unknown('Waiting for a consistent wheel reading.');
}

function selectSettlement(body){
  const chain=body?.chain;
  if(body?.schemaVersion!==3||body.status!=='available'||!uint(chain?.chainId)||!uint(chain.safeThroughBlock)||!uint(chain.confirmations)||BigInt(chain.confirmations)<12n||!Array.isArray(body.recentSettlements))return null;
  const items=body.recentSettlements.filter(item=>item?.confirmationStatus==='safe'&&/^0x[0-9a-f]{64}$/i.test(item.transactionHash)&&uint(item.settledThroughRound)&&uint(item.ethereumBlockNumber)&&BigInt(item.ethereumBlockNumber)<=BigInt(chain.safeThroughBlock)&&uint(item.workAdded)&&BigInt(item.workAdded)>0n);
  items.sort((a,b)=>BigInt(a.settledThroughRound)>BigInt(b.settledThroughRound)?-1:BigInt(a.settledThroughRound)<BigInt(b.settledThroughRound)?1:0);
  const latest=items[0];
  if(!latest)return null;
  return {transactionHash:latest.transactionHash.toLowerCase(),round:latest.settledThroughRound,chainId:chain.chainId,network:chain.target==='sepolia'?'Sepolia testnet':`Chain ${chain.chainId}`};
}

function createBatch(settlement){
  if(!settlement)return {seed:null,special:null,offers:[]};
  const seed=`${settlement.chainId}:${settlement.transactionHash}:${settlement.round}`;
  const bytes=createHash('sha256').update(`hamster-crunch-genesis-v1:${seed}`).digest();
  const ingredient=RecipeData.ingredients[bytes[0]%RecipeData.ingredients.length].id;
  const offers=RecipeData.recipes.map((recipe,index)=>{
    const multiplier=75+bytes[index+1]%76;
    const base=Math.max(3,Math.ceil(Object.values(recipe.needs).reduce((sum,n)=>sum+n,0)*3/recipe.yield));
    return {recipe:recipe.id,price:Math.max(1,Math.round(base*multiplier/100)),demand:multiplier>=125?'Craving':multiplier<=90?'Quiet':'Steady'};
  });
  return {seed,special:{seed,ingredient},offers};
}

function createChainAdapter({fetch:fetcher=globalThis.fetch,now=Date.now,cacheMs=10000}={}){
  let cached=null,inflight=null,lastSettlement=null;
  async function read(endpoint){
    const response=await fetcher(BASE+endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
    if(!response.ok)throw new Error(`Squeekchain HTTP ${response.status}`);
    return response.json();
  }
  async function refresh(){
    try{
      const [status,settlements]=await Promise.all([read('status'),read('settlements')]);
      const consistent=typeof status.installationId==='string'&&status.installationId===settlements.installationId;
      const settlement=consistent?selectSettlement(settlements):null;
      if(settlement)lastSettlement=settlement;
      cached={at:now(),status,settlement,error:consistent?null:'Chain installation data does not match.'};
    }catch(error){
      cached={at:now(),status:null,settlement:null,error:'The live bakery connection is unavailable.'};
    }
  }
  async function snapshot({force=false}={}){
    if(force||!cached||now()-cached.at>=cacheMs){
      if(!inflight)inflight=refresh().finally(()=>{inflight=null;});
      await inflight;
    }
    const live=normalizeStatus(cached.status,now());
    if(cached.error||!cached.settlement){live.status='unknown';live.reason=cached.error||'Waiting for a confirmed settlement.';}
    return {...live,...createBatch(cached.settlement||lastSettlement),settlement:cached.settlement||lastSettlement,checkedAt:new Date(now()).toISOString()};
  }
  return {snapshot};
}

module.exports={normalizeStatus,selectSettlement,createBatch,createChainAdapter};
