const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = Object.fromEntries(['score','lives','remaining','overlay','status','message','hint','play','pause','shortcut'].map(id => [id, document.getElementById(id)]));
const W = 800, H = 560, SPEED = 355;
const paddle = { x: 344, y: 516, w: 112, h: 14 };
const ball = { x: 400, y: 500, r: 8, vx: 120, vy: -334 };
const keys = new Set();
const colors = ['#d0f36a','#b3cf70','#edca7b','#d69266','#a4b9a0'];
let bricks = [], particles = [], trail = [], score = 0, lives = 3, state = 'intro', lastTime = 0, accumulator = 0;

function sync() {
  ui.score.textContent = String(score).padStart(4, '0');
  ui.lives.textContent = '● '.repeat(lives).trim() || '—';
  ui.remaining.textContent = bricks.filter(b => b.alive).length;
  ui.pause.disabled = !['playing','paused'].includes(state);
  ui.pause.textContent = state === 'paused' ? '▶ RESUME' : 'Ⅱ PAUSE';
  ui.pause.setAttribute('aria-label', state === 'paused' ? 'Resume game' : 'Pause game');
}
function overlay(status, title, hint, button) {
  ui.status.textContent = status;
  ui.message.innerHTML = title;
  ui.hint.textContent = hint;
  ui.play.innerHTML = `${button} <span>↗</span>`;
  ui.shortcut.textContent = state === 'paused' ? 'or press P / SPACE' : 'or press SPACE';
  ui.overlay.hidden = false;
  sync();
}
function reset(showIntro = false) {
  score = 0; lives = 3; particles = []; trail = []; keys.clear();
  paddle.x = (W - paddle.w) / 2;
  bricks = Array.from({length:40}, (_, i) => ({x:41 + (i % 8) * 91, y:65 + Math.floor(i / 8) * 33, w:81, h:23, row:Math.floor(i / 8), alive:true}));
  state = showIntro ? 'intro' : 'ready';
  dock();
  if (showIntro) overlay('FRESH OUT OF THE BURROW', 'Ready to<br>make a mess?', 'Move the paddle. Catch the seed. Crunch every block.', 'LET’S CRUNCH');
  else ui.overlay.hidden = true;
  sync();
}
function dock() {ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r - 3; ball.vx = 120; ball.vy = -Math.sqrt(SPEED ** 2 - ball.vx ** 2); trail = [];}
function action() {
  if (state === 'paused') {state = 'playing'; ui.overlay.hidden = true; sync(); return;}
  if (['intro','won','lost'].includes(state)) reset();
  if (state === 'ready') {state = 'playing'; ui.overlay.hidden = true; sync();}
}
function pause() {
  if (state === 'playing') {state = 'paused'; keys.clear(); overlay('TAKE A BREATHER', 'Snack<br>break.', 'Your seed is safe. Jump back in whenever you’re ready.', 'KEEP CRUNCHING');}
  else if (state === 'paused') action();
}
function hitBrick(b) {
  b.alive = false; score += 10;
  for (let i=0;i<9;i++) particles.push({x:ball.x,y:ball.y,vx:(Math.random()-.5)*180,vy:(Math.random()-.5)*180,life:.45,color:colors[b.row]});
  if (bricks.every(brick => !brick.alive)) {state = 'won'; overlay('NOT A CRUMB LEFT', 'Clean<br>plate!', `All 40 blocks crunched. ${score} points. Hungry for another round?`, 'PLAY AGAIN');}
  sync();
}
function step(dt) {
  if (!['playing','ready'].includes(state)) return;
  const move = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
  paddle.x = Math.max(0, Math.min(W-paddle.w, paddle.x + move * 540 * dt));
  if (state === 'ready') {dock(); return;}
  const px = ball.x, py = ball.y;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  if (ball.x < ball.r) {ball.x = ball.r; ball.vx = Math.abs(ball.vx);}
  if (ball.x > W-ball.r) {ball.x = W-ball.r; ball.vx = -Math.abs(ball.vx);}
  if (ball.y < ball.r) {ball.y = ball.r; ball.vy = Math.abs(ball.vy);}
  if (ball.vy > 0 && py + ball.r <= paddle.y && ball.y + ball.r >= paddle.y && ball.x + ball.r > paddle.x && ball.x - ball.r < paddle.x+paddle.w) {
    const offset = Math.max(-1, Math.min(1, (ball.x - paddle.x - paddle.w / 2) / (paddle.w / 2)));
    const angle = offset * Math.PI / 3;
    ball.vx = SPEED * Math.sin(angle); ball.vy = -SPEED * Math.cos(angle);
    ball.y = paddle.y - ball.r;
  }
  for (const b of bricks) {
    if (!b.alive || ball.x+ball.r <= b.x || ball.x-ball.r >= b.x+b.w || ball.y+ball.r <= b.y || ball.y-ball.r >= b.y+b.h) continue;
    if (py+ball.r <= b.y) {ball.y=b.y-ball.r;ball.vy=-Math.abs(ball.vy);}
    else if (py-ball.r >= b.y+b.h) {ball.y=b.y+b.h+ball.r;ball.vy=Math.abs(ball.vy);}
    else if (px < b.x) {ball.x=b.x-ball.r;ball.vx=-Math.abs(ball.vx);}
    else {ball.x=b.x+b.w+ball.r;ball.vx=Math.abs(ball.vx);}
    hitBrick(b); break;
  }
  if (ball.y-ball.r > H) {
    lives--; sync();
    if (!lives) {state='lost';overlay('THE SEED GOT AWAY', 'Still<br>hungry?', `${score} points. A fresh batch is one click away.`, 'TRY AGAIN');}
    else {state='ready';dock();}
  }
  for (const p of particles) {p.x += p.vx*dt;p.y += p.vy*dt;p.vy += 250*dt;p.life -= dt;}
  particles = particles.filter(p => p.life > 0);
}
function draw() {
  ctx.fillStyle='#111810';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#263021';
  for (let x=20;x<W;x+=24) for (let y=18;y<H;y+=24) ctx.fillRect(x,y,1,1);
  ctx.font='10px monospace';ctx.fillStyle='#64715a';ctx.textAlign='left';ctx.fillText('THE SEED STORAGE',41,35);
  ctx.textAlign='right';ctx.fillText('CLEAR THE SHELVES',759,35);
  for (const b of bricks) if(b.alive) {
    ctx.fillStyle='#060c07';ctx.fillRect(b.x+3,b.y+4,b.w,b.h);
    ctx.fillStyle=colors[b.row];ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.fillStyle='#ffffff35';ctx.fillRect(b.x+2,b.y+2,b.w-4,2);
    ctx.strokeStyle='#26301855';ctx.lineWidth=1;ctx.strokeRect(b.x+6,b.y+5,b.w-12,b.h-10);
    ctx.fillStyle='#23301f66';ctx.beginPath();ctx.ellipse(b.x+b.w/2,b.y+b.h/2,3,5,.5,0,Math.PI*2);ctx.fill();
  }
  trail.forEach((p,i) => {ctx.fillStyle=`rgba(208,243,106,${i/trail.length*.22})`;ctx.beginPath();ctx.arc(p.x,p.y,ball.r*i/trail.length,0,Math.PI*2);ctx.fill();});
  for (const p of particles) {ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
  ctx.fillStyle='#0a1009';ctx.fillRect(paddle.x+3,paddle.y+4,paddle.w,paddle.h);
  ctx.fillStyle='#d0f36a';ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
  ctx.fillStyle='#f0ffbe';ctx.fillRect(paddle.x+4,paddle.y+2,paddle.w-8,3);
  ctx.fillStyle='#64833b';for(let i=0;i<3;i++)ctx.fillRect(paddle.x+paddle.w/2-9+i*7,paddle.y+7,3,4);
  ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(-.45);ctx.fillStyle='#f8e6ad';ctx.beginPath();ctx.ellipse(0,0,7,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9d7e45';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,6);ctx.stroke();ctx.restore();
  if (state === 'ready') {ctx.textAlign='center';ctx.font='12px monospace';ctx.fillStyle='#d0f36a';ctx.fillText('SPACE / TAP TO LAUNCH',W/2,455);}
}
function frame(time) {
  const elapsed = lastTime ? Math.min((time-lastTime)/1000,.05) : 0;lastTime=time;
  accumulator += elapsed;
  while(accumulator >= 1/240) {step(1/240); accumulator-=1/240;}
  if(state === 'playing') {trail.push({x:ball.x,y:ball.y});if(trail.length>9)trail.shift();}
  draw();requestAnimationFrame(frame);
}
function pointer(event) {
  if (!['ready','playing'].includes(state)) return;
  const rect = canvas.getBoundingClientRect();
  paddle.x = Math.max(0,Math.min(W-paddle.w,(event.clientX-rect.left)*W/rect.width-paddle.w/2));
  if (state === 'ready') dock();
}
canvas.addEventListener('pointermove',pointer);
canvas.addEventListener('pointerdown',event => {pointer(event);canvas.focus();action();});
document.addEventListener('keydown',event => {
  if(event.target instanceof HTMLButtonElement && [' ','Enter'].includes(event.key)) return;
  const key = event.key.length===1 ? event.key.toLowerCase() : event.key;
  if(['ArrowLeft','ArrowRight',' ','a','d','p','r'].includes(key)) event.preventDefault();
  keys.add(key);
  if(event.repeat) return;
  if(key===' ') action();
  if(key==='p') pause();
  if(key==='r') reset();
});
document.addEventListener('keyup',event => keys.delete(event.key.length===1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur',() => {keys.clear();if(state==='playing')pause();});
document.addEventListener('visibilitychange',() => {if(document.hidden && state==='playing')pause();});
ui.play.addEventListener('click',() => {action();canvas.focus();});
ui.pause.addEventListener('click',pause);
document.querySelector('#restart').addEventListener('click',() => {reset();canvas.focus();});
reset(true);requestAnimationFrame(frame);
