const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {RecipeData,createRecipeBox}=require('./recipe-core.js');
function node(tag='div'){return {tagName:tag.toUpperCase(),children:[],attributes:{},listeners:{},dataset:{},textContent:'',disabled:false,open:false,isConnected:true,style:{},classList:{remove(){},add(){}},
  append(...children){this.children.push(...children);},replaceChildren(...children){this.children=[...children];},setAttribute(key,value){this.attributes[key]=String(value);},
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},async fire(name,event={}){for(const listener of this.listeners[name]||[])await listener(event);},
  focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;this.fire('close');}};}
const elements=new Map();function element(selector){if(!elements.has(selector))elements.set(selector,node());return elements.get(selector);}
const tabs=['market','recipes','orders','collection','profile'].map(id=>{const item=node('button');item.dataset.recipeTab=id;return item;});
const memory=new Map(),storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
const data=createRecipeBox(storage).snapshot();data.name='<b>Pip</b>';data.food['butter-paws']=6;data.liveOrders=[];data.saleReceipts=[];data.lastSales={};data.saleTotals={quantity:0,points:0};
const market={status:'closed',offers:[{recipe:'butter-paws',price:5,rangeMin:3,rangeMax:7,demand:'Steady'}]};
const calls=[];let onChange,interval,count=0,pauses=0;
const model={snapshot:()=>data,ready:Promise.resolve(),settle:async()=>{},
  async request(url){calls.push({url});if(url==='/api/bakery')return market;if(url==='/api/profile'){onChange();return {profile:data};}return {};},
  async queueSale(recipe,quantity){calls.push({action:'queueSale',recipe,quantity});data.food[recipe]-=quantity;data.liveOrders.push({id:'queued-1',recipe,quantity,waitForRest:false});onChange();return {ok:true,message:'Reserved.'};},
  async cancelSale(id){calls.push({action:'cancelSale',id});const index=data.liveOrders.findIndex(order=>order.id===id);const [order]=data.liveOrders.splice(index,1);data.food[order.recipe]+=order.quantity;onChange();return {ok:true,message:'Returned.'};},
  startRun(){},awardLevel(){return [];},bake(){},fulfill(){},rename(){},buyIngredient(){},
};
const document={querySelector:element,querySelectorAll:()=>tabs,createElement:node,activeElement:{tagName:'BODY'}};
const context=vm.createContext({console,document,localStorage:storage,RecipeData,createBakeryClient(_storage,change){onChange=change;return model;},state:'playing',keys:new Set(),canvas:{focus(){}},pause(){pauses++;context.state='paused';},action(){context.state='playing';},notify(){},startSpecialBatch(){},setInterval(fn){interval=fn;}});
vm.runInContext(fs.readFileSync('recipe-ui.js','utf8'),context);
const profile=vm.runInContext('RecipeProfile',context),tick=()=>new Promise(resolve=>setImmediate(resolve));
function text(item){return [item.textContent,...item.children.map(text)].join(' ');}
function find(item,predicate){if(predicate(item))return item;for(const child of item.children){const result=find(child,predicate);if(result)return result;}return null;}
function button(label){const result=find(element('#recipe-content'),item=>item.tagName==='BUTTON'&&item.textContent===label);assert.ok(result,`Button ${label} exists`);return result;}
function check(name,value){assert.ok(value,name);count++;console.log('PASS '+name);}
(async()=>{
  await tick();
  data.runAllowance={walletRequired:true,limit:5,used:0,remaining:0,resetsAt:'2026-11-09T00:00:00.000Z'};
  check('Guests see practice and wallet guidance',profile.runStatus().includes('Practice')&&profile.runStatus().includes('wallet'));
  data.runAllowance={...data.runAllowance,walletRequired:false,used:1,remaining:4};data.activeRunRewarded=true;
  check('Rewarded run displays its remaining daily quota',profile.runStatus(true)==='Rewarded · 4/5 left today'&&profile.isRewardedRun());
  data.runAllowance.used=5;data.runAllowance.remaining=0;data.activeRunRewarded=false;
  check('Exhausted quota displays practice and UTC reset',profile.runStatus().includes('00:00 UTC')&&profile.runStatus(true)==='Practice · no rewards');
  let firstClearPrompts=0;context.Onboarding={firstClear(){firstClearPrompts++;}};
  await profile.awardLevel('practice',0,10);
  check('Practice clears still trigger first-clear save guidance',firstClearPrompts===1);
  const mainTabs=[...fs.readFileSync('index.html','utf8').matchAll(/data-recipe-tab="([^"]+)"/g)].map(match=>match[1]);
  check('Main tabs follow the requested five-section order',mainTabs.join(',')==='market,recipes,orders,collection,profile');
  profile.openMarket();await tick();
  check('Live Bakery opens with a concise loop explanation and offline link',tabs[0].attributes['aria-selected']==='true'&&text(element('#recipe-content')).includes('Play for ingredients. Bake treats. Sell while Squeektoshi runs.'));
  element('#close-recipes').fire('click');await tick();profile.open();await tick();
  check('Recipe Box always opens Recipes after visiting the market',tabs[1].attributes['aria-selected']==='true'&&element('#recipe-content').attributes['aria-labelledby']==='tab-recipes');
  check('Baker names remain safe literal text',element('#baker-name').textContent==='<b>Pip</b>’s Bakery');
  await button('Pantry').fire('click');
  check('Pantry stays inside Recipes with its own explanation',tabs[1].attributes['aria-selected']==='true'&&text(element('#recipe-content')).includes('Your ingredients.'));
  await tabs[2].fire('click');
  check('Orders has a casual neighbor-order view',text(element('#recipe-content')).includes('Casual orders: serve neighbors')&&!!button('Live'));
  await button('Live').fire('click');await tick();
  check('Live orders explain offline reservation and unknown opening prices',text(element('#recipe-content')).includes('even while you’re offline')&&text(element('#recipe-content')).includes('Round data sets the price at opening'));
  const quantity=find(element('#recipe-content'),item=>item.className==='live-sale-quantity');quantity.value='3';await quantity.fire('input');
  check('Chosen quantity updates the possible total range',text(element('#recipe-content')).includes('Possible total: 9–21 points'));
  await element('#close-recipes').fire('click');profile.openLiveOrders();await tick();
  check('Quantity drafts survive profile and market refreshes',find(element('#recipe-content'),item=>item.className==='live-sale-quantity').value==='3');
  document.activeElement={tagName:'INPUT'};const before=calls.length;interval();await tick();check('Polling does not interrupt a focused quantity input',calls.length===before);document.activeElement={tagName:'BODY'};
  await button('Queue sale').fire('click');await tick();
  check('Queue action sends the selected recipe and exact quantity',calls.some(call=>call.action==='queueSale'&&call.recipe==='butter-paws'&&call.quantity===3)&&data.food['butter-paws']===3);
  await button('Cancel & return treats').fire('click');await tick();
  check('Cancel action returns the reservation through its order ID',calls.some(call=>call.action==='cancelSale'&&call.id==='queued-1')&&data.food['butter-paws']===6);
  profile.openMarket();await tick();await button('Queue offline sales ↗').fire('click');await tick();
  check('Live Bakery links directly to Orders Live',tabs[2].attributes['aria-selected']==='true'&&text(element('#recipe-content')).includes('Set up a sale'));
  market.offers=[];profile.openMarket();await tick();await button('Queue offline sales ↗').fire('click');await tick();
  check('Missing market data never invents a price range',text(element('#recipe-content')).includes('Price range unavailable')&&!text(element('#recipe-content')).includes('Possible total:'));
  check('Opening the bakery from play pauses gameplay',pauses>0);
  market.special={seed:'practice-special',ingredient:'cocoa'};profile.openMarket();await tick();
  check('Special Batch practice does not promise ingredients or XP',text(element('#recipe-content')).includes('Practice · no rewards or ranking')&&!text(element('#recipe-content')).includes('+3 ingredients'));
  model.startRun=async()=>{data.activeRunRewarded=true;return 17;};await profile.startRun();data.activeRunRewarded=false;
  check('Another device launch cannot change this client run reward mode',profile.isRewardedRun()&&profile.runStatus(true).startsWith('Rewarded'));
  console.log(`${count} recipe navigation and live-order UI checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
