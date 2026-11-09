// Rendering only: the tested game physics and collision sizes stay in engine.js.
function backingSize(width,height,ratio=1){
  const density=Math.max(1,Math.min(3,ratio||1));
  return {width:Math.max(1,Math.round(width*density)),height:Math.max(1,Math.round(height*density))};
}
function prepareCanvas(){
  const bounds=canvas.getBoundingClientRect();
  const size=backingSize(bounds.width,bounds.height,window.devicePixelRatio);
  if(canvas.width!==size.width||canvas.height!==size.height){canvas.width=size.width;canvas.height=size.height;}
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
}
function rounded(x,y,w,h,r,fill,stroke) {
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function hamster(b) {
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rotation);
  if(piercing()){ctx.shadowBlur=12;ctx.shadowColor='#e99d64';}
  if(!BakeryArt.sprite(ctx,'hamster',-b.r*1.33,-b.r*1.42,b.r*2.66,b.r*2.84)){
    ctx.fillStyle='#dba976';ctx.beginPath();ctx.arc(-7,-8,5,0,Math.PI*2);ctx.arc(7,-8,5,0,Math.PI*2);ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff0d5';ctx.beginPath();ctx.ellipse(0,4,9,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#69432c';ctx.beginPath();ctx.arc(-4,-2,1.5,0,Math.PI*2);ctx.arc(4,-2,1.5,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function draw() {
  prepareCanvas();
  ctx.fillStyle='#fff0d2';ctx.fillRect(0,0,W,H);ctx.save();
  if(shake>0)ctx.translate(Math.sin(worldTime*130)*shake,Math.cos(worldTime*110)*shake*.5);
  ctx.fillStyle='#c6985720';for(let x=18;x<W;x+=29)for(let y=16;y<H;y+=31)ctx.fillRect(x+(y%5),y,1,1);
  ctx.font='italic 12px Georgia';ctx.fillStyle='#96724f';ctx.textAlign='left';ctx.fillText('Baked with a little love',36,33);
  ctx.textAlign='right';ctx.fillText(`Batch time ${formatTime(levelTime)}`,764,33);
  for(const brick of bricks)if(brick.alive){
    const flavor=brick.explosive?'gift':['butter','cracker','sugar','jam','chocolate'][brick.row%5];
    if(!BakeryArt.sprite(ctx,flavor,brick.x-2,brick.y-5,brick.w+4,brick.h+10)){
      rounded(brick.x,brick.y,brick.w,brick.h,7,brick.explosive?'#e88d91':['#edc27d','#e6ab60','#f6dfb6','#e8a197','#ae7955'][brick.row%5],'#c08e53');ctx.fillStyle='#fff4d9';ctx.textAlign='center';ctx.font='12px Georgia';ctx.fillText(brick.explosive?'✿':'♡',brick.x+brick.w/2,brick.y+17);
    }
    if(brick.maxHp>1){rounded(brick.x+brick.w-23,brick.y+3,20,10,5,'#fff6dfdd');ctx.fillStyle='#906045';for(let i=0;i<brick.hp;i++){ctx.beginPath();ctx.arc(brick.x+brick.w-18+i*5,brick.y+8,1.7,0,Math.PI*2);ctx.fill();}}
    if(brick.hp<brick.maxHp){ctx.strokeStyle='#79503588';ctx.beginPath();ctx.moveTo(brick.x+12,brick.y+2);ctx.lineTo(brick.x+19,brick.y+12);ctx.lineTo(brick.x+14,brick.y+22);ctx.stroke();}
    if(cleanupAnnounced){ctx.strokeStyle='#b65c62';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.strokeRect(brick.x-3,brick.y-4,brick.w+6,brick.h+8);ctx.setLineDash([]);}
  }
  for(const o of obstacles){rounded(o.x,o.y,o.w,o.h,6,o.moving?'#ac7751':'#79543e','#5f3c2b');for(let x=o.x+8;x<o.x+o.w-4;x+=14){ctx.strokeStyle='#f6d7a180';ctx.beginPath();ctx.moveTo(x,o.y+5);ctx.lineTo(x+5,o.y+o.h-5);ctx.stroke();}ctx.fillStyle='#fff0ce';ctx.font='14px Georgia';ctx.textAlign='center';ctx.fillText(o.moving?'↔':'×',o.x+o.w/2,o.y+17);}
  for(const b of balls)b.trail.forEach((p,i)=>{ctx.fillStyle=piercing()?`rgba(222,115,75,${i/b.trail.length*.22})`:`rgba(198,143,84,${i/b.trail.length*.12})`;ctx.beginPath();ctx.arc(p.x,p.y,b.r*i/b.trail.length,0,Math.PI*2);ctx.fill();});
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  for(const drop of drops){
    if(drop.ingredient){
      const ingredient=RecipeData.ingredients.find(item=>item.id===drop.ingredient),rarity=RecipeData.rarities.find(item=>item.id===drop.rarity);
      rounded(drop.x-18,drop.y-18,36,36,12,'#fffaf0',rarity?.color||'#b29169');
      if(!BakeryArt.ingredient(ctx,drop.ingredient,drop.x-16,drop.y-16,32,32)){ctx.fillStyle=rarity?.color||'#9f5962';ctx.font='18px Georgia';ctx.textAlign='center';ctx.fillText(ingredient?.icon||'♡',drop.x,drop.y+6);}
    }else{rounded(drop.x-15,drop.y-13,30,26,10,'#fff6e6','#ca9a72');ctx.fillStyle='#9f5962';ctx.font='bold 17px Georgia';ctx.textAlign='center';ctx.fillText(drop.power.icon,drop.x,drop.y+6);}
  }
  if(shield){ctx.strokeStyle='#b596bd';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(0,H-12);ctx.lineTo(W,H-12);ctx.stroke();ctx.setLineDash([]);}
  const pinWidth=currentLayout().width,pinX=paddle.x+(paddle.w-pinWidth)/2;
  if(wideLeft>0){
    ctx.save();ctx.strokeStyle='#a96848';ctx.lineWidth=2;ctx.lineCap='round';ctx.setLineDash([1,5]);
    for(const [left,right] of [[paddle.x,pinX],[pinX+pinWidth,paddle.x+paddle.w]]){
      ctx.beginPath();ctx.moveTo(left,paddle.y+paddle.h/2);ctx.lineTo(right,paddle.y+paddle.h/2);ctx.stroke();
    }
    ctx.restore();
  }
  if(!BakeryArt.sprite(ctx,'paddle',pinX-8,paddle.y-13,pinWidth+16,paddle.h+26))rounded(pinX,paddle.y,pinWidth,paddle.h,7,'#d8a76a','#a97741');
  balls.forEach(hamster);
  if(combo>1&&comboLeft>0){ctx.textAlign='center';ctx.font='bold 22px Georgia';ctx.fillStyle='#b36457';ctx.fillText(`${combo}× Sweet crunch!`,W/2,390);}
  if(zoomLeft>0){ctx.strokeStyle='#dd8a80';ctx.lineWidth=4;ctx.strokeRect(3,3,W-6,H-6);ctx.textAlign='center';ctx.fillStyle='#b15c60';ctx.font='bold 18px Georgia';ctx.fillText('✦ Sugar-rush zoomies! ✦',W/2,420);}
  if(state==='ready'){ctx.textAlign='center';ctx.font='italic 15px Georgia';ctx.fillStyle='#a46d48';ctx.fillText('Space or tap to serve your hamster',W/2,458);}
  ctx.restore();
}
