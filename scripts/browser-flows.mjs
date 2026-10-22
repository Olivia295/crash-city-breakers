import {chromium, expect as playwrightExpect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run from the project root while the Vite development server is running.
// Only the finish() diagnostic mutates game state; configuration and play use the UI.
const expect=playwrightExpect.configure({timeout:10000});
const baseURL=process.env.CRASH_URL||'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const artifacts=path.resolve('artifacts');
const storageKey='crash-city:v1';
const report={startedAt:new Date().toISOString(),baseURL,browser:chromePath,status:'running',suites:[],browserErrors:[],screenshots:[],download:null};
await fs.mkdir(artifacts,{recursive:true});
let browser;

async function capture(page,name){
  const filename=`flow-${name}.png`;
  await page.screenshot({path:path.join(artifacts,filename),animations:'disabled'});
  report.screenshots.push(filename);
  return filename;
}

function observe(page,suite){
  page.on('pageerror',error=>report.browserErrors.push({suite,type:'pageerror',message:error.message}));
  page.on('console',message=>{if(message.type()==='error')report.browserErrors.push({suite,type:'console',message:message.text()});});
  page.on('response',response=>{if(response.status()>=400)report.browserErrors.push({suite,type:'http',message:`${response.status()} ${response.url()}`});});
}

async function boot(page){
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.__CRASH__),null,{timeout:30000});
  await expect(page.locator('.menu-screen')).toBeVisible();
}

async function snapshot(page){
  return page.evaluate(()=>{
    const state=window.__CRASH__.snapshot();
    return {phase:state.phase,time:state.time,score:state.score,config:state.config,interventions:state.interventions};
  });
}

async function waitPhase(page,phase){
  await page.waitForFunction(expected=>window.__CRASH__.snapshot().phase===expected,phase);
}

async function saved(page){
  return page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),storageKey);
}

async function expandLoadout(page){
  const toggle=page.locator('[data-action="loadout"]');
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await expect(page.locator('#loadout-options')).toBeVisible();
}

async function configure(page,config){
  for(const field of ['mode','car','route']){
    if(config[field])await page.locator(`button[data-config="${field}"][data-value="${config[field]}"]`).click();
  }
  if(config.blast||config.passive)await expandLoadout(page);
  for(const field of ['blast','passive']){
    if(config[field])await page.locator(`select[data-config="${field}"]`).selectOption(config[field]);
  }
}

async function setRangeWithKeyboard(page,setting,steps){
  const slider=page.locator(`input[data-setting="${setting}"]`);
  await slider.focus();
  await slider.press('Home');
  for(let index=0;index<steps;index++)await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(steps*5/100));
}

async function finish(page){
  await page.evaluate(()=>window.__CRASH__.finish());
  await expect(page.locator('.result-screen')).toBeVisible();
  await waitPhase(page,'ended');
  return (await saved(page)).records[0];
}

async function checkStep(suite,name,work){
  const step={name,status:'running',startedAt:new Date().toISOString()};
  suite.steps.push(step);
  const started=performance.now();
  try{
    step.evidence=await work();step.status='passed';
    console.log(`PASS ${suite.name}: ${name}`);
    return step.evidence;
  }catch(error){
    step.status='failed';step.error=error instanceof Error?error.stack:String(error);
    throw error;
  }finally{step.durationMs=Math.round(performance.now()-started);}
}

async function runSuite(name,viewport,work){
  const suite={name,viewport,status:'running',steps:[]};report.suites.push(suite);
  let context,page;
  try{
    // Every suite uses an isolated temporary profile, never the user's Chrome profile.
    context=await browser.newContext({viewport,deviceScaleFactor:1,acceptDownloads:true,reducedMotion:'reduce'});
    page=await context.newPage();page.setDefaultTimeout(12000);observe(page,name);
    await boot(page);
    await work(page,suite);
    suite.status='passed';
  }catch(error){
    suite.status='failed';suite.error=error instanceof Error?error.stack:String(error);
    console.error(`FAIL ${name}: ${error instanceof Error?error.message:String(error)}`);
    if(page&&!page.isClosed()){
      try{suite.failureScreenshot=await capture(page,`failure-${name}`);}catch{}
    }
  }finally{await context?.close();}
}

