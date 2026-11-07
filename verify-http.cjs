// Optional smoke test against a running local server: node verify-http.cjs
const assert=require('node:assert/strict');
(async()=>{
  const origin='http://127.0.0.1:4173';
  const response=await fetch(origin+'/api/profile');
  assert.equal(response.status,200);
  assert.equal((await response.json()).profile.name,'Little Baker');
  const cookie=response.headers.get('set-cookie');
  assert.ok(cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict'));
  const resumed=await fetch(origin+'/api/profile',{headers:{Cookie:cookie.split(';')[0]}});
  assert.equal(resumed.headers.get('set-cookie'),null);
  assert.equal((await fetch(origin+'/.local/bakery.sqlite')).status,404);
  const blocked=await fetch(origin+'/api/profile',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(blocked.status,403);
  assert.equal((await fetch(origin+'/bakery-client.js')).status,200);
  const rankings=await fetch(origin+'/api/leaderboards?board=genesis');assert.equal(rankings.status,200);const board=await rankings.json();assert.equal(board.version,'genesis-21-v1');assert.ok(Array.isArray(board.rows));
  assert.equal((await fetch(origin+'/leaderboard.js')).status,200);
  console.log('PASS HTTP leaderboards, sessions, cookie flags, private database isolation, cross-origin rejection and client asset');
})().catch(error=>{console.error(error);process.exitCode=1;});
