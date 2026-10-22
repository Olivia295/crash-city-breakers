import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.CRASH_ARTIFACTS||'artifacts/polish-v4';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const report={fixture:true,description:'DEV setup positions real bodies and supplies blast charge; all reactions use normal physics and damage. Not a human balance or skill test.',checks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
async function shot(name){await page.screenshot({path:`${out}/${name}.png`});}
try{
 await page.goto(process.env.CRASH_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__CRASH__);
 for(const city of ['sf','sydney','london']){
  await page.evaluate(city=>{window.__CRASH__.start({city,rules:'sandbox',seed:72721});window.__CRASH__.position(0,city==='sydney'?8:0);},city);
  await page.waitForTimeout(750);await shot(`city-${city}`);
  const result=await page.evaluate(city=>{
   const api=window.__CRASH__;const [x,z]=city==='sf'?[-4.25,-18]:city==='sydney'?[2,8]:[0,18];
   for(let i=0;i<3;i++){api.position(x,z);api.charge();api.blast();api.step(.2);}
   return {event:api.snapshot().cityEvent,events:api.snapshot().events.filter(e=>e.effect==='city'),score:api.snapshot().score};
  },city);
  assert(result.event.triggered,`${city} event must trigger`);assert(result.events.length>=1);
  await page.waitForTimeout(350);await shot(`event-${city}`);report.checks.push({name:`event-${city}`,...result});
 }
 for(const [city,index] of [['sydney',8],['london',6]]){
  const initial=await page.evaluate(({city,index})=>{
   const api=window.__CRASH__;api.start({city,rules:'sandbox',car:'semi',seed:72721});
   const b=api.snapshot().entities.find(e=>e.kind==='building'&&e.buildingIndex===index);
   api.position(b.p.x-b.scale.x/2-5,b.p.z);return b;
  },{city,index});
  await page.waitForTimeout(250);await shot(`landmark-${city}-before`);
  const damaged=await page.evaluate(({id,x,z})=>{
   const api=window.__CRASH__;for(let i=0;i<12;i++){api.position(x,z);api.charge();api.blast();api.step(.1);}
   return api.snapshot().entities.find(e=>e.id===id);
  },{id:initial.id,x:initial.p.x-initial.scale.x/2-5,z:initial.p.z});
  assert.equal(damaged.stage,3,`${city} landmark rubble stage`);assert(damaged.destroyed);
  await page.waitForTimeout(300);await shot(`landmark-${city}-destroyed`);report.checks.push({name:`landmark-${city}`,before:initial.stage,after:damaged.stage,physicalScale:damaged.scale});
 }
 for(const [kind,city] of [['roadtrain','sydney'],['ute','sydney'],['doubledecker','london'],['blackcab','london']]){
  const data=await page.evaluate(({kind,city})=>{
   const api=window.__CRASH__;api.start({city,rules:'sandbox',car:'semi',seed:72721});api.position(0,city==='sydney'?8:18);
   const z=city==='sydney'?8:18,id=api.traffic(kind,5,z);api.charge();api.blast();api.step(.3);
   const s=api.snapshot();return {id,entity:s.entities.find(e=>e.id===id),props:s.entities.filter(e=>e.kind==='trailer'||e.kind==='crate').map(e=>({kind:e.kind,p:e.p})),events:s.events.filter(e=>e.effect===kind)};
  },{kind,city});
  assert(data.entity?.damage>0);if(kind==='roadtrain')assert(data.props.filter(e=>e.kind==='trailer').length>=2);
  await page.waitForTimeout(300);await shot(`traffic-${kind}`);report.checks.push({name:`traffic-${kind}`,...data});
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);await shot('gameplay-failure');process.exitCode=1;}
finally{await fs.writeFile(`${out}/gameplay-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.map(x=>x.name),errors:report.errors,failure:report.failure},null,2));await browser.close();}
