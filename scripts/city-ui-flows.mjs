import {chromium,expect as baseExpect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Real menus, buttons and Q input. DEV helpers are used only to charge the real
// ability, position a real wreck and accelerate the end of a round.
const expect=baseExpect.configure({timeout:15000});
const url=process.env.CRASH_URL||'http://127.0.0.1:5173/';
const out=path.resolve(process.env.CRASH_ARTIFACTS||'artifacts/polish-v4/city-ui');
const desktopFit=process.argv.includes('--desktop-fit');
const menusOnly=process.argv.includes('--menus-only')||desktopFit;
const report={startedAt:new Date().toISOString(),url,menusOnly,status:'running',checks:[],errors:[],screenshots:[]};
const cities={sf:{name:'旧金山',district:'金门坡道',route:'山顶俯冲',traffic:['山城缆车','运钞车','燃料罐车']},sydney:{name:'悉尼',district:'歌剧院港湾',route:'桥头俯冲',traffic:['悉尼工程皮卡','港口双挂重卡','鲜货配送车']},london:{name:'伦敦',district:'西敏钟楼环岛',route:'钟楼入场',traffic:['伦敦双层巴士','伦敦黑出租','运钞车']}};
const abilities={compact:'磁吸弹跳',sport:'三连穿刺',pickup:'废铁投手',semi:'重锤封街'};
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
async function shot(page,name){const file=`ui-${name}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);}
async function boot(page){await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__CRASH__);await expect(page.locator('.menu-screen')).toBeVisible();}
async function choice(page,key,value){await page.locator(`[data-config="${key}"][data-value="${value}"]`).click();}
const state=page=>page.evaluate(()=>{const s=window.__CRASH__.snapshot();return {config:s.config,phase:s.phase,abilityReady:s.abilityReady,abilityCooldown:s.abilityCooldown,abilityActive:s.abilityActive,cityEvent:s.cityEvent,blastCharge:s.blastCharge,score:s.score};});
async function check(name,viewport,work){const entry={name,status:'running',viewport};report.checks.push(entry);const context=await browser.newContext({viewport,acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push({name,message:error.message}));page.on('console',message=>{if(message.type()==='error')report.errors.push({name,message:message.text()});});try{await boot(page);entry.evidence=await work(page);entry.status='passed';console.log(`PASS ${name}`);}catch(error){entry.status='failed';entry.error=error.stack||String(error);console.error(`FAIL ${name}: ${error.message}`);try{await shot(page,`failure-${name}`);}catch{}}finally{await context.close();}}
async function finish(page){await page.evaluate(()=>window.__CRASH__.finish());await expect(page.locator('.result-screen')).toBeVisible();}
async function menuFromRun(page){await page.keyboard.press('Escape');await expect(page.locator('.pause-screen')).toBeVisible();await page.locator('[data-action="menu"]').click();await expect(page.locator('.menu-screen')).toBeVisible();}
try{
 for(const viewport of (desktopFit?[{width:1600,height:1000},{width:1440,height:900}]:[{width:1280,height:720},{width:390,height:844}]))await check(`maps-layout-${viewport.width}`,viewport,async page=>{
  const evidence=[];await expect(page.locator('[data-config="city"]')).toHaveCount(3);await expect(page.locator('.city-map')).toHaveCount(3);
  for(const [id,city] of Object.entries(cities)){
   await choice(page,'city',id);await expect(page.locator('.selected-city-brief')).toContainText(city.district);await expect(page.locator('.route-choice.is-selected')).toContainText(city.route);
   const snapshot=await state(page);assert.equal(snapshot.config.city,id);await expect(page.locator('.edition')).toContainText(id==='sf'?'SF—01':id==='sydney'?'SYD—02':'LDN—03');
   const paths=await page.locator('.route-map').first().innerHTML();evidence.push({city:id,routeText:await page.locator('.route-picker').innerText(),paths});
  }
  assert.equal(new Set(evidence.map(item=>item.paths)).size,3,'City route schematics must differ');
  for(const [id,name] of Object.entries(abilities)){await choice(page,'car',id);await expect(page.locator('.vehicle-ability')).toContainText(name);await expect(page.locator('.vehicle-ability')).toContainText('秒冷却');await expect(page.locator('.vehicle-ability')).toContainText('爆破能量');}
  await page.locator('[data-action="vehicles"]').click();await expect(page.locator('.guide-intro')).toContainText('伦敦重点车流');
  const highlighted=await page.locator('.vehicle-codex article.is-local h3').allTextContents();for(const name of cities.london.traffic)assert(highlighted.some(text=>text.includes(name)));await page.locator('[data-action="close-dialog"]').click();
  await choice(page,'city','sydney');await choice(page,'car','compact');await page.locator('.menu-screen').evaluate(el=>el.scrollTop=0);await shot(page,`menu-${viewport.width}`);
  if(viewport.width>=1440){for(const selector of ['.vehicle-ability','[data-action="start"]']){const box=await page.locator(selector).boundingBox();assert(box.y>=0&&box.y+box.height<=viewport.height,`${selector} must be fully visible on first desktop view`);}}
  await choice(page,'rules','sandbox');await page.locator('[data-action="loadout"]').click();await page.locator('[data-action="start"]').scrollIntoViewIfNeeded();await page.locator('[data-action="start"]').click({trial:true});
  const layout=await page.evaluate(()=>{const menu=document.querySelector('.menu-screen'),preview=document.querySelector('.vehicle-preview').getBoundingClientRect(),stats=document.querySelector('.car-attributes').getBoundingClientRect();return {doc:document.documentElement.scrollWidth,width:menu.clientWidth,scroll:menu.scrollWidth,previewBottom:preview.bottom,statsTop:stats.top,bounds:['.city-picker','.rules-picker','.vehicle-ability','.race-setup','[data-action="start"]'].map(selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {selector,left:b.left,right:b.right};})};});
  assert(layout.doc<=viewport.width+1);assert(layout.scroll<=layout.width+1);assert(layout.previewBottom<=layout.statsTop+1,'Preview covers stats');for(const b of layout.bounds)assert(b.left>=-1&&b.right<=viewport.width+1,`${b.selector} overflow`);
  const launch=await page.locator('[data-action="start"]').boundingBox();assert(launch.y>=-1&&launch.y+launch.height<=viewport.height+1);await shot(page,`launch-${viewport.width}`);return {cities:evidence,highlighted,layout,launch,mobileGameplayTested:false};
 });
 if(!menusOnly){
  await check('abilities-and-city-hud',{width:1280,height:720},async page=>{
   const observations=[];
   for(const [car,name] of Object.entries(abilities)){
    await choice(page,'city','sydney');await choice(page,'car',car);await choice(page,'rules','sandbox');await page.locator('[data-action="start"]').click();await expect(page.locator('.game-hud')).toBeVisible();
    await page.evaluate(()=>window.__CRASH__.charge());await expect(page.locator('[data-action="ability"]')).toBeEnabled();await expect(page.locator('[data-field="abilityName"]')).toHaveText(name);await expect(page.locator('[data-field="cityLabel"]')).toContainText('悉尼');
    if(car==='compact')await page.locator('[data-action="ability"]').click();else await page.keyboard.press('q');
    await page.waitForFunction(()=>window.__CRASH__.snapshot().abilityCooldown>0);await expect(page.locator('[data-action="ability"]')).toBeDisabled();const after=await state(page);assert(after.abilityCooldown>0);assert.equal(after.config.car,car);await shot(page,`skill-${car}`);observations.push(after);
    await page.keyboard.press('r');await expect(page.locator('[data-field="stageBanner"]')).toBeHidden();await expect(page.locator('[data-field="pizza"]')).toBeHidden();const fresh=await state(page);assert.equal(fresh.abilityCooldown,0);assert.equal(fresh.cityEvent.triggered,false);await menuFromRun(page);
   }
   return observations;
  });
  await check('city-duel-and-results',{width:1280,height:720},async page=>{
   await choice(page,'city','london');await choice(page,'rules','sandbox');await choice(page,'car','sport');await choice(page,'mode','versus');await choice(page,'route','hill');await page.locator('[data-action="loadout"]').click();await page.locator('select[data-config="blast"]').selectOption('leap');await page.locator('select[data-config="passive"]').selectOption('elastic');await page.locator('[data-action="start"]').click();const first=await state(page);await finish(page);await expect(page.locator('.result-build')).toContainText('伦敦');await expect(page.locator('.result-build')).toContainText('钟楼入场');await page.locator('[data-action="next-player"]').click();
   for(const field of ['city','car','rules','mode'])for(const element of await page.locator(`[data-config="${field}"]`).all())await expect(element).toBeDisabled();for(const field of ['blast','passive'])await expect(page.locator(`select[data-config="${field}"]`)).toBeDisabled();for(const button of await page.locator('[data-config="route"]').all())await expect(button).toBeEnabled();
   await shot(page,'duel-city-locked');await choice(page,'route','pier');await page.locator('[data-action="start"]').click();const second=await state(page);for(const field of ['city','car','rules','mode','blast','passive','seed'])assert.equal(second.config[field],first.config[field],field);assert.equal(second.config.route,'pier');await finish(page);await expect(page.locator('.versus-comparison')).toBeVisible();await expect(page.locator('.result-build')).toContainText('出租围堵');await shot(page,'duel-city-result');
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="share"]').click()]);const file=path.join(out,'ui-london-score.png');await download.saveAs(file);const bytes=await fs.readFile(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert(bytes.length>10000);
   await page.locator('[data-action="retry"]').click();await expect(page.locator('#ui')).toHaveAttribute('data-challenge-round','1');const replay=await state(page);assert.equal(replay.config.city,'london');await expect(page.locator('[data-field="stageBanner"]')).toBeHidden();return {first:first.config,second:second.config,replay:replay.config,pngBytes:bytes.length};
  });
 }
}finally{await browser.close();report.finishedAt=new Date().toISOString();report.status=report.checks.every(item=>item.status==='passed')&&!report.errors.length?'passed':'failed';const file=`ui-${desktopFit?'desktop-fit':menusOnly?'menus':'flows'}-report.json`;await fs.writeFile(path.join(out,file),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.map(({name,status})=>({name,status})),errors:report.errors,report:path.join(out,file)},null,2));if(report.status!=='passed')process.exitCode=1;}
