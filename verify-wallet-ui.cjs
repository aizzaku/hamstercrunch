const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let checks=0;
function check(name,value){assert.ok(value,name);checks++;console.log('PASS '+name);}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({restore=false,cancel=false,connected=false}={}){
  const nodes=new Map(),calls=[],memory=new Map();let reloads=0,pauses=0,resumes=0;
  function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,open:false,disabled:false,textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},focus(){}});return nodes.get(id);}
  const address='0x'+'1'.repeat(40),rpc=[];
  const window={location:{reload(){reloads++;}},ethereum:{async request(input){rpc.push(input);if(input.method==='eth_requestAccounts')return [address];if(input.method==='eth_chainId')return '0x1';if(cancel){const error=new Error('Rejected');error.code=4001;throw error;}return '0xsignature';}}};
  const context=vm.createContext({console,window,AbortSignal,TextEncoder,localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},document:{querySelector:s=>node(s.slice(1))},state:'playing',keys:new Set(),canvas:{focus(){}},pause(){pauses++;context.state='paused';},action(){resumes++;context.state='playing';},RecipeProfile:{settle:async()=>{}},fetch:async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null;calls.push({url,body});
    const data=url==='/api/auth'?{connected,address:connected?address:null,enabled:true,walletConnectProjectId:'public-id'}:url.endsWith('/nonce')?{message:'Exact server message'}:url.endsWith('/verify')?(restore?{restoreRequired:true,restoreToken:'one-time-token',savedName:'Pip'}:{connected:true}):{ok:true};
    return {ok:true,json:async()=>data};
  }});
  node('save-bakery-prompt').hidden=true;
  vm.runInContext(fs.readFileSync('wallet-ui.js','utf8'),context);
  return {context,node,calls,rpc,memory,get counts(){return {reloads,pauses,resumes};}};
}
(async()=>{
  const fresh=setup();await tick();
  check('Guest save button is optional and QR appears only when configured',fresh.node('save-bakery').textContent==='Save bakery'&&!fresh.node('wallet-qr').hidden);
  await fresh.node('save-bakery').listeners.click();
  check('Opening identity pauses only active play',fresh.context.state==='paused'&&fresh.counts.pauses===1);
  await fresh.node('wallet-browser').listeners.click();
  const nonce=fresh.calls.find(call=>call.url.endsWith('/nonce'));
  check('Wallet address and chain request the server challenge',nonce.body.address==='0x'+'1'.repeat(40)&&nonce.body.chainId===1);
  const signed=fresh.rpc.find(call=>call.method==='personal_sign');
  check('The wallet signs the exact returned message as UTF-8 hex',Buffer.from(signed.params[0].slice(2),'hex').toString()==='Exact server message');
  check('Successful verified login reloads the profile',fresh.counts.reloads===1);
  fresh.node('close-wallet').listeners.click();
  check('Closing identity resumes the previously paused game',fresh.context.state==='playing'&&fresh.counts.resumes===1);
  const existing=setup({restore:true});await tick();await existing.node('save-bakery').listeners.click();await existing.node('wallet-browser').listeners.click();
  check('An existing wallet asks before changing profiles',!existing.node('wallet-restore').hidden&&existing.node('wallet-restore-copy').textContent.includes('Pip')&&existing.counts.reloads===0);
  existing.node('wallet-keep-guest').listeners.click();
  check('Keeping guest sends no restore request',existing.node('wallet-restore').hidden&&!existing.calls.some(call=>call.url.endsWith('/restore')));
  await existing.node('wallet-browser').listeners.click();await existing.node('wallet-open-saved').listeners.click();
  check('Explicit restore sends only its one-time token then reloads',existing.calls.find(call=>call.url.endsWith('/restore')).body.token==='one-time-token'&&existing.counts.reloads===1);
  const rejected=setup({cancel:true});await tick();await rejected.node('save-bakery').listeners.click();await rejected.node('wallet-browser').listeners.click();
  check('Rejected signature retains guest play without a verify request',rejected.node('wallet-status').textContent.includes('canceled')&&rejected.counts.reloads===0&&!rejected.calls.some(call=>call.url.endsWith('/verify')));
  check('Canceled sign-in re-enables controls',!rejected.node('wallet-browser').disabled);
  const prompt=setup();await tick();await vm.runInContext('WalletUI.firstClear()',prompt.context);
  check('First clear shows a guest save prompt without blocking play',!prompt.node('save-bakery-prompt').hidden&&prompt.counts.pauses===0&&prompt.memory.has('hamster-crunch-save-prompt-v1'));
  prompt.node('prompt-save-later').listeners.click();await vm.runInContext('WalletUI.firstClear()',prompt.context);
  check('Dismissed first-clear save prompt does not repeat',prompt.node('save-bakery-prompt').hidden);
  const saved=setup({connected:true});await tick();await vm.runInContext('WalletUI.firstClear()',saved.context);
  check('Wallet-linked players are not asked to save again',saved.node('save-bakery-prompt').hidden);
  console.log(`${checks} wallet UI checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
