const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
function node(){return {children:[],attributes:{},listeners:{},dataset:{},textContent:'',disabled:false,open:false,tabIndex:0,
  append(...children){this.children.push(...children);},replaceChildren(...children){this.children=[...children];},
  setAttribute(key,value){this.attributes[key]=value;},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},
  fire(name,event={}){for(const fn of this.listeners[name]||[])fn(event);},focus(){this.focused=true;},
  showModal(){this.open=true;},close(){this.open=false;this.fire('close');}};}
const elements=new Map();
function element(selector){if(!elements.has(selector))elements.set(selector,node());return elements.get(selector);}
const tabs=['arcade','bakery','collection'].map(group=>{const tab=node();tab.dataset.rankingTab=group;return tab;});
const pending=[];
let pauses=0,resumes=0,count=0;
const context=vm.createContext({console,AbortController,setTimeout,clearTimeout,encodeURIComponent,
  document:{querySelector:element,querySelectorAll:()=>tabs,createElement:node},state:'playing',
  keys:new Set(['ArrowRight']),canvas:{focus(){}},formatTime:seconds=>`time:${seconds}`,
  pause(){pauses++;context.state='paused';},action(){resumes++;context.state='playing';},
  fetch:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve})),
});
vm.runInContext(fs.readFileSync('leaderboard.js','utf8'),context);
const board=vm.runInContext('Leaderboards',context);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function check(name,value){assert.ok(value,name);console.log('PASS '+name);count++;}
function resolve(request,data,ok=true){request.resolve({ok,json:async()=>data});}
function text(item){return [item.textContent,...item.children.map(text)].join(' ');}
(async()=>{
  board.open();
  check('Opening rankings pauses play and clears movement keys',board.isOpen()&&pauses===1&&context.keys.size===0);
  check('Default arcade board requests shared Genesis rankings',pending[0].url==='/api/leaderboards?board=genesis');
  resolve(pending[0],{rows:[{rank:1,name:'<b>Pip</b>',reached:4,time:99,isYou:true}]});await tick();
  const table=element('#ranking-results').children[0];
  check('Player names stay literal text and current player is highlighted',text(table).includes('<b>Pip</b>')&&table.children[1].children[0].className==='ranking-you');
  check('Progress and elapsed time use campaign ranking units',text(table).includes('4 / 21')&&text(table).includes('time:99'));
  tabs[1].fire('click');
  check('Bakery tab selects the cooking metric',pending[1].url.endsWith('board=cooks')&&tabs[1].attributes['aria-selected']==='true');
  tabs[2].fire('click');
  check('Switching boards aborts the previous request',pending[1].options.signal.aborted&&pending[2].url.endsWith('board=collection'));
  resolve(pending[2],{rows:[{rank:1,name:'Hazel',value:12}],viewer:{rank:30,name:'Pip',value:3}});await tick();
  const collectionText=text(element('#ranking-results'));
  check('Collection totals and viewer rank outside top25 render',collectionText.includes('12 / 12')&&collectionText.includes('Your place: #30'));
  resolve(pending[1],{rows:[{rank:1,name:'Stale response',value:999}]});await tick();
  check('Late responses cannot replace the selected board',!text(element('#ranking-results')).includes('Stale response'));
  element('#refresh-rankings').fire('click');resolve(pending[3],{},false);await tick();
  check('Network failures display a retry message without fake empty rankings',element('#ranking-status').textContent.includes('unavailable')&&text(element('#ranking-results')).includes('needs a moment'));
  element('#refresh-rankings').fire('click');resolve(pending[4],{rows:[]});await tick();
  check('Successful empty results explain how to join the board',text(element('#ranking-results')).includes('Bake a recipe to begin'));
  element('#close-rankings').fire('click');
  check('Closing restores play only when rankings paused it',!board.isOpen()&&resumes===1);
  context.state='ready';board.open();resolve(pending[5],{rows:[]});await tick();
  let prevented=false,stopped=false;tabs[2].fire('keydown',{key:'Home',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  check('Keyboard Home selects and focuses the first category without moving the hamster',prevented&&stopped&&tabs[0].focused&&pending[6].url.endsWith('board=genesis'));
  resolve(pending[6],{rows:[]});await tick();element('#close-rankings').fire('click');
  check('Opening from relaunch screen does not launch a run on close',context.state==='ready'&&resumes===1);
  console.log(`${count} leaderboard UI checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
