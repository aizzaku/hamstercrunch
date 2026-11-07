const RecipeProfile=(()=>{
  const model=createBakeryClient(localStorage,()=>{if(dialog.open)render();}),dialog=document.querySelector('#recipe-box');
  const content=document.querySelector('#recipe-content'),status=document.querySelector('#recipe-status');
  let tab='recipes',resume=false,filter='all';
  const {recipes,ingredients}=RecipeData;
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function button(text,fn,disabled=false){const node=el('button','',text);node.type='button';node.disabled=disabled;node.addEventListener('click',async()=>{node.disabled=true;try{await fn();}catch(error){message(error.message);}finally{if(node.isConnected)render();}});return node;}
  function message(text){status.textContent=text;}
  function image(flavor){const frame=el('div',`recipe-art recipe-art-${flavor}`);frame.setAttribute('aria-hidden','true');return frame;}
  function renderHeader(data){
    document.querySelector('#baker-name').textContent=`${data.name}’s Recipe Box`;
    document.querySelector('#baker-title').textContent=`${data.title} · Baker level ${data.bakerLevel}`;
    document.querySelector('#recipe-stats').textContent=`${Object.values(data.recipes).filter(r=>r.scraps===2).length}/12 recipes · ${Object.values(data.recipes).filter(r=>r.firstBaked).length}/12 baked · ${data.ordersDone} ${data.ordersDone===1?'order':'orders'} · ${data.stamps} stamps`;
    document.querySelector('#baker-xp').value=data.xp%50;
    document.querySelector('#baker-xp').setAttribute('aria-label',`${data.xpNext} experience to next baker level`);
    document.querySelector('#recipe-save').textContent=data.warning||'Saved to this bakery · keep this browser’s session to return';
    content.setAttribute('aria-labelledby',`tab-${tab}`);
    document.querySelectorAll('[data-recipe-tab]').forEach(b=>{const active=b.dataset.recipeTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  }
  function requirements(recipe,data){const list=el('ul','recipe-needs');for(const [id,n]of Object.entries(recipe.needs)){const ingredient=ingredients.find(i=>i.id===id);const enough=data.pantry[id]>=n;const item=el('li',enough?'enough':'missing',`${ingredient.icon} ${ingredient.name} ${data.pantry[id]}/${n}`);list.append(item);}return list;}
  function renderRecipes(data){
    const controls=el('div','recipe-filters');controls.append(el('span','', 'Your handwritten cookbook'),button(filter==='all'?'Show discovered only':'Show all recipes',()=>{filter=filter==='all'?'known':'all';render();}));content.append(controls);
    const grid=el('div','recipe-grid');
    for(const recipe of recipes){
      const entry=data.recipes[recipe.id],known=entry?.scraps===2;if(filter==='known'&&!known)continue;
      const card=el('article',`recipe-card ${known?'':'undiscovered'}`);card.append(image(recipe.flavor));
      card.append(el('span','recipe-ribbon',entry?.firstBaked?'Baked with love':known?'Ready to learn':`${entry?.scraps||0}/2 recipe scraps`),el('h3','',recipe.name),el('p','recipe-description',recipe.description));
      if(known){
        card.append(requirements(recipe,data));
        const canBake=Object.entries(recipe.needs).every(([id,n])=>data.pantry[id]>=n);
        card.append(el('p','recipe-yield',`Makes ${recipe.yield} · In tin: ${data.food[recipe.id]}`));
        card.append(button(`Bake a batch · ${recipe.yield} treats`,async()=>{const result=await model.bake(recipe.id);message(result.message);render();if(result.ok){const receipt=document.querySelector('#baking-receipt');receipt.textContent=`Fresh from the oven: ${recipe.yield} ${recipe.name} ♡`;receipt.classList.remove('baked');void receipt.offsetWidth;receipt.classList.add('baked');}},!canBake||data.readOnly));
        card.append(el('small','',entry.firstBaked?`First baked ${new Date(entry.firstBaked).toLocaleDateString()}`:'First bake earns 3 stamps and a collection card.'));
      }else card.append(el('p','recipe-locked','Find two scraps while clearing levels. A scrap is guaranteed after eight clears without one.'));
      grid.append(card);
    }
    content.append(grid);
  }
  function renderPantry(data){
    content.append(el('p','recipe-explainer','Your ingredients stay with you after every run. Spend 3 stamps to choose a missing ingredient, or find more by clearing levels.'));
    const grid=el('div','pantry-grid');for(const i of ingredients){const card=el('article','pantry-card');card.append(el('span','ingredient-icon',i.icon),el('h3','',i.name),el('strong','pantry-count',String(data.pantry[i.id])),button('Restock · 3 stamps',async()=>{const result=await model.buyIngredient(i.id);message(result.message);render();},data.stamps<3||data.readOnly));grid.append(card);}content.append(grid);
  }
  function renderOrders(data){
    content.append(el('p','recipe-explainer','Bake treats in your Recipe Box, then serve your neighbors. Orders use baked food, not raw ingredients. There are no deadlines.'));
    const grid=el('div','orders-grid');for(const order of data.orders){const recipe=recipes.find(r=>r.id===order.recipe),card=el('article','order-card');card.append(el('span','order-customer',`A note from ${order.customer}`),image(recipe.flavor),el('h3','',`${order.quantity} ${recipe.name}`),el('p','',`In your tin: ${data.food[recipe.id]} / ${order.quantity}`),el('p','order-reward',`Reward: ${order.quantity*3} stamps + 15 baker XP`),button('Pack & serve ♡',async()=>{const result=await model.fulfill(order.id);message(result.message);render();},data.food[recipe.id]<order.quantity||data.readOnly));grid.append(card);}content.append(grid);
    const tin=el('section','treat-tin');tin.append(el('h3','','Your treat tin'));const stocked=recipes.filter(r=>data.food[r.id]>0);tin.append(el('p','',stocked.length?stocked.map(r=>`${r.name} ×${data.food[r.id]}`).join(' · '):'Bake your first batch to fill the tin.'));content.append(tin);
  }
  function renderCollection(data){
    content.append(el('p','recipe-explainer','Bake a recipe once to collect its card forever. Serving or using the treats never removes the card.'));
    const grid=el('div','recipe-grid collection-grid');for(const recipe of recipes){const entry=data.recipes[recipe.id],complete=!!entry?.firstBaked,card=el('article',`recipe-card ${complete?'collected':'undiscovered'}`);card.append(image(recipe.flavor),el('span','recipe-ribbon',complete?'In your collection':'Not baked yet'),el('h3','',recipe.name),el('p','recipe-description',complete?recipe.description:'Discover the recipe and bake your first batch.'),el('small','',complete?`${entry.batches} ${entry.batches===1?'batch':'batches'} baked · First bake ${new Date(entry.firstBaked).toLocaleDateString()}`:`Recipe scraps: ${entry?.scraps||0}/2`));grid.append(card);}content.append(grid);
  }
  function renderProfile(data){
    const form=el('form','profile-form'),label=el('label','','Your baker name'),input=el('input');input.maxLength=24;input.value=data.name;input.required=true;input.setAttribute('aria-label','Baker name');label.append(input);const submit=el('button','','Save name');submit.type='submit';submit.disabled=data.readOnly;form.append(label,submit);form.addEventListener('submit',async event=>{event.preventDefault();try{if(await model.rename(input.value)){message('Your baker name is saved.');render();}}catch(error){message(error.message);}});content.append(form);
    content.append(el('h3','','A little bakery, growing every run'),el('p','recipe-explainer',`${data.clears} levels cleared · ${data.totalBaked} treats baked · ${data.ordersDone} neighbors served · ${data.xp} baker XP · ${data.bakeryPoints||0} Bakery Points · ${data.sales||0} market treats sold`));
    const titles=el('div','title-shelf');for(const title of RecipeData.titles)titles.append(el('span',data.ordersDone>=title.orders?'earned':'',`${data.ordersDone>=title.orders?'♡':'○'} ${title.name} · ${title.orders} orders`));content.append(titles);
    content.append(el('h3','','This run’s basket'));const loot=data.activeRun?.loot||[];content.append(el('p','recipe-explainer',loot.length?loot.join(' · '):'Clear a batch to bring home ingredients and discoveries.'));
    const history=el('div','recipe-history');history.append(el('h3','','Bakery diary'));for(const entry of data.history.slice(0,12))history.append(el('p','',entry.message));if(!data.history.length)history.append(el('p','','Your first recipe and a small pantry bundle are ready. Bake something lovely.'));content.append(history);
  }
  function render(){const data=model.snapshot();renderHeader(data);content.replaceChildren();({recipes:renderRecipes,pantry:renderPantry,orders:renderOrders,collection:renderCollection,profile:renderProfile,market:renderMarket}[tab])(data);}
  function open(){resume=state==='playing';if(resume)pause();keys.clear();render();dialog.showModal();}
  function close(){dialog.close();}
  document.querySelector('#open-recipes').addEventListener('click',open);document.querySelector('#open-market').addEventListener('click',()=>{tab='market';open();refreshBakery();});document.querySelector('#close-recipes').addEventListener('click',close);
  dialog.addEventListener('close',()=>{keys.clear();if(resume&&state==='paused')action();resume=false;canvas.focus();});
  const tabs=[...document.querySelectorAll('[data-recipe-tab]')];
  tabs.forEach((node,index)=>{node.addEventListener('click',()=>{tab=node.dataset.recipeTab;message('');render();});node.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tab=tabs[next].dataset.recipeTab;render();tabs[next].focus();}});});
  async function awardLevel(runId,level,elapsed){
    try{const rewards=await model.awardLevel(runId,level,elapsed);showLoot(rewards);return rewards;}
    catch(error){message(error.message);notify('Reward could not save · '+error.message);return [];}
  }
  function showLoot(rewards){const summary=document.querySelector('#run-loot');summary.textContent=rewards.length?`In your basket: ${rewards.join(' · ')}`:'';summary.hidden=!rewards.length;}
  let bakery=null,refreshing=false;
  async function refreshBakery(){
    if(refreshing)return;refreshing=true;
    try{bakery=await model.request('/api/bakery');}catch(error){bakery={status:'unknown',reason:error.message};}
    finally{refreshing=false;if(dialog.open&&tab==='market')render();}
  }
  function renderMarket(data){
    const view=bakery||{status:'unknown',reason:'Checking Squeektoshi’s wheel…'};
    const banner=el('section',`market-banner market-${view.status}`);
    banner.append(el('span','eyebrow','SQUEEKTOSHI’S LITTLE BAKERY'),el('h3','',view.status==='open'?'The bakery is open ♡':view.status==='closed'?'Resting paws. Busy ovens.':'Waiting for the wheel'),el('p','',view.reason||''),el('strong','',`${data.bakeryPoints||0} Bakery Points`));
    banner.append(el('p','recipe-description','Collect ingredients, discover recipes and bake between openings. Sell your treats while Squeektoshi runs. Bakery Points are game rewards.'));
    content.append(banner);
    if(view.settlement){content.append(el('p','recipe-save',`${view.settlement.network} · settled round ${view.settlement.round} · demand from ${view.settlement.transactionHash.slice(0,12)}…`));}
    if(view.special){
      const ingredient=ingredients.find(i=>i.id===view.special.ingredient);
      const card=el('article','special-batch');card.append(el('span','eyebrow','THE SPECIAL BATCH'),el('h3','','One settlement. One shared tray.'),el('p','',`Featured ingredient: ${ingredient?.name||view.special.ingredient}. Clear the tray for a reward of 3 ingredients +20 XP, once per settlement. Play while the wheel rests, too.`));
      const claimed=(data.specialClaims||[]).includes(view.special.seed);card.append(button(claimed?'Replay for a faster time ✦':'Play the Special Batch ✦',()=>{resume=false;dialog.close();startSpecialBatch(view.special);},data.readOnly));content.append(card);
    }
    const grid=el('div','recipe-grid');
    for(const offer of view.offers||[]){const recipe=recipes.find(r=>r.id===offer.recipe);if(!recipe)continue;
      const card=el('article','recipe-card');card.append(image(recipe.flavor),el('span','recipe-ribbon',offer.demand||'Fresh from the tin'),el('h3','',recipe.name),el('p','',`${offer.price} Bakery Points each · ${data.food[recipe.id]} in your tin`));
      card.append(button('Sell one treat',async()=>{const response=await model.request('/api/sell',{recipe:recipe.id,quantity:1,seed:view.seed});message(response.result.message);await refreshBakery();},view.status!=='open'||!data.food[recipe.id]||data.readOnly));grid.append(card);
    }
    content.append(grid,button('Check the wheel ↻',refreshBakery));
    content.append(el('p','recipe-save','Prices are checked again when you sell. Missing, simulated or stale telemetry keeps the counter closed.'));
  }
  model.ready.then(refreshBakery).catch(error=>message(error.message));
  setInterval(()=>{if(dialog.open&&tab==='market')refreshBakery();},15000);
  render();
  return {isOpen:()=>dialog.open,startRun:()=>{document.querySelector('#run-loot').hidden=true;return model.startRun();},awardLevel,open,
    startSpecial:seed=>{const run=model.startSpecial(seed);run.catch(error=>notify(error.message));return run;},awardSpecial:async (id,elapsed)=>{try{const result=await model.awardSpecial(id,elapsed);showLoot(result.rewards||[]);notify(result.message);}catch(error){notify(error.message);}}};
})();
