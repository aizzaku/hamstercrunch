// Bundled ElevenLabs tracks. Playback starts only after a player action.
const RADIO_TRACKS = [
  {title:'Burrow Comfort',src:'assets/music/burrow-comfort.mp3'},
  {title:'Pantry Adventure',src:'assets/music/pantry-adventure.mp3'},
  {title:'Tiny Paws Kitchen Dance',src:'assets/music/tiny-paws-kitchen-dance.mp3'},
  {title:'Snack Heist Shuffle',src:'assets/music/snack-heist-shuffle.mp3'},
  {title:'Snack Cupboard Shuffle',src:'assets/music/snack-cupboard-shuffle.mp3'},
  {title:'Moonlit Hamster Garden',src:'assets/music/moonlit-hamster-garden.mp3'},
  {title:'Hamster Tea Rush',src:'assets/music/hamster-tea-rush.mp3'},
  {title:'Biscuits on the Little Line',src:'assets/music/biscuits-on-the-little-line.mp3'},
  {title:'Snack Bowl Groove',src:'assets/music/snack-bowl-groove.mp3'},
  {title:'Homeward Burrow',src:'assets/music/homeward-burrow.mp3'},
];
const radioAudio=document.querySelector('#radio-audio');
const radioPlay=document.querySelector('#radio-play');
const radioPrevious=document.querySelector('#radio-previous');
const radioNext=document.querySelector('#radio-next');
const radioTitle=document.querySelector('#radio-title');
const radioVolume=document.querySelector('#radio-volume');
const radioStatus=document.querySelector('#radio-status');
const radioTrack=document.querySelector('#radio-track');
const radioShuffle=document.querySelector('#radio-shuffle');
function readRadioSetting(key){try{return localStorage.getItem(key);}catch(error){console.warn('Radio setting unavailable:',error);return null;}}
function saveRadioSetting(key,value){try{localStorage.setItem(key,String(value));}catch(error){console.warn('Radio setting could not save:',error);}}
function readRadioVolume(){const stored=readRadioSetting('hamster-radio-volume'),value=stored===null?.35:Number(stored);return Number.isFinite(value)?Math.max(0,Math.min(1,value)):.35;}
const savedRadioIndex=Number(readRadioSetting('hamster-radio-track'));
let radioIndex=Number.isInteger(savedRadioIndex)&&savedRadioIndex>=0&&savedRadioIndex<RADIO_TRACKS.length?savedRadioIndex:0;
let radioShuffled=readRadioSetting('hamster-radio-shuffle')==='true';
let radioWantsPlay=false,radioRequest=0,radioError='';
const radioHistory=[];
radioAudio.volume=readRadioVolume();radioAudio.preload='none';
radioVolume.value=Math.round(radioAudio.volume*100);
if(radioTrack){RADIO_TRACKS.forEach((track,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=track.title;radioTrack.append(option);});}
function updateRadio(){
  const available=RADIO_TRACKS.length>0;
  radioPlay.disabled=!available;radioNext.disabled=radioPrevious.disabled=RADIO_TRACKS.length<2;
  radioTitle.textContent=available?RADIO_TRACKS[radioIndex].title:'No tracks';
  radioStatus.textContent=radioError||(available?`${radioIndex+1} / ${RADIO_TRACKS.length}`:'');
  radioPlay.textContent=radioAudio.paused?'▶':'Ⅱ';
  radioPlay.setAttribute('aria-label',radioAudio.paused?'Play radio':'Pause radio');
  radioPlay.setAttribute('aria-pressed',String(!radioAudio.paused));
  if(radioTrack){radioTrack.value=String(radioIndex);radioTrack.disabled=!available;}
  if(radioShuffle){radioShuffle.disabled=RADIO_TRACKS.length<2;radioShuffle.setAttribute('aria-pressed',String(radioShuffled));}
}
async function playRadio(){
  if(!RADIO_TRACKS.length)return;
  const request=++radioRequest;radioWantsPlay=true;radioError='';
  if(!radioAudio.getAttribute('src'))radioAudio.src=RADIO_TRACKS[radioIndex].src;
  try{await radioAudio.play();if(request!==radioRequest&&!radioWantsPlay)radioAudio.pause();if(request===radioRequest)updateRadio();}
  catch(error){if(request!==radioRequest)return;radioWantsPlay=false;radioError=error.name==='NotAllowedError'?'Tap play':'Track unavailable';console.warn('Radio could not play:',error);updateRadio();}
}
function pauseRadio(){radioRequest++;radioWantsPlay=false;radioAudio.pause();updateRadio();}
async function selectRadioTrack(index,remember=true,continuePlaying=radioWantsPlay||!radioAudio.paused){
  if(!Number.isInteger(index)||index<0||index>=RADIO_TRACKS.length)return;
  if(remember&&index!==radioIndex){radioHistory.push(radioIndex);if(radioHistory.length>100)radioHistory.shift();}
  radioRequest++;radioError='';radioAudio.pause();radioWantsPlay=continuePlaying;radioIndex=index;
  radioAudio.src=RADIO_TRACKS[radioIndex].src;radioAudio.load?.();
  saveRadioSetting('hamster-radio-track',radioIndex);updateRadio();
  if(continuePlaying)await playRadio();
}
async function switchTrack(direction){
  if(RADIO_TRACKS.length<2)return;
  let next;
  if(direction<0&&radioHistory.length)next=radioHistory.pop();
  else if(direction>0&&radioShuffled)next=(radioIndex+1+Math.floor(Math.random()*(RADIO_TRACKS.length-1)))%RADIO_TRACKS.length;
  else next=(radioIndex+direction+RADIO_TRACKS.length)%RADIO_TRACKS.length;
  await selectRadioTrack(next,direction>0);
}
radioPlay.addEventListener('click',()=>{if(radioWantsPlay||!radioAudio.paused)pauseRadio();else playRadio();});
radioPrevious.addEventListener('click',()=>switchTrack(-1));radioNext.addEventListener('click',()=>switchTrack(1));
radioTrack?.addEventListener('change',()=>selectRadioTrack(Number(radioTrack.value)));
radioShuffle?.addEventListener('click',()=>{radioShuffled=!radioShuffled;saveRadioSetting('hamster-radio-shuffle',radioShuffled);updateRadio();});
radioVolume.addEventListener('input',()=>{const value=Number(radioVolume.value);radioAudio.volume=Number.isFinite(value)?Math.max(0,Math.min(1,value/100)):.35;saveRadioSetting('hamster-radio-volume',radioAudio.volume);});
radioAudio.addEventListener('play',updateRadio);radioAudio.addEventListener('pause',()=>{if(!radioAudio.ended)radioWantsPlay=false;updateRadio();});
radioAudio.addEventListener('ended',()=>{if(!radioWantsPlay)return;if(RADIO_TRACKS.length>1)switchTrack(1);else{radioAudio.currentTime=0;playRadio();}});
radioAudio.addEventListener('error',()=>{radioRequest++;radioWantsPlay=false;radioAudio.pause();radioError='Track unavailable';updateRadio();});
const BurrowRadio={start:playRadio,pause:pauseRadio,select:selectRadioTrack,tracks:RADIO_TRACKS,isPlaying:()=>!radioAudio.paused};
updateRadio();
