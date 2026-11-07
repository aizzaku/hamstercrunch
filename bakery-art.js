// Art is loaded once; gameplay stays available while images load or if one fails.
const BakeryArt = (() => {
  const atlas = document.createElement('img');
  let ready = false;
  atlas.onload = () => { ready = true; };
  atlas.onerror = () => console.warn('Bakery sprites unavailable; using drawn fallbacks.');
  atlas.src = 'assets/bakery-sprites.png';
  // Normalized bounds within the original four-column, two-row transparent atlas.
  const regions = {
    hamster:[.027,.067,.195,.389], paddle:[.26,.185,.231,.129],
    butter:[.519,.151,.211,.21], cracker:[.768,.15,.212,.214],
    sugar:[.01,.632,.22,.266], jam:[.269,.63,.208,.267],
    chocolate:[.519,.633,.216,.267], gift:[.757,.603,.232,.301],
  };
  function fitRect(sourceWidth,sourceHeight,x,y,w,h) {
    const scale=Math.min(w/sourceWidth,h/sourceHeight);
    const width=sourceWidth*scale,height=sourceHeight*scale;
    return {x:x+(w-width)/2,y:y+(h-height)/2,width,height};
  }
  function sprite(ctx,name,x,y,w,h) {
    if (!ready) return false;
    const [sx,sy,sw,sh] = regions[name];
    const sourceWidth=sw*atlas.naturalWidth,sourceHeight=sh*atlas.naturalHeight;
    const target=fitRect(sourceWidth,sourceHeight,x,y,w,h);
    ctx.drawImage(atlas,sx*atlas.naturalWidth,sy*atlas.naturalHeight,sourceWidth,sourceHeight,target.x,target.y,target.width,target.height);
    return true;
  }
  return {sprite,fitRect};
})();