try{
  browser=await chromium.launch({executablePath:chromePath,headless:true,args:['--no-sandbox']});

  await runSuite('solo-persistence',{width:1280,height:720},async(page,suite)=>{
    const wanted={mode:'solo',car:'sport',route:'market',blast:'focused',passive:'heavy'};
    let completedRun;
    await checkStep(suite,'garage choices reach the real simulation',async()=>{
      assert.equal((await saved(page)).records?.length||0,0,'Expected a fresh isolated profile');
      await configure(page,wanted);
      await expect(page.locator('[data-action="loadout"]')).toContainText('定向破城 + 重型配重');
      await capture(page,'01-configured-garage');
      await page.locator('[data-action="start"]').click();
      await waitPhase(page,'running');
      const state=await snapshot(page);
      for(const [field,value] of Object.entries(wanted))assert.equal(state.config[field],value,`${field} did not reach the simulation`);
      await expect(page.locator('.game-hud')).toBeVisible();
      await expect(page.locator('.menu-screen')).toHaveCount(0);
      return state;
    });

    const settings={volume:0.35,music:0.25,shake:false,quality:'low'};
    await checkStep(suite,'pause freezes time and settings accept real input',async()=>{
      await page.keyboard.press('Escape');await waitPhase(page,'paused');
      await expect(page.locator('.pause-screen')).toBeVisible();
      const before=(await snapshot(page)).time;
      await page.waitForTimeout(650);
      const after=(await snapshot(page)).time;
      assert.ok(Math.abs(after-before)<0.000001,`Paused timer moved from ${before} to ${after}`);
      await setRangeWithKeyboard(page,'volume',7);
      await setRangeWithKeyboard(page,'music',5);
      await page.locator('input[data-setting="shake"]').setChecked(false);
      await page.locator('select[data-setting="quality"]').selectOption('low');
      assert.deepEqual((await saved(page)).settings,settings);
      await capture(page,'02-pause-settings');
      await page.locator('[data-action="resume"]').click();await waitPhase(page,'running');
      await page.waitForFunction(time=>window.__CRASH__.snapshot().time<time-0.15,before);
      return {before,after,settings};
    });

    await checkStep(suite,'real play scores and a first result earns NEW BEST',async()=>{
      // Let the car enter, then use the normal Space input. No score or physics injection.
      await page.waitForFunction(()=>window.__CRASH__.snapshot().time<115,null,{timeout:12000});
      await page.mouse.move(680,370);
      await page.keyboard.down('Space');
      try{await page.waitForFunction(()=>window.__CRASH__.snapshot().score>0,null,{timeout:20000});}
      finally{await page.keyboard.up('Space');}
      await capture(page,'03-real-play');
      completedRun=await finish(page);
      assert.ok(completedRun.score>0,'Actual keyboard play should earn a positive score');
      await expect(page.locator('.result-score')).toContainText('NEW BEST');
      await expect(page.locator('.result-score strong')).toHaveText(completedRun.score.toLocaleString('en-US'));
      await capture(page,'04-new-best');
      return {score:completedRun.score,config:completedRun.config,timestamp:completedRun.timestamp};
    });

    await checkStep(suite,'score card is downloaded as a valid PNG',async()=>{
      const [download]=await Promise.all([
        page.waitForEvent('download',{timeout:15000}),
        page.locator('[data-action="share"]').click(),
      ]);
      assert.equal(await download.failure(),null);
      const destination=path.join(artifacts,'score-card.png');
      await download.saveAs(destination);
      const bytes=await fs.readFile(destination);
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Download must be a PNG');
      const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
      assert.equal(width,1200);assert.equal(height,900);assert.ok(bytes.length>1024);
      report.download={filename:'score-card.png',suggestedFilename:download.suggestedFilename(),width,height,bytes:bytes.length};
      return report.download;
    });

    await checkStep(suite,'records and settings survive returning to garage and reloading',async()=>{
      await page.locator('[data-action="menu"]').click();
      await expect(page.locator('.menu-screen')).toBeVisible();
      await expect(page.locator('.menu-footer')).toContainText(completedRun.score.toLocaleString('en-US'));
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>Boolean(window.__CRASH__),null,{timeout:30000});
      await expect(page.locator('.menu-screen')).toBeVisible();
      const after=await saved(page);
      assert.ok(after.records.some(record=>record.timestamp===completedRun.timestamp&&record.score===completedRun.score),'Completed record was lost after reload');
      assert.deepEqual(after.settings,settings);
      // The default car is intentional after reload; select the recorded build to inspect its board.
      await configure(page,wanted);
      await expect(page.locator('.menu-footer')).toContainText(completedRun.score.toLocaleString('en-US'));
      await page.locator('[data-action="settings"]').click();
      await expect(page.locator('input[data-setting="volume"]')).toHaveValue('0.35');
      await expect(page.locator('input[data-setting="music"]')).toHaveValue('0.25');
      await expect(page.locator('input[data-setting="shake"]')).not.toBeChecked();
      await expect(page.locator('select[data-setting="quality"]')).toHaveValue('low');
      await capture(page,'05-persisted-settings');
      await page.locator('[data-action="close-dialog"]').click();
      await capture(page,'06-persisted-record');
      return {recordCount:after.records.length,settings:after.settings,restoredTimestamp:completedRun.timestamp};
    });
  });

  await runSuite('same-machine-duel',{width:1280,height:720},async(page,suite)=>{
    let firstConfig,firstResult,secondResult;
    await checkStep(suite,'player one starts a configured fair challenge',async()=>{
      await configure(page,{mode:'versus',car:'pickup',route:'hill',blast:'leap',passive:'elastic'});
      await expect(page.locator('[data-action="start"]')).toContainText('玩家 1');
      await page.locator('[data-action="start"]').click();await waitPhase(page,'running');
      firstConfig=(await snapshot(page)).config;
      assert.deepEqual({car:firstConfig.car,blast:firstConfig.blast,passive:firstConfig.passive,mode:firstConfig.mode},{car:'pickup',blast:'leap',passive:'elastic',mode:'versus'});
      firstResult=await finish(page);
      await expect(page.locator('[data-action="next-player"]')).toBeVisible();
      await expect(page.locator('.result-topline')).toContainText('玩家 1');
      await capture(page,'07-player-one-result');
      return {config:firstConfig,score:firstResult.score};
    });

    await checkStep(suite,'handoff locks car, build and mode while allowing a new route',async()=>{
      await page.locator('[data-action="next-player"]').click();
      await expect(page.locator('.menu-screen')).toBeVisible();
      await expect(page.locator('#ui')).toHaveAttribute('data-challenge-round','2');
      await expect(page.locator('.garage-top')).toContainText('条件已锁定');
      await expect(page.locator('[data-action="start"]')).toContainText('玩家 2');
      const carButtons=page.locator('button[data-config="car"]');
      const modeButtons=page.locator('button[data-config="mode"]');
      assert.equal(await carButtons.count(),4);assert.equal(await modeButtons.count(),2);
      for(const buttons of [carButtons,modeButtons])for(let index=0;index<await buttons.count();index++)await expect(buttons.nth(index)).toBeDisabled();
      await expandLoadout(page);
      for(const field of ['blast','passive']){
        await expect(page.locator(`select[data-config="${field}"]`)).toBeDisabled();
        await expect(page.locator(`select[data-config="${field}"]`)).toHaveValue(firstConfig[field]);
      }
      const routeButtons=page.locator('button[data-config="route"]');
      assert.equal(await routeButtons.count(),3);
      for(let index=0;index<3;index++)await expect(routeButtons.nth(index)).toBeEnabled();
      await page.locator('button[data-config="route"][data-value="pier"]').click();
      await expect(page.locator('button[data-config="route"][data-value="pier"]')).toHaveAttribute('aria-pressed','true');
      await capture(page,'08-player-two-locked-garage');
      await page.locator('[data-action="start"]').click();await waitPhase(page,'running');
      const config=(await snapshot(page)).config;
      for(const field of ['car','blast','passive','mode','seed'])assert.equal(config[field],firstConfig[field],`Player two changed locked ${field}`);
      assert.equal(config.route,'pier');assert.notEqual(config.route,firstConfig.route);
      return {firstConfig,secondConfig:config,disabledCarButtons:4,disabledModeButtons:2,disabledBuildSelectors:2};
    });

    await checkStep(suite,'second result compares both players and replay becomes player one',async()=>{
      secondResult=await finish(page);
      await expect(page.locator('.versus-comparison')).toBeVisible();
      await expect(page.locator('.versus-comparison')).toContainText('玩家 1');
      await expect(page.locator('.versus-comparison')).toContainText('玩家 2');
      await expect(page.locator('.versus-comparison strong')).toHaveText([firstResult.score.toLocaleString('en-US'),secondResult.score.toLocaleString('en-US')]);
      await expect(page.locator('[data-action="retry"]')).toContainText('再比一轮');
      await capture(page,'09-duel-comparison');
      await page.locator('[data-action="retry"]').click();await waitPhase(page,'running');
      await expect(page.locator('#ui')).toHaveAttribute('data-challenge-round','1');
      assert.equal((await snapshot(page)).config.mode,'versus');
      await finish(page);
      await expect(page.locator('.result-topline')).toContainText('玩家 1');
      await expect(page.locator('[data-action="next-player"]')).toBeVisible();
      await expect(page.locator('.versus-comparison')).toHaveCount(0);
      await capture(page,'10-replay-player-one');
      return {firstScore:firstResult.score,secondScore:secondResult.score,replayRound:1};
    });
  });

  for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
    await runSuite(`layout-${viewport.width}x${viewport.height}`,viewport,async(page,suite)=>{
      await checkStep(suite,'menu has no horizontal overflow and launch stays reachable',async()=>{
        const measure=()=>page.evaluate(()=>{
          const menu=document.querySelector('.menu-screen');
          const selectors=['.brand','.garage','.mode-switch','.car-picker','.route-picker','[data-action="start"]'];
          return {viewportWidth:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,menuWidth:menu.clientWidth,menuScrollWidth:menu.scrollWidth,menuHeight:menu.clientHeight,menuScrollHeight:menu.scrollHeight,menuScrollTop:menu.scrollTop,bounds:selectors.map(selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {selector,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};})};
        });
        const initial=await measure();
        const assertNoOverflow=metrics=>{
          assert.ok(metrics.documentWidth<=viewport.width+1,`Document overflow: ${metrics.documentWidth}`);
          assert.ok(metrics.bodyWidth<=viewport.width+1,`Body overflow: ${metrics.bodyWidth}`);
          assert.ok(metrics.menuScrollWidth<=metrics.menuWidth+1,`Menu horizontal overflow: ${metrics.menuScrollWidth} > ${metrics.menuWidth}`);
          for(const bounds of metrics.bounds)assert.ok(bounds.left>=-1&&bounds.right<=viewport.width+1,`${bounds.selector} exceeds viewport: ${JSON.stringify(bounds)}`);
        };
        assertNoOverflow(initial);
        await capture(page,`11-layout-${viewport.width}-top`);
        await expandLoadout(page);
        const launch=page.locator('[data-action="start"]');
        await launch.scrollIntoViewIfNeeded();
        await expect(launch).toBeVisible();await expect(launch).toBeEnabled();
        const expanded=await measure();assertNoOverflow(expanded);
        const bounds=await launch.boundingBox();
        assert.ok(bounds&&bounds.y>=-1&&bounds.y+bounds.height<=viewport.height+1,'Launch cannot be scrolled into the visible viewport');
        // Trial checks visibility, hit target and clipping without starting touch gameplay.
        await launch.click({trial:true});
        await capture(page,`12-layout-${viewport.width}-launch`);
        return {initial,expanded,launchBounds:bounds,mobileGameplayTested:false};
      });
    });
  }
}catch(error){
  report.bootstrapError=error instanceof Error?error.stack:String(error);
  console.error(report.bootstrapError);
}finally{
  if(browser)await browser.close();
  report.finishedAt=new Date().toISOString();
  report.status=!report.bootstrapError&&report.browserErrors.length===0&&report.suites.length===4&&report.suites.every(suite=>suite.status==='passed')?'passed':'failed';
  await fs.writeFile(path.join(artifacts,'browser-flows.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,suites:report.suites.map(({name,status})=>({name,status})),browserErrors:report.browserErrors,report:'artifacts/browser-flows.json'},null,2));
  if(report.status!=='passed')process.exitCode=1;
}
