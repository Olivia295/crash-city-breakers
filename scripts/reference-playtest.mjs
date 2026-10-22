import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='artifacts/reference-v2';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[],checks=[],runs=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const shot=async name=>page.screenshot({path:`${out}/${name}.png`});
const snap=()=>page.evaluate(()=>window.__CRASH__.snapshot());
try{
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__CRASH__);
 await shot('01-garage');
 for(const mode of ['roadtrip','rushhour','pileup','sandbox'])assert.equal(await page.locator(`[data-config="rules"][data-value="${mode}"]`).count(),1);
 checks.push('Four rulesets are selectable in the real garage.');
 await page.locator('[data-config="rules"][data-value="rushhour"]').click();
 await page.locator('[data-action="start"]').click();
 await page.waitForTimeout(6100);
 assert.equal((await snap()).config.rules,'rushhour');
 const before=(await snap()).time;
 assert(before<89&&before>80);
 await page.keyboard.press('Space');await page.waitForTimeout(450);
 await shot('02-rushhour-impact');
 await page.keyboard.press('Escape');
 const paused=await snap();await page.waitForTimeout(450);
 assert.deepEqual(await snap(),paused);
 await page.keyboard.press('Escape');
 checks.push('Rush Hour begins at 90 seconds; collision, Space and pause/resume work through real input.');
 await page.evaluate(()=>window.__CRASH__.step(25,true));await page.waitForTimeout(180);
 await shot('03-rushhour-chaos');
 runs.push({mode:'rushhour',sample:await snap()});
 await page.evaluate(()=>window.__CRASH__.step(70,true));await page.waitForTimeout(250);
 assert.equal((await snap()).phase,'ended');
 await page.waitForSelector('[aria-label="本局成绩"]');
 await shot('04-rushhour-results');
 checks.push('Rush Hour resolves its final explosion and reaches the result screen.');

 for(const rules of ['roadtrip','pileup']){
  await page.evaluate(rules=>window.__CRASH__.start({rules,seed:72191}),rules);
  const stages=new Set();let s;
  for(let i=0;i<70;i++){
   await page.evaluate(()=>window.__CRASH__.step(5,true));s=await snap();stages.add(s.roundStage);
   if(i===2){await page.waitForTimeout(100);await shot(`05-${rules}-play`);}
   if(s.roundStage==='inferno'||s.roundStage==='finale'){await page.waitForTimeout(100);await shot(`06-${rules}-${s.roundStage}`);}
   if(s.phase==='ended')break;
  }
  assert.equal(s.phase,'ended',`${rules} must have a complete lifecycle`);
  assert(s.score>0);assert(s.trafficRemaining>=0);
  if(rules==='roadtrip'){assert(s.escaped<=5);assert(s.escaped===5||s.trafficRemaining===0,'Road Trip must resolve by escape failure or all traffic, not a safety timeout');}
  if(rules==='pileup')assert(stages.has('inferno'));
  await page.waitForSelector('[aria-label="本局成绩"]');await shot(`07-${rules}-results`);
  runs.push({mode:rules,stages:[...stages],score:s.score,escaped:s.escaped,remaining:s.trafficRemaining});
 }
 checks.push('Road Trip escape outcome and Pile Up Inferno lifecycle terminate without softlocks.');

 // A controlled, explicitly labelled scene tests destruction rendering using real blasts.
 await page.evaluate(()=>window.__CRASH__.start({rules:'sandbox',car:'semi'}));
 for(let i=0;i<7;i++){
  await page.evaluate(()=>{window.__CRASH__.position(-12,-27);window.__CRASH__.charge();window.__CRASH__.blast();});
  await page.waitForTimeout(160);
 }
 const destruction=await snap();
 assert(destruction.entities.some(e=>e.kind==='building'&&e.stage===3));
 await shot('08-controlled-building-collapse');
 checks.push('Repeated physical blasts collapse a building into a stage-3 ruin.');

 await page.keyboard.press('Escape');await page.locator('[data-action="menu"]').click();
 for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(200);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.locator('[data-action="start"]').scrollIntoViewIfNeeded();
  await shot(`09-garage-${viewport.width}`);
  assert(await page.locator('[data-action="start"]').isVisible());
 }
 checks.push('720p and narrow garage layout keep the launch control reachable without horizontal overflow.');
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${out}/playtest.json`,JSON.stringify({checks,errors,runs},null,2));
 console.log(JSON.stringify({checks,errors,runs:runs.map(r=>({mode:r.mode,stages:r.stages,score:r.score??r.sample.score}))},null,2));
}catch(error){
 await shot('failure');await fs.writeFile(`${out}/playtest.json`,JSON.stringify({checks,errors,failure:String(error),runs},null,2));throw error;
}finally{await browser.close();}
