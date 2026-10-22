import './style.css';
import {GameSimulation,type GameInput} from './simulation/GameSimulation';
import {GameRenderer} from './render/GameRenderer';
import {GameUI} from './ui/GameUI';
import {GameAudio} from './audio/GameAudio';
import {DEFAULT_CONFIG,DEFAULT_SETTINGS,VEHICLES,ROUTES,RULE_VERSION,type RunConfig,type RunResult,type Settings,type GameSnapshot} from './shared';

const STORAGE='crash-city:v1';
function readSaved():{records:RunResult[];settings:Settings}{
 try{const v=JSON.parse(localStorage.getItem(STORAGE)||'{}');return {records:Array.isArray(v.records)?v.records.filter((r:RunResult)=>Number.isFinite(r.score)&&r.config&&r.config.car in VEHICLES).slice(0,60):[],settings:{...DEFAULT_SETTINGS,...v.settings}};}catch{return{records:[],settings:{...DEFAULT_SETTINGS}};}
}
const saved=readSaved();let records=saved.records;let settings=saved.settings;
let config:RunConfig={...DEFAULT_CONFIG};let game:GameSimulation;let renderer:GameRenderer;const audio=new GameAudio();
let ready=false;let showingResult=false;let result:RunResult|undefined;let duel:{base:RunConfig;first?:RunResult;round:1|2}|undefined;
let last=performance.now();const held=new Set<string>();let pointer={x:0,y:0,z:1};let pointerMoved=false;let requestBlast=false;
let lastSnapshot:GameSnapshot|undefined;let latestFPS=60;let frameCount=0;let frameTime=0;
const worldElement=document.querySelector<HTMLElement>('#world')!;const uiElement=document.querySelector<HTMLElement>('#ui')!;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({records,settings}));}catch{ui.toast('本机存储不可用；本次游戏仍可正常进行');}}
function freshSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
function reset(next:RunConfig,start:boolean){
 game?.dispose();game=new GameSimulation(next);config={...next};held.clear();requestBlast=false;showingResult=false;result=undefined;pointerMoved=false;renderer.setOverview(next.route);
 audio.setActive(false);if(start){game.start();audio.setActive(true);ui.hideOverlays();}last=performance.now();
}
function enterMenu(){audio.setActive(false);duel=undefined;uiElement.dataset.challengeRound='1';reset({...config,mode:'solo',seed:freshSeed()},false);ui.showMenu(config,records,settings);}
function start(next:RunConfig){
 void audio.unlock();
 if(duel?.round===2){next={...duel.base,route:next.route};}
 else if(next.mode==='versus'){duel={base:{...next,seed:freshSeed()},round:1};next={...duel.base};}
 else {duel=undefined;next={...next,seed:freshSeed()};}
 reset(next,true);
}
function pause(){if(game?.phase!=='running')return;game.pause();held.clear();audio.setActive(false);ui.showPause(settings);}
function resume(){if(game?.phase!=='paused')return;void audio.unlock();game.resume();audio.setActive(true);ui.hideOverlays();last=performance.now();}
function retry(){if(!ready)return;void audio.unlock();if(duel){duel={base:{...duel.base},round:1};uiElement.dataset.challengeRound='1';}reset(config,true);}
async function share(){
 if(!result)return;
 try{
  const img=new Image();img.src=renderer.screenshot();await img.decode();const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const c=canvas.getContext('2d')!;
  c.fillStyle='#172b2f';c.fillRect(0,0,1200,900);const aspect=img.width/img.height;const h=1200/aspect;c.drawImage(img,0,0,1200,h);
  const gradient=c.createLinearGradient(0,320,0,760);gradient.addColorStop(0,'rgba(17,34,37,0)');gradient.addColorStop(1,'#112225');c.fillStyle=gradient;c.fillRect(0,320,1200,580);
  c.fillStyle='#ffc76b';c.font='italic 900 105px Arial Black, Arial';c.fillText('CRASH!',64,625);
  c.fillStyle='#fff7e8';c.font='900 106px Arial';c.fillText(result.score.toLocaleString(),62,735);
  c.fillStyle='#83d4c4';c.font='24px sans-serif';c.fillText(`旧金山 · ${ROUTES.find(r=>r.id===result!.config.route)!.short}  /  ${VEHICLES[result.config.car].name}`,68,790);
  c.fillStyle='#ccd3c8';c.font='21px sans-serif';c.fillText(`最高连锁 ${result.bestCombo}   ·   命中 ${result.crashes}   ·   摧毁 ${result.destroyed}`,68,833);
  c.font='14px monospace';c.fillStyle='#8faaa8';c.fillText(`${RULE_VERSION} / ${result.config.blast} / ${result.config.passive} / CHALLENGE ${result.config.seed}`,68,868);
  const a=document.createElement('a');a.download=`CRASH-${result.score}-${result.config.seed}.png`;a.href=canvas.toDataURL('image/png');a.click();ui.toast('成绩图已导出，可以分享给朋友');
 }catch{ui.toast('成绩图暂时无法导出，请重试');}
}
const ui=new GameUI(uiElement,{
 onStart:start,onConfig(next){config={...next};if(ready&&game.phase==='ready')reset(config,false);},onPause:pause,onResume:resume,onRetry:retry,onMenu:enterMenu,onBlast(){if(!game.blast())ui.toast('爆破正在充能，满格后再引爆');},
 onMechanism(id){game.useMechanism(id);},onMechanismMode(){game.toggleMechanisms();},onSettings(next){settings={...next};save();},onShare(){void share();},
 onNextPlayer(){if(!duel||!result)return;duel.first=result;duel.round=2;uiElement.dataset.challengeRound='2';reset({...duel.base},false);ui.showMenu(duel.base,records,settings);ui.toast('玩家 2：车辆、配装与车流已统一，可自行选择入场路线');},
});
ui.showLoading('正在装载城市、车辆与碰撞引擎…');

