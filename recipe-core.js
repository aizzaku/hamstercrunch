/* Persistent collection/baking economy. Independent of the game and DOM. */
const RecipeData=(()=>{
  const rarities=[
    {id:'common',name:'Common',color:'#91775b',weight:65,ingredientValue:1,restockCost:3},
    {id:'uncommon',name:'Uncommon',color:'#648050',weight:25,ingredientValue:2,restockCost:6},
    {id:'rare',name:'Rare',color:'#6683a7',weight:9,ingredientValue:4,restockCost:12},
    {id:'epic',name:'Epic',color:'#9564a6',weight:1,ingredientValue:10,restockCost:30},
  ];
  const loot={chance:.18,rarityWeights:Object.fromEntries(rarities.map(r=>[r.id,r.weight])),scrapChance:.05};
  const ingredients=[
    {id:'flour',name:'Flour',icon:'🌾',rarity:'common'},{id:'butter',name:'Butter',icon:'🧈',rarity:'common'},
    {id:'sugar',name:'Sugar',icon:'◇',rarity:'common'},{id:'vanilla',name:'Vanilla',icon:'✿',rarity:'uncommon'},
    {id:'cocoa',name:'Cocoa',icon:'🍫',rarity:'rare'},{id:'strawberry',name:'Strawberries',icon:'🍓',rarity:'rare'},
    {id:'cinnamon',name:'Cinnamon',icon:'❧',rarity:'uncommon'},{id:'honey',name:'Honey',icon:'🍯',rarity:'rare'},
    {id:'eggs',name:'Eggs',icon:'🥚',rarity:'common'},{id:'milk',name:'Milk',icon:'🥛',rarity:'uncommon'},
    {id:'almond',name:'Almonds',icon:'🌰',rarity:'rare'},{id:'saffron',name:'Saffron',icon:'✺',rarity:'epic'},
  ].map(ingredient=>{const rarity=rarities.find(r=>r.id===ingredient.rarity);return {...ingredient,image:`assets/ingredients/${ingredient.id}.png`,restockCost:rarity.restockCost,value:rarity.ingredientValue};});
  const recipes=[
    {id:'butter-paws',name:'Butter Paw Biscuits',flavor:'butter',description:'Little paw prints. A very big welcome.',needs:{flour:1,butter:1,sugar:1},yield:2},
    {id:'sugar-clouds',name:'Sugar Clouds',flavor:'sugar',description:'A soft snowfall over the cookie tin.',needs:{flour:1,butter:1,sugar:2},yield:3},
    {id:'strawberry-hearts',name:'Strawberry Hearts',flavor:'jam',description:'A tiny jam heart, baked for someone sweet.',needs:{flour:1,butter:1,strawberry:1},yield:2},
    {id:'choco-checkers',name:'Chocolate Checkerboards',flavor:'chocolate',description:'Half golden, half cocoa. Entirely irresistible.',needs:{flour:1,butter:1,cocoa:1},yield:2},
    {id:'cinnamon-swirls',name:'Cinnamon Swirls',flavor:'butter',description:'Follow the spiral all the way to the last crumb.',needs:{flour:1,butter:1,cinnamon:1,sugar:1},yield:3},
    {id:'honey-crackers',name:'Honey Crackers',flavor:'cracker',description:'Sunshine, a little crunch, and sticky paws.',needs:{flour:2,honey:1},yield:3},
    {id:'vanilla-kisses',name:'Vanilla Kisses',flavor:'sugar',description:'The tiniest treats in the biggest jar.',needs:{flour:1,sugar:1,vanilla:1},yield:3},
    {id:'berry-tarts',name:'Berry Burrow Tarts',flavor:'jam',description:'A buttery nest for a spoonful of berries.',needs:{flour:2,butter:1,strawberry:2},yield:2},
    {id:'cocoa-stars',name:'Midnight Cocoa Stars',flavor:'chocolate',description:'For midnight bakers and sleepy little dreamers.',needs:{flour:1,cocoa:2,sugar:1,vanilla:1},yield:3},
    {id:'honey-hugs',name:'Honey Cinnamon Hugs',flavor:'cracker',description:'A warm blanket, in biscuit form.',needs:{flour:1,honey:1,cinnamon:1,butter:1},yield:2},
    {id:'marble-morsels',name:'Marble Morsels',flavor:'chocolate',description:'Chocolate and vanilla taking a little tumble.',needs:{flour:2,butter:1,cocoa:1,vanilla:1},yield:3},
    {id:'genesis-feast',name:'The Genesis Feast',flavor:'gift',description:'Every flavor in the bakery, together at last.',needs:{flour:2,butter:1,sugar:1,vanilla:1,cocoa:1,strawberry:1,cinnamon:1,honey:1},yield:4},
    {id:'egg-custard-cookies',name:'Golden Custard Cookies',flavor:'butter',description:'Soft golden middles for tiny paws.',needs:{flour:1,butter:1,sugar:1,eggs:1},yield:3},
    {id:'milk-shortbread',name:'Milk Bottle Shortbread',flavor:'sugar',description:'A milky little biscuit for the tea tray.',needs:{flour:2,butter:1,milk:1},yield:3},
    {id:'vanilla-mooncakes',name:'Vanilla Moon Bites',flavor:'sugar',description:'A moonlit snack with a vanilla heart.',needs:{flour:1,sugar:1,eggs:1,milk:1,vanilla:1},yield:3},
    {id:'almond-crescents',name:'Almond Crescents',flavor:'butter',description:'Curled up like a sleepy hamster.',needs:{flour:1,butter:1,sugar:1,almond:1},yield:2},
    {id:'cocoa-cream-puffs',name:'Cocoa Cream Puffs',flavor:'chocolate',description:'A cloud of cream with chocolate cheeks.',needs:{flour:1,eggs:1,milk:1,cocoa:1},yield:2},
    {id:'berry-almond-kisses',name:'Berry Almond Kisses',flavor:'jam',description:'Sweet berry kisses and a nutty crunch.',needs:{flour:1,butter:1,strawberry:1,almond:1},yield:2},
    {id:'saffron-sunbursts',name:'Saffron Sunbursts',flavor:'gift',description:'A tiny golden sunrise, fresh from the oven.',needs:{flour:2,butter:1,eggs:1,honey:1,saffron:1},yield:3},
    {id:'royal-saffron-tarts',name:'Royal Burrow Tarts',flavor:'gift',description:'The bakery’s rarest little celebration.',needs:{flour:2,butter:1,milk:1,almond:1,vanilla:1,saffron:2},yield:3},
  ].map(recipe=>{const tier=Math.max(...Object.keys(recipe.needs).map(id=>rarities.findIndex(r=>r.id===ingredients.find(i=>i.id===id).rarity)));return {...recipe,rarity:rarities[tier].id};});
  const titles=[{name:'Little Baker',orders:0},{name:'Cookie Companion',orders:3},{name:'Pantry Pro',orders:10},{name:'Master of Crumbs',orders:25}];
  function recipeValue(recipe){return Object.entries(recipe.needs).reduce((sum,[id,n])=>sum+n*ingredients.find(i=>i.id===id).value,0);}
  return {ingredients,recipes,titles,rarities,loot,recipeValue};
})();

