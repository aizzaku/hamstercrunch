const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let count=0;
function check(name,condition){assert.ok(condition,name);console.log(`PASS ${name}`);count++;}
const elements=new Map(),storage=new Map(),listeners=new Map();
function element(id){if(!elements.has(id))elements.set(id,{paused:true,disabled:false,textContent:'',value:0,attributes:{},addEventListener(name,fn){listeners.set(`${id}:${name}`,fn);},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]||null;},async play(){this.paused=false;listeners.get(`${id}:play`)?.();},pause(){this.paused=true;listeners.get(`${id}:pause`)?.();},set src(v){this.attributes.src=v;},get src(){return this.attributes.src;}});return elements.get(id);}
const context=vm.createContext({document:{querySelector:s=>element(s.slice(1))},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},console});
vm.runInContext(fs.readFileSync('radio.js','utf8').replace(/const RADIO_TRACKS = \[[\s\S]*?\n\];/, 'const RADIO_TRACKS = [];'),context);
(async()=>{
  check('Empty radio does not offer fake playback',element('radio-play').disabled&&element('radio-next').disabled&&element('radio-previous').disabled);
  check('Default volume is gentle and separate from effects',element('radio-audio').volume===.35);
  storage.set('hamster-radio-volume','invalid');check('Malformed saved volume recovers',vm.runInContext('readRadioVolume()',context)===.35);
  storage.set('hamster-radio-volume','2');check('Saved volume clamps to safe range',vm.runInContext('readRadioVolume()',context)===1);
  vm.runInContext("RADIO_TRACKS.push({title:'First Crumbs',src:'assets/music/first-crumbs.mp3'},{title:'Sunflower Shuffle',src:'assets/music/sunflower-shuffle.mp3'});updateRadio();",context);
  check('Configured tracks enable controls and show title',!element('radio-play').disabled&&!element('radio-next').disabled&&element('radio-title').textContent==='First Crumbs');
  await vm.runInContext('playRadio()',context);check('Playback starts selected track',!element('radio-audio').paused&&element('radio-audio').src==='assets/music/first-crumbs.mp3');
  await vm.runInContext('switchTrack(1)',context);check('Next keeps playback and changes title',!element('radio-audio').paused&&element('radio-title').textContent==='Sunflower Shuffle');
  await vm.runInContext('switchTrack(1)',context);check('Next wraps to first track',element('radio-title').textContent==='First Crumbs');
  element('radio-audio').pause();await vm.runInContext('switchTrack(-1)',context);check('Previous wraps without starting paused audio',element('radio-audio').paused&&element('radio-title').textContent==='Sunflower Shuffle');
  element('radio-volume').value=60;listeners.get('radio-volume:input')();check('Music volume persists independently',element('radio-audio').volume===.6&&storage.get('hamster-radio-volume')==='0.6');
  element('radio-audio').play=async()=>{throw new Error('Expected test failure');};await vm.runInContext('playRadio()',context);check('Unavailable track produces honest status',element('radio-status').textContent==='Track unavailable');
  for(const file of ['bakery-background.png','bakery-sprites.png','burrow-radio.png'])check(`${file} is a real PNG`,fs.readFileSync(`assets/${file}`).subarray(1,4).toString()==='PNG');
  console.log(`${count} bakery and radio checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
