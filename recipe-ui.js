const RecipeProfile=(()=>{
  const model=createBakeryClient(localStorage,()=>{if(dialog.open)render();updateRunMode();}),dialog=document.querySelector('#recipe-box');
  const content=document.querySelector('#recipe-content'),status=document.querySelector('#recipe-status');
  let tab='recipes',resume=false,filter='all',recipesView='recipes',ordersView='casual';
  const queueDrafts=new Map();
  const {recipes,ingredients}=RecipeData;
  let activeRewarded=null,activeLootPlan=null,launchVersion=0;
  function isRewardedRun(){return activeRewarded??model.snapshot().activeRunRewarded===true;}
  function canRewardRun(){const quota=model.snapshot().runAllowance;return !!quota&&!quota.walletRequired&&quota.remaining>0;}
  function launchRun(start){const attempt=++launchVersion;activeRewarded=null;activeLootPlan=null;return Promise.resolve(start()).then(id=>{if(attempt===launchVersion){activeRewarded=model.snapshot().activeRunRewarded===true;activeLootPlan=model.snapshot().runLootPlan;updateRunMode();}return id;});}
  function lootPlan(runId,level,kind='campaign'){const plan=activeLootPlan||model.snapshot().runLootPlan;return plan&&plan.runId===runId&&plan.level===level&&plan.kind===kind?plan:null;}
  async function prepareLevelLoot(runId,level,kind='campaign'){activeLootPlan=await model.prepareLevelLoot(runId,level,kind);return activeLootPlan;}
  async function collectIngredient(runId,level,pickup,kind='campaign'){try{const result=await model.collectIngredient(runId,level,pickup,kind);if(result.ok){showLoot(result.rewards||[]);notify(result.message);}else notify(result.message);return result;}catch(error){notify(`Catch could not save: ${error.message}`);return {ok:false};}}
  function runStatus(active=false){
    const data=model.snapshot(),quota=data.runAllowance;
    if(!quota)return 'Checking daily runs…';
    if(active&&isRewardedRun())return `Rewarded · ${quota.remaining}/5 left today`;
    if(active)return quota.walletRequired?'Practice · connect wallet':'Practice · no rewards';
    if(quota.walletRequired)return 'Practice · connect wallet for rewards';
    return quota.remaining?`${quota.remaining}/5 rewarded runs left`:'Practice · resets 00:00 UTC';
  }
  function updateRunMode(){const label=document.querySelector('#run-mode');if(label)label.textContent=runStatus(typeof started!=='undefined'&&started);}
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function button(text,fn,disabled=false){const node=el('button','',text);node.type='button';node.disabled=disabled;node.addEventListener('click',async()=>{node.disabled=true;try{await fn();}catch(error){message(error.message);}finally{if(node.isConnected)render();}});return node;}
  function message(text){status.textContent=text;}
  function image(flavor){const frame=el('div',`recipe-art recipe-art-${flavor}`);frame.setAttribute('aria-hidden','true');return frame;}
  function ingredientImage(ingredient){const image=el('img','ingredient-art');image.src=ingredient.image;image.alt='';image.loading='lazy';image.width=72;image.height=72;return image;}
  function rarityBadge(id){const rarity=RecipeData.rarities.find(item=>item.id===id);return el('span',`rarity-badge rarity-${id}`,rarity?.name||id);}
  function renderHeader(data){
    document.querySelector('#baker-name').textContent=`${data.name}’s Bakery`;
    document.querySelector('#baker-title').textContent=`${data.title} · Lv ${data.bakerLevel}`;
    document.querySelector('#recipe-stats').textContent=`${Object.values(data.recipes).filter(r=>r.scraps===2).length}/${recipes.length} recipes · ${Object.values(data.recipes).filter(r=>r.firstBaked).length}/${recipes.length} baked · ${data.ordersDone} ${data.ordersDone===1?'order':'orders'} · ${data.stamps} stamps`;
    document.querySelector('#baker-xp').value=data.xp%50;
    document.querySelector('#baker-xp').setAttribute('aria-label',`${data.xpNext} experience to next baker level`);
    document.querySelector('#recipe-save').textContent=data.warning||'Saved';
    content.setAttribute('aria-labelledby',`tab-${tab}`);
    document.querySelectorAll('[data-recipe-tab]').forEach(b=>{const active=b.dataset.recipeTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  }
  function requirements(recipe,data){const list=el('ul','recipe-needs');for(const [id,n]of Object.entries(recipe.needs)){const ingredient=ingredients.find(i=>i.id===id);const enough=data.pantry[id]>=n;const item=el('li',enough?'enough':'missing',`${ingredient.icon} ${ingredient.name} ${data.pantry[id]}/${n}`);list.append(item);}return list;}
  function subnav(label,items,active,select){const nav=el('div','bakery-subnav');nav.setAttribute('role','group');nav.setAttribute('aria-label',label);for(const item of items){const control=button(item.label,()=>select(item.id));control.setAttribute('aria-pressed',String(item.id===active));nav.append(control);}return nav;}
  function renderRecipes(data){
    content.append(subnav('Recipe sections',[{id:'recipes',label:'Recipes'},{id:'pantry',label:'Pantry'}],recipesView,id=>{recipesView=id;render();}));
    if(recipesView==='pantry'){renderPantry(data);return;}
    content.append(el('p','recipe-explainer','Find recipes, gather ingredients and bake treats.'));
    const controls=el('div','recipe-filters');controls.append(el('span','', '2 scraps unlock a recipe'),button(filter==='all'?'Discovered':'All recipes',()=>{filter=filter==='all'?'known':'all';render();}));content.append(controls);
    const grid=el('div','recipe-grid');
    for(const recipe of recipes){
      const entry=data.recipes[recipe.id],known=entry?.scraps===2;if(filter==='known'&&!known)continue;
      const card=el('article',`recipe-card ${known?'':'undiscovered'} tier-${recipe.rarity}`);card.append(image(recipe.flavor),rarityBadge(recipe.rarity));
      card.append(el('span','recipe-ribbon',entry?.firstBaked?'Collected':known?'Discovered':`${entry?.scraps||0}/2 scraps`),el('h3','',recipe.name));
      if(known){
        card.append(requirements(recipe,data));
        const canBake=Object.entries(recipe.needs).every(([id,n])=>data.pantry[id]>=n);
        card.append(el('p','recipe-yield',`Makes ×${recipe.yield} · Stored ×${data.food[recipe.id]}`));
        card.append(button(`Bake ×${recipe.yield}`,async()=>{const result=await model.bake(recipe.id);message(result.message);render();if(result.ok){const receipt=document.querySelector('#baking-receipt');receipt.textContent=`Baked ×${recipe.yield} ${recipe.name}`;receipt.classList.remove('baked');void receipt.offsetWidth;receipt.classList.add('baked');}},!canBake||data.readOnly));
        if(!entry.firstBaked)card.append(el('small','','First bake: +3 stamps + collection card'));
      }
      grid.append(card);
    }
    content.append(grid);
  }
  function renderPantry(data){
    content.append(el('p','recipe-explainer','Your ingredients. Catch drops in rewarded runs: each broken food block has an 18% chance. No guaranteed drops.'));
    content.append(el('p','loot-odds','Drops: Common 65% · Uncommon 25% · Rare 9% · Epic 1%. These are shares of ingredient drops.'));
    const grid=el('div','pantry-grid');for(const i of ingredients){const card=el('article',`pantry-card tier-${i.rarity}`);card.append(ingredientImage(i),rarityBadge(i.rarity),el('h3','',i.name),el('strong','pantry-count',String(data.pantry[i.id])),button(`Restock · ${i.restockCost} stamps`,async()=>{const result=await model.buyIngredient(i.id);message(result.message);render();},data.stamps<i.restockCost||data.readOnly));grid.append(card);}content.append(grid);
  }
  function renderOrders(data){
    content.append(subnav('Order sections',[{id:'casual',label:'Casual'},{id:'live',label:`Live${data.liveOrders?.length?' · '+data.liveOrders.length:''}`}],ordersView,id=>{ordersView=id;render();if(id==='live')refreshLiveOrders();}));
    if(ordersView==='live'){renderLiveOrders(data);return;}
    content.append(el('p','recipe-explainer','Casual orders: serve neighbors for stamps and XP. No deadline.'));

    const grid=el('div','orders-grid');for(const order of data.orders){const recipe=recipes.find(r=>r.id===order.recipe),card=el('article','order-card');card.append(el('span','order-customer',order.customer),image(recipe.flavor),el('h3','',`${order.quantity} ${recipe.name}`),el('p','',`Stored ${data.food[recipe.id]} / ${order.quantity}`),el('p','order-reward',`+${order.quantity*3} stamps · +15 XP`),button('Serve',async()=>{const result=await model.fulfill(order.id);message(result.message);render();},data.food[recipe.id]<order.quantity||data.readOnly));grid.append(card);}content.append(grid);
    const tin=el('section','treat-tin');tin.append(el('h3','','Treat tin'));const stocked=recipes.filter(r=>data.food[r.id]>0);tin.append(el('p','',stocked.length?stocked.map(r=>`${r.name} ×${data.food[r.id]}`).join(' · '):'No treats yet.'));content.append(tin);
  }
  function priceRange(offer,quantity=1){return Number.isFinite(offer?.rangeMin)&&Number.isFinite(offer?.rangeMax)?`${offer.rangeMin*quantity}–${offer.rangeMax*quantity} points`:null;}
  function recipeFor(id){return recipes.find(recipe=>recipe.id===id);}
  function showRecipes(){tab='recipes';recipesView='recipes';message('');render();}
  function showMarket(){tab='market';message('');render();refreshBakery();}
  function showLiveOrders(){tab='orders';ordersView='live';message('');render();refreshLiveOrders();}
  function renderLiveOrders(data){
    content.append(el('p','recipe-explainer','Reserve treats for the next bakery opening. They sell automatically, even while you’re offline.'));
    const note=el('p','live-price-note','Round data sets the price at opening. Ranges show possible prices, not a fixed quote.');content.append(note);
    const actions=el('div','live-order-actions');actions.append(button('Bake treats',showRecipes),button('Live Bakery ↗',showMarket),button('Refresh ↻',refreshLiveOrders));content.append(actions);
    const orders=data.liveOrders||[],totals=data.saleTotals||{quantity:0,points:0};
    const stats=el('div','live-order-totals');stats.append(el('span','',`Reserved ×${orders.reduce((sum,order)=>sum+order.quantity,0)}`),el('span','',`Sold ×${totals.quantity||0}`),el('strong','',`${totals.points||0} points earned`));content.append(stats);
    if(orders.length){
      const section=el('section','pending-sales');section.append(el('h3','','Queued for opening'));
      const grid=el('div','orders-grid');
      for(const order of orders){const recipe=recipeFor(order.recipe);if(!recipe)continue;const card=el('article','order-card live-order-card');card.append(image(recipe.flavor),el('span','order-customer','Reserved'),el('h3','',`${recipe.name} ×${order.quantity}`),el('p','',order.waitForRest?'Waiting for Squeektoshi to rest, then run again.':'Sells at the next confirmed opening.'),button('Cancel & return treats',async()=>{const result=await model.cancelSale(order.id);message(result.message);},data.readOnly));grid.append(card);}
      section.append(grid);content.append(section);
    }
    content.append(el('h3','live-sale-title','Set up a sale'));
    const known=recipes.filter(recipe=>data.recipes[recipe.id]?.scraps===2||data.food[recipe.id]>0||data.lastSales?.[recipe.id]);
    const grid=el('div','recipe-grid');
    for(const recipe of known){
      const available=data.food[recipe.id]||0,limit=Math.min(available,1000),offer=bakery?.offers?.find(item=>item.recipe===recipe.id),last=data.lastSales?.[recipe.id];
      const card=el('article','recipe-card live-sale-card');card.append(image(recipe.flavor),el('h3','',recipe.name),el('p','live-stock',`Available ×${available}`));
      const range=priceRange(offer);card.append(el('p','live-sale-range',range?`${range} each`:'Price range unavailable'),el('p','live-last-sale',last?`Last sale: ${last.unitPrice} points each`:'No sales yet'));
      const quantity=el('input','live-sale-quantity');quantity.type='number';quantity.min='1';quantity.max=String(Math.max(1,limit));quantity.step='1';quantity.value=String(Math.min(Math.max(1,Number(queueDrafts.get(recipe.id))||1),Math.max(1,limit)));quantity.disabled=!available||data.readOnly;quantity.setAttribute('aria-label',`Quantity of ${recipe.name} to reserve`);
      const quantityLabel=el('label','live-quantity-label','Reserve quantity');quantityLabel.append(quantity);card.append(quantityLabel);
      const estimate=el('p','live-sale-estimate');
      const queue=button('Queue sale',async()=>{const chosen=Number(quantity.value);if(!Number.isSafeInteger(chosen)||chosen<1||chosen>limit){message('Choose a quantity from your available treats.');return;}const result=await model.queueSale(recipe.id,chosen);message(result.message);if(result.ok)queueDrafts.delete(recipe.id);},!available||data.readOnly);
      function update(){const chosen=Number(quantity.value),valid=Number.isSafeInteger(chosen)&&chosen>0&&chosen<=limit;queueDrafts.set(recipe.id,quantity.value);queue.disabled=!valid||data.readOnly;const total=valid?priceRange(offer,chosen):null;estimate.textContent=total?`Possible total: ${total}`:valid?'Price set at opening.':available?`Choose 1–${limit} treats.`:'Bake more treats to queue a sale.';}
      quantity.addEventListener('input',update);update();card.append(estimate,queue);grid.append(card);
    }
    content.append(grid);
    if(!known.length)content.append(el('p','recipe-explainer','Discover and bake a recipe to queue your first sale.'));
    const receipts=data.saleReceipts||[];
    const history=el('section','sale-receipts');history.append(el('h3','','Recent sales'));
    if(!receipts.length)history.append(el('p','recipe-explainer','Your sale receipts will appear here.'));
    for(const receipt of receipts.slice(0,8)){const recipe=recipeFor(receipt.recipe);if(!recipe)continue;const row=el('div','sale-receipt');if(receipt.at)row.title=new Date(receipt.at).toLocaleString();row.append(el('div','',`${recipe.name} ×${receipt.quantity}`),el('span','',`${receipt.unitPrice} each · ${receipt.kind==='queued'?'Queued sale':'Live sale'}`),el('strong','',`+${receipt.totalPoints} points`));history.append(row);}
    content.append(history);
  }
  function renderCollection(data){
    content.append(el('p','recipe-explainer','Bake once. Keep the card forever.'));
    const grid=el('div','recipe-grid collection-grid');for(const recipe of recipes){const entry=data.recipes[recipe.id],complete=!!entry?.firstBaked,card=el('article',`recipe-card ${complete?'collected':'undiscovered'} tier-${recipe.rarity}`);card.append(image(recipe.flavor),rarityBadge(recipe.rarity),el('span','recipe-ribbon',complete?'Collected':'Uncollected'),el('h3','',recipe.name),el('small','',complete?`${entry.batches} ${entry.batches===1?'batch':'batches'} baked`:`${entry?.scraps||0}/2 scraps`));grid.append(card);}content.append(grid);
  }
  function renderProfile(data){
    content.append(el('p','recipe-explainer','Your baker name, progress and recent activity.'));
    if(data.runAllowance)content.append(el('p','recipe-explainer',`${runStatus()} · Resets daily at 00:00 UTC. Practice earns no loot or global rankings.`));
    const form=el('form','profile-form'),label=el('label','','Baker name'),input=el('input');input.maxLength=24;input.value=data.name;input.required=true;input.setAttribute('aria-label','Baker name');label.append(input);const submit=el('button','','Save name');submit.type='submit';submit.disabled=data.readOnly;form.append(label,submit);form.addEventListener('submit',async event=>{event.preventDefault();try{if(await model.rename(input.value)){message('Name saved.');render();}}catch(error){message(error.message);}});content.append(form);
    content.append(el('h3','','Your stats'),el('p','recipe-explainer',`${data.clears} clears · ${data.totalBaked} baked · ${data.ordersDone} orders · ${data.xp} XP · ${data.bakeryPoints||0} points · ${data.sales||0} sold`));
    const titles=el('div','title-shelf');for(const title of RecipeData.titles)titles.append(el('span',data.ordersDone>=title.orders?'earned':'',`${data.ordersDone>=title.orders?'♡':'○'} ${title.name} · ${title.orders} orders`));content.append(titles);
    content.append(el('h3','','Run loot'));const loot=data.activeRun?.loot||[];content.append(el('p','recipe-explainer',loot.length?loot.join(' · '):'Clear a level for loot.'));
    const history=el('div','recipe-history');history.append(el('h3','','Recent activity'));for(const entry of data.history.slice(0,6))history.append(el('p','',entry.message));if(!data.history.length)history.append(el('p','','Starter ingredients ready.'));content.append(history);
  }
  function render(){const data=model.snapshot();renderHeader(data);content.replaceChildren();({recipes:renderRecipes,orders:renderOrders,collection:renderCollection,profile:renderProfile,market:renderMarket}[tab])(data);}
  function openPanel(next='recipes'){tab=next;if(next==='recipes')recipesView='recipes';resume=state==='playing';if(resume)pause();keys.clear();render();if(!dialog.open)dialog.showModal();refreshProfile();if(next==='market')refreshBakery();}
  function open(){openPanel('recipes');}

  function close(){dialog.close();}
  document.querySelector('#open-recipes').addEventListener('click',open);document.querySelector('#open-market').addEventListener('click',()=>openPanel('market'));document.querySelector('#close-recipes').addEventListener('click',close);
  dialog.addEventListener('close',()=>{keys.clear();if(resume&&state==='paused')action();resume=false;canvas.focus();});
  const tabs=[...document.querySelectorAll('[data-recipe-tab]')];
  tabs.forEach((node,index)=>{node.addEventListener('click',()=>{tab=node.dataset.recipeTab;if(tab==='recipes')recipesView='recipes';message('');render();if(tab==='market')refreshBakery();if(tab==='orders'&&ordersView==='live')refreshLiveOrders();});node.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tab=tabs[next].dataset.recipeTab;if(tab==='recipes')recipesView='recipes';render();tabs[next].focus();if(tab==='market')refreshBakery();if(tab==='orders'&&ordersView==='live')refreshLiveOrders();}});});
  async function awardLevel(runId,level,elapsed){
    try{const rewards=await model.awardLevel(runId,level,elapsed);showLoot(rewards);if(typeof Onboarding!=='undefined')Onboarding.firstClear();return rewards;}
    catch(error){message(error.message);notify('Save failed · '+error.message);return [];}
  }
  function showLoot(rewards){const summary=document.querySelector('#run-loot');summary.textContent=rewards.length?`Loot: ${rewards.join(' · ')}`:'';summary.hidden=!rewards.length;}
  let bakery=null,refreshing=false,refreshingProfile=false;
  async function refreshProfile(){if(refreshingProfile)return;refreshingProfile=true;try{await model.settle();await model.request('/api/profile');}catch(error){message(error.message);}finally{refreshingProfile=false;}}
  async function refreshLiveOrders(){await Promise.all([refreshProfile(),refreshBakery()]);}

  async function refreshBakery(){
    if(refreshing)return;refreshing=true;
    try{bakery=await model.request('/api/bakery');}catch(error){bakery={status:'unknown',reason:error.message};}
    finally{refreshing=false;if(dialog.open&&(tab==='market'||tab==='orders'&&ordersView==='live'))render();}
  }
  function renderMarket(data){
    const view=bakery||{status:'unknown',reason:'Checking wheel…'};
    const overview=el('section','market-overview');overview.append(el('h3','','Your bakery, powered by Squeektoshi'),el('p','','Play for ingredients. Bake treats. Sell while Squeektoshi runs.'),el('p','market-overview-note','Going offline? Reserve treats for the next opening.'),button('Queue offline sales ↗',showLiveOrders));content.append(overview);
    const banner=el('section',`market-banner market-${view.status}`);

    banner.append(el('span','eyebrow','SQUEEKTOSHI’S BAKERY'),el('h3','',view.status==='open'?'Bakery open':view.status==='closed'?'Resting paws':'Checking wheel'),el('strong','',`${data.bakeryPoints||0} points`));
    banner.append(el('p','recipe-description',view.status==='open'?'Sell while Squeektoshi runs.':view.status==='closed'?'Bake now. Sell when Squeektoshi runs.':'Sales paused. Try refresh.'));
    if(view.settlement){const info=el('div','market-info');info.append(el('span','eyebrow','Round info'),el('p','recipe-save',`${view.settlement.network} · Round ${view.settlement.round} · ${view.settlement.transactionHash}`));if(view.reason)info.append(el('p','recipe-save',view.reason));banner.append(info);}
    content.append(banner);
    if(view.special){
      const ingredient=ingredients.find(i=>i.id===view.special.ingredient);
      const practice=!!data.runAllowance&&!canRewardRun();
      const card=el('article','special-batch');card.append(el('span','eyebrow','SPECIAL BATCH'),el('h3','',ingredient?.name||view.special.ingredient),el('p','',practice?'Practice · no rewards or ranking':'Chance ingredient drops · +20 XP on first clear'));
      const claimed=(data.specialClaims||[]).includes(view.special.seed);card.append(el('small','',practice?(data.runAllowance.walletRequired?'Connect a wallet for rewarded runs.':'Daily rewarded runs used. Resets 00:00 UTC.'):claimed?'Reward claimed. Beat your time.':'Reward once per round.'),button(practice?'Play practice ✦':claimed?'Beat your time ✦':'Play special ✦',()=>{resume=false;dialog.close();startSpecialBatch(view.special);},data.readOnly));content.append(card);
    }
    const grid=el('div','recipe-grid');
    for(const offer of view.offers||[]){const recipe=recipes.find(r=>r.id===offer.recipe);if(!recipe)continue;
      const card=el('article','recipe-card');card.append(image(recipe.flavor),el('span','recipe-ribbon',offer.demand||'Steady'),el('h3','',recipe.name),el('p','',`${offer.price} points each · Stored ×${data.food[recipe.id]}`));
      card.append(button('Sell ×1',async()=>{const response=await model.request('/api/sell',{recipe:recipe.id,quantity:1,seed:view.seed});message(response.result.message);await refreshBakery();},view.status!=='open'||!data.food[recipe.id]||data.readOnly),button('Queue for next opening',()=>{queueDrafts.set(recipe.id,'1');showLiveOrders();},!data.food[recipe.id]||data.readOnly));grid.append(card);
    }
    content.append(grid,button('Refresh ↻',refreshBakery));

  }
  model.ready.then(refreshBakery).catch(error=>message(error.message));
  setInterval(()=>{if(!dialog.open||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(tab==='market')refreshBakery();else if(tab==='orders'&&ordersView==='live')refreshLiveOrders();},15000);
  render();
  return {runStatus,isRewardedRun,canRewardRun,lootPlan,prepareLevelLoot,collectIngredient,settle:()=>model.settle(),isOpen:()=>dialog.open,startRun:()=>{document.querySelector('#run-loot').hidden=true;return launchRun(()=>model.startRun());},awardLevel,open,openMarket:()=>openPanel('market'),openLiveOrders:()=>{openPanel('orders');ordersView='live';render();refreshLiveOrders();},
    startSpecial:seed=>{const run=launchRun(()=>model.startSpecial(seed));run.catch(error=>notify(error.message));return run;},awardSpecial:async (id,elapsed)=>{try{const result=await model.awardSpecial(id,elapsed);showLoot(result.rewards||[]);notify(result.message);}catch(error){notify(error.message);}}};
})();
