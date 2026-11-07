/* One short tour, then contextual help after the first saved clear. */
const Onboarding=(()=>{
  const dialog=document.querySelector('#first-run');
  const title=document.querySelector('#tour-title'),copy=document.querySelector('#tour-copy'),stepLabel=document.querySelector('#tour-step');
  const next=document.querySelector('#tour-next'),skip=document.querySelector('#tour-skip');
  const key='hamster-crunch-tour-v1',basketKey='hamster-crunch-basket-tip-v1';
  const steps=[['Move your paws','Mouse, arrows or drag. Keep the hamster bouncing.','↔'],['Launch & crunch','Press Space or tap. Clear the tray.','✦'],['Catch the good stuff','Catch power-ups. Charge Zoomies. Tap it or press Space.','×3']];
  let index=0,resume=false;
  function read(name){try{return localStorage.getItem(name);}catch(error){console.warn('Tutorial preference unavailable:',error);return null;}}
  function remember(name){try{localStorage.setItem(name,'1');}catch(error){console.warn('Tutorial preference could not save:',error);}}
  function render(){title.textContent=steps[index][0];copy.textContent=steps[index][1];document.querySelector('#tour-symbol').textContent=steps[index][2];stepLabel.textContent=`${index+1} / ${steps.length}`;next.textContent=index===steps.length-1?'Let’s play':'Next';}
  function open(){if(dialog.open)return;resume=state==='playing';if(resume)pause();keys.clear();index=0;render();dialog.showModal();}
  function finish(){remember(key);dialog.close();}
  next.addEventListener('click',()=>{if(index<steps.length-1){index++;render();}else finish();});
  skip.addEventListener('click',finish);dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
  dialog.addEventListener('close',()=>{keys.clear();if(resume&&state==='paused')action();resume=false;canvas.focus();});
  document.querySelector('#replay-tutorial').addEventListener('click',()=>{const wasPlaying=menuPaused;menuPaused=false;ui.details.close();open();resume=wasPlaying;});
  function firstClear(){if(read(basketKey))return;remember(basketKey);document.querySelector('#bakery-nudge').hidden=false;}
  document.querySelector('#tip-bake').addEventListener('click',()=>{document.querySelector('#bakery-nudge').hidden=true;RecipeProfile.open();});
  document.querySelector('#tip-dismiss').addEventListener('click',()=>{document.querySelector('#bakery-nudge').hidden=true;});
  if(!read(key))open();
  return {open,isOpen:()=>dialog.open,firstClear};
})();
