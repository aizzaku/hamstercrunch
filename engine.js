const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = Object.fromEntries(['score','lives','remaining','overlay','status','message','hint','play','pause','shortcut','level','timer','level-name','effects','toast','splits','records','sound','zoomies','charge','menu','details','close-menu','fullscreen'].map(id=>[id,document.getElementById(id)]));
const W=800,H=560,STEP=1/240;
const COLORS=['#d0f36a','#b3cf70','#edca7b','#d69266','#a4b9a0','#dbb7c8'];
const POWERS=[
  {id:'wide',icon:'↔',name:'BIG PAWS',color:'#d0f36a',description:'A wider paddle for 14 seconds.'},
  {id:'slow',icon:'◷',name:'SLOW MO',color:'#8edbd4',description:'Take a breath. Slower hamsters for 12 seconds.'},
  {id:'multi',icon:'×3',name:'HAMSTER PARTY',color:'#edca7b',description:'Three hamsters. Triple the trouble.'},
  {id:'fire',icon:'✦',name:'HOT CHEEKS',color:'#ff9d6f',description:'Smash straight through bricks for 10 seconds.'},
  {id:'shield',icon:'═',name:'SAFETY NET',color:'#b8b2f4',description:'One rescue bounce from the floor.'},
  {id:'heart',icon:'♥',name:'SECOND HELPING',color:'#f1a3bb',description:'One extra life, up to five.'},
];
const paddle={x:338,y:516,w:124,h:14};
const keys=new Set();
let bricks=[],obstacles=[],balls=[],particles=[],drops=[],splits=[];
let score=0,lives=3,level=0,state='intro',lastTime=0,accumulator=0;
let runTime=0,levelTime=0,worldTime=0,combo=0,comboLeft=0,kills=0,powerCursor=0;
let wideLeft=0,slowLeft=0,fireLeft=0,shield=false,shake=0,toastLeft=0,started=false,saved=false;
let soundEnabled=false,audio=null,storageWarning=false,records=readRecords();
let zoomCharge=0,zoomLeft=0,menuPaused=false,cleanupAnnounced=false;
let recipeRunId=null,specialBatch=null;
function currentLayout(){return specialBatch?specialLayout(specialBatch.seed):LEVELS[level];}
function startSpecialBatch(batch){reset();specialBatch=batch;loadLevel(0);overlay("SQUEEKTOSHI’S SPECIAL BATCH","A special<br>little batch.","One shared tray. Clear it to bring home the featured ingredient. Campaign records stay separate.","LET’S CRUNCH");}
function piercing(){return fireLeft>0||zoomLeft>0;}
function activateZoomies(){
  if(state!=='playing'||zoomCharge<100||zoomLeft>0)return false;
  zoomCharge=0;zoomLeft=5;shake=4;notify('ZOOMIES! · Five seconds of hamster havoc');tone(1100,.25,'triangle');sync();return true;
}
function openMenu(){menuPaused=state==='playing';if(menuPaused)pause();ui.details.showModal();}
function closeMenu(){ui.details.close();}
async function fullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('Fullscreen unavailable · try your browser’s fullscreen control');}
  catch(error){console.warn('Fullscreen could not start:',error);notify('Fullscreen unavailable in this preview');}
}

