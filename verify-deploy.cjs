// Production-mode smoke check using an isolated temporary database.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {mkdtempSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const dataDir=mkdtempSync(path.join(tmpdir(),'hamster-deploy-'));
let child;
async function start(){
  child=spawn(process.execPath,['server.cjs'],{cwd:__dirname,env:{...process.env,NODE_ENV:'production',PORT:'0',HOST:'127.0.0.1',DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
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
  console.log('PASS production port, healthcheck, Secure cookies, persistent data directory and rankings');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(stop);
