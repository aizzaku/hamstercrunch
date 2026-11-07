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
  const challenge=await post('/api/auth/nonce',{address:wallet.address,chainId:1});
  assert.equal(challenge.status,200);assert.ok(challenge.data.message.includes('hamster.example'));
  const signature=await wallet.signMessage(challenge.data.message);
  const signed=await post('/api/auth/verify',{message:challenge.data.message,signature});
  assert.equal(signed.status,200);assert.equal(signed.data.profile.name,'Deployment Baker');assert.notEqual(signed.cookie,headers.Cookie);
  assert.ok(!('sessionToken' in signed.data));
  const state=await (await fetch(origin+'/api/auth',{headers:{Cookie:signed.cookie}})).json();assert.equal(state.connected,true);
  const replay=await post('/api/auth/verify',{message:challenge.data.message,signature},signed.cookie);assert.equal(replay.status,400);
  const range=await fetch(origin+'/assets/music/burrow-comfort.mp3',{headers:{Range:'bytes=0-99'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,100);assert.match(range.headers.get('cache-control'),/max-age/);
  assert.equal((await fetch(origin+'/radio.css')).status,200);assert.equal((await fetch(origin+'/walletconnect-provider.js')).status,200);

  console.log('PASS production port, healthcheck, Secure cookies, persistent data, rankings and HTTP wallet signatures');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(stop);
