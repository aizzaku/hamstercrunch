const assert=require('node:assert/strict');
const {LEVELS,CHAPTERS,CAMPAIGN_VERSION,makeLevel}=require('./levels.js');
let checks=0;
function check(name,test){assert.ok(test,name);checks++;console.log(`PASS ${name}`);}
check('Genesis has 21 distinct trays in three seven-level chapters',LEVELS.length===21&&CHAPTERS.length===3&&new Set(LEVELS.map(l=>l.map.join(''))).size===21&&LEVELS.every((l,i)=>l.chapter===Math.floor(i/7)+1&&l.chapterName===CHAPTERS[l.chapter-1]));
check('Chapter finales arrive at 7, 14 and 21',LEVELS.flatMap((l,i)=>l.finale?[i+1]:[]).join(',')==='7,14,21');
check('Campaign identity is available for run validation',CAMPAIGN_VERSION==='genesis-21-v1');
check('Every level uses valid rows and stays above the return lane',LEVELS.every(l=>l.map.length<=7&&l.map.every(row=>/^[.123#+]{8}$/.test(row)))&&LEVELS.every((_,i)=>{const generated=makeLevel(i);return generated.bricks.length>0&&[...generated.bricks,...generated.obstacles].every(b=>b.x>=41&&b.x+b.w<=759&&b.y+b.h<400);}));
check('All permanent barriers retain open side entry corridors',LEVELS.every(l=>l.map.every(row=>![row[0],row[7]].some(c=>c==='#'||c==='+'))));
check('No full steel wall seals off a tray',LEVELS.every(l=>l.map.every(row=>(row.match(/[#\+]/g)||[]).length<=4&&!/[#+]{5}/.test(row))));
check('Brick workload rises every level and follows the exponential budget',LEVELS.every((l,i)=>l.work>=Math.round(24*1.09**i)&&(!i||l.work>LEVELS[i-1].work)));
check('Ball speed rises gently and paddle stays usable',LEVELS.every((l,i)=>l.speed<=465&&l.width>=94&&(!i||l.speed>LEVELS[i-1].speed&&l.width<=LEVELS[i-1].width)));
check('Difficulty increases substantially across chapters',LEVELS[20].work>=LEVELS[0].work*5&&LEVELS[20].difficulty>5&&LEVELS[7].map.join('').includes('+')&&LEVELS[14].map.join('').includes('#'));
check('Final trays contain challenging armor and moving barriers',LEVELS.slice(14).every((_,i)=>{const l=makeLevel(i+14);return l.bricks.some(b=>b.hp===3)&&l.obstacles.some(o=>o.moving);}));
check('Layout generation is repeatable and does not mutate the templates',JSON.stringify(makeLevel(20))===JSON.stringify(makeLevel(20))&&LEVELS[0].map.join(',')==='11111111,11111111,11111111');
console.log(`${checks} campaign level checks passed.`);