window.addEventListener('pointermove',e=>{if(!renderer||!game)return;const p=renderer.worldFromPointer(e.clientX,e.clientY);pointer=p;pointerMoved=true;});
window.addEventListener('keydown',e=>{
 const editing=e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement;if(editing)return;
 if(e.code==='Escape'){if(game?.phase==='running')pause();else if(game?.phase==='paused')resume();return;}
 if(game?.phase!=='running')return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','Digit1','Digit2','Digit3'].includes(e.code))e.preventDefault();
 held.add(e.code);if(e.repeat)return;
 if(e.code==='Space')requestBlast=true;if(e.code==='KeyE')game.toggleMechanisms();
 if(game.slowMotion&&e.code==='Digit1')game.useMechanism('signal');if(game.slowMotion&&e.code==='Digit2')game.useMechanism('cargo');if(game.slowMotion&&e.code==='Digit3')game.useMechanism('billboard');
 if(e.code==='KeyR')retry();
});
window.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',()=>{held.clear();if(game?.phase==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.phase==='running')pause();});
worldElement.addEventListener('webglcontextlost',()=>{if(game?.phase==='running')pause();ui.toast('画面正在恢复，游戏已为你暂停');},true);
window.addEventListener('resize',()=>renderer?.resize());

function frame(now:number){
 requestAnimationFrame(frame);if(!ready)return;
 const dt=Math.min(.1,(now-last)/1000);last=now;
 frameTime+=dt;frameCount++;if(frameTime>=.7){latestFPS=frameCount/frameTime;frameTime=0;frameCount=0;}
 let x=Number(held.has('KeyD')||held.has('ArrowRight'))-Number(held.has('KeyA')||held.has('ArrowLeft'));
 let z=Number(held.has('KeyS')||held.has('ArrowDown'))-Number(held.has('KeyW')||held.has('ArrowUp'));
 const n=Math.hypot(x,z);if(n){x/=n;z/=n;}
 const hero=game.entities.get(game.playerId)?.body.translation();let aim=game.aim;
 if(pointerMoved&&hero){aim={x:pointer.x-hero.x,y:0,z:pointer.z-hero.z};}else if(n)aim={x,y:0,z};
 const input:GameInput={x,z,aim,blast:requestBlast||held.has('Space')};requestBlast=false;
 game.update(dt,input);const snapshot=game.snapshot();snapshot.fps=latestFPS;lastSnapshot=snapshot;
 renderer.render(snapshot,dt,settings);audio.update(snapshot,settings);ui.update(snapshot);
 if(game.phase==='ended'&&!showingResult){
  showingResult=true;result=game.result();records.unshift(result);records=records.slice(0,60);save();audio.setActive(false);ui.showResults(result,duel?.round===2?duel.first:undefined);
 }
}

async function boot(){
 try{
  renderer=new GameRenderer(worldElement);await Promise.all([GameSimulation.init(),renderer.init()]);reset(config,false);ready=true;ui.showMenu(config,records,settings);requestAnimationFrame(frame);
  // Read-only diagnostics plus explicit dev controls for repeatable playtesting. Absent from production builds.
  if(import.meta.env.DEV)(window as any).__CRASH__={snapshot:()=>lastSnapshot||game.snapshot(),stats:()=>({...renderer.getStats(),fps:latestFPS}),start:(partial:Partial<RunConfig>={})=>start({...DEFAULT_CONFIG,...partial}),blast:()=>game.blast(),mechanism:(id:Parameters<GameSimulation['useMechanism']>[0])=>game.useMechanism(id),finish:()=>{game.time=.01;},step:(seconds:number)=>{for(let t=0;t<seconds;t+=1/60)game.update(1/60,{x:0,z:0,aim:game.aim,blast:true});},pause,resume};
 }catch(error){console.error(error);ui.showError(`城市未能装载。请刷新重试，或换用支持 WebGL 2 的电脑浏览器。${import.meta.env.DEV?' '+String(error):''}`);}
}
void boot();
