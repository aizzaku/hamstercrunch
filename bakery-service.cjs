const {DatabaseSync}=require('node:sqlite');
const {randomBytes,createHash}=require('node:crypto');
const {createRecipeBox,RecipeData}=require('./recipe-core.js');
const {LEVELS,CAMPAIGN_VERSION,makeLevel,specialLayout}=require('./levels.js');
const {createIngredientLootPlan,publicIngredientLootPlan}=require('./ingredient-loot.cjs');
const BOARDS=['genesis','speed','cooks','sells','fortune','collection','special'];

// Server owns inventory and sale receipts. Arcade clears remain client-reported
// beta progress; this is not a proof-of-play or a redeemable token economy.
function createBakeryService({filename=':memory:',chain,now=()=>new Date().toISOString(),lootRandom}={}){
  const db=new DatabaseSync(filename);
  db.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, profile TEXT, meta TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)');
  // Existing browser cookies remain valid. Revoked tokens stay recorded so a
  // later process restart cannot accidentally reactivate them during migration.
  db.prepare('INSERT OR IGNORE INTO sessions (token,player_id,expires_at) SELECT id,id,? FROM players').run(Date.parse(now())+31536000000);
  const get=db.prepare('SELECT profile,meta FROM players WHERE id=?');
  const put=db.prepare('UPDATE players SET profile=?,meta=? WHERE id=?');
  const all=db.prepare('SELECT id,profile,meta FROM players WHERE profile IS NOT NULL');
  const timestamp=()=>Date.parse(now());
  function walletFor(id){
    if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='wallet_accounts'").get())return null;
    return db.prepare('SELECT address FROM wallet_accounts WHERE player_id=?').get(id)?.address||null;
  }
  function runAllowance(id,meta){
    const day=new Date(timestamp()).toISOString().slice(0,10),walletRequired=!walletFor(id);
    const used=meta.rewardedRuns?.day===day?meta.rewardedRuns.used:0;
    const resetsAt=new Date(Date.parse(`${day}T00:00:00Z`)+86400000).toISOString();
    return {walletRequired,limit:5,used,remaining:walletRequired?0:Math.max(0,5-used),resetsAt};
  }
  function reserveRewardedRun(id,meta){
    const allowance=runAllowance(id,meta),rewarded=!allowance.walletRequired&&allowance.remaining>0;
    if(rewarded)meta.rewardedRuns={day:new Date(timestamp()).toISOString().slice(0,10),used:allowance.used+1};
    meta.activeRunRewarded=rewarded;return rewarded;
  }
  function runFor(meta,kind){return kind==='campaign'?meta.campaignRun:kind==='special'?meta.specialRun:null;}
  function prepareLoot(meta,run,kind,level){
    if(run.lootPlan?.level!==level){
      const layout=kind==='special'?specialLayout(run.seed):null;
      run.lootPlan=createIngredientLootPlan({runId:run.id,kind,level,eligible:run.rewarded,bricks:makeLevel(level,layout).bricks,now:timestamp(),featured:kind==='special'?run.ingredient:undefined,random:lootRandom});
    }
    meta.activeLootKind=kind;return run.lootPlan;
  }
  function currentLoot(meta){return publicIngredientLootPlan(runFor(meta,meta.activeLootKind)?.lootPlan);}
  function prepareMeta(meta){
    meta.rankedCooks??=0;meta.rankedRecipes??=[];
    // Points have not been spendable in earlier builds, so their saved balance
    // is also lifetime earnings. Unlike imported recipe totals, sales are server-owned.
    meta.pointsEarned??=meta.bakeryPoints||0;
    meta.specialTimes??={};
    if(meta.specialRun)meta.specialRun.reached??=0;
    meta.liveOrders??=[];meta.saleReceipts??=[];meta.lastSales??={};
    return meta;
  }
  function validTime(elapsed,start,previous=0){
    return Number.isFinite(elapsed)&&elapsed>=previous+.25&&Number.isFinite(start)&&elapsed<=(timestamp()-start)/1000+2;
  }
  function session(id){
    if(resolveSession(id))return id;
    const token=randomBytes(32).toString('hex');
    db.prepare('INSERT INTO players VALUES (?,NULL,?)').run(token,JSON.stringify({initialized:false,bakeryPoints:0,sales:0,specialClaims:[],specialRun:null}));
    db.prepare('INSERT INTO sessions (token,player_id,expires_at) VALUES (?,?,?)').run(token,token,timestamp()+31536000000);return token;
  }
  function resolveSession(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    return db.prepare('SELECT player_id FROM sessions WHERE token=? AND revoked=0 AND expires_at>?').get(token,timestamp())?.player_id||null;
  }
  function mutate(id,fn){
    db.exec('BEGIN IMMEDIATE');
    try{
      const row=get.get(id);if(!row)throw new Error('Unknown bakery session.');
      let raw=row.profile;const meta=prepareMeta(JSON.parse(row.meta));
      const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
      let model=createRecipeBox(storage,Math.random,now);
      const context={meta,model,replace(value){raw=JSON.stringify(value);model=createRecipeBox(storage,Math.random,now);this.model=model;},raw:()=>JSON.parse(raw)};
      const result=fn(context);
      put.run(raw,JSON.stringify(meta),id);db.exec('COMMIT');
      return {profile:{...context.model.snapshot(),bakeryPoints:meta.bakeryPoints,sales:meta.sales,specialClaims:[...meta.specialClaims],liveOrders:meta.liveOrders.map(order=>({...order})),saleReceipts:meta.saleReceipts.map(receipt=>({...receipt})),lastSales:{...meta.lastSales},saleTotals:{quantity:meta.sales,points:meta.pointsEarned},runAllowance:runAllowance(id,meta),activeRunRewarded:meta.activeRunRewarded===true,runLootPlan:currentLoot(meta)},needsImport:!meta.initialized,result};
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function profile(id){return mutate(id,()=>undefined);}
  function liveOrders(id){const saved=profile(id);return {...saved,orders:saved.profile.liveOrders,receipts:saved.profile.saleReceipts,totalSold:saved.profile.saleTotals.quantity,totalPoints:saved.profile.saleTotals.points};}
  function recordSale(context,data,{recipe,quantity,price,seed,orderId=null}){
    const points=price*quantity;
    const receipt={id:randomBytes(12).toString('hex'),orderId,kind:orderId?'queued':'manual',recipe,quantity,unitPrice:price,totalPoints:points,seed,at:now()};
    context.meta.bakeryPoints+=points;context.meta.pointsEarned+=points;context.meta.sales+=quantity;context.meta.initialized=true;
    context.meta.saleReceipts.unshift(receipt);context.meta.saleReceipts=context.meta.saleReceipts.slice(0,30);context.meta.lastSales[recipe]=receipt;
    data.history.unshift({at:receipt.at,message:`Sold ${quantity} ${RecipeData.recipes.find(r=>r.id===recipe).name}: +${points} Bakery Points`});data.history=data.history.slice(0,24);
    return receipt;
  }
  const failure=message=>({ok:false,message});
  async function command(id,action,args=[]){
    if(!Array.isArray(args))throw new Error('Command arguments must be an array.');
    const bakery=['startSpecial','queueSale'].includes(action)?await chain.snapshot({force:action==='queueSale'}):null;
    return mutate(id,context=>{
      const {meta}=context;
      if(action==='import'){
        if(meta.initialized)return failure('This bakery already has a saved profile.');
        const imported=args[0];
        if(!imported||imported.version!==1||JSON.stringify(imported).length>64000)return failure('The previous save could not be imported. It remains on this browser.');
        if(typeof imported.name==='string')context.model.rename(imported.name);
        meta.initialized=true;return {ok:true,message:'Legacy save kept on this browser. New bakery starts with server-issued supplies.'};
      }
      if(action==='startRun'){
        meta.initialized=true;
        const runId=context.model.startRun();
        meta.campaignRun={id:runId,version:CAMPAIGN_VERSION,startedAt:timestamp(),reached:0,time:0,rewarded:reserveRewardedRun(id,meta)};
        prepareLoot(meta,meta.campaignRun,'campaign',0);
        return runId;
      }
      if(action==='prepareLevelLoot'){
        const [runId,level,kind='campaign']=args,run=runFor(meta,kind);
        if(!run||run.id!==runId||!Number.isInteger(level)||level<0||level>=(kind==='special'?1:LEVELS.length)||level!==run.reached||(kind==='campaign'&&run.version!==CAMPAIGN_VERSION))return failure('That level is not available for this run.');
        return publicIngredientLootPlan(prepareLoot(meta,run,kind,level));
      }
      if(action==='collectIngredient'){
        const [runId,level,pickupId,kind='campaign']=args,run=runFor(meta,kind),plan=run?.lootPlan;
        if(!run||run.id!==runId||!Number.isInteger(level)||!plan||plan.level!==level||plan.runId!==runId||plan.kind!==kind||(kind==='campaign'&&run.version!==CAMPAIGN_VERSION)||(run.reached!==level&&run.reached!==level+1))return failure('That ingredient drop belongs to another level or run.');
        if(!run.rewarded||!plan.eligible)return failure('Practice pickups do not enter your Pantry.');
        if(timestamp()<plan.issuedAt+750||timestamp()>plan.expiresAt)return failure('That ingredient drop is not available now.');
        const entry=typeof pickupId==='string'?plan.entries.find(item=>item.id===pickupId):null;
        if(!entry)return failure('That ingredient drop was not issued for this run.');
        if(plan.claimed.includes(pickupId))return failure('That ingredient was already collected.');
        const result=context.model.collectIngredient(entry.ingredient);
        if(result.ok)plan.claimed.push(pickupId);
        return result;
      }
      if(action==='awardLevel'){
        const [runId,level,elapsed]=args,run=meta.campaignRun;
        if(!run||run.id!==runId||run.version!==CAMPAIGN_VERSION||!Number.isInteger(level)||level!==run.reached||level<0||level>=LEVELS.length||!validTime(elapsed,run.startedAt,run.time))return [];
        if(run.rewarded!==true){run.reached++;run.time=Math.round(elapsed*1000)/1000;return [];}
        const rewards=context.model.awardLevel(runId,level);
        run.reached++;run.time=Math.round(elapsed*1000)/1000;
        const previous=meta.campaignBest;
        if(!previous||previous.version!==CAMPAIGN_VERSION||run.reached>previous.reached||(run.reached===previous.reached&&run.time<previous.time))meta.campaignBest={version:CAMPAIGN_VERSION,reached:run.reached,time:run.time};
        if(run.reached===LEVELS.length&&(meta.fastestCampaign?.version!==CAMPAIGN_VERSION||run.time<meta.fastestCampaign.time))meta.fastestCampaign={version:CAMPAIGN_VERSION,time:run.time};
        return rewards;
      }
      if(action==='bake'){
        meta.initialized=true;
        const result=context.model.bake(...args);
        if(result.ok&&walletFor(id)){
          const recipe=RecipeData.recipes.find(item=>item.id===args[0]);
          meta.rankedCooks+=recipe.yield;
          if(!meta.rankedRecipes.includes(recipe.id))meta.rankedRecipes.push(recipe.id);
        }
        return result;
      }
      if(action==='queueSale'){
        if(!walletFor(id))return failure('Connect a wallet to sell treats for Bakery Points.');
        const [recipe,quantity]=args,data=context.raw();
        if(!RecipeData.recipes.some(item=>item.id===recipe)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return failure('Choose a valid treat and quantity.');
        if(meta.liveOrders.length>=24)return failure('Your live order tray is full.');
        if(data.food[recipe]<quantity)return failure('Bake enough treats first.');
        const queuedWhileOpen=bakery?.status==='open';
        const order={id:randomBytes(12).toString('hex'),recipe,quantity,createdAt:now(),waitForRest:queuedWhileOpen,blockedSeed:queuedWhileOpen?bakery.seed:null};
        data.food[recipe]-=quantity;meta.liveOrders.push(order);meta.initialized=true;
        data.history.unshift({at:now(),message:`Queued ${quantity} ${RecipeData.recipes.find(r=>r.id===recipe).name} for live sale`});data.history=data.history.slice(0,24);context.replace(data);
        return {ok:true,orderId:order.id,message:`Reserved ×${quantity}. Sells at the next verified opening.`};
      }
      if(action==='cancelSale'){
        const index=meta.liveOrders.findIndex(order=>order.id===args[0]);
        if(index<0)return failure('That live order has already sold or been canceled.');
        const [order]=meta.liveOrders.splice(index,1),data=context.raw();
        data.food[order.recipe]+=order.quantity;
        data.history.unshift({at:now(),message:`Live order canceled: ×${order.quantity} returned to your tin`});data.history=data.history.slice(0,24);context.replace(data);
        return {ok:true,message:`Canceled. ×${order.quantity} returned to your tin.`};
      }
      const methods=['fulfill','rename','buyIngredient'];
      if(methods.includes(action)){meta.initialized=true;return context.model[action](...args);}
      if(action==='startSpecial'){
        if(!bakery?.special||args[0]!==bakery.special.seed)return failure('The Special Batch has changed. Refresh the bakery.');
        meta.initialized=true;meta.specialRun={id:randomBytes(16).toString('hex'),seed:args[0],ingredient:bakery.special.ingredient,startedAt:timestamp(),reached:0,rewarded:reserveRewardedRun(id,meta)};
        prepareLoot(meta,meta.specialRun,'special',0);
        return {ok:true,runId:meta.specialRun.id,...bakery.special,rewarded:meta.specialRun.rewarded};
      }
      if(action==='awardSpecial'){
        const run=meta.specialRun;
        if(!run||run.id!==args[0])return failure('That Special Batch run has already been recorded or was not started.');
        if(!validTime(args[1],run.startedAt))return failure('That clear time could not be validated. Complete a new Special Batch run.');
        if(run.rewarded!==true){meta.specialRun=null;return {ok:true,rewards:[],message:'Practice complete. No rewards or ranked result.'};}
        if(!RecipeData.ingredients.some(i=>i.id===run.ingredient))return failure('The featured ingredient is unavailable.');
        const recorded=Math.round(args[1]*1000)/1000;
        const best=meta.specialTimes[run.seed];
        if(!Number.isFinite(best)||recorded<best)meta.specialTimes[run.seed]=recorded;
        if(meta.specialClaims.includes(run.seed)){
          meta.specialRun=null;
          return {ok:true,rewards:[],message:!Number.isFinite(best)||recorded<best?'New Special Batch personal best!':'Special Batch recorded. Your clear bonus was already collected.'};
        }
        const data=context.raw();data.xp+=20;
        const rewards=['+20 baker XP'];
        data.history.unshift({at:now(),message:`Special Batch: ${rewards.join(' · ')}`});data.history=data.history.slice(0,24);
        context.replace(data);meta.specialClaims.push(run.seed);meta.specialRun=null;
        return {ok:true,rewards,message:`Special Batch complete: ${rewards.join(' · ')}`};
      }
      throw new Error('Unknown bakery command.');
    });
  }
  async function sell(id,{recipe,quantity,seed}={}){
    const bakery=await chain.snapshot({force:true});
    const output=mutate(id,context=>{
      if(!walletFor(id))return failure('Connect a wallet to sell treats for Bakery Points.');
      if(bakery.status!=='open')return failure(bakery.status==='closed'?'The bakery is resting. Come back when Squeektoshi runs.':'Live wheel data is unavailable. Sales are paused.');
      if(seed!==bakery.seed)return failure('The market batch changed. Check the new prices.');
      const offer=bakery.offers.find(o=>o.recipe===recipe);
      if(!offer||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return failure('Choose a valid treat and quantity.');
      const data=context.raw();
      if(data.food[recipe]<quantity)return failure('There are not enough treats in your tin.');
      const points=offer.price*quantity;
      if(!Number.isSafeInteger(points)||points<1)return failure('That price is unavailable.');
      data.food[recipe]-=quantity;recordSale(context,data,{recipe,quantity,price:offer.price,seed});context.replace(data);
      return {ok:true,points,message:`Sold ${quantity} treats for ${points} Bakery Points.`};
    });return {...output,bakery};
  }
  function hasLiveOrders(){return !!db.prepare("SELECT 1 FROM players WHERE profile IS NOT NULL AND json_array_length(json_extract(meta,'$.liveOrders'))>0 LIMIT 1").get();}
  async function processLiveOrders(){
    if(!hasLiveOrders())return {sold:0,points:0};
    const bakery=await chain.snapshot({force:true});
    // Never treat a connection fault as resting. Expired ACTIVE snapshots cannot sell.
    const expires=Date.parse(bakery.expiresAt);
    if(!['open','closed'].includes(bakery.status)||!Number.isFinite(expires)||expires<=timestamp())return {sold:0,points:0};
    if(bakery.status==='open'&&(!bakery.seed||!Array.isArray(bakery.offers)))return {sold:0,points:0};
    let sold=0,points=0;
    const players=db.prepare("SELECT id FROM players WHERE profile IS NOT NULL AND json_array_length(json_extract(meta,'$.liveOrders'))>0").all();
    for(const player of players){
      if(expires<=timestamp())break;
      const output=mutate(player.id,context=>{
        if(bakery.status==='closed'){for(const order of context.meta.liveOrders)order.waitForRest=false;return {sold:0,points:0};}
        const data=context.raw(),remaining=[];let playerSold=0,playerPoints=0;
        for(const order of context.meta.liveOrders){
          if(order.waitForRest){remaining.push(order);continue;}
          const offer=bakery.offers.find(item=>item.recipe===order.recipe);
          if(!offer||!Number.isSafeInteger(offer.price)||offer.price<1||!Number.isSafeInteger(offer.price*order.quantity)){remaining.push(order);continue;}
          const receipt=recordSale(context,data,{recipe:order.recipe,quantity:order.quantity,price:offer.price,seed:bakery.seed,orderId:order.id});
          playerSold+=order.quantity;playerPoints+=receipt.totalPoints;
        }
        context.meta.liveOrders=remaining;context.replace(data);return {sold:playerSold,points:playerPoints};
      });sold+=output.result.sold;points+=output.result.points;
    }
    return {sold,points};
  }
  async function leaderboard(board='genesis',viewerId){
    if(!BOARDS.includes(board))throw new Error('Unknown leaderboard.');
    const seed=board==='special'?(await chain.snapshot()).special?.seed||null:null;
    const entries=[];
    for(const row of all.all()){
      const saved=JSON.parse(row.profile),meta=prepareMeta(JSON.parse(row.meta));
      const player=createHash('sha256').update(`hamster-public-player:${row.id}`).digest('hex').slice(0,20);
      const entry={player,name:saved.name||'Little Baker',isYou:row.id===viewerId,reached:0,time:null,value:0};
      if(board==='genesis'){
        if(meta.campaignBest?.version!==CAMPAIGN_VERSION)continue;
        entry.reached=meta.campaignBest.reached;entry.time=meta.campaignBest.time;entry.value=entry.reached;
      }else if(board==='speed'){
        if(meta.fastestCampaign?.version!==CAMPAIGN_VERSION)continue;
        entry.reached=LEVELS.length;entry.time=meta.fastestCampaign.time;entry.value=entry.time;
      }else if(board==='special'){
        if(!seed||!Number.isFinite(meta.specialTimes[seed]))continue;
        entry.reached=1;entry.time=meta.specialTimes[seed];entry.value=entry.time;
      }else{
        entry.value=board==='cooks'?meta.rankedCooks:board==='sells'?meta.sales:board==='fortune'?meta.pointsEarned:meta.rankedRecipes.length;
        if(!entry.value)continue;
      }
      entries.push(entry);
    }
    entries.sort((a,b)=>(board==='genesis'?b.reached-a.reached||a.time-b.time:board==='speed'||board==='special'?a.time-b.time:b.value-a.value)||a.player.localeCompare(b.player));
    let rank=1;
    entries.forEach((entry,index)=>{
      if(index){const previous=entries[index-1];const tied=board==='genesis'?entry.reached===previous.reached&&entry.time===previous.time:board==='speed'||board==='special'?entry.time===previous.time:entry.value===previous.value;if(!tied)rank=index+1;}
      entry.rank=rank;
    });
    return {board,rows:entries.slice(0,50),viewer:entries.find(entry=>entry.isYou)||null,seed,version:CAMPAIGN_VERSION,total:entries.length};
  }
  return {session,resolveSession,profile,liveOrders,hasLiveOrders,processLiveOrders,command,sell,leaderboard,db,close:()=>db.close()};
}
module.exports={createBakeryService};
