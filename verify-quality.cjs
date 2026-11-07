const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let count=0;
function check(name,condition){assert.ok(condition,name);console.log(`PASS ${name}`);count++;}
const artContext=vm.createContext({document:{createElement:()=>({})},console});
vm.runInContext(fs.readFileSync('bakery-art.js','utf8')+'\n'+fs.readFileSync('bakery-render.js','utf8'),artContext);
const fit=vm.runInContext('BakeryArt.fitRect(400,200,0,0,80,30)',artContext);
check('Wide food sprite keeps its original proportions',fit.width===60&&fit.height===30&&fit.x===10&&fit.y===0);
const hamster=vm.runInContext('BakeryArt.fitRect(300,300,0,0,32,34)',artContext);
check('Round hamster stays round',hamster.width===32&&hamster.height===32&&hamster.y===1);
const rolling=vm.runInContext('BakeryArt.fitRect(400,100,0,0,140,40)',artContext);
check('Rolling pin preserves shape without stretching',rolling.width===140&&rolling.height===35&&rolling.y===2.5);
const backing=vm.runInContext('backingSize(1200,840,2)',artContext);
check('Retina canvas uses screen-sized backing pixels',backing.width===2400&&backing.height===1680);
check('Canvas density is bounded for memory use',vm.runInContext('backingSize(800,560,8).width===2400',artContext));
const requests=[],decoded=[],sources=[],parameters=[];
const context=vm.createContext({console,fetch:async url=>{requests.push(url);return {ok:true,arrayBuffer:async()=>({url})};}});
vm.runInContext(fs.readFileSync('bakery-audio.js','utf8'),context);
const bakeryAudio=vm.runInContext('BakeryAudio',context);
function parameter(){return {value:0,setValueAtTime(v,t){parameters.push([v,t]);},exponentialRampToValueAtTime(v,t){parameters.push([v,t]);},linearRampToValueAtTime(v,t){parameters.push([v,t]);}};}
function node(){return {connect(){},disconnect(){},gain:parameter(),frequency:parameter(),Q:parameter(),playbackRate:parameter(),start(){},stop(){}};}
const audio={state:'running',currentTime:0,destination:{},createGain:node,createDynamicsCompressor(){return {...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()};},async decodeAudioData(bytes){const buffer={duration:1.2,url:bytes.url};decoded.push(buffer);return buffer;},createBufferSource(){const source=node();sources.push(source);return source;}};
(async()=>{
  check('Sound waits for an active context and loaded clips',!bakeryAudio.play(null,'butter')&&!bakeryAudio.play(audio,'butter'));
  await bakeryAudio.load(audio);await bakeryAudio.load(audio);
  check('Three approved ElevenLabs clips load and decode only once',requests.length===3&&decoded.length===3&&requests.every(url=>url.startsWith('assets/sfx/asmr-')));
  check('Food mappings preserve five distinct playback profiles',new Set(['butter','cracker','sugar','jam','chocolate'].map(k=>JSON.stringify(bakeryAudio.profiles[k]))).size===5);
  check('Cracker impacts play the approved cracker buffer',bakeryAudio.play(audio,'cracker')&&sources[0].buffer===decoded.find(b=>b.url.includes('asmr-cracker')));
  check('Chain reactions throttle repeated samples',!bakeryAudio.play(audio,'cracker')&&sources.length===1);
  for(let i=0;i<15;i++){audio.currentTime+=.1;bakeryAudio.play(audio,'butter');}
  check('Sample overlap is bounded during multiball',sources.length===8);
  sources[0].onended();audio.currentTime+=.1;
  check('Finished voices release capacity for the chocolate sample',bakeryAudio.play(audio,'chocolate')&&sources[8].buffer===decoded.find(b=>b.url.includes('asmr-chocolate')));
  check('Playback envelopes contain finite values and times',parameters.every(pair=>pair.every(Number.isFinite)));
  check('All approved clips exist as project assets',Object.values(bakeryAudio.files).every(file=>fs.statSync(file).size>1000));
  console.log(`${count} rendering and sampled-audio checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
