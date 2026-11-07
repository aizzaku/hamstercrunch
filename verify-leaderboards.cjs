const assert=require('node:assert/strict');
const {createBakeryService}=require('./bakery-service.cjs');
const {LEVELS,CAMPAIGN_VERSION}=require('./levels.js');
let wall=Date.parse('2026-11-06T12:00:00Z');
let seed='shared-batch';
const chain={snapshot:async()=>({status:'open',seed,special:{seed,ingredient:'cocoa'},offers:[{recipe:'butter-paws',price:7}]})};
const service=createBakeryService({chain,now:()=>new Date(wall).toISOString()});
let count=0;
function check(name,value){assert.ok(value,name);console.log(`PASS ${name}`);count++;}
async function clear(id,levels,seconds){
  const run=(await service.command(id,'startRun')).result;
  for(let level=0;level<levels;level++){
    wall+=seconds*1000;
    const result=await service.command(id,'awardLevel',[run,level,(level+1)*seconds]);
    assert.ok(result.result.length>0,`level ${level+1} reward`);
  }
  return run;
}
(async()=>{
  const a=service.session(),b=service.session(),c=service.session();
  await service.command(a,'rename',['Pip']);await service.command(b,'rename',['Hazel']);await service.command(c,'rename',['Mabel']);
  check('New profiles do not populate global boards with zero records',(await service.leaderboard('genesis')).rows.length===0&&(await service.leaderboard('cooks')).rows.length===0);
  await clear(a,2,10);await clear(b,3,20);await clear(c,3,15);
  let board=await service.leaderboard('genesis',b);
  check('Genesis prioritizes furthest clear and uses fastest cumulative time for ties',board.rows.map(row=>row.name).join(',')==='Mabel,Hazel,Pip'&&board.rows[0].time===45&&board.rows[0].reached===3);
  check('Public rows exclude session credentials and identify viewer safely',board.viewer.name==='Hazel'&&board.viewer.isYou&&board.rows.every(row=>/^[a-f0-9]{20}$/.test(row.player)&&![a,b,c].includes(row.player))&&!JSON.stringify(board).includes(b));
  const badRun=(await service.command(a,'startRun')).result;
  check('Skipped levels and invalid times cannot advance server campaign',!(await service.command(a,'awardLevel',[badRun,1,3])).result.length&&!(await service.command(a,'awardLevel',[badRun,0,-1])).result.length&&!(await service.command(a,'awardLevel',[badRun,0,100])).result.length);
  wall+=2000;await service.command(a,'awardLevel',[badRun,0,2]);
  check('Duplicate level receipts cannot create global progress',!(await service.command(a,'awardLevel',[badRun,0,2])).result.length&&(await service.leaderboard('genesis',a)).viewer.reached===2);
  wall+=500;
  check('Half-second clears are accepted and preserve sequential reward progress',(await service.command(a,'awardLevel',[badRun,1,2.5])).result.length>0);
  check('Zero and negative elapsed deltas remain invalid',!(await service.command(a,'awardLevel',[badRun,2,2.5])).result.length&&!(await service.command(a,'awardLevel',[badRun,2,2.4])).result.length);
  wall+=500;
  check('A valid clear can follow rejected timing without losing the run',(await service.command(a,'awardLevel',[badRun,2,3])).result.length>0);
  check('Incomplete runs never enter full-campaign speed board',(await service.leaderboard('speed')).rows.length===0);
  await clear(a,LEVELS.length,3);await clear(b,LEVELS.length,4);
  board=await service.leaderboard('speed',a);
  check('Completed 21-level campaigns rank by fastest total time',board.rows.length===2&&board.rows[0].name==='Pip'&&board.rows[0].time===63&&board.version===CAMPAIGN_VERSION);
  await clear(a,1,2);
  check('A later shorter run does not erase the personal best',(await service.leaderboard('genesis',a)).viewer.reached===21);
  await service.command(a,'bake',['butter-paws']);await service.command(b,'bake',['butter-paws']);
  board=await service.leaderboard('cooks');
  check('Successful cooking counts individual baked treats',board.rows.length===2&&board.rows.every(row=>row.value===2));
  check('Equal bakery totals share a rank',board.rows.every(row=>row.rank===1));
  const before=(await service.leaderboard('cooks',c)).viewer;
  const failed=await service.command(c,'bake',['unknown-recipe']);
  check('Failed baking cannot award cooking rank',!failed.result.ok&&before===null&&(await service.leaderboard('cooks',c)).viewer===null);
  await service.command(a,'bake',['butter-paws']);
  check('Collection counts unique recipes rather than repeat batches',(await service.leaderboard('collection',a)).viewer.value===1&&(await service.leaderboard('cooks',a)).viewer.value===4);
  await service.sell(a,{recipe:'butter-paws',quantity:2,seed});await service.sell(b,{recipe:'butter-paws',quantity:1,seed});
  check('Sales and lifetime points use server sale receipts',(await service.leaderboard('sells',a)).viewer.value===2&&(await service.leaderboard('fortune',a)).viewer.value===14);
  const imported=service.session();
  const source=service.profile(c).profile;source.totalBaked=999999;source.recipes['butter-paws'].firstBaked='2026-01-01';
  await service.command(imported,'import',[source]);
  check('Imported cooking and collection totals cannot enter global boards',(await service.leaderboard('cooks',imported)).viewer===null&&(await service.leaderboard('collection',imported)).viewer===null);
  const special=(await service.command(a,'startSpecial',[seed])).result;wall+=10000;
  await service.command(a,'awardSpecial',[special.runId,10]);
  check('Special fastest-clear board uses the current shared seed',(await service.leaderboard('special',a)).viewer.time===10);
  seed='next-batch';
  check('New Special Batch starts a fresh challenge leaderboard',(await service.leaderboard('special',a)).rows.length===0);
  check('Unknown boards are rejected',await service.leaderboard('invalid').then(()=>false,()=>true));
  service.close();console.log(`${count} global leaderboard checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
