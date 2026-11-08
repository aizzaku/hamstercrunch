const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let count=0;
const check=(name,test)=>{assert.ok(test,name);count++;console.log('PASS '+name);};
function setup(seen=false){
  const nodes=new Map(),memory=new Map(seen?[['hamster-crunch-tour-v1','1']]:[]);let pauses=0,resumes=0,bakes=0;
  function node(id){if(!nodes.has(id))nodes.set(id,{hidden:true,open:false,textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},focus(){}});return nodes.get(id);}
  const context=vm.createContext({document:{querySelector:s=>node(s.slice(1))},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},console,state:'intro',menuPaused:false,keys:new Set(),canvas:{focus(){}},ui:{details:{close(){}}},pause(){pauses++;context.state='paused';},action(){resumes++;context.state='playing';},RecipeProfile:{open(){bakes++;}}});
  vm.runInContext(fs.readFileSync('onboarding.js','utf8'),context);
  return {context,node,memory,get counts(){return {pauses,resumes,bakes};}};
}
const first=setup();
check('First visit opens one short tutorial',first.node('first-run').open&&first.node('tour-step').textContent==='1 / 3');
first.node('tour-next').listeners.click();first.node('tour-next').listeners.click();
check('Three prompts end with a play action',first.node('tour-next').textContent==='Let’s play'&&first.node('tour-step').textContent==='3 / 3');
first.node('tour-next').listeners.click();
check('Finishing persists completion without launching unexpectedly',!first.node('first-run').open&&first.memory.has('hamster-crunch-tour-v1')&&first.counts.resumes===0);
const returning=setup(true);
check('Returning players start without another tour',!returning.node('first-run').open);
returning.context.state='playing';vm.runInContext('Onboarding.open()',returning.context);
check('Replaying help pauses gameplay',returning.context.state==='paused'&&returning.counts.pauses===1);
returning.node('tour-skip').listeners.click();
check('Skipping resumes only the game paused by the tutorial',returning.context.state==='playing'&&returning.counts.resumes===1);
vm.runInContext('Onboarding.firstClear()',returning.context);
check('First clear shows the baking nudge once',!returning.node('bakery-nudge').hidden&&returning.memory.has('hamster-crunch-basket-tip-v1'));
returning.node('tip-bake').listeners.click();
check('Baking nudge opens recipes then stays dismissed',returning.node('bakery-nudge').hidden&&returning.counts.bakes===1);
vm.runInContext('Onboarding.firstClear()',returning.context);
check('Later clears do not repeat the baking nudge',returning.node('bakery-nudge').hidden);
let savePrompts=0;returning.context.WalletUI={firstClear(){savePrompts++;}};
vm.runInContext('Onboarding.firstClear()',returning.context);
check('Save prompt still receives a clear after the baking nudge was seen',savePrompts===1);
console.log(`${count} onboarding checks passed.`);
