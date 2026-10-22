import {chromium,expect as baseExpect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Real DOM configuration and input, isolated browser profiles. DEV helpers only
// accelerate simulation/endings or arrange a physical pizza for the reset check.
const expect=baseExpect.configure({timeout:15000});
const url=process.env.CRASH_URL||'http://127.0.0.1:5173/';
const out=path.resolve('artifacts/reference-v2');
const storage='crash-city:world-tour-v3';
const timeoutOnly=process.argv.includes('--timeout-only');
const reportFile=timeoutOnly?'flow-timeout-report.json':'flow-report.json';
const report={startedAt:new Date().toISOString(),url,status:'running',suites:[],errors:[],screenshots:[],download:null};
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const money=value=>`$${Math.round(value).toLocaleString('en-US')}`;
const state=page=>page.evaluate(()=>{const s=window.__CRASH__.snapshot();return {phase:s.phase,time:s.time,score:s.score,config:s.config,feature:s.feature,roundStage:s.roundStage,stars:s.stars,challengeProgress:s.challengeProgress};});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),storage);
const phase=(page,value)=>page.waitForFunction(expected=>window.__CRASH__.snapshot().phase===expected,value);
async function shot(page,name){const file=`flow-${name}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);}
async function boot(page){await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__CRASH__);await expect(page.locator('.menu-screen')).toBeVisible();}
async function configure(page,config){
 for(const field of ['rules','mode','car','route'])if(config[field])await page.locator(`[data-config="${field}"][data-value="${config[field]}"]`).click();
 if(config.blast||config.passive){const toggle=page.locator('[data-action="loadout"]');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}
 for(const field of ['blast','passive'])if(config[field])await page.locator(`select[data-config="${field}"]`).selectOption(config[field]);
}
async function start(page){await page.locator('[data-action="start"]').click();await phase(page,'running');await expect(page.locator('.game-hud')).toBeVisible();}
async function advance(page,seconds){await page.evaluate(seconds=>window.__CRASH__.step(seconds,true),seconds);await page.waitForTimeout(80);}
async function finish(page){await page.evaluate(()=>window.__CRASH__.finish());await expect(page.locator('.result-screen')).toBeVisible();await phase(page,'ended');return (await saved(page)).records[0];}
async function cleanRunUI(page){
 await page.waitForTimeout(120);const current=await state(page);assert.equal(current.phase,'running');
 await expect(page.locator('[data-field="stageBanner"]')).toBeHidden();await expect(page.locator('[data-field="pizza"]')).toBeHidden();
 await expect(page.locator('[data-field="featureStatus"]')).toBeHidden();assert.equal(current.feature,'none');return current;
}
async function step(suite,name,work){const item={name,status:'running'};suite.steps.push(item);const begin=performance.now();try{item.evidence=await work();item.status='passed';console.log(`PASS ${suite.name}: ${name}`);return item.evidence;}catch(error){item.status='failed';item.error=String(error);throw error;}finally{item.durationMs=Math.round(performance.now()-begin);}}
async function suite(name,viewport,work){
 const entry={name,status:'running',viewport,steps:[]};report.suites.push(entry);
 const context=await browser.newContext({viewport,acceptDownloads:true,deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>report.errors.push({suite:name,type:'pageerror',message:error.message}));
 page.on('console',message=>{if(message.type()==='error')report.errors.push({suite:name,type:'console',message:message.text()});});
 page.on('response',response=>{if(response.status()>=400)report.errors.push({suite:name,type:'http',message:`${response.status()} ${response.url()}`});});
 try{await boot(page);await work(page,entry);entry.status='passed';}catch(error){entry.status='failed';entry.error=error.stack||String(error);console.error(`FAIL ${name}: ${error.message}`);try{await shot(page,`failure-${name}`);}catch{}}
 finally{await context.close();}
}
try{
 if(!timeoutOnly){
 await suite('records-settings-export',{width:1280,height:720},async(page,s)=>{
  const config={rules:'sandbox',mode:'solo',car:'pickup',route:'hill',blast:'leap',passive:'elastic'};const rounds=[];
  await step(s,'three consecutive results compare against prior matching records',async()=>{
   await configure(page,config);await start(page);
   for(const [index,seconds] of [6,0,60].entries()){
    if(index){await page.locator('[data-action="retry"]').click();await phase(page,'running');await cleanRunUI(page);}
    if(seconds)await advance(page,seconds);
    const result=await finish(page);const priorBest=Math.max(0,...rounds.map(r=>r.score));const expected=result.score>0&&result.score>priorBest;
    const displayed=(await page.locator('.result-score').innerText()).includes('NEW BEST');assert.equal(displayed,expected,`Wrong NEW BEST in round ${index+1}`);
    await expect(page.locator('.result-score strong')).toHaveText(money(result.score));
    assert.equal(result.stars,result.challenges.filter(Boolean).length);assert.equal(await page.locator('.result-stars .earned').count(),result.stars);
    assert.equal(await page.locator('.result-challenges>span').count(),5);
    assert.equal(result.score,result.breakdown.traffic+result.breakdown.property+result.breakdown.bonus);
    await expect(page.locator('.damage-breakdown strong')).toHaveText([money(result.breakdown.traffic),money(result.breakdown.property),money(result.breakdown.bonus)]);
    rounds.push({score:result.score,timestamp:result.timestamp,config:result.config,stars:result.stars,expectedNewBest:expected,displayedNewBest:displayed});
    await shot(page,`0${index+1}-result-${index+1}`);
   }
   assert(rounds[0].score>0);assert(rounds[1].score<rounds[0].score,'Immediate finish should score less than active play');assert(rounds[2].score>rounds[0].score,'Long active play should exercise a later new best');
   return rounds;
  });
  await step(s,'PNG is an actual downloaded and decodable score image',async()=>{
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="share"]').click()]);assert.equal(await download.failure(),null);
   const file=path.join(out,'flow-score-card.png');await download.saveAs(file);const bytes=await fs.readFile(file);
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert(bytes.length>10000);
   const dimensions=await page.evaluate(async data=>{const image=new Image();image.src=data;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};},`data:image/png;base64,${bytes.toString('base64')}`);
   assert.deepEqual(dimensions,{width:1200,height:900});report.download={file:'flow-score-card.png',suggestedName:download.suggestedFilename(),bytes:bytes.length,...dimensions};return report.download;
  });
  await step(s,'settings and matching high score persist after reload',async()=>{
   await page.locator('[data-action="menu"]').click();await expect(page.locator('.menu-screen')).toBeVisible();
   const best=Math.max(...rounds.map(r=>r.score));await expect(page.locator('.menu-footer')).toContainText(money(best));
   await page.locator('[data-action="settings"]').click();
   for(const [key,count] of [['volume',7],['music',5]]){const slider=page.locator(`input[data-setting="${key}"]`);await slider.focus();await slider.press('Home');for(let i=0;i<count;i++)await slider.press('ArrowRight');}
   await page.locator('input[data-setting="shake"]').setChecked(false);await page.locator('select[data-setting="quality"]').selectOption('low');
   const expectedSettings={volume:.35,music:.25,shake:false,quality:'low'};assert.deepEqual((await saved(page)).settings,expectedSettings);await shot(page,'04-settings');
   await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__CRASH__);await expect(page.locator('.menu-screen')).toBeVisible();
   const persisted=await saved(page);assert.deepEqual(persisted.settings,expectedSettings);assert.equal(persisted.records.length,3);
   for(const result of rounds)assert(persisted.records.some(record=>record.timestamp===result.timestamp&&record.score===result.score));
   await configure(page,config);await expect(page.locator('.menu-footer')).toContainText(money(best));
   await page.locator('[data-action="settings"]').click();await expect(page.locator('input[data-setting="volume"]')).toHaveValue('0.35');await expect(page.locator('input[data-setting="music"]')).toHaveValue('0.25');await expect(page.locator('input[data-setting="shake"]')).not.toBeChecked();await expect(page.locator('select[data-setting="quality"]')).toHaveValue('low');
   await page.locator('[data-action="close-dialog"]').click();await shot(page,'05-persisted-record');
   // Classic rules must also normalize the hidden loadout before record lookup.
   await page.locator('[data-config="rules"][data-value="rushhour"]').click();const normalized=await state(page);assert.equal(normalized.config.blast,'radial');assert.equal(normalized.config.passive,'balanced');await expect(page.locator('[data-action="loadout"]')).toHaveCount(0);
   return {records:persisted.records.length,settings:persisted.settings,best,classicConfig:normalized.config};
  });
 });
 await suite('same-machine-duel',{width:1280,height:720},async(page,s)=>{
  let first,second;
  await step(s,'player one and player two share rules car loadout and seed',async()=>{
   await configure(page,{rules:'sandbox',mode:'versus',car:'sport',route:'hill',blast:'focused',passive:'heavy'});await start(page);await advance(page,5);first=await finish(page);
   await expect(page.locator('.result-topline')).toContainText('PLAYER 01');await page.locator('[data-action="next-player"]').click();
   await expect(page.locator('.menu-screen')).toBeVisible();await expect(page.locator('#ui')).toHaveAttribute('data-challenge-round','2');await expect(page.locator('.edition')).toContainText('条件已锁定');
   for(const field of ['rules','car','mode']){const buttons=page.locator(`button[data-config="${field}"]`);for(let i=0;i<await buttons.count();i++)await expect(buttons.nth(i)).toBeDisabled();}
   const toggle=page.locator('[data-action="loadout"]');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
   for(const field of ['blast','passive']){await expect(page.locator(`select[data-config="${field}"]`)).toBeDisabled();await expect(page.locator(`select[data-config="${field}"]`)).toHaveValue(first.config[field]);}
   for(const button of await page.locator('[data-config="route"]').all())await expect(button).toBeEnabled();
   await page.locator('[data-config="route"][data-value="pier"]').click();await shot(page,'06-player-two-locked');await start(page);
   const next=(await state(page)).config;for(const field of ['rules','car','blast','passive','seed','mode'])assert.equal(next[field],first.config[field],`Unlocked ${field}`);assert.equal(next.route,'pier');assert.notEqual(next.route,first.config.route);
   await advance(page,8);second=await finish(page);return {first:first.config,second:next};
  });
  await step(s,'comparison is accurate and replay returns to player one',async()=>{
   await expect(page.locator('.versus-comparison')).toBeVisible();await expect(page.locator('.versus-comparison strong')).toHaveText([money(first.score),money(second.score)]);await expect(page.locator('[data-action="retry"]')).toContainText('再比一轮');await shot(page,'07-duel-comparison');
   await page.locator('[data-action="retry"]').click();await phase(page,'running');await cleanRunUI(page);await expect(page.locator('#ui')).toHaveAttribute('data-challenge-round','1');
   const next=await state(page);assert.equal(next.config.seed,first.config.seed);assert.equal(next.config.rules,first.config.rules);await shot(page,'08-duel-fresh-replay');
   await finish(page);await expect(page.locator('.result-topline')).toContainText('PLAYER 01');await expect(page.locator('[data-action="next-player"]')).toBeVisible();await expect(page.locator('.versus-comparison')).toHaveCount(0);
   return {scores:[first.score,second.score],newRound:1};
  });
 });
 await suite('overlay-resets',{width:1280,height:720},async(page,s)=>{
  await step(s,'end banner appears then vanishes on retry',async()=>{
   await configure(page,{rules:'sandbox'});await start(page);await page.evaluate(()=>window.__CRASH__.finish());await phase(page,'ended');
   await expect(page.locator('[data-field="stageBanner"]')).toBeVisible();await expect(page.locator('[data-field="stageTitle"]')).toContainText('CRASH COMPLETE');await expect(page.locator('.blast-cluster')).toBeHidden();await shot(page,'09-crash-complete');
   await expect(page.locator('.result-screen')).toBeVisible();await page.locator('[data-action="retry"]').click();await phase(page,'running');const fresh=await cleanRunUI(page);assert(fresh.time>118);await shot(page,'10-fresh-after-complete');return fresh;
  });
  await step(s,'physical pizza result and pause restart leave no stale overlays',async()=>{
   await page.keyboard.press('Escape');await page.locator('[data-action="menu"]').click();await configure(page,{rules:'rushhour',car:'semi'});await start(page);
   // Arrange one real pizza vehicle beside the player and destroy it with the real blast system.
   await page.evaluate(()=>{window.__CRASH__.position(0,0);window.__CRASH__.traffic('pizza',1,0);window.__CRASH__.charge();window.__CRASH__.blast();});
   for(let i=0;i<4&&!await page.locator('[data-field="pizza"]').isVisible();i++){await page.evaluate(()=>{window.__CRASH__.charge();window.__CRASH__.blast();window.__CRASH__.step(.2);});await page.waitForTimeout(80);}
   await expect(page.locator('[data-field="pizza"]')).toBeVisible();await shot(page,'11-pizza-before-restart');
   const feature=(await state(page)).feature;assert.notEqual(feature,'none');await page.keyboard.press('r');await cleanRunUI(page);await shot(page,'12-fresh-after-pizza');
   await page.evaluate(()=>window.__CRASH__.feature('magnet'));await page.waitForTimeout(80);await expect(page.locator('[data-field="featureStatus"]')).toBeVisible();
   await page.keyboard.press('Escape');await expect(page.locator('.pause-screen')).toBeVisible();await page.locator('[data-action="retry"]').click();const fresh=await cleanRunUI(page);assert(fresh.time>88);return {controlledPizzaFixture:true,previousFeature:feature,fresh};
  });
 });
 for(const viewport of [{width:1280,height:720},{width:390,height:844}])await suite(`layout-${viewport.width}`,viewport,async(page,s)=>{
  await step(s,'menu preview launch and expanded sandbox fit horizontally',async()=>{
   const measure=()=>page.evaluate(()=>{const menu=document.querySelector('.menu-screen'),preview=document.querySelector('.vehicle-preview').getBoundingClientRect(),stats=document.querySelector('.car-attributes').getBoundingClientRect();return {documentWidth:document.documentElement.scrollWidth,menuWidth:menu.clientWidth,menuScrollWidth:menu.scrollWidth,previewBottom:preview.bottom,statsTop:stats.top,bounds:['.brand','.rules-picker','.car-picker','.race-setup','[data-action="start"]'].map(selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {selector,left:b.left,right:b.right};})};});
   const validate=metrics=>{assert(metrics.documentWidth<=viewport.width+1);assert(metrics.menuScrollWidth<=metrics.menuWidth+1);assert(metrics.previewBottom<=metrics.statsTop+1,'3D preview covers attributes');for(const b of metrics.bounds)assert(b.left>=-1&&b.right<=viewport.width+1,`${b.selector} overflows`);};
   const initial=await measure();validate(initial);await expect(page.locator('.vehicle-preview canvas')).toBeVisible();await shot(page,`13-menu-${viewport.width}`);
   await configure(page,{rules:'sandbox',car:'semi',blast:'leap',passive:'elastic'});const launch=page.locator('[data-action="start"]');await launch.scrollIntoViewIfNeeded();await launch.click({trial:true});const expanded=await measure();validate(expanded);
   const box=await launch.boundingBox();assert(box.y>=-1&&box.y+box.height<=viewport.height+1);await shot(page,`14-sandbox-launch-${viewport.width}`);
   return {initial,expanded,launch:box,mobileGameplayTested:false};
  });
 });
 }
 await suite('roadtrip-timeout',{width:1280,height:720},async(page,s)=>{
  await step(s,'unfinished Road Trip reports timeout separately from five escapes',async()=>{
   await configure(page,{rules:'roadtrip'});await start(page);
   // Force only the safety timer to expire before the first road outcomes.
   // No score, escape count or result object is injected.
   await page.evaluate(()=>window.__CRASH__.finish());
   await expect(page.locator('.result-screen')).toBeVisible();
   const result=(await saved(page)).records[0];assert.equal(result.outcome,'timeout');assert.equal(result.config.rules,'roadtrip');assert(result.escaped<5);
   await expect(page.locator('.result-kicker')).toHaveText('TIME LIMIT / INCOMPLETE');
   await expect(page.locator('.result-heading h2')).toHaveText('车流未解决，挑战未完成。');
   await expect(page.locator('.result-heading p')).toHaveText('时间用尽，路口仍有车流未解决。本次挑战未完成。');
   await expect(page.locator('.result-heading')).not.toContainText('5 辆车完整逃脱');
   await expect(page.locator('.result-heading')).not.toContainText('整轮车流结束');
   await expect(page.locator('.result-kicker')).not.toContainText('EVENT COMPLETE');
   await shot(page,'15-roadtrip-timeout');
   return {outcome:result.outcome,escaped:result.escaped,score:result.score,title:await page.locator('.result-heading h2').innerText()};
  });
 });
}finally{
 await browser.close();report.finishedAt=new Date().toISOString();report.status=report.suites.length===(timeoutOnly?1:6)&&report.suites.every(s=>s.status==='passed')&&report.errors.length===0?'passed':'failed';
 await fs.writeFile(path.join(out,reportFile),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,suites:report.suites.map(({name,status})=>({name,status})),errors:report.errors,report:`artifacts/reference-v2/${reportFile}`},null,2));
 if(report.status!=='passed')process.exitCode=1;
}