function formatTime(seconds) {const t=Math.floor(seconds*10);return `${String(Math.floor(t/600)).padStart(2,'0')}:${String(Math.floor(t/10)%60).padStart(2,'0')}.${t%10}`;}
function rankRecords(a,b) {return b.reached-a.reached || a.time-b.time;}
function readRecords() {
  try {const data=JSON.parse(localStorage.getItem('hamster-crunch-genesis-21-v1')||'[]');return Array.isArray(data)?data.filter(r=>Number.isInteger(r.reached)&&r.reached>=0&&r.reached<=LEVELS.length&&Number.isFinite(r.time)&&r.time>=0).sort(rankRecords).slice(0,8):[];}
  catch(error) {console.warn('Local records could not be read:',error);return [];}
}
function renderRecords() {
  ui.records.replaceChildren();
  if (!records.length) {ui.records.textContent='Your first run belongs here. Finish a run to set a time.';return;}
  records.forEach((record,i)=>{const row=document.createElement('div');row.className='record-row';const rank=document.createElement('span');rank.textContent=String(i+1).padStart(2,'0');const progress=document.createElement('span');progress.textContent=record.reached===LEVELS.length?`ALL ${LEVELS.length} CLEARED`:`LEVEL ${Math.min(LEVELS.length,record.reached+1)} · ${record.reached} CLEARED`;const time=document.createElement('strong');time.textContent=formatTime(record.time);row.append(rank,progress,time);ui.records.append(row);});
}
function saveRun() {
  if (!started || saved || specialBatch) return;
  saved=true;
  records.push({reached:splits.length,time:runTime});records.sort(rankRecords);records=records.slice(0,8);
  try {localStorage.setItem('hamster-crunch-genesis-21-v1',JSON.stringify(records));}
  catch(error) {storageWarning=true;console.warn('Local records could not be saved:',error);}
  renderRecords();
  if(storageWarning)notify('Storage unavailable · this record lasts until reload');
}
function tone(freq=500,duration=.05,type='sine',volume=.025) {
  if(!soundEnabled || !audio) return;
  if(typeof BakeryAudio!=='undefined')BakeryAudio.cue(audio,freq,duration);
}
function foodSound(brick,damaged=false){
  if(!soundEnabled||!audio)return;
  const flavor=brick.explosive?'gift':['butter','cracker','sugar','jam','chocolate'][brick.row%5];
  if(typeof BakeryAudio!=='undefined')BakeryAudio.play(audio,flavor,damaged);
}
async function toggleSound() {
  if(ui.sound.disabled)return;
  if(soundEnabled){soundEnabled=false;BakeryAudio.setMuted(true);ui.sound.textContent='♪ Sound off';ui.sound.setAttribute('aria-pressed','false');return;}
  ui.sound.disabled=true;ui.sound.textContent='♪ Loading crunches…';
  try {if(!audio){const AudioEngine=window.AudioContext||window.webkitAudioContext;if(!AudioEngine){notify('Sound is unavailable in this browser');return;}audio=new AudioEngine();}await audio.resume();await BakeryAudio.load(audio);BakeryAudio.setMuted(false);soundEnabled=true;ui.sound.textContent='♪ ASMR sound on';ui.sound.setAttribute('aria-pressed','true');BakeryAudio.play(audio,'butter');notify('ElevenLabs ASMR crunches ready');}
  catch(error){soundEnabled=false;console.warn('Audio could not start:',error);notify('ASMR sounds could not load. Tap Sound to retry.');}
  finally{ui.sound.disabled=false;if(!soundEnabled){ui.sound.textContent='♪ Sound off';ui.sound.setAttribute('aria-pressed','false');}}
}
function sync() {
  ui.score.textContent=String(score).padStart(5,'0');ui.lives.textContent='♥'.repeat(lives);
  ui.remaining.textContent=bricks.filter(b=>b.alive).length;
  ui.level.textContent=specialBatch?'SPECIAL':`${String(level+1).padStart(2,'0')} / ${LEVELS.length}`;
  ui.timer.textContent=formatTime(runTime);ui['level-name'].textContent=`${specialBatch?'Special':`Chapter ${currentLayout().chapter||1}`} · ${String(level+1).padStart(2,'0')} — ${currentLayout().name}`;
  ui.pause.disabled=!['playing','paused'].includes(state);
  ui.pause.textContent=state==='paused'?'▶ Resume':'Ⅱ Pause';
  ui.pause.setAttribute('aria-label',state==='paused'?'Resume game':'Pause game');
  ui.charge.value=zoomCharge;
  ui.zoomies.disabled=state!=='playing'||zoomCharge<100||zoomLeft>0;
  ui.zoomies.textContent=zoomLeft>0?`✦ ZOOMIES ${Math.ceil(zoomLeft)}s`:zoomCharge>=100?'✦ ZOOMIES · SPACE':`✦ ZOOMIES ${Math.floor(zoomCharge)}%`;
  const active=[];
  if(wideLeft>0)active.push(`↔ BIG PAWS ${Math.ceil(wideLeft)}s`);
  if(slowLeft>0)active.push(`◷ SLOW MO ${Math.ceil(slowLeft)}s`);
  if(fireLeft>0)active.push(`✦ HOT CHEEKS ${Math.ceil(fireLeft)}s`);
  if(shield)active.push('═ NET READY');
  if(balls.length>1)active.push(`×${balls.length} HAMSTERS`);
  ui.effects.textContent=active.join(' · ')||'Catch falling snacks for power-ups';
}
function overlay(status,title,hint,button) {
  ui.status.textContent=status;ui.message.innerHTML=title;ui.hint.textContent=hint;
  ui.play.textContent=`${button} ↗`;ui.shortcut.textContent=state==='paused'?'or press P / SPACE':'or press SPACE';ui.overlay.hidden=false;sync();
  const loot=document.getElementById('run-loot');if(loot)loot.hidden=!['cleared','won','lost'].includes(state)||!loot.textContent;
}
function notify(message) {ui.toast.textContent=message;toastLeft=3;ui.toast.hidden=false;}
function newBall(x,y,vx=120,vy=-300) {return {x,y,r:12,vx,vy,rotation:0,trail:[]};}
function dock() {balls=[newBall(paddle.x+paddle.w/2,paddle.y-16,120,-Math.sqrt(currentLayout().speed**2-120**2))];}
function clearEffects() {wideLeft=0;slowLeft=0;fireLeft=0;zoomLeft=0;shield=false;drops=[];combo=0;comboLeft=0;}
function loadLevel(index) {
  level=index;const generated=makeLevel(index,specialBatch?currentLayout():null);bricks=generated.bricks;obstacles=generated.obstacles;
  clearEffects();cleanupAnnounced=false;paddle.w=generated.width;paddle.x=(W-paddle.w)/2;levelTime=0;worldTime=0;kills=0;powerCursor=0;particles=[];keys.clear();dock();state='ready';ui.overlay.hidden=true;
  notify(`${specialBatch?'SPECIAL':`${index+1} / ${LEVELS.length}`} · ${generated.name.toUpperCase()}`);sync();
}
function reset(showIntro=false) {
  if(started&&!saved)saveRun();
  ui.play.disabled=false;specialBatch=null;score=0;lives=3;runTime=0;splits=[];started=false;saved=false;shake=0;zoomCharge=0;recipeRunId=null;renderSplits();loadLevel(0);
  if(showIntro){state='intro';overlay('Fresh out of the oven','Small hamster.<br>Big appetite.','Twenty-one warm batches. Three bakery chapters. Six little power-ups. One very hungry hamster. Let’s leave no crumb behind.','Let’s crunch');}
}
function action() {
  if(state==='paused'){state='playing';ui.overlay.hidden=true;sync();return;}
  if(state==='cleared'){loadLevel(level+1);return;}
  if(['intro','won','lost'].includes(state))reset();
  if(state==='ready'){
    if(!started&&typeof RecipeProfile!=='undefined'){
      const pending=specialBatch?RecipeProfile.startSpecial(specialBatch.seed):RecipeProfile.startRun();recipeRunId=pending;
      if(pending&&typeof pending.then==='function'){
        state='connecting';ui.play.disabled=true;
        overlay('WARMING THE OVEN','One little<br>moment…','Opening your saved run before the timer starts.','CONNECTING');
        pending.then(id=>{if(state!=='connecting'||recipeRunId!==pending)return;recipeRunId=id;ui.play.disabled=false;beginPlay();})
          .catch(error=>{if(state!=='connecting'||recipeRunId!==pending)return;ui.play.disabled=false;state='ready';overlay('BAKERY CONNECTION PAUSED','Try<br>again?',error.message,'RETRY');});
        return;
      }
    }
    beginPlay();
  }
}
function beginPlay(){state='playing';started=true;ui.overlay.hidden=true;tone(600,.08);sync();}
function pause() {
  if(state==='playing'){state='paused';keys.clear();overlay('TAKE A BREATHER','Snack<br>break.','Timer paused. Your hamster is safe.','KEEP CRUNCHING');}
  else if(state==='paused')action();
}
function renderSplits() {
  ui.splits.replaceChildren();
  if(!splits.length){ui.splits.textContent='Clear a level to start your split times.';return;}
  splits.forEach((split,i)=>{const row=document.createElement('div');row.className='record-row';const label=document.createElement('span');label.textContent=`${String(i+1).padStart(2,'0')} ${LEVELS[i].name}`;const time=document.createElement('strong');time.textContent=formatTime(split);row.append(label,time);ui.splits.append(row);});
}
function finishLevel() {
  if(specialBatch){
    if(typeof RecipeProfile!=='undefined')RecipeProfile.awardSpecial(recipeRunId,runTime);
    state='won';saved=true;tone(1000,.25,'triangle');
    overlay('SPECIAL BATCH CLEARED','Freshly<br>crunched!',`Tray cleared in ${formatTime(runTime)}. Your special reward is being saved. Return to the Recipe Box for the market.`,'BACK TO GENESIS');return;
  }
  if(typeof RecipeProfile!=='undefined')RecipeProfile.awardLevel(recipeRunId,level,runTime);
  splits.push(levelTime);renderSplits();tone(1000,.25,'triangle');
  if(level===LEVELS.length-1){state='won';saveRun();overlay('GENESIS ERA · CLEAN PLATE','Genesis<br>crunched!',`All ${LEVELS.length} cleared in ${formatTime(runTime)}. ${score} points. Your run is saved locally; accepted clears also enter global rankings.`,'RUN IT BACK');}
  else{state='cleared';overlay(`${(level+1)%7===0?'CHAPTER '+Math.ceil((level+1)/7)+' COMPLETE':'LEVEL '+(level+1)+' CLEARED'} · ${formatTime(levelTime)}`,'Not a<br>crumb left.',`Run time ${formatTime(runTime)}. Next: ${LEVELS[level+1].name}. Lives carry over; temporary power-ups reset.`,'NEXT LEVEL');}
}
function burst(x,y,color,count=9) {for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*200,vy:(Math.random()-.5)*200,life:.45,color});}
function applyPower(id) {
  const power=POWERS.find(p=>p.id===id);if(!power)return;
  if(id==='wide'){wideLeft=14;paddle.w=currentLayout().width+62;paddle.x=Math.min(paddle.x,W-paddle.w);}
  if(id==='slow')slowLeft=12;
  if(id==='fire')fireLeft=10;
  if(id==='shield')shield=true;
  if(id==='heart')lives=Math.min(5,lives+1);
  if(id==='multi'&&balls.length){const source=balls[0];for(const angle of [-.55,.55]){if(balls.length>=5)break;const direction=Math.atan2(source.vy,source.vx)+angle;const speed=currentLayout().speed;const vx=Math.cos(direction)*speed,vy=Math.sin(direction)*speed;balls.push(newBall(source.x,source.y,vx,Math.abs(vy)<120?-120:vy));}}
  notify(`${power.icon} ${power.name} · ${power.description}`);tone(850,.16,'triangle');sync();
}
function hitBrick(b,hamster,blast=false) {
  if(!b.alive)return;
  b.hp-=blast?b.hp:piercing()?3:1;
  if(!blast&&zoomLeft<=0)zoomCharge=Math.min(100,zoomCharge+10);
  burst(hamster.x,hamster.y,b.explosive?'#ff9d6f':COLORS[b.row%COLORS.length],b.hp>0?4:10);shake=Math.max(shake,b.hp>0?1.2:2.8);
  if(b.hp>0){foodSound(b,true);return;}
  b.alive=false;combo=comboLeft>0?Math.min(combo+1,8):1;comboLeft=2.5;score+=10*combo;kills++;
  foodSound(b);
  if(kills%4===0){const power=POWERS[powerCursor%POWERS.length];powerCursor++;drops.push({x:b.x+b.w/2,y:b.y+b.h/2,power});}
  if(b.explosive){
    burst(b.x+b.w/2,b.y+b.h/2,'#ff9d6f',24);shake=5;
    // Marking the crate dead first makes recursive chains finite.
    for(const nearby of bricks){if(nearby.alive&&Math.abs(nearby.x-b.x)<=92&&Math.abs(nearby.y-b.y)<=35)hitBrick(nearby,{x:nearby.x+nearby.w/2,y:nearby.y+nearby.h/2},true);}
  }
  const remaining=bricks.filter(brick=>brick.alive).length;
  if(remaining===0&&state==='playing')finishLevel();
  else if(remaining>0&&remaining<=3&&!cleanupAnnounced){cleanupAnnounced=true;notify('LAST CRUMBS · Paddle returns now help aim at the final bricks');}
  sync();
}
function aimLastCrumbs(b){
  const remaining=bricks.filter(brick=>brick.alive);
  if(!remaining.length||remaining.length>3)return;
  const target=remaining.reduce((best,brick)=>Math.abs(brick.x+brick.w/2-b.x)<Math.abs(best.x+best.w/2-b.x)?brick:best);
  const dx=target.x+target.w/2-b.x,dy=target.y+target.h/2-b.y;
  const length=Math.hypot(dx,dy),speed=currentLayout().speed;
  b.vx=dx/length*speed;b.vy=dy/length*speed;
}
function overlaps(b,rect) {return b.x+b.r>rect.x&&b.x-b.r<rect.x+rect.w&&b.y+b.r>rect.y&&b.y-b.r<rect.y+rect.h;}
function reflect(b,rect,px,py) {
  if(py+b.r<=rect.y){b.y=rect.y-b.r;b.vy=-Math.abs(b.vy);}
  else if(py-b.r>=rect.y+rect.h){b.y=rect.y+rect.h+b.r;b.vy=Math.abs(b.vy);}
  else if(px<rect.x){b.x=rect.x-b.r;b.vx=-Math.abs(b.vx);}
  else{b.x=rect.x+rect.w+b.r;b.vx=Math.abs(b.vx);}
}
function step(dt) {
  if((typeof Leaderboards!=='undefined'&&Leaderboards.isOpen())||ui.details.open||(typeof RecipeProfile!=='undefined'&&RecipeProfile.isOpen())||!['playing','ready'].includes(state))return;
  const move=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
  paddle.x=Math.max(0,Math.min(W-paddle.w,paddle.x+move*560*dt));
  if(started){runTime+=dt;levelTime+=dt;}
  if(state==='ready'){dock();sync();return;}
  worldTime+=dt;wideLeft=Math.max(0,wideLeft-dt);slowLeft=Math.max(0,slowLeft-dt);fireLeft=Math.max(0,fireLeft-dt);zoomLeft=Math.max(0,zoomLeft-dt);comboLeft=Math.max(0,comboLeft-dt);shake=Math.max(0,shake-dt*16);
  if(!wideLeft&&paddle.w!==currentLayout().width){const center=paddle.x+paddle.w/2;paddle.w=currentLayout().width;paddle.x=Math.max(0,Math.min(W-paddle.w,center-paddle.w/2));}
  obstacles.forEach(o=>{if(o.moving)o.x=o.baseX+Math.sin(worldTime*1.1+o.phase)*90;});
  for(const b of balls){
    const px=b.x,py=b.y,factor=slowLeft>0?.68:1;b.x+=b.vx*dt*factor;b.y+=b.vy*dt*factor;b.rotation+=b.vx*dt*.014;
    if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx);}
    if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx);}
    if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy);}
    if(b.vy>0&&py+b.r<=paddle.y&&b.y+b.r>=paddle.y&&b.x+b.r>paddle.x&&b.x-b.r<paddle.x+paddle.w){
      const offset=Math.max(-1,Math.min(1,(b.x-paddle.x-paddle.w/2)/(paddle.w/2)));const angle=offset*Math.PI/3;const speed=currentLayout().speed;
      b.vx=speed*Math.sin(angle);if(Math.abs(b.vx)<35)b.vx=35*(offset<0?-1:1);b.vy=-Math.sqrt(speed**2-b.vx**2);b.y=paddle.y-b.r;aimLastCrumbs(b);combo=0;comboLeft=0;if(soundEnabled&&typeof BakeryAudio!=='undefined')BakeryAudio.play(audio,'wood');
    }
    if(shield&&b.vy>0&&b.y+b.r>=H-12&&py+b.r<H-12){b.y=H-12-b.r;b.vy=-Math.abs(b.vy);shield=false;burst(b.x,H-12,'#b8b2f4',20);notify('NET SAVE! · Back for seconds');tone(650,.12);}
    for(const o of obstacles){if(overlaps(b,o)){reflect(b,o,px,py);break;}}
    for(const brick of bricks){if(brick.alive&&overlaps(b,brick)){if(!piercing())reflect(b,brick,px,py);hitBrick(brick,b);if(!piercing()||state!=='playing')break;}}
    if(state!=='playing')break;
  }
  if(state!=='playing')return;
  balls=balls.filter(b=>b.y-b.r<=H);
  if(!balls.length){lives--;clearEffects();paddle.w=currentLayout().width;paddle.x=Math.min(paddle.x,W-paddle.w);tone(110,.25,'triangle');if(!lives){state='lost';saveRun();overlay('THE HAMSTER GOT AWAY','Still<br>hungry?',`${splits.length} levels cleared · ${formatTime(runTime)} · ${score} points. Your run is on the local board.`,'TRY AGAIN');}else{state='ready';dock();notify('Shake it off. SPACE / TAP to relaunch');}sync();return;}
  for(const drop of drops){drop.y+=125*dt;if(drop.y+12>=paddle.y&&drop.y-12<=paddle.y+paddle.h&&drop.x+12>paddle.x&&drop.x-12<paddle.x+paddle.w){applyPower(drop.power.id);drop.caught=true;}}
  drops=drops.filter(d=>!d.caught&&d.y<H+20);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=250*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
}
function hamster(b) {
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rotation);ctx.scale(b.r/12,b.r/12);
  if(piercing()){ctx.shadowBlur=18;ctx.shadowColor='#ff954e';}
  ctx.fillStyle='#c18c5b';ctx.beginPath();ctx.arc(-8,-9,6,0,Math.PI*2);ctx.arc(8,-9,6,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='#f1b4ac';ctx.beginPath();ctx.arc(-8,-9,3.2,0,Math.PI*2);ctx.arc(8,-9,3.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#dba976';ctx.beginPath();ctx.ellipse(0,0,12,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffedcc';ctx.beginPath();ctx.ellipse(0,5,9,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1e2119';ctx.beginPath();ctx.arc(-4,-2,1.7,0,Math.PI*2);ctx.arc(4,-2,1.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f3a5a1';ctx.beginPath();ctx.ellipse(0,3,2,1.5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f9d0a4';ctx.beginPath();ctx.ellipse(-7,9,3,2,-.4,0,Math.PI*2);ctx.ellipse(7,9,3,2,.4,0,Math.PI*2);ctx.fill();ctx.restore();
}
function draw() {
  ctx.fillStyle='#111810';ctx.fillRect(0,0,W,H);ctx.save();if(shake>0)ctx.translate(Math.sin(worldTime*130)*shake,Math.cos(worldTime*110)*shake*.5);
  ctx.fillStyle='#263021';for(let x=20;x<W;x+=24)for(let y=18;y<H;y+=24)ctx.fillRect(x,y,1,1);
  ctx.font='11px monospace';ctx.fillStyle='#889278';ctx.textAlign='left';ctx.fillText(currentLayout().name.toUpperCase(),41,34);ctx.textAlign='right';ctx.fillText(`LEVEL ${formatTime(levelTime)}`,759,34);
  for(const brick of bricks)if(brick.alive){
    ctx.fillStyle='#060c07';ctx.fillRect(brick.x+3,brick.y+4,brick.w,brick.h);ctx.fillStyle=brick.explosive?'#ff9d6f':COLORS[brick.row%COLORS.length];ctx.fillRect(brick.x,brick.y,brick.w,brick.h);ctx.fillStyle='#ffffff35';ctx.fillRect(brick.x+2,brick.y+2,brick.w-4,2);
    ctx.strokeStyle='#26301855';ctx.lineWidth=1;ctx.strokeRect(brick.x+5,brick.y+5,brick.w-10,brick.h-10);
    ctx.fillStyle='#25331f';for(let i=0;i<brick.hp;i++)ctx.fillRect(brick.x+brick.w/2-(brick.hp*7)/2+i*7,brick.y+10,4,4);
    if(brick.hp<brick.maxHp){ctx.strokeStyle='#24301c';ctx.beginPath();ctx.moveTo(brick.x+12,brick.y);ctx.lineTo(brick.x+22,brick.y+12);ctx.lineTo(brick.x+15,brick.y+24);ctx.stroke();}
    if(brick.explosive){ctx.fillStyle='#342315';ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.fillText('✹',brick.x+brick.w/2,brick.y+18);}
    if(cleanupAnnounced){ctx.strokeStyle='#f8e6ad';ctx.lineWidth=2;ctx.strokeRect(brick.x-2,brick.y-2,brick.w+4,brick.h+4);}
  }
  for(const o of obstacles){ctx.fillStyle=o.moving?'#737f82':'#535f59';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#a4b3a2';ctx.strokeRect(o.x+3,o.y+3,o.w-6,o.h-6);ctx.fillStyle='#1e2b25';ctx.font='14px monospace';ctx.textAlign='center';ctx.fillText(o.moving?'↔':'×',o.x+o.w/2,o.y+17);}
  for(const b of balls){b.trail.forEach((p,i)=>{ctx.fillStyle=piercing()?`rgba(255,146,87,${i/b.trail.length*.3})`:`rgba(208,243,106,${i/b.trail.length*.16})`;ctx.beginPath();ctx.arc(p.x,p.y,b.r*i/b.trail.length,0,Math.PI*2);ctx.fill();});}
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
  for(const drop of drops){ctx.fillStyle=drop.power.color;ctx.fillRect(drop.x-15,drop.y-12,30,24);ctx.fillStyle='#162015';ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillText(drop.power.icon,drop.x,drop.y+5);}
  if(shield){ctx.fillStyle='#b8b2f4';for(let x=0;x<W;x+=16)ctx.fillRect(x,H-12,10,3);}
  ctx.fillStyle='#0a1009';ctx.fillRect(paddle.x+3,paddle.y+4,paddle.w,paddle.h);ctx.fillStyle=wideLeft>0?'#f3e68c':'#d0f36a';ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);ctx.fillStyle='#f0ffbe';ctx.fillRect(paddle.x+4,paddle.y+2,paddle.w-8,3);ctx.fillStyle='#64833b';for(let i=0;i<3;i++)ctx.fillRect(paddle.x+paddle.w/2-9+i*7,paddle.y+7,3,4);
  balls.forEach(hamster);
  if(combo>1&&comboLeft>0){ctx.textAlign='center';ctx.font='bold 24px monospace';ctx.fillStyle='#edca7b';ctx.fillText(`${combo}× CRUNCH!`,W/2,390);}
  if(zoomLeft>0){ctx.strokeStyle='#ff9d6f';ctx.lineWidth=4;ctx.strokeRect(3,3,W-6,H-6);ctx.textAlign='center';ctx.fillStyle='#ffb983';ctx.font='bold 18px monospace';ctx.fillText('✦ ZOOMIES ✦',W/2,420);}
  if(state==='ready'){ctx.textAlign='center';ctx.font='13px monospace';ctx.fillStyle='#d0f36a';ctx.fillText('SPACE / TAP TO LAUNCH',W/2,458);}
  ctx.restore();
}
function frame(time) {
  const elapsed=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;accumulator+=elapsed;
  while(accumulator>=STEP){step(STEP);accumulator-=STEP;}
  if(state==='playing')for(const b of balls){b.trail.push({x:b.x,y:b.y});if(b.trail.length>8)b.trail.shift();}
  toastLeft=Math.max(0,toastLeft-elapsed);ui.toast.hidden=toastLeft===0;sync();draw();requestAnimationFrame(frame);
}
function pointer(event) {if(!['ready','playing'].includes(state))return;const rect=canvas.getBoundingClientRect();paddle.x=Math.max(0,Math.min(W-paddle.w,(event.clientX-rect.left)*W/rect.width-paddle.w/2));if(state==='ready')dock();}
canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',event=>{pointer(event);canvas.focus();action();});
document.addEventListener('keydown',event=>{
  if((typeof Leaderboards!=='undefined'&&Leaderboards.isOpen())||(typeof RecipeProfile!=='undefined'&&RecipeProfile.isOpen()))return;
  if(event.target&&['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(event.target instanceof HTMLButtonElement&&[' ','Enter'].includes(event.key))return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;if(['ArrowLeft','ArrowRight',' ','a','d','p','r'].includes(key))event.preventDefault();keys.add(key);if(event.repeat)return;
  if(ui.details.open){if(key==='Escape')closeMenu();return;}
  if(key===' '){if(state==='playing')activateZoomies();else action();}if(key==='p')pause();if(key==='r')reset();
});
document.addEventListener('keyup',event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
window.addEventListener('blur',()=>{keys.clear();if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
ui.play.addEventListener('click',()=>{action();canvas.focus();});ui.pause.addEventListener('click',pause);ui.sound.addEventListener('click',toggleSound);document.querySelector('#restart').addEventListener('click',()=>{reset();canvas.focus();});
ui.zoomies.addEventListener('click',()=>{activateZoomies();canvas.focus();});ui.menu.addEventListener('click',openMenu);ui['close-menu'].addEventListener('click',closeMenu);ui.fullscreen.addEventListener('click',fullscreen);
ui.details.addEventListener('close',()=>{keys.clear();if(menuPaused&&state==='paused')action();menuPaused=false;canvas.focus();});
document.addEventListener('fullscreenchange',()=>{ui.fullscreen.textContent=document.fullscreenElement?'⤡ EXIT FULLSCREEN':'⛶ FULLSCREEN';});
renderRecords();reset(true);requestAnimationFrame(frame);
