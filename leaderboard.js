/* Shared bakery rankings. Names are rendered as text, never HTML. */
const Leaderboards=(()=>{
  const dialog=document.querySelector('#leaderboards');
  const panel=document.querySelector('#rankings-panel');
  const choices=document.querySelector('#ranking-choices');
  const summary=document.querySelector('#ranking-summary');
  const status=document.querySelector('#ranking-status');
  const results=document.querySelector('#ranking-results');
  const refresh=document.querySelector('#refresh-rankings');
  const tabs=[...document.querySelectorAll('[data-ranking-tab]')];
  const groups={arcade:['genesis','speed','special'],bakery:['cooks','sells','fortune'],collection:['collection']};
  const boards={
    genesis:{name:'Genesis Champions',group:'arcade',description:'Highest clear. Fastest time breaks ties.',empty:'Clear a level to enter.',metric:'Run time'},
    speed:{name:'Speed Bakers',group:'arcade',description:'Fastest 21-level finish.',empty:'Finish all 21 levels to enter.',metric:'Finish time'},
    special:{name:'Special Batch',group:'arcade',description:'Fastest current Special Batch clear.',empty:'Clear the Special Batch to enter.',metric:'Clear time'},
    cooks:{name:'Master Bakers',group:'bakery',description:'Most treats baked.',empty:'Bake a batch to enter.',metric:'Treats baked'},
    sells:{name:'Busy Counter',group:'bakery',description:'Most treats sold.',empty:'Sell a treat to enter.',metric:'Treats sold'},
    fortune:{name:'Bakery Fortune',group:'bakery',description:'Lifetime points earned.',empty:'Sell a treat to earn points.',metric:'Points earned'},
    collection:{name:'Recipe Collectors',group:'collection',description:'Most unique recipes baked.',empty:'Bake a recipe to begin.',metric:'Recipes baked'},
  };
  let group='arcade',board='genesis',resume=false,controller=null,sequence=0;
  const number=value=>Number.isFinite(value)?Math.max(0,value).toLocaleString():'0';
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function time(value){return Number.isFinite(value)&&value>=0?formatTime(value):'—';}
  function renderControls(){
    tabs.forEach(tab=>{const selected=tab.dataset.rankingTab===group;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
    panel.setAttribute('aria-labelledby',`ranking-tab-${group}`);
    choices.replaceChildren();
    for(const id of groups[group]){
      const button=el('button','ranking-choice',boards[id].name);button.type='button';button.setAttribute('aria-pressed',String(id===board));
      button.addEventListener('click',()=>{board=id;renderControls();load();});choices.append(button);
    }
    summary.textContent=boards[board].description;
  }
  function renderRows(data){
    results.replaceChildren();
    const rows=Array.isArray(data.rows)?data.rows.slice(0,25):[];
    if(!rows.length){const empty=el('div','rankings-empty');empty.append(el('span','ranking-empty-cookie','✿'),el('h3','','No scores yet'),el('p','',boards[board].empty));results.append(empty);return;}
    const table=el('table','ranking-table');table.setAttribute('aria-label',boards[board].name);
    const head=el('thead'),heading=el('tr');
    const headers=['Rank','Baker'];if(board==='genesis')headers.push('Level cleared');headers.push(boards[board].metric);
    headers.forEach(label=>{const th=el('th','',label);th.scope='col';heading.append(th);});head.append(heading);table.append(head);
    const body=el('tbody');
    for(const row of rows){
      const tr=el('tr',row.isYou?'ranking-you':'');
      tr.append(el('td','ranking-position',number(row.rank)));
      const baker=el('td','ranking-baker');baker.append(el('span','',typeof row.name==='string'?row.name:'Little Baker'));
      if(row.isYou)baker.append(el('small','ranking-you-label','You'));tr.append(baker);
      if(board==='genesis')tr.append(el('td','ranking-progress',`${number(row.reached)} / 21`));
      const value=['genesis','speed','special'].includes(board)?time(row.time):board==='collection'?`${number(row.value)} / 12`:number(row.value);
      tr.append(el('td','ranking-value',value));body.append(tr);
    }
    table.append(body);results.append(table);
    if(data.viewer&&!rows.some(row=>row.isYou)){
      const you=data.viewer;const value=['genesis','speed','special'].includes(board)?time(you.time):number(you.value);
      results.append(el('p','ranking-own-place',`Your place: #${number(you.rank)} · ${you.name||'Little Baker'} · ${board==='genesis'?`${number(you.reached)} / 21 cleared · `:''}${value}`));
    }
  }
  async function load(){
    if(controller)controller.abort();const requestController=new AbortController();controller=requestController;
    const request=++sequence,requestedBoard=board;
    const timeout=setTimeout(()=>requestController.abort(),12000);
    panel.setAttribute('aria-busy','true');refresh.disabled=true;status.textContent='Loading…';results.replaceChildren();
    try{
      const response=await fetch(`/api/leaderboards?board=${encodeURIComponent(requestedBoard)}`,{signal:requestController.signal,cache:'no-store'});
      if(!response.ok)throw new Error('Rankings unavailable. Retry.');
      const data=await response.json();if(request!==sequence)return;
      renderRows(data);status.textContent='Top 25 · Updated';
    }catch(error){
      if(request!==sequence||!dialog.open)return;
      status.textContent=error.name==='AbortError'?'Timed out. Refresh to retry.':'Rankings unavailable. Refresh to retry.';
      const retry=el('div','rankings-empty');retry.append(el('h3','','Board needs a moment'),el('p','','Refresh to retry.'));results.replaceChildren(retry);
    }finally{
      clearTimeout(timeout);if(request===sequence){panel.setAttribute('aria-busy','false');refresh.disabled=false;}
    }
  }
  function open(){resume=state==='playing';if(resume)pause();keys.clear();renderControls();dialog.showModal();load();}
  document.querySelector('#open-rankings').addEventListener('click',open);
  document.querySelector('#close-rankings').addEventListener('click',()=>dialog.close());
  refresh.addEventListener('click',load);
  dialog.addEventListener('close',()=>{sequence++;controller?.abort();keys.clear();if(resume&&state==='paused')action();resume=false;canvas.focus();});
  tabs.forEach((tab,index)=>{
    function select(){group=tab.dataset.rankingTab;board=groups[group][0];renderControls();load();}
    tab.addEventListener('click',select);
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      group=tabs[next].dataset.rankingTab;board=groups[group][0];renderControls();tabs[next].focus();load();
    });
  });
  return {open,isOpen:()=>dialog.open};
})();
