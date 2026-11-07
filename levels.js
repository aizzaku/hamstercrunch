// Fixed layouts make campaign runs comparable. # = steel, + = moving steel.
// Digits are brick health; dots are open lanes.
const CAMPAIGN_VERSION='genesis-21-v1';
const CHAPTERS=['Morning Crumbs','The Busy Kitchen','Midnight Feast'];
const LEVELS = [
  {name:'First crumbs', speed:325, width:124, map:['11111111','11111111','11111111']},
  {name:'Snack stairs', speed:338, width:122, map:['1......1','11....11','111..111','11111111']},
  {name:'Hard shells', speed:350, width:120, map:['12211221','11111111','.111111.','..1111..']},
  {name:'Steel pantry', speed:360, width:118, map:['21122112','11111111','.#....#.','11.11.11']},
  {name:'The burrow', speed:370, width:116, map:['..2222..','.211112.','211..112','11.##.11','111..111']},
  {name:'Moving day', speed:380, width:114, map:['22222222','12111121','........','...++...','11....11']},
  {name:'Split decision', speed:390, width:112, map:['221..122','121..121','11.##.11','21....12','11.11.11']},
  {name:'Crunch factory', speed:402, width:110, map:['23222232','11211211','.#....#.','...++...','111..111']},
  {name:'Vault crackers', speed:414, width:108, map:['32322323','21.11.12','.#....#.','12.++.21','11....11','..1111..']},
  {name:'Genesis block', speed:425, width:106, map:['33322333','22111122','1.#..#.1','21....12','...++...','12111121']},
  {name:'Sugar shutters',map:['22222222','22122122','1.#..#.1','22....22','..+..+..','11111111']},
  {name:'Caramel crossing',map:['22222222','22.22.22','112..211','.#.++.#.','221..122','11111111']},
  {name:'Cookie carousel',map:['22222222','12222221','21....12','..+..+..','12.##.21','22222222']},
  {name:'Golden hour',map:['22222222','22211222','22.##.22','11....11','.+....+.','22222222','111..111']},
  {name:'Midnight morsels',map:['22222222','22222222','22.22.22','1.#..#.1','..+..+..','22222222','111..111']},
  {name:'Wafer fortress',map:['22222222','22222222','22....22','2.#..#.2','22.++.22','22222222','11111111']},
  {name:'Honeycomb havoc',map:['22222222','22222222','22.22.22','2.#..#.2','12.++.21','22222222','22222222']},
  {name:'Rolling thunder',map:['22222222','22222222','22.22.22','22....22','.+.##.+.','22222222','22222222']},
  {name:'Chocolate labyrinth',map:['22222222','22222222','22.##.22','222..222','2.+..+.2','22222222','22222222']},
  {name:'Last call',map:['22222222','22222222','222..222','2.#..#.2','22.++.22','22222222','22222222']},
  {name:'The Genesis Feast',map:['22222222','22222222','22222222','22.##.22','2.+..+.2','22222222','22222222']},
].map((layout,index)=>{
  // Exponential workload, rather than exponential speed: each new tray asks for
  // about 9% more brick work. Existing shapes keep their aimed-shot shortcuts.
  const target=Math.round(24*1.09**index),map=layout.map.map(row=>[...row]);
  const cells=map.flatMap((row,y)=>row.flatMap((cell,x)=>/^[1-3]$/.test(cell)?[{x,y}]:[]));
  let work=cells.reduce((sum,{x,y})=>sum+Number(map[y][x]),0);
  // Spread extra armor across the tray, not only along its upper edge.
  for(let pass=0;work<target&&pass<3;pass++){
    for(let offset=0;offset<cells.length&&work<target;offset++){
      const {x,y}=cells[(offset+index*7)%cells.length];
      if(Number(map[y][x])<3){map[y][x]=String(Number(map[y][x])+1);work++;}
    }
  }
  return {...layout,map:map.map(row=>row.join('')),speed:Math.round(325*1.018**index),width:124-Math.round(index*1.5),chapter:Math.floor(index/7)+1,chapterName:CHAPTERS[Math.floor(index/7)],finale:(index+1)%7===0,difficulty:Number((1.09**index).toFixed(2)),work};
});

function makeLevel(index, customLayout=null) {
  const layout = customLayout || LEVELS[index];
  if (!layout) throw new RangeError('Unknown Genesis level');
  const bricks = [], obstacles = [];
  layout.map.forEach((row, y) => [...row].forEach((cell, x) => {
    const block = {x:41+x*91,y:66+y*34,w:81,h:24,row:y,alive:true};
    if (/^[1-3]$/.test(cell)) bricks.push({...block,hp:Number(cell),maxHp:Number(cell),explosive:false});
    if (cell==='#' || cell==='+') obstacles.push({...block,baseX:block.x,moving:cell==='+',phase:x<4 ? 0 : Math.PI});
  }));
  // A few fixed seed crates reward aimed shots and create repeatable chains.
  const crateCount=index<3?1:index<7?2:3;
  const used=new Set();
  for(let i=0;i<crateCount;i++){
    const target=Math.min(bricks.length-1,Math.floor(bricks.length*(i+1)/(crateCount+1)));
    if(!used.has(target)){bricks[target].explosive=true;used.add(target);}
  }
  return {bricks,obstacles,...layout};
}

// Same settlement seed, same tray for every baker. Kept separate from campaign ranks.
function specialLayout(seed){
  let value=2166136261;
  for(const char of String(seed))value=Math.imul(value^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const map=Array.from({length:5},(_,y)=>Array.from({length:8},(_,x)=>{
    if(y===3&&(x===2||x===5))return '#';
    return random()<.18?'.':String(1+Math.floor(random()*2));
  }).join(''));
  map[0]='11111111';
  return {name:'Squeektoshi’s Special Batch',speed:370,width:118,map};
}
if(typeof module!=='undefined'&&module.exports)module.exports={LEVELS,CHAPTERS,CAMPAIGN_VERSION,makeLevel,specialLayout};
