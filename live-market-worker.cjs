// A single process/replica polls only while players have reserved live orders.
function createLiveMarketWorker(service,{intervalMs=30000,onError=error=>console.error('Live market check failed:',error.message)}={}){
  let running=false,stopped=false;
  async function tick(){
    if(stopped||running||!service.hasLiveOrders())return;
    running=true;try{return await service.processLiveOrders();}catch(error){onError(error);}finally{running=false;}
  }
  const timer=setInterval(tick,intervalMs);timer.unref?.();
  tick();
  return {tick,stop(){stopped=true;clearInterval(timer);}};
}
module.exports={createLiveMarketWorker};
