import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='artifacts/reference-v2';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__CRASH__);
 // Fixtures position real simulation entities; effects and damage are not mocked.
 for(const kind of ['pizza','bank','ambulance','bulldozer','missile','icecream']){
  const initial=await page.evaluate(kind=>{
   window.__CRASH__.start({rules:'rushhour',car:'semi'});window.__CRASH__.position(0,0);
   window.__CRASH__.traffic(kind,3,0);
   if(kind!=='ambulance'&&kind!=='bulldozer'){
    window.__CRASH__.charge();window.__CRASH__.blast();
    window.__CRASH__.position(0,0);window.__CRASH__.charge();window.__CRASH__.blast();
   }
   return window.__CRASH__.snapshot();
  },kind);
  await page.waitForTimeout(kind==='pizza'?1100:450);
  const s=await page.evaluate(()=>window.__CRASH__.snapshot());
  if(kind==='pizza'){
   assert(initial.events.some(e=>e.effect==='pizza'&&e.kind==='special'));
   assert(s.feature!=='none');assert(await page.locator('[data-field="pizza"]').isVisible());
  }
  if(kind==='bank')assert(initial.events.some(e=>e.effect==='bank'));
  await page.screenshot({path:`${out}/effect-${kind}.png`});
  checks.push({kind,feature:s.feature,score:s.score});
 }
 for(const feature of ['goodcop','magnet','tornado','airstrike','tidalwave','ufo','asteroid','monster']){
  await page.evaluate(feature=>{window.__CRASH__.start({rules:'sandbox'});window.__CRASH__.position(0,0);window.__CRASH__.feature(feature);},feature);
  await page.waitForTimeout(feature==='asteroid'?5600:1500);
  await page.screenshot({path:`${out}/effect-${feature}.png`});
  assert.equal(await page.evaluate(()=>window.__CRASH__.snapshot().feature),feature);
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${out}/effects.json`,JSON.stringify({fixture:true,checks,errors},null,2));
 console.log(JSON.stringify({fixture:true,checks,errors},null,2));
}catch(error){await page.screenshot({path:`${out}/effects-failure.png`});await fs.writeFile(`${out}/effects-failure.json`,JSON.stringify({error:String(error),errors,snapshot:await page.evaluate(()=>window.__CRASH__.snapshot())},null,2));throw error;}finally{await browser.close();}
