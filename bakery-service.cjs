const {DatabaseSync}=require('node:sqlite');
const {randomBytes,createHash}=require('node:crypto');
const {createRecipeBox,RecipeData}=require('./recipe-core.js');
const {LEVELS,CAMPAIGN_VERSION}=require('./levels.js');
const BOARDS=['genesis','speed','cooks','sells','fortune','collection','special'];

// Server owns inventory and sale receipts. Arcade clears remain client-reported
// beta progress; this is not a proof-of-play or a redeemable token economy.
function createBakeryService({filename=':memory:',chain,now=()=>new Date().toISOString()}={}){
  const db=new DatabaseSync(filename);
  db.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, profile TEXT, meta TEXT NOT NULL)');
  const get=db.prepare('SELECT profile,meta FROM players WHERE id=?');
  const put=db.prepare('UPDATE players SET profile=?,meta=? WHERE id=?');
  const all=db.prepare('SELECT id,profile,meta FROM players WHERE profile IS NOT NULL');
  const timestamp=()=>Date.parse(now());
  function prepareMeta(meta){
    meta.rankedCooks??=0;meta.rankedRecipes??=[];
    // Points have not been spendable in earlier builds, so their saved balance
    // is also lifetime earnings. Unlike imported recipe totals, sales are server-owned.
    meta.pointsEarned??=meta.bakeryPoints||0;
    meta.specialTimes??={};
    return meta;
  }
  function validTime(elapsed,start,previous=0){
    return Number.isFinite(elapsed)&&elapsed>=previous+.25&&Number.isFinite(start)&&elapsed<=(timestamp()-start)/1000+2;
  }
  function session(id){
    if(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id)&&get.get(id))return id;
    const token=randomBytes(32).toString('hex');
    db.prepare('INSERT INTO players VALUES (?,NULL,?)').run(token,JSON.stringify({initialized:false,bakeryPoints:0,sales:0,specialClaims:[],specialRun:null}));return token;
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
      return {profile:{...context.model.snapshot(),bakeryPoints:meta.bakeryPoints,sales:meta.sales,specialClaims:[...meta.specialClaims]},needsImport:!meta.initialized,result};
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function profile(id){return mutate(id,()=>undefined);}
  const failure=message=>({ok:false,message});
  async function command(id,action,args=[]){
    if(!Array.isArray(args))throw new Error('Command arguments must be an array.');
    const bakery=action==='startSpecial'?await chain.snapshot():null;
    return mutate(id,context=>{
      const {meta}=context;
      if(action==='import'){
        if(meta.initialized)return failure('This bakery already has a saved profile.');
        const imported=args[0];
        if(!imported||imported.version!==1||JSON.stringify(imported).length>64000)return failure('The previous save could not be imported. It remains on this browser.');
        context.replace(imported);
        if(context.model.snapshot().readOnly)throw new Error('Unsupported recipe save.');
        meta.initialized=true;return {ok:true,message:'Your browser collection has moved into this bakery.'};
      }
      if(action==='startRun'){
        meta.initialized=true;
        const runId=context.model.startRun();
        meta.campaignRun={id:runId,version:CAMPAIGN_VERSION,startedAt:timestamp(),reached:0,time:0};
        return runId;
      }
      if(action==='awardLevel'){
        const [runId,level,elapsed]=args,run=meta.campaignRun;
        if(!run||run.id!==runId||run.version!==CAMPAIGN_VERSION||!Number.isInteger(level)||level!==run.reached||level<0||level>=LEVELS.length||!validTime(elapsed,run.startedAt,run.time))return [];
        const rewards=context.model.awardLevel(runId,level);
        if(!rewards.length)return [];
        run.reached++;run.time=Math.round(elapsed*1000)/1000;
        const previous=meta.campaignBest;
        if(!previous||previous.version!==CAMPAIGN_VERSION||run.reached>previous.reached||(run.reached===previous.reached&&run.time<previous.time))meta.campaignBest={version:CAMPAIGN_VERSION,reached:run.reached,time:run.time};
        if(run.reached===LEVELS.length&&(meta.fastestCampaign?.version!==CAMPAIGN_VERSION||run.time<meta.fastestCampaign.time))meta.fastestCampaign={version:CAMPAIGN_VERSION,time:run.time};
        return rewards;
      }
      if(action==='bake'){
        meta.initialized=true;
        const result=context.model.bake(...args);
        if(result.ok){
          const recipe=RecipeData.recipes.find(item=>item.id===args[0]);
          meta.rankedCooks+=recipe.yield;
          if(!meta.rankedRecipes.includes(recipe.id))meta.rankedRecipes.push(recipe.id);
        }
        return result;
      }
      const methods=['fulfill','rename','buyIngredient'];
      if(methods.includes(action)){meta.initialized=true;return context.model[action](...args);}
      if(action==='startSpecial'){
        if(!bakery?.special||args[0]!==bakery.special.seed)return failure('The Special Batch has changed. Refresh the bakery.');
        meta.initialized=true;meta.specialRun={id:randomBytes(16).toString('hex'),seed:args[0],ingredient:bakery.special.ingredient,startedAt:timestamp()};
        return {ok:true,runId:meta.specialRun.id,...bakery.special};
      }
      if(action==='awardSpecial'){
        const run=meta.specialRun;
        if(!run||run.id!==args[0])return failure('That Special Batch run has already been recorded or was not started.');
        if(!validTime(args[1],run.startedAt))return failure('That clear time could not be validated. Complete a new Special Batch run.');
        if(!RecipeData.ingredients.some(i=>i.id===run.ingredient))return failure('The featured ingredient is unavailable.');
        const recorded=Math.round(args[1]*1000)/1000;
        const best=meta.specialTimes[run.seed];
        if(!Number.isFinite(best)||recorded<best)meta.specialTimes[run.seed]=recorded;
        if(meta.specialClaims.includes(run.seed)){
          meta.specialRun=null;
          return {ok:true,rewards:[],message:!Number.isFinite(best)||recorded<best?'New Special Batch personal best!':'Special Batch recorded. Your ingredient reward was already collected.'};
        }
        const data=context.raw();data.pantry[run.ingredient]+=3;data.xp+=20;
        const ingredient=RecipeData.ingredients.find(i=>i.id===run.ingredient);
        const rewards=[`+3 ${ingredient.name}`,'+20 baker XP'];
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
      if(bakery.status!=='open')return failure(bakery.status==='closed'?'The bakery is resting. Come back when Squeektoshi runs.':'Live wheel data is unavailable. Sales are paused.');
      if(seed!==bakery.seed)return failure('The market batch changed. Check the new prices.');
      const offer=bakery.offers.find(o=>o.recipe===recipe);
      if(!offer||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return failure('Choose a valid treat and quantity.');
      const data=context.raw();
      if(data.food[recipe]<quantity)return failure('There are not enough treats in your tin.');
      const points=offer.price*quantity;
      if(!Number.isSafeInteger(points)||points<1)return failure('That price is unavailable.');
      data.food[recipe]-=quantity;context.meta.bakeryPoints+=points;context.meta.pointsEarned+=points;context.meta.sales+=quantity;context.meta.initialized=true;
      data.history.unshift({at:now(),message:`Sold ${quantity} ${RecipeData.recipes.find(r=>r.id===recipe).name}: +${points} Bakery Points`});data.history=data.history.slice(0,24);context.replace(data);
      return {ok:true,points,message:`Sold ${quantity} treats for ${points} Bakery Points.`};
    });return {...output,bakery};
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
  return {session,profile,command,sell,leaderboard,close:()=>db.close()};
}
module.exports={createBakeryService};