function createRecipeBox(storage,random=Math.random,now=()=>new Date().toISOString()){
  const campaignLength=21;
  const key='hamster-crunch-recipe-box-v1';
  const {recipes,ingredients,titles}=RecipeData;
  const count=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,1000000):0;
  const emptyMap=ids=>Object.fromEntries(ids.map(id=>[id,0]));
  let warning='',readOnly=false;
  function fresh(){return {version:1,name:'Little Baker',created:now(),pantry:{...emptyMap(ingredients.map(i=>i.id)),flour:3,butter:2,sugar:2,vanilla:1},recipes:{'butter-paws':{scraps:2,discovered:now(),firstBaked:null,batches:0}},food:emptyMap(recipes.map(r=>r.id)),stamps:0,xp:0,ordersDone:0,totalBaked:0,clears:0,ingredientDry:0,scrapDry:0,runCounter:0,activeRun:null,orderCounter:0,orders:[],history:[]};}
  function load(){
    try{
      const raw=storage.getItem(key);if(!raw)return fresh();
      const loaded=JSON.parse(raw);
      if(!loaded||loaded.version!==1){readOnly=true;warning='Unsupported save. Original preserved.';return fresh();}
      const clean=fresh();
      clean.name=typeof loaded.name==='string'?loaded.name.slice(0,24):clean.name;
      clean.created=typeof loaded.created==='string'?loaded.created:clean.created;
      for(const field of ['stamps','xp','ordersDone','totalBaked','clears','ingredientDry','scrapDry','runCounter','orderCounter'])clean[field]=count(loaded[field]);
      clean.pantry=emptyMap(ingredients.map(i=>i.id));for(const i of ingredients)clean.pantry[i.id]=count(loaded.pantry?.[i.id]);
      clean.food=emptyMap(recipes.map(r=>r.id));for(const r of recipes)clean.food[r.id]=count(loaded.food?.[r.id]);
      clean.recipes={};for(const r of recipes){const entry=loaded.recipes?.[r.id];if(entry&&typeof entry==='object')clean.recipes[r.id]={scraps:Math.min(2,count(entry.scraps)),discovered:typeof entry.discovered==='string'?entry.discovered:null,firstBaked:typeof entry.firstBaked==='string'?entry.firstBaked:null,batches:count(entry.batches)};}
      clean.recipes['butter-paws']??={scraps:2,discovered:clean.created,firstBaked:null,batches:0};
      const run=loaded.activeRun;if(run&&Number.isSafeInteger(run.id)&&run.id>0&&run.id<=clean.runCounter)clean.activeRun={id:run.id,lastLevel:Math.max(-1,Math.min(campaignLength-1,Number.isInteger(run.lastLevel)?run.lastLevel:-1)),loot:Array.isArray(run.loot)?run.loot.filter(x=>typeof x==='string').slice(0,84):[]};
      clean.orders=Array.isArray(loaded.orders)?loaded.orders.filter(o=>o&&Number.isSafeInteger(o.id)&&o.id>0&&recipes.some(r=>r.id===o.recipe)&&Number.isInteger(o.quantity)&&o.quantity>0&&o.quantity<=4).slice(0,3).map(o=>({id:o.id,recipe:o.recipe,quantity:o.quantity,customer:typeof o.customer==='string'?o.customer.slice(0,40):'A hungry neighbor'})):[];
      clean.orderCounter=Math.max(clean.orderCounter,...clean.orders.map(o=>o.id));
      clean.history=Array.isArray(loaded.history)?loaded.history.filter(h=>h&&typeof h.message==='string'&&typeof h.at==='string').slice(0,24):[];
      return clean;
    }catch(error){readOnly=true;warning='Save unreadable. Original preserved.';console.warn('Recipe save could not be read:',error);return fresh();}
  }
  let data=load();
  function save(){
    if(readOnly)return false;
    try{storage.setItem(key,JSON.stringify(data));warning='';return true;}
    catch(error){warning='Storage unavailable. Saved for this visit only.';console.warn('Recipe progress could not be saved:',error);return false;}
  }
  function log(message){data.history.unshift({message,at:now()});data.history=data.history.slice(0,24);}
  function pick(items){return items[Math.min(items.length-1,Math.max(0,Math.floor(random()*items.length)))];}
  function known(){return recipes.filter(r=>data.recipes[r.id]?.scraps>=2);}
  function fillOrders(){
    const available=known();
    const customers=['Mabel the Mouse','Pip the Posthamster','The Tea-Time Club','Hazel Next Door','Grandma Crumb','The Sleepy Twins'];
    while(data.orders.length<3){const index=data.orderCounter++;const recipe=available[index%available.length];data.orders.push({id:index+1,recipe:recipe.id,quantity:Math.min(recipe.yield,index%3+1),customer:customers[index%customers.length]});}
  }
  fillOrders();save();
  function snapshot(){
    const copy=JSON.parse(JSON.stringify(data));
    copy.warning=warning;copy.readOnly=readOnly;copy.title=[...titles].reverse().find(t=>data.ordersDone>=t.orders).name;
    copy.bakerLevel=1+Math.floor(data.xp/50);copy.xpNext=50-data.xp%50;return copy;
  }
  function startRun(){if(readOnly)return null;data.runCounter++;data.activeRun={id:data.runCounter,lastLevel:-1,loot:[]};save();return data.runCounter;}
  function awardLevel(runId,level){
    if(readOnly||!data.activeRun||data.activeRun.id!==runId||!Number.isInteger(level)||level<0||level>=campaignLength||level!==data.activeRun.lastLevel+1)return [];
    data.activeRun.lastLevel=level;data.clears++;data.xp+=5;const rewards=['+5 XP'];
    const scrapRoll=random();
    if(scrapRoll<RecipeData.loot.scrapChance){
      const missing=recipes.filter(r=>(data.recipes[r.id]?.scraps||0)<2);
      if(missing.length){
        const tiers=RecipeData.rarities.filter(tier=>missing.some(recipe=>recipe.rarity===tier.id));
        let roll=random()*tiers.reduce((sum,tier)=>sum+tier.weight,0),tier=tiers[tiers.length-1];
        for(const candidate of tiers){roll-=candidate.weight;if(roll<0){tier=candidate;break;}}
        const recipe=pick(missing.filter(item=>item.rarity===tier.id));
        const entry=data.recipes[recipe.id]??={scraps:0,discovered:null,firstBaked:null,batches:0};entry.scraps++;if(entry.scraps===2){entry.discovered=now();data.xp+=15;rewards.push(`Discovered: ${recipe.name}`);}else rewards.push(`Scrap: ${recipe.name} (1/2)`);
      }
      else{data.stamps+=2;rewards.push('+2 stamps · all recipes found');}
      data.scrapDry=0;
    }else data.scrapDry++;
    data.activeRun.loot.push(...rewards);log(`Batch ${level+1}: ${rewards.join(' · ')}`);save();return rewards;
  }
  // Only the server's issued-pickup claim path may call this in online play.
  function collectIngredient(id){
    const ingredient=ingredients.find(item=>item.id===id);
    if(readOnly)return {ok:false,rewards:[],message:warning};
    if(!ingredient)return {ok:false,rewards:[],message:'Unknown ingredient.'};
    data.pantry[id]++;const rewards=[`+1 ${ingredient.name}`];
    if(data.activeRun)data.activeRun.loot.push(...rewards);
    log(`Caught ${ingredient.name}`);save();return {ok:true,rewards,message:`Caught ${ingredient.name}!`};
  }
  function bake(id){
    const recipe=recipes.find(r=>r.id===id);
    if(readOnly)return {ok:false,message:warning};
    if(!recipe||data.recipes[id]?.scraps!==2)return {ok:false,message:'Find 2 recipe scraps first.'};
    if(Object.entries(recipe.needs).some(([key,n])=>data.pantry[key]<n))return {ok:false,message:'Need ingredients.'};
    for(const [key,n]of Object.entries(recipe.needs))data.pantry[key]-=n;
    const entry=data.recipes[id];entry.batches++;data.food[id]+=recipe.yield;data.totalBaked+=recipe.yield;data.xp+=10;
    if(!entry.firstBaked){entry.firstBaked=now();data.stamps+=3;}
    const message=`Baked ${recipe.yield} ${recipe.name}!`;log(message);save();return {ok:true,message};
  }
  function fulfill(id){
    if(readOnly)return {ok:false,message:warning};
    const index=data.orders.findIndex(o=>o.id===id);if(index<0)return {ok:false,message:'Order already served.'};
    const order=data.orders[index];if(data.food[order.recipe]<order.quantity)return {ok:false,message:'Need more treats.'};
    data.food[order.recipe]-=order.quantity;const stamps=order.quantity*3;data.stamps+=stamps;data.xp+=15;data.ordersDone++;
    const recipe=recipes.find(r=>r.id===order.recipe);data.orders.splice(index,1);fillOrders();
    const message=`Served ${order.customer}: +${stamps} stamps`;log(message);save();return {ok:true,message,recipe:recipe.name};
  }
  function rename(name){if(readOnly)return false;const clean=String(name).trim().slice(0,24);if(!clean)return false;data.name=clean;save();return true;}
  // Stamps buy targeted ingredients: a deterministic escape from unlucky drops.
  function buyIngredient(id){
    if(readOnly)return {ok:false,message:warning};
    const ingredient=ingredients.find(i=>i.id===id);
    if(!ingredient)return {ok:false,message:'Unknown ingredient.'};
    if(data.stamps<ingredient.restockCost)return {ok:false,message:`Need ${ingredient.restockCost} stamps.`};
    data.stamps-=ingredient.restockCost;data.pantry[id]++;log(`Restock: +1 ${ingredient.name}`);save();return {ok:true,message:'+1 ingredient.'};
  }
  return {snapshot,startRun,awardLevel,collectIngredient,bake,fulfill,rename,buyIngredient};
}
if(typeof module!=='undefined'&&module.exports)module.exports={RecipeData,createRecipeBox};
