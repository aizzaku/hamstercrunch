// Approved ElevenLabs ASMR clips, decoded once and played through Web Audio.
const BakeryAudio=(()=>{
  const files={cookie:'assets/sfx/asmr-cookie.mp3',cracker:'assets/sfx/asmr-cracker.mp3',chocolate:'assets/sfx/asmr-chocolate.mp3'};
  const profiles={
    butter:{sample:'cookie',rate:1,gain:.65},
    cracker:{sample:'cracker',rate:1,gain:.6},
    sugar:{sample:'cookie',rate:1.06,gain:.45},
    jam:{sample:'cookie',rate:.94,gain:.6},
    chocolate:{sample:'chocolate',rate:1,gain:.65},
    gift:{sample:'cracker',rate:.92,gain:.55},
    wood:{sample:'chocolate',rate:.75,gain:.13,duration:.11},
  };
  let context=null,output=null,loading=null,voices=0;
  const buffers=new Map(),lastPlayed=new Map();
  function load(audio){
    if(context===audio&&loading)return loading;
    context=audio;buffers.clear();lastPlayed.clear();voices=0;
    const compressor=audio.createDynamicsCompressor();
    compressor.threshold.value=-16;compressor.knee.value=18;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;
    output=audio.createGain();output.gain.value=.6;output.connect(compressor);compressor.connect(audio.destination);
    loading=Promise.all(Object.entries(files).map(async([name,url])=>{
      const response=await fetch(url);
      if(!response.ok)throw new Error(`Could not load ${name} crunch: HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();
      buffers.set(name,await audio.decodeAudioData(bytes));
    })).catch(error=>{loading=null;buffers.clear();throw error;});
    return loading;
  }
  function play(audio,flavor,damaged=false){
    if(!audio||audio!==context||audio.state!=='running')return false;
    const profile=profiles[flavor]||profiles.butter,buffer=buffers.get(profile.sample);
    if(!buffer)return false;
    const now=audio.currentTime;
    if(voices>=8||now-(lastPlayed.get(flavor)??-Infinity)<.065)return false;
    lastPlayed.set(flavor,now);
    const source=audio.createBufferSource(),gain=audio.createGain();
    source.buffer=buffer;source.playbackRate.value=profile.rate*(.99+Math.random()*.02);
    const duration=Math.min(buffer.duration/source.playbackRate.value,damaged?.28:profile.duration||1.2);
    gain.gain.setValueAtTime(profile.gain*(damaged?.45:1),now);
    gain.gain.setValueAtTime(profile.gain*(damaged?.45:1),now+Math.max(0,duration-.035));
    gain.gain.linearRampToValueAtTime(0,now+duration);
    source.connect(gain);gain.connect(output);voices++;
    source.onended=()=>{voices--;source.disconnect();gain.disconnect();};
    source.start(now);source.stop(now+duration);return true;
  }
  function cue(audio,frequency,duration=.12){
    if(!audio||audio.state!=='running'||audio!==context)return;
    // Quiet oven-bell style cues; food impacts always use the approved samples.
    for(const [partial,volume] of [[1,.025],[2.76,.009]]){
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.type='sine';oscillator.frequency.value=frequency*partial;
      gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+Math.max(.12,duration));
      oscillator.connect(gain);gain.connect(output);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start();oscillator.stop(audio.currentTime+Math.max(.12,duration));
    }
  }
  function setMuted(muted){if(output)output.gain.value=muted?0:.6;}
  return {play,load,cue,setMuted,profiles,files};
})();
