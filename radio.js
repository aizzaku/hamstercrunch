// Drop finished files into assets/music and add {title, src} entries here.
// The empty player never pretends that music is playing.
const RADIO_TRACKS = [];
const radioAudio = document.querySelector('#radio-audio');
const radioPlay = document.querySelector('#radio-play');
const radioPrevious = document.querySelector('#radio-previous');
const radioNext = document.querySelector('#radio-next');
const radioTitle = document.querySelector('#radio-title');
const radioVolume = document.querySelector('#radio-volume');
const radioStatus = document.querySelector('#radio-status');
let radioIndex = 0;
function readRadioVolume() {
  try {const stored=localStorage.getItem('hamster-radio-volume');const value=stored===null?.35:Number(stored);return Number.isFinite(value)?Math.max(0,Math.min(1,value)):.35;}
  catch(error){console.warn('Radio volume could not be read:',error);return .35;}
}
radioAudio.volume = readRadioVolume();
radioVolume.value = Math.round(radioAudio.volume*100);
function updateRadio() {
  const available = RADIO_TRACKS.length > 0;
  radioPlay.disabled = !available;
  radioNext.disabled = radioPrevious.disabled = RADIO_TRACKS.length < 2;
  radioTitle.textContent = available ? RADIO_TRACKS[radioIndex].title : 'Your cozy soundtrack goes here';
  radioStatus.textContent = available ? `${radioIndex+1} / ${RADIO_TRACKS.length}` : 'Fresh tunes coming soon';
  radioPlay.textContent = radioAudio.paused ? '▶' : 'Ⅱ';
  radioPlay.setAttribute('aria-label',radioAudio.paused?'Play radio':'Pause radio');
  radioPlay.setAttribute('aria-pressed',String(!radioAudio.paused));
}
async function playRadio() {
  if(!RADIO_TRACKS.length)return;
  try {if(!radioAudio.getAttribute('src'))radioAudio.src=RADIO_TRACKS[radioIndex].src;await radioAudio.play();}
  catch(error){console.warn('Radio could not play:',error);radioStatus.textContent='Track unavailable. Try again.';}
}
async function switchTrack(direction) {
  if(RADIO_TRACKS.length<2)return;
  const wasPlaying=!radioAudio.paused;
  radioIndex=(radioIndex+direction+RADIO_TRACKS.length)%RADIO_TRACKS.length;
  radioAudio.src=RADIO_TRACKS[radioIndex].src;updateRadio();
  if(wasPlaying)await playRadio();
}
radioPlay.addEventListener('click',()=>{if(radioAudio.paused)playRadio();else radioAudio.pause();});
radioPrevious.addEventListener('click',()=>switchTrack(-1));
radioNext.addEventListener('click',()=>switchTrack(1));
radioVolume.addEventListener('input',()=>{radioAudio.volume=Number(radioVolume.value)/100;try{localStorage.setItem('hamster-radio-volume',String(radioAudio.volume));}catch(error){console.warn('Radio volume could not be saved:',error);}});
radioAudio.addEventListener('play',updateRadio);radioAudio.addEventListener('pause',updateRadio);
radioAudio.addEventListener('ended',()=>{if(RADIO_TRACKS.length>1){radioIndex=(radioIndex+1)%RADIO_TRACKS.length;radioAudio.src=RADIO_TRACKS[radioIndex].src;}updateRadio();playRadio();});
radioAudio.addEventListener('error',()=>{updateRadio();radioStatus.textContent='Track unavailable. Try another.';});
updateRadio();
