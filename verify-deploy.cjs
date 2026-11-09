// Production-mode smoke check using an isolated temporary database.
const assert=require('node:assert/strict');
const {Wallet}=require('ethers');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {mkdtempSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const dataDir=mkdtempSync(path.join(tmpdir(),'hamster-deploy-'));
let child;
async function start(){
  child=spawn(process.execPath,['server.cjs'],{cwd:__dirname,env:{...process.env,NODE_ENV:'production',PUBLIC_ORIGIN:'https://hamster.example',PORT:'0',HOST:'127.0.0.1',DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited: ${code}`));});
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/listening on 127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}`);}});
  });
}
async function stop(){if(child&&child.exitCode===null){const closed=once(child,'exit');child.kill();await closed;}}
(async()=>{
  let origin=await start();
  assert.equal(await (await fetch(origin+'/healthz')).text(),'ok');
  const response=await fetch(origin+'/api/profile'),cookie=response.headers.get('set-cookie');
  assert.match(cookie,/; Secure/);
  const headers={Cookie:cookie.split(';')[0],'Content-Type':'application/json'};
  const renamed=await fetch(origin+'/api/profile',{method:'POST',headers,body:JSON.stringify({action:'rename',args:['Deployment Baker']})});
  assert.equal((await renamed.json()).profile.name,'Deployment Baker');
  await stop();origin=await start();
  const resumed=await fetch(origin+'/api/profile',{headers});
  assert.equal((await resumed.json()).profile.name,'Deployment Baker');
  assert.equal((await fetch(origin+'/api/leaderboards?board=genesis')).status,200);
  const wallet=Wallet.createRandom();
  const post=async(route,body,sessionCookie=headers.Cookie)=>{
    const response=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:sessionCookie},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const practice=await post('/api/profile',{action:'startRun'});
  assert.equal(practice.data.profile.activeRunRewarded,false);assert.equal(practice.data.profile.runAllowance.walletRequired,true);
  const challenge=await post('/api/auth/nonce',{address:wallet.address,chainId:1});
  assert.equal(challenge.status,200);assert.ok(challenge.data.message.includes('hamster.example'));
  const signature=await wallet.signMessage(challenge.data.message);
  const signed=await post('/api/auth/verify',{message:challenge.data.message,signature});
  assert.equal(signed.status,200);assert.equal(signed.data.profile.name,'Deployment Baker');assert.notEqual(signed.cookie,headers.Cookie);
  assert.ok(!('sessionToken' in signed.data));
  const state=await (await fetch(origin+'/api/auth',{headers:{Cookie:signed.cookie}})).json();assert.equal(state.connected,true);
  for(let used=1;used<=5;used++){
    const launched=await post('/api/profile',{action:'startRun'},signed.cookie);
    assert.equal(launched.data.profile.activeRunRewarded,true);assert.equal(launched.data.profile.runAllowance.used,used);
    assert.equal(launched.data.profile.runLootPlan.runId,launched.data.result);
    if(used===1){
      const plan=launched.data.profile.runLootPlan;
      const prepared=await post('/api/profile',{action:'prepareLevelLoot',args:[launched.data.result,0,'campaign']},signed.cookie);
      assert.deepEqual(prepared.data.result,plan);
      const entry=plan.entries[0];
      if(entry){
        await new Promise(resolve=>setTimeout(resolve,800));
        const caught=await post('/api/profile',{action:'collectIngredient',args:[launched.data.result,0,entry.id,'campaign']},signed.cookie);
        assert.equal(caught.data.result.ok,true);assert.equal(caught.data.profile.pantry[entry.ingredient],launched.data.profile.pantry[entry.ingredient]+1);
        const duplicate=await post('/api/profile',{action:'collectIngredient',args:[launched.data.result,0,entry.id,'campaign']},signed.cookie);
        assert.equal(duplicate.data.result.ok,false);
      }
    }
  }
  await stop();origin=await start();
  const extra=await post('/api/profile',{action:'startRun'},signed.cookie);
  assert.equal(extra.data.profile.activeRunRewarded,false);assert.equal(extra.data.profile.runAllowance.remaining,0);
  const practiceClear=await post('/api/profile',{action:'awardLevel',args:[extra.data.result,0,1]},signed.cookie);
  assert.deepEqual(practiceClear.data.result,[]);assert.equal(practiceClear.data.profile.clears,0);
  const baked=await post('/api/profile',{action:'bake',args:['butter-paws']},signed.cookie);assert.equal(baked.data.result.ok,true);
  const queued=await post('/api/profile',{action:'queueSale',args:['butter-paws',1]},signed.cookie);assert.equal(queued.data.result.ok,true);assert.equal(queued.data.profile.food['butter-paws'],1);
  const reservations=await (await fetch(origin+'/api/live-orders',{headers:{Cookie:signed.cookie}})).json();assert.equal(reservations.orders.length,1);
  const canceled=await post('/api/profile',{action:'cancelSale',args:[queued.data.result.orderId]},signed.cookie);assert.equal(canceled.data.result.ok,true);assert.equal(canceled.data.profile.food['butter-paws'],2);

  const replay=await post('/api/auth/verify',{message:challenge.data.message,signature},signed.cookie);assert.equal(replay.status,400);
  const range=await fetch(origin+'/assets/music/burrow-comfort.mp3',{headers:{Range:'bytes=0-99'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,100);assert.match(range.headers.get('cache-control'),/max-age/);
  assert.equal((await fetch(origin+'/radio.css')).status,200);assert.equal((await fetch(origin+'/walletconnect-provider.js')).status,200);
  for(const ingredient of require('./recipe-core.js').RecipeData.ingredients){const image=await fetch(origin+'/'+ingredient.image);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');}

  console.log('PASS production port, healthcheck, Secure cookies, persistent data, wallet quota, practice exclusions, rankings, signatures and reserved live orders');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(stop);
