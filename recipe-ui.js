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
    document.querySelector('#baker-name').textContent=`${data.name}’s Bakery`;
    document.querySelector('#baker-title').textContent=`${data.title} · Lv ${data.bakerLevel}`;
    document.querySelector('#recipe-stats').textContent=`${Object.values(data.recipes).filter(r=>r.scraps===2).length}/12 recipes · ${Object.values(data.recipes).filter(r=>r.firstBaked).length}/12 baked · ${data.ordersDone} ${data.ordersDone===1?'order':'orders'} · ${data.stamps} stamps`;
    document.querySelector('#baker-xp').value=data.xp%50;
    document.querySelector('#baker-xp').setAttribute('aria-label',`${data.xpNext} experience to next baker level`);
    document.querySelector('#recipe-save').textContent=data.warning||'Saved';
    content.setAttribute('aria-labelledby',`tab-${tab}`);
    document.querySelectorAll('[data-recipe-tab]').forEach(b=>{const active=b.dataset.recipeTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  }
  function requirements(recipe,data){const list=el('ul','recipe-needs');for(const [id,n]of Object.entries(recipe.needs)){const ingredient=ingredients.find(i=>i.id===id);const enough=data.pantry[id]>=n;const item=el('li',enough?'enough':'missing',`${ingredient.icon} ${ingredient.name} ${data.pantry[id]}/${n}`);list.append(item);}return list;}
  function renderRecipes(data){
    const controls=el('div','recipe-filters');controls.append(el('span','', '2 scraps unlock a recipe'),button(filter==='all'?'Discovered':'All recipes',()=>{filter=filter==='all'?'known':'all';render();}));content.append(controls);
    const grid=el('div','recipe-grid');
    for(const recipe of recipes){
      const entry=data.recipes[recipe.id],known=entry?.scraps===2;if(filter==='known'&&!known)continue;
      const card=el('article',`recipe-card ${known?'':'undiscovered'}`);card.append(image(recipe.flavor));
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
    content.append(el('p','recipe-explainer','Clear levels to collect. Restock for 3 stamps.'));
    const grid=el('div','pantry-grid');for(const i of ingredients){const card=el('article','pantry-card');card.append(el('span','ingredient-icon',i.icon),el('h3','',i.name),el('strong','pantry-count',String(data.pantry[i.id])),button('Restock · 3 stamps',async()=>{const result=await model.buyIngredient(i.id);message(result.message);render();},data.stamps<3||data.readOnly));grid.append(card);}content.append(grid);
  }
  function renderOrders(data){
    content.append(el('p','recipe-explainer','Bake. Serve. Earn stamps. No deadline.'));
    const grid=el('div','orders-grid');for(const order of data.orders){const recipe=recipes.find(r=>r.id===order.recipe),card=el('article','order-card');card.append(el('span','order-customer',order.customer),image(recipe.flavor),el('h3','',`${order.quantity} ${recipe.name}`),el('p','',`Stored ${data.food[recipe.id]} / ${order.quantity}`),el('p','order-reward',`+${order.quantity*3} stamps · +15 XP`),button('Serve',async()=>{const result=await model.fulfill(order.id);message(result.message);render();},data.food[recipe.id]<order.quantity||data.readOnly));grid.append(card);}content.append(grid);
    const tin=el('section','treat-tin');tin.append(el('h3','','Treat tin'));const stocked=recipes.filter(r=>data.food[r.id]>0);tin.append(el('p','',stocked.length?stocked.map(r=>`${r.name} ×${data.food[r.id]}`).join(' · '):'No treats yet.'));content.append(tin);
  }
  function renderCollection(data){
    content.append(el('p','recipe-explainer','Bake once. Keep the card forever.'));
    const grid=el('div','recipe-grid collection-grid');for(const recipe of recipes){const entry=data.recipes[recipe.id],complete=!!entry?.firstBaked,card=el('article',`recipe-card ${complete?'collected':'undiscovered'}`);card.append(image(recipe.flavor),el('span','recipe-ribbon',complete?'Collected':'Uncollected'),el('h3','',recipe.name),el('small','',complete?`${entry.batches} ${entry.batches===1?'batch':'batches'} baked`:`${entry?.scraps||0}/2 scraps`));grid.append(card);}content.append(grid);
  }
  function renderProfile(data){
    const form=el('form','profile-form'),label=el('label','','Baker name'),input=el('input');input.maxLength=24;input.value=data.name;input.required=true;input.setAttribute('aria-label','Baker name');label.append(input);const submit=el('button','','Save name');submit.type='submit';submit.disabled=data.readOnly;form.append(label,submit);form.addEventListener('submit',async event=>{event.preventDefault();try{if(await model.rename(input.value)){message('Name saved.');render();}}catch(error){message(error.message);}});content.append(form);
    content.append(el('h3','','Your stats'),el('p','recipe-explainer',`${data.clears} clears · ${data.totalBaked} baked · ${data.ordersDone} orders · ${data.xp} XP · ${data.bakeryPoints||0} points · ${data.sales||0} sold`));
    const titles=el('div','title-shelf');for(const title of RecipeData.titles)titles.append(el('span',data.ordersDone>=title.orders?'earned':'',`${data.ordersDone>=title.orders?'♡':'○'} ${title.name} · ${title.orders} orders`));content.append(titles);
    content.append(el('h3','','Run loot'));const loot=data.activeRun?.loot||[];content.append(el('p','recipe-explainer',loot.length?loot.join(' · '):'Clear a level for loot.'));
    const history=el('div','recipe-history');history.append(el('h3','','Recent activity'));for(const entry of data.history.slice(0,6))history.append(el('p','',entry.message));if(!data.history.length)history.append(el('p','','Starter ingredients ready.'));content.append(history);
  }
  function render(){const data=model.snapshot();renderHeader(data);content.replaceChildren();({recipes:renderRecipes,pantry:renderPantry,orders:renderOrders,collection:renderCollection,profile:renderProfile,market:renderMarket}[tab])(data);}
  function open(){resume=state==='playing';if(resume)pause();keys.clear();render();dialog.showModal();}
  function close(){dialog.close();}
  document.querySelector('#open-recipes').addEventListener('click',open);document.querySelector('#open-market').addEventListener('click',()=>{tab='market';open();refreshBakery();});document.querySelector('#close-recipes').addEventListener('click',close);
  dialog.addEventListener('close',()=>{keys.clear();if(resume&&state==='paused')action();resume=false;canvas.focus();});
  const tabs=[...document.querySelectorAll('[data-recipe-tab]')];
  tabs.forEach((node,index)=>{node.addEventListener('click',()=>{tab=node.dataset.recipeTab;message('');render();});node.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tab=tabs[next].dataset.recipeTab;render();tabs[next].focus();}});});
  async function awardLevel(runId,level,elapsed){
    try{const rewards=await model.awardLevel(runId,level,elapsed);showLoot(rewards);if(rewards.length&&typeof Onboarding!=='undefined')Onboarding.firstClear();return rewards;}
    catch(error){message(error.message);notify('Save failed · '+error.message);return [];}
  }
  function showLoot(rewards){const summary=document.querySelector('#run-loot');summary.textContent=rewards.length?`Loot: ${rewards.join(' · ')}`:'';summary.hidden=!rewards.length;}
  let bakery=null,refreshing=false;
  async function refreshBakery(){
    if(refreshing)return;refreshing=true;
    try{bakery=await model.request('/api/bakery');}catch(error){bakery={status:'unknown',reason:error.message};}
    finally{refreshing=false;if(dialog.open&&tab==='market')render();}
  }
  function renderMarket(data){
    const view=bakery||{status:'unknown',reason:'Checking wheel…'};
    const banner=el('section',`market-banner market-${view.status}`);
    banner.append(el('span','eyebrow','SQUEEKTOSHI’S BAKERY'),el('h3','',view.status==='open'?'Bakery open':view.status==='closed'?'Resting paws':'Checking wheel'),el('strong','',`${data.bakeryPoints||0} points`));
    banner.append(el('p','recipe-description',view.status==='open'?'Sell while Squeektoshi runs.':view.status==='closed'?'Bake now. Sell when Squeektoshi runs.':'Sales paused. Try refresh.'));
    content.append(banner);
    if(view.settlement){const info=el('details','market-info');info.append(el('summary','','Round info'),el('p','recipe-save',`${view.settlement.network} · Round ${view.settlement.round} · ${view.settlement.transactionHash}`));if(view.reason)info.append(el('p','recipe-save',view.reason));content.append(info);}
    if(view.special){
      const ingredient=ingredients.find(i=>i.id===view.special.ingredient);
      const card=el('article','special-batch');card.append(el('span','eyebrow','SPECIAL BATCH'),el('h3','',ingredient?.name||view.special.ingredient),el('p','','+3 ingredients · +20 XP'));
      const claimed=(data.specialClaims||[]).includes(view.special.seed);card.append(el('small','',claimed?'Reward claimed. Beat your time.':'Reward once per round.'),button(claimed?'Beat your time ✦':'Play special ✦',()=>{resume=false;dialog.close();startSpecialBatch(view.special);},data.readOnly));content.append(card);
    }
    const grid=el('div','recipe-grid');
    for(const offer of view.offers||[]){const recipe=recipes.find(r=>r.id===offer.recipe);if(!recipe)continue;
      const card=el('article','recipe-card');card.append(image(recipe.flavor),el('span','recipe-ribbon',offer.demand||'Steady'),el('h3','',recipe.name),el('p','',`${offer.price} points each · Stored ×${data.food[recipe.id]}`));
      card.append(button('Sell ×1',async()=>{const response=await model.request('/api/sell',{recipe:recipe.id,quantity:1,seed:view.seed});message(response.result.message);await refreshBakery();},view.status!=='open'||!data.food[recipe.id]||data.readOnly));grid.append(card);
    }
    content.append(grid,button('Refresh ↻',refreshBakery));

  }
  model.ready.then(refreshBakery).catch(error=>message(error.message));
  setInterval(()=>{if(dialog.open&&tab==='market')refreshBakery();},15000);
  render();
  return {settle:()=>model.settle(),isOpen:()=>dialog.open,startRun:()=>{document.querySelector('#run-loot').hidden=true;return model.startRun();},awardLevel,open,
    startSpecial:seed=>{const run=model.startSpecial(seed);run.catch(error=>notify(error.message));return run;},awardSpecial:async (id,elapsed)=>{try{const result=await model.awardSpecial(id,elapsed);showLoot(result.rewards||[]);notify(result.message);}catch(error){notify(error.message);}}};
})();
