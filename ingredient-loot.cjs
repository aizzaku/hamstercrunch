const {randomBytes,randomInt}=require('node:crypto');
const {RecipeData}=require('./recipe-core.js');

const PLAN_LIFETIME_MS=6*60*60*1000;
const secureRandom=()=>randomInt(0,0x100000000)/0x100000000;

function chooseRarity(random,weights){
  const entries=Object.entries(weights),total=entries.reduce((sum,[,weight])=>sum+weight,0);
  let roll=random()*total;
  for(const [rarity,weight] of entries){roll-=weight;if(roll<0)return rarity;}
  return entries[entries.length-1][0];
}

function createIngredientLootPlan({runId,kind,level,eligible,bricks,now,featured,random=secureRandom}){
  const chance=RecipeData.loot?.chance??.18,weights=RecipeData.loot?.rarityWeights??{common:65,uncommon:25,rare:9,epic:1};
  const entries=[];
  bricks.forEach((_brick,brickId)=>{
    if(random()>=chance)return;
    const rarity=chooseRarity(random,weights);
    const available=RecipeData.ingredients.filter(ingredient=>(ingredient.rarity||'common')===rarity);
    if(!available.length)return;
    const featuredIngredient=available.find(ingredient=>ingredient.id===featured);
    const ingredient=featuredIngredient&&random()<.5?featuredIngredient:available[Math.min(available.length-1,Math.floor(random()*available.length))];
    entries.push({id:randomBytes(12).toString('hex'),brickId,ingredient:ingredient.id,rarity});
  });
  return {runId,kind,level,eligible:eligible===true,issuedAt:now,expiresAt:now+PLAN_LIFETIME_MS,entries,claimed:[]};
}

function publicIngredientLootPlan(plan){
  if(!plan)return null;
  return {runId:plan.runId,kind:plan.kind,level:plan.level,eligible:plan.eligible,expiresAt:new Date(plan.expiresAt).toISOString(),entries:plan.entries.filter(entry=>!plan.claimed.includes(entry.id)).map(entry=>({...entry}))};
}

module.exports={createIngredientLootPlan,publicIngredientLootPlan,chooseRarity,PLAN_LIFETIME_MS};
