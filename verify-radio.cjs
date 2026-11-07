const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const source=fs.readFileSync('radio.js','utf8');
let checks=0;
function check(name,value){assert.ok(value,name);checks++;console.log(`PASS ${name}`);}
function setup(saved={}){
  const elements=new Map(),listeners=new Map(),storage=new Map(Object.entries(saved));
  function element(id){
    if(!elements.has(id))elements.set(id,{paused:true,disabled:false,textContent:'',value:'',children:[],attributes:{},append(node){this.children.push(node);},addEventListener(event,fn){listeners.set(`${id}:${event}`,fn);},setAttribute(key,value){this.attributes[key]=value;},getAttribute(key){return this.attributes[key]||null;},async play(){this.paused=false;listeners.get(`${id}:play`)?.();},pause(){this.paused=true;listeners.get(`${id}:pause`)?.();},load(){},set src(value){this.attributes.src=value;},get src(){return this.attributes.src;}});
    return elements.get(id);
  }
  const context=vm.createContext({document:{querySelector:selector=>element(selector.slice(1)),createElement:()=>({value:'',textContent:''})},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},console});
  vm.runInContext(source,context);
  return {element,listeners,storage,run:code=>vm.runInContext(code,context)};
}
(async()=>{
  const app=setup(),audio=app.element('radio-audio');
  const tracks=app.run('RADIO_TRACKS');
  check('All ten tracks have readable titles and valid bundled paths',tracks.length===10&&tracks.every(track=>track.title&&!track.title.includes('_')&&/^assets\/music\/[a-z-]+\.mp3$/.test(track.src)&&fs.statSync(track.src).size>1000000));
  const originals=fs.readdirSync('music').filter(name=>name.endsWith('.mp3'));
  const hash=filename=>createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  check('Bundled tracks preserve all original recordings',tracks.every(track=>{const original=originals.find(name=>name.toLowerCase().replace(/_2026-.+$/,'').replaceAll('_','-')===track.src.split('/').pop().slice(0,-4));return original&&hash('music/'+original)===hash(track.src);}));
  check('Radio waits for player input and avoids preloading audio',audio.paused&&!audio.src&&audio.preload==='none');
  check('Every track appears in the selector',app.element('radio-track').children.length===10);
  await app.run('BurrowRadio.start()');
  check('Explicit play starts the selected real track',!audio.paused&&audio.src===tracks[0].src&&app.run('BurrowRadio.isPlaying()'));
  app.element('radio-track').value='3';await app.listeners.get('radio-track:change')();
  check('Selecting a track preserves active playback',!audio.paused&&audio.src===tracks[3].src&&app.storage.get('hamster-radio-track')==='3');
  app.run('BurrowRadio.pause()');await app.run('BurrowRadio.select(5)');
  check('Selecting while paused does not start music',audio.paused&&audio.src===tracks[5].src);
  app.listeners.get('radio-shuffle:click')();const before=app.run('radioIndex');await app.run('switchTrack(1)');
  check('Shuffle saves its setting and avoids immediate repeats',app.storage.get('hamster-radio-shuffle')==='true'&&app.run('radioIndex')!==before);
  await app.run('switchTrack(-1)');
  check('Previous follows actual playback history in shuffle',app.run('radioIndex')===before);
  app.element('radio-volume').value='62';app.listeners.get('radio-volume:input')();
  check('Volume preference stays independent of effects',audio.volume===.62&&app.storage.get('hamster-radio-volume')==='0.62');
  const restored=setup({'hamster-radio-track':'7','hamster-radio-volume':'0.22','hamster-radio-shuffle':'true'});
  check('Track, shuffle and volume restore without autoplay',restored.run('radioIndex===7&&radioShuffled')&&restored.element('radio-audio').volume===.22&&restored.element('radio-audio').paused);
  check('Invalid saved selection falls back safely',setup({'hamster-radio-track':'not-a-number'}).run('radioIndex')===0);
  app.run('radioShuffled=false');await app.run('BurrowRadio.select(9)');await app.run('BurrowRadio.start()');await app.listeners.get('radio-audio:ended')();
  check('Finished songs advance and wrap through the playlist',app.run('radioIndex')===0&&!audio.paused);
  app.listeners.get('radio-audio:error')();
  check('Audio failures stop playback with a short useful message',audio.paused&&app.element('radio-status').textContent==='Track unavailable');
  audio.play=async()=>{const error=new Error('gesture required');error.name='NotAllowedError';throw error;};
  await app.run('BurrowRadio.start()');
  check('Browser autoplay restrictions ask for a tap',app.element('radio-status').textContent==='Tap play');
  const race=setup();let rejectOld;
  race.element('radio-audio').play=()=>new Promise((_resolve,reject)=>{rejectOld=reject;});
  const pending=race.run('BurrowRadio.start()');
  race.element('radio-audio').play=async()=>{race.element('radio-audio').paused=false;};
  await race.run('BurrowRadio.select(2)');rejectOld(new Error('old load canceled'));await pending;
  check('An old play rejection cannot overwrite the newest track',race.element('radio-status').textContent==='3 / 10'&&race.element('radio-title').textContent===tracks[2].title);
  console.log(`${checks} full music radio checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
