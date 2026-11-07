/* Commands are serialized so a quick clear cannot overtake its run creation. */
function createBakeryClient(storage,onChange){
  const local=createRecipeBox(storage);
  let profile=local.snapshot(),queue=Promise.resolve(),ready;
  async function request(url,body){
    const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||data.message||'The bakery could not save that action.');
    if(data.profile){profile=data.profile;onChange();}return data;
  }
  ready=(async()=>{
    const data=await request('/api/profile');
    if(data.needsImport){
      const raw=storage.getItem('hamster-crunch-recipe-box-v1');
      if(raw){const save=JSON.parse(raw);if(save.version!==1)throw new Error('Your original save was preserved. Its format needs attention.');await request('/api/profile',{action:'import',args:[save]});}
    }
  })().catch(error=>{profile.readOnly=true;profile.warning=`Bakery offline: ${error.message} Reload to reconnect. Your original browser save is preserved.`;onChange();throw error;});
  // Initialization errors are visible in the profile; avoid an unhandled rejection.
  ready.catch(()=>{});
  function command(action,args=[]){
    const result=queue.then(()=>ready).then(async()=>request('/api/profile',{action,args:await Promise.all(args)})).then(data=>data.result);
    queue=result.catch(()=>{});return result;
  }
  return {snapshot:()=>profile,ready,request,settle:()=>queue.then(()=>ready),
    startRun:()=>command('startRun'),awardLevel:(id,level,elapsed)=>command('awardLevel',[id,level,elapsed]),
    startSpecial:seed=>command('startSpecial',[seed]).then(result=>{if(!result.ok)throw new Error(result.message);return result.runId;}),
    awardSpecial:(id,elapsed)=>command('awardSpecial',[id,elapsed]),
    bake:id=>command('bake',[id]),fulfill:id=>command('fulfill',[id]),
    buyIngredient:id=>command('buyIngredient',[id]),rename:name=>command('rename',[name])};
}
