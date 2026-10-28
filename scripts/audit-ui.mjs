// Runtime copy audit: CRASH_URL=http://127.0.0.1:5173/ node scripts/audit-ui.mjs [zh|en]
// Opens every surface, reads the visible text and attributes, and reports middle dots, leftover Chinese (en) and text volume.
import {chromium} from '@playwright/test';
const url=process.env.CRASH_URL||'http://127.0.0.1:5173/';
const lang=process.argv[2]||'zh';
const CJK=/[㐀-鿿]/,DOT='·';
const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(language=>{try{localStorage.setItem('crash-city:world-tour-v3',JSON.stringify({settings:{language},records:[]}));localStorage.setItem('crash-city:tips','1');}catch{}},lang);
const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);
await page.waitForFunction(()=>window.__CRASH__&&document.querySelector('[data-action="start"]'),null,{timeout:90000});
await page.waitForTimeout(800);
const read=()=>page.evaluate(()=>{
  const out=[];
  for(const el of document.querySelectorAll('#ui *')){
    if(!el.checkVisibility({checkVisibilityCSS:true})||el.closest('[hidden]'))continue;
    for(const node of el.childNodes)if(node.nodeType===3&&node.textContent.trim())out.push(node.textContent.trim());
    for(const attr of ['aria-label','title','alt','placeholder'])if(el.getAttribute(attr))out.push(`[${attr}] ${el.getAttribute(attr)}`);
  }
  return out;
});
const surfaces=[];
const grab=async name=>{surfaces.push({name,lines:await read()});};
await grab('menu roadtrip');
for(const rule of ['rushhour','pileup','sandbox']){await page.click(`[data-config="rules"][data-value="${rule}"]`);await page.waitForTimeout(250);if(rule==='sandbox'){await page.click('[data-action="loadout"]').catch(()=>{});await page.waitForTimeout(150);}await grab(`menu ${rule}`);}
await page.click('[data-config="rules"][data-value="roadtrip"]');
for(const kind of ['guide','settings','vehicles']){await page.click(`[data-action="${kind}"]`);await page.waitForTimeout(500);await grab(`dialog ${kind}`);if(kind==='vehicles'){await page.click('[data-vehicle="sport"]');await page.waitForTimeout(500);await grab('dialog model');}await page.click('[data-action="close-dialog"]');await page.waitForTimeout(150);}
await page.click('[data-action="start"]');await page.waitForTimeout(1200);await grab('contract draft');
await page.keyboard.press('1');await page.waitForTimeout(400);
await page.evaluate(()=>{__CRASH__.step(2,true);});await page.waitForTimeout(500);await grab('hud');
let drafted=false;for(let i=0;i<40&&!drafted;i++){await page.evaluate(()=>{__CRASH__.step(4,true);});drafted=await page.evaluate(()=>__CRASH__.snapshot().draft?.kind==='perk');}
if(!drafted){console.log('perk draft never opened');process.exit(2);}
await page.waitForTimeout(300);await grab('perk draft');
await page.keyboard.press('2');await page.waitForTimeout(300);
await page.evaluate(()=>{__CRASH__.pause();});await page.waitForTimeout(400);await grab('pause');
await page.evaluate(()=>{__CRASH__.resume();});await page.waitForTimeout(300);
await page.evaluate(()=>{__CRASH__.finish();});await page.waitForTimeout(4600);await grab('results');
const all=surfaces.flatMap(s=>s.lines.map(line=>({surface:s.name,line})));
const dots=all.filter(x=>x.line.includes(DOT));
const cjkInEn=lang==='en'?all.filter(x=>CJK.test(x.line)&&!/^中文$/.test(x.line)):[];
const volume=Object.fromEntries(surfaces.map(s=>[s.name,s.lines.join('').replace(/\s/g,'').length]));
console.log(`language ${lang}; surfaces ${surfaces.length}`);
console.log('visible characters per surface:',JSON.stringify(volume));
console.log(`middle dots: ${dots.length}`);for(const d of dots.slice(0,40))console.log(`  [${d.surface}] ${d.line}`);
if(lang==='en'){console.log(`leftover Chinese: ${cjkInEn.length}`);for(const d of cjkInEn.slice(0,60))console.log(`  [${d.surface}] ${d.line}`);}
console.log(`page errors: ${errors.length?errors.join('; '):'none'}`);
if(process.env.DUMP)console.log(JSON.stringify(surfaces,null,1));
await browser.close();
process.exit(dots.length||cjkInEn.length||errors.length?1:0);
