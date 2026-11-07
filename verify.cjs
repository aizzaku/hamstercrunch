const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {textContent:'',innerHTML:'',hidden:false,addEventListener(){},setAttribute(){},focus(){},getContext(){return {};}});
  return elements.get(id);
}
const context = vm.createContext({
  document:{querySelector:s=>element(s.slice(1)),getElementById:element,addEventListener(){}},
  window:{addEventListener(){}}, requestAnimationFrame(){}, HTMLButtonElement:class {}, console,
});
vm.runInContext(readFileSync('game.js','utf8'),context);
function check(name,code) {assert.equal(vm.runInContext(code,context),true,name);console.log(`PASS ${name}`);}
check('Initial level has 40 bricks and three lives', "bricks.length === 40 && lives === 3 && state === 'intro'");
check('Launch starts play', "action(); state === 'playing' && ui.overlay.hidden");
check('Wall collision reflects inward', "ball.x=7;ball.y=300;ball.vx=-120;step(1/240);ball.vx>0 && ball.x>=ball.r");
check('Paddle edge changes outgoing angle', "ball.x=paddle.x+100;ball.y=paddle.y-ball.r-1;ball.vx=0;ball.vy=355;step(1/120);ball.vx>0 && ball.vy<0");
check('Brick collision scores and reflects', "ball.x=bricks[0].x+40;ball.y=bricks[0].y+bricks[0].h+ball.r+1;ball.vx=0;ball.vy=-355;step(1/120);!bricks[0].alive && score===10 && ball.vy>0");
check('Pause freezes position and resume works', "pause();const savedX=ball.x;step(1);const frozen=ball.x===savedX && state==='paused';action();frozen && state==='playing'");
check('Miss loses one life and docks ball', "ball.y=H+20;step(1/240);lives===2 && state==='ready' && ball.y<paddle.y");
check('Third miss ends game', "lives=1;state='playing';ball.y=H+20;step(1/240);lives===0 && state==='lost' && !ui.overlay.hidden");
check('Restart restores full level', "reset();state==='ready' && lives===3 && score===0 && bricks.every(b=>b.alive)");
check('Last brick completes level', "state='playing';bricks.forEach((b,i)=>b.alive=i===0);hitBrick(bricks[0]);state==='won' && !ui.overlay.hidden && score===10");
check('Play again starts a fresh run', "action();state==='playing' && lives===3 && score===0 && bricks.every(b=>b.alive)");
