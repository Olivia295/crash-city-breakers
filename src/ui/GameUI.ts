import { translate } from '../i18n';
import { CarPreview } from './CarPreview';
import { CITIES, getCity, cityRoutes } from '../cities';
import { challengeLabels, recordKey } from '../simulation/rules';
import { CONTRACTS, MUTATORS, PAINTS, PERKS, contractById, type DailySetup, type PerkId } from '../simulation/perks';
import { BLAST_MODS, DEFAULT_CONFIG, DEFAULT_SETTINGS, MECHANISMS, PASSIVE_MODS, PLAYER_CARS, PLAYER_STATS, PLAYER_ABILITIES, RULE_VERSION, VEHICLES, type CityId, type Language, type VehicleKind, type GameSnapshot, type MechanismId, type Profile, type RunConfig, type RunResult, type Settings } from '../shared';

export interface UICallbacks {
  onStart(config:RunConfig):void; onConfig(config:RunConfig):void; onBlast():void; onAbility():void;
  onPause():void; onResume():void; onRetry():void; onMenu():void;
  onMechanism(id:MechanismId):void; onMechanismMode():void;
  onSettings(settings:Settings):void; onShare():void; onNextPlayer():void;
  onDraft(index:number):void; onPaint(id:string):void;
}
export interface DailyInfo {setup:DailySetup;best:number;streak:number}
export interface ResultExtra {gained:number;total:number;unlocked:string[];dailyBest?:number;streak?:number}

type RuleMode='roadtrip'|'rushhour'|'pileup'|'sandbox';
type RuleSnapshot=GameSnapshot & Partial<{
  trafficTotal:number;trafficRemaining:number;escaped:number;escapeLimit:number;wave:number;
  featureProgress:number;feature:string;featureTime:number;roundStage:string;finalePower:number;
  infernoTime:number;infernoMultiplier:number;stars:number;starProgress:number;
  breakdown:{traffic:number;property:number;bonus:number};bonusNextIn:number;pizzaOnField:boolean;bonusDraws:number;
}>;
type RuleResult=RunResult & Partial<{ruleVersion:string;outcome:'complete'|'escaped'|'timeout';escaped:number;stars:number;breakdown:{traffic:number;property:number;bonus:number}}>;
const rulesOf=(config:RunConfig):RuleMode=>config.rules??'roadtrip';
const normalizedConfig=(config:RunConfig):RunConfig=>rulesOf(config)==='sandbox'?{...config,city:getCity(config.city).id}:{...config,city:getCity(config.city).id,blast:'radial',passive:'balanced'};
const escapeHTML=(value:unknown):string=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const scoreText=(score:number):string=>Math.round(score).toLocaleString('en-US');
const money=(score:number):string=>`$${scoreText(score)}`;
const colorHex=(color:number):string=>`#${color.toString(16).padStart(6,'0')}`;
const clamp01=(value:number):number=>Math.max(0,Math.min(1,value));
const arrow='<span aria-hidden="true">››</span>';
const glyph=(path:string,color:string):string=>`<svg viewBox="0 0 24 24" class="glyph" style="--glyph:${color}" aria-hidden="true"><path d="${path}"/></svg>`;
const paintHex=(color:number):string=>color?colorHex(color):'';
const RULES:Record<RuleMode,{name:string;zh:string;tag:string;description:string;objective:string}>={
  roadtrip:{name:'ROAD TRIP',zh:'公路之旅',tag:'拦住车流 · 挺到终场',description:'阻挡整轮车流，收获特殊事件与终场灾难。5 辆完整逃脱，挑战结束。',objective:'堵住出口，别让 5 辆车逃脱。'},
  rushhour:{name:'RUSH HOUR',zh:'高峰时刻',tag:'90 秒 · 全力破坏',description:'90 秒内尽情破坏。炸开披萨车转动幸运轮盘，到时引发终场大爆破。',objective:'90 秒竞分，车辆逃脱不扣机会。'},
  pileup:{name:'PILE UP',zh:'连环堆撞',tag:'积攒残骸 · 引燃地狱',description:'先堵住有限车流，保留可燃目标。进入 INFERNO 后，让火焰持续，放大得分。',objective:'先堆积，再点燃。别让 INFERNO 熄灭。'},
  sandbox:{name:'SANDBOX',zh:'自由连锁',tag:'120 秒 · 自选机关',description:'带上专属配装，反复爆破。三次现场机关，让城市按你的思路崩塌。',objective:'120 秒，自选配装与 3 次现场机关。'},
};
const FEATURES:Record<string,{name:string;symbol:string;description:string}>={
  none:{name:'等待下一次事件',symbol:'★',description:'制造碰撞，推进现场事件'},
  goodcop:{name:'好警察 · 封锁出口',symbol:'✦',description:'警车帮助拦住车流'},
  badcop:{name:'坏警察 · 注意躲避',symbol:'!',description:'被追上会暂时无法爆破'},
  magnet:{name:'磁力吸引',symbol:'∩',description:'附近车辆被吸向你的残骸'},
  double:{name:'双倍奖励',symbol:'×2',description:'把握时机，扩大破坏'},
  freeze:{name:'冰封路口',symbol:'❄',description:'利用冰面推动更多残骸'},
  tornado:{name:'龙卷风',symbol:'≋',description:'终场灾难正在席卷街区'},
  airstrike:{name:'空中冲击',symbol:'✈',description:'终场灾难正在穿过街区'},
  tidalwave:{name:'巨浪来袭',symbol:'≈',description:'终场灾难正在冲刷街区'},
  ufo:{name:'不明飞行物',symbol:'◉',description:'终场灾难正在扫过街区'},
  asteroid:{name:'陨石冲击',symbol:'✹',description:'终场灾难即将撞击街区'},
  monster:{name:'巨兽来袭',symbol:'♜',description:'终场灾难正在碾过街区'},
};
const statArrows=(value:number):string=>Array.from({length:7},(_,i)=>`<i class="${i<value?'filled':''}"></i>`).join('');
const PIZZA_FEATURES=['goodcop','magnet','double','freeze'];
const starsHTML=(count:number):string=>Array.from({length:5},(_,i)=>`<span class="${i<count?'earned':''}" aria-hidden="true">★</span>`).join('');
const carIcon=(kind:string,color:string):string=>`<svg viewBox="0 0 104 43" aria-hidden="true" class="car-silhouette" style="--car-color:${color}"><path d="${kind==='semi'?'M5 8h57v23H5z M65 15h19l13 12v7H65z':kind==='pickup'?'M7 22h35V9h25l13 12h15v12H7z':kind==='sport'?'M6 26l25-7L45 9h22l17 13 13 5v7H6z':'M11 24l10-16h40l17 15 13 4v7H8z'}" fill="currentColor"/><path d="M${kind==='semi'?'72 19h10l8 8H72z':kind==='pickup'?'49 13h15l10 10H49z':kind==='sport'?'45 13h18l12 9H35z':'26 12h29l12 12H19z'}" fill="#17202c"/><circle cx="25" cy="33" r="8" fill="#101317"/><circle cx="79" cy="33" r="8" fill="#101317"/><circle cx="25" cy="33" r="3" fill="#dce1e5"/><circle cx="79" cy="33" r="3" fill="#dce1e5"/></svg>`;
/** The schematics use the same road and approach geometry as the running city. */
const routeIcon=(cityId:CityId,id:string):string=>{
  const city=getCity(cityId),route=city.routes.find(item=>item.id===id)!;
  const line=(points:{x:number;z:number}[])=>points.map((p,i)=>`${i?'L':'M'}${p.x+80} ${p.z+80}`).join(' ');
  const ring=cityId==='london'?'<circle cx="80" cy="80" r="22" class="route-base"/>':'';
  return `<svg class="route-map" viewBox="0 0 160 160" aria-hidden="true">${city.roads.map(road=>`<path class="route-base" d="${line(road.points)}"/>`).join('')}${ring}<path class="route-line" d="M${route.x+80} ${route.z+80}l${route.dx*36} ${route.dz*36}"/><circle cx="${route.x+80}" cy="${route.z+80}" r="6" fill="currentColor"/></svg>`;
};
const cityMap=(id:CityId):string=>{
  const common='<path class="map-grid" d="M0 27H240M0 54H240M0 81H240M0 108H240M30 0V130M60 0V130M90 0V130M120 0V130M150 0V130M180 0V130M210 0V130"/>';
  const roads=id==='sf'?'<path class="map-road" d="M19 98H139M79 44V130"/><path class="map-lane" d="M19 98H139M79 44V130"/><path class="map-rail" d="M69 55V126M72 55V126"/>':id==='sydney'?'<path class="map-water" d="M152 0Q115 36 151 61T145 130H240V0Z"/><path class="map-road" d="M12 86H161M62 37V86M114 86V130"/><path class="map-lane" d="M12 86H161M62 37V86M114 86V130"/>':'<path class="map-water" d="M159 0Q138 32 173 68T169 130H240V0Z"/><path class="map-road" d="M8 86H50M106 86H159M78 29V58M78 114V136"/><circle class="map-road" cx="78" cy="86" r="28"/><path class="map-lane" d="M8 86H50M106 86H159M78 29V58M78 114V136"/><circle class="map-lane" cx="78" cy="86" r="28"/>';
  const landmark=id==='sf'?'<g class="map-landmark"><path d="M104 49H235M112 52V59M132 51V8M136 51V8M203 51V8M207 51V8M128 14H140M128 24H140M199 14H211M199 24H211M108 33Q132 35 134 15Q168 58 205 15Q214 35 235 34M149 29V48M166 39V48M187 31V48"/><path d="M120 112V95H144V112ZM118 94H146L142 88H123ZM124 98V105M132 98V105M140 98V105M117 115H147"/><circle cx="124" cy="114" r="3"/><circle cx="141" cy="114" r="3"/></g>':id==='sydney'?'<g class="map-landmark"><path d="M134 58H229M139 54Q181 -3 223 54M145 49Q181 9 217 49M145 47V57M158 32V57M171 24V57M185 24V57M199 32V57M213 44V57M137 40V61M226 40V61"/><path d="M141 119H229M147 114Q153 91 168 79L163 115M162 115Q177 81 189 72L184 115M182 115Q207 87 215 86L208 115M148 115H223"/></g>':'<g class="map-landmark"><path d="M181 123V38H203V123M178 39H206L199 27H185ZM186 27V15H198V27M192 15V7M184 19H200M184 58H200M184 76H200M184 93H200M178 124H207M187 80V89M197 80V89M187 99V119M197 99V119"/><circle cx="192" cy="48" r="7"/><path d="M192 43V48L196 50M17 49V17Q17 12 23 12H54Q60 12 60 17V49ZM19 31H58M23 18H32V26H23ZM38 18H47V26H38ZM23 35H33V42H23ZM39 35H49V42H39Z"/><circle cx="26" cy="49" r="4"/><circle cx="51" cy="49" r="4"/></g>';
  return `<svg class="city-map" viewBox="0 0 240 130" role="img" aria-label="${escapeHTML(getCity(id).landmark)}，${id==='sf'?'坡道十字路口':id==='sydney'?'错位双 T 路口':'环岛道路'}">${common}${roads}${landmark}<g class="map-pins"><circle cx="${id==='sydney'?62:78}" cy="${id==='sydney'?86:id==='sf'?98:86}" r="5"/><circle cx="${id==='sydney'?62:78}" cy="${id==='sydney'?86:id==='sf'?98:86}" r="10"/></g></svg>`;
};

/** DOM presentation only. Simulation, random outcomes and keyboard input live in the game. */
export class GameUI {
  private readonly overlay:HTMLDivElement;
  private readonly hud:HTMLDivElement;
  private readonly dialog:HTMLDivElement;
  private readonly toastElement:HTMLDivElement;
  private config:RunConfig={...DEFAULT_CONFIG};
  private settings:Settings={...DEFAULT_SETTINGS};
  private records:RunResult[]=[];
  private screen:'menu'|'game'|'pause'|'results'|'loading'|'error'='loading';
  private loadoutOpen=false;
  private toastTimer=0;
  private snapshot?:RuleSnapshot;
  private lastFocus:HTMLElement|null=null;
  private readonly fields:Record<string,HTMLElement>={};
  private seenEvents=new Set<number>();
  private lastNotice='';
  private noticeUntil=0;
  private pizzaUntil=0;
  private pizzaStart=0;
  private pizzaResult='none';
  private lastFeature='none';
  private lastScore=0;
  private preview?:CarPreview;
  private lastStage='';
  private stageUntil=0;
  private textSources=new WeakMap<Node,string>();
  private attributeSources=new WeakMap<Element,Record<string,string>>();
  private dialogKind='';
  private dialogVehicle=false;
  private resultPair?:{result:RunResult;previous?:RunResult;extra?:ResultExtra};
  private profile:Profile={stars:0,paint:'stock',best:{}};
  private daily?:DailyInfo;
  private draftId=0;
  private megaUntil=0;
  private lastToast='';
  private pizzaWinningTime=0;
  private pauseStarted=0;
  private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private t(text:string):string{return translate(text,this.settings.language??'zh');}
  private setText(field:string,value:string):void {
    const element=this.fields[field],text=this.t(value);
    if(element.textContent!==text){element.textContent=text;if(element.firstChild)this.textSources.set(element.firstChild,value);}
  }
  /** Translate once when a surface is created or its language changes. */
  private localize(root:HTMLElement):void {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;if((node.parentElement as HTMLElement)?.closest('[data-language-name]'))continue;
      const original=this.textSources.get(node)??node.textContent??'';this.textSources.set(node,original);node.textContent=this.t(original);
    }
    for(const element of [root,...root.querySelectorAll<HTMLElement>('[aria-label],[title],[alt]')]){
      const originals=this.attributeSources.get(element)??{};
      for(const attribute of ['aria-label','title','alt']){const raw=originals[attribute]??element.getAttribute(attribute);if(raw!==null){originals[attribute]=raw;element.setAttribute(attribute,this.t(raw));}}
      this.attributeSources.set(element,originals);
    }
    this.container.dataset.language=this.settings.language??'zh';document.documentElement.lang=this.settings.language==='en'?'en':'zh-CN';
  }
  setSettings(settings:Settings):void {this.settings={...settings};this.localize(this.hud);this.localize(this.overlay);}
  private changeLanguage(language:Language):void {
    const dialog=this.dialogKind;this.settings={...this.settings,language};this.callbacks.onSettings({...this.settings});
    if(this.screen==='menu')this.renderMenu();
    else if(this.screen==='pause')this.showPause(this.settings);
    else if(this.screen==='results'&&this.resultPair)this.showResults(this.resultPair.result,this.resultPair.previous,this.resultPair.extra);
    else this.localize(this.overlay);
    this.localize(this.hud);if(this.lastToast)this.toastElement.textContent=this.t(this.lastToast);
    if(dialog)this.showDialog(dialog);
  }
  private restoreMenuPreview():void {
    if(this.screen==='menu'){const host=this.overlay.querySelector<HTMLElement>('.vehicle-preview');if(host){this.preview??=new CarPreview();this.preview.show(host,this.config.car,this.profile.paint);}}
  }

  constructor(private readonly container:HTMLElement,private readonly callbacks:UICallbacks) {
    container.classList.add('crash-ui');
    container.innerHTML='<div class="game-hud" hidden></div><div class="screen-layer"></div><div class="dialog-layer" hidden></div><div class="game-toast" role="status" aria-live="polite" hidden></div>';
    this.overlay=container.querySelector('.screen-layer')!;this.hud=container.querySelector('.game-hud')!;
    this.dialog=container.querySelector('.dialog-layer')!;this.toastElement=container.querySelector('.game-toast')!;
    this.buildHud();container.addEventListener('click',this.handleClick);container.addEventListener('input',this.handleInput);container.addEventListener('change',this.handleChange);
    container.addEventListener('keydown',event=>{
      if(!this.dialog.hidden&&event.key==='Escape'){event.preventDefault();event.stopPropagation();this.closeDialog();}
      if(!this.dialog.hidden&&event.key==='Tab')this.trapFocus(event);
      if((event.target as HTMLElement).matches('input,select'))event.stopPropagation();
    });
  }

  showMenu(config:RunConfig,records:RunResult[],settings:Settings,profile?:Profile,daily?:DailyInfo):void {
    if(profile)this.profile={...profile};if(daily)this.daily=daily;
    this.config=normalizedConfig({...config,daily:undefined,mutator:undefined});this.records=records;this.settings={...settings};this.screen='menu';this.hud.hidden=true;
    this.seenEvents.clear();this.pizzaUntil=0;this.lastNotice='';this.lastFeature='none';this.lastStage='';this.closeDialog();this.renderMenu();
  }

  private renderMenu():void {
    const car=VEHICLES[this.config.car],rule=rulesOf(this.config),info=RULES[rule],stats=PLAYER_STATS[this.config.car]??{power:0,aftertouch:0};
    const best=Math.max(0,...this.records.filter(record=>recordKey(record.config,record.ruleVersion??RULE_VERSION)===recordKey(this.config)).map(record=>record.score));
    const city=getCity(this.config.city),routes=cityRoutes(city.id),route=routes.find(item=>item.id===this.config.route)!;
    const ability=PLAYER_ABILITIES[this.config.car]!;
    const locked=this.container.dataset.challengeRound==='2';
    this.overlay.hidden=false;
    this.overlay.innerHTML=`<section class="menu-screen" style="--city-color:${city.color}" aria-label="城市连锁车库"><div class="garage-stars" aria-hidden="true">★</div><div class="menu-layout">
      <header class="menu-header"><div class="brand"><span class="eyebrow">WORLD TOUR / 03 CITIES</span><h1>CRASH<span>!</span></h1><div class="brand-subtitle">城 市 连 锁 <span>CREATE A CHAIN REACTION</span></div></div><div class="menu-header-right"><span class="edition">${locked?'PLAYER 02 / 条件已锁定':`${city.code} / ${city.englishName}`}</span><div class="garage-footer"><button type="button" data-action="guide">怎么玩</button><button type="button" data-action="vehicles">车流图鉴</button><button type="button" data-action="settings">设置</button><button type="button" class="language-toggle" data-action="language" aria-label="界面语言" data-language-name>${this.settings.language==='en'?'中文':'EN'}</button></div><span class="desktop-note">桌面键鼠 · 本地街机</span></div></header>
      <section class="city-selection" aria-label="选择独立城市"><div class="city-section-heading"><b>01 / SELECT CITY <span>选择城市</span></b><span>${locked?'同机第二轮 · 城市已锁定':'三座城市 · 三种道路结构'}</span></div><div class="city-picker">${Object.values(CITIES).map(item=>`<button type="button" class="city-choice ${city.id===item.id?'is-selected':''}" data-config="city" data-value="${item.id}" style="--city-color:${item.color}" aria-pressed="${city.id===item.id}" ${locked?'disabled':''}><span class="city-card-copy"><small>${item.code} <i>${city.id===item.id?'● SELECTED':'○'}</i></small><strong>${item.name}<em>${item.englishName}</em></strong><span>${item.tagline}</span></span>${cityMap(item.id)}</button>`).join('')}</div></section>
      <nav class="rules-picker" aria-label="玩法规则">${(Object.keys(RULES) as RuleMode[]).map(id=>`<button type="button" data-config="rules" data-value="${id}" class="rule-choice ${rule===id?'is-selected':''}" aria-pressed="${rule===id}" ${locked?'disabled':''}><span>${RULES[id].name}</span><b>${RULES[id].zh}</b><small>${RULES[id].tag}</small></button>`).join('')}</nav>
      <div class="garage-main"><section class="vehicle-stage" aria-label="选择座驾"><div class="section-caption"><span><b>02 / SELECT VEHICLE</b> / 选择座驾</span><span>0${PLAYER_CARS.indexOf(this.config.car)+1} <i>/ 04</i></span></div><div class="vehicle-showcase"><div class="showcase-grid"></div><span class="showcase-index">0${PLAYER_CARS.indexOf(this.config.car)+1}</span><div class="vehicle-preview" role="img" aria-label="${car.name}，游戏内三维模型"></div><div class="vehicle-title"><span>${car.tag}</span><h2>${car.name}</h2></div><div class="car-attributes"><div class="power-stat"><span>CRASHBREAKER <b>POWER</b></span><div>${statArrows(stats.power)}</div></div><div class="aftertouch-stat"><span>AFTERTOUCH <b>CONTROL</b></span><div>${statArrows(stats.aftertouch)}</div></div></div></div>
      <div class="car-picker">${PLAYER_CARS.map((id,i)=>`<button type="button" class="car-choice ${this.config.car===id?'is-selected':''}" data-config="car" data-value="${id}" ${locked?'disabled':''} aria-pressed="${this.config.car===id}" aria-label="${VEHICLES[id].name}，${VEHICLES[id].tag}"><span class="car-card-number">0${i+1}</span>${carIcon(id,colorHex(VEHICLES[id].color))}<span>${VEHICLES[id].name}</span><i class="selection-mark">${this.config.car===id?'SELECTED':'READY'}</i></button>`).join('')}</div>${this.paintRow(locked)}<div class="vehicle-ability" style="--ability-color:${ability.color}"><kbd>Q</kbd><div><span>主动技能 <b>${ability.name}</b><i>${ability.tag}</i></span><p>${ability.description}</p><small>${ability.cooldown} 秒冷却 · 消耗 ${Math.round(ability.cost*100)}% 爆破能量 · 鼠标选择方向</small></div></div></section>
      <aside class="race-setup" aria-label="出发准备"><div class="section-caption"><span><b>03 / ENTER THE CITY</b> / 赛事准备</span><span class="setup-status">● READY</span></div><div class="mode-switch" aria-label="游戏模式">${this.choice('mode','solo','单人街机',this.config.mode)}${this.choice('mode','versus','同机对决',this.config.mode)}</div><div class="event-description"><span>${info.name}</span><h3>${info.zh}</h3><p>${info.description}</p><button type="button" class="event-goals-button" data-action="guide">HOW TO PLAY <span>★ 五星目标 ›</span></button></div><div class="selected-city-brief"><span>${city.code} / ${city.name}</span><strong>${city.district}</strong><p>${city.description}</p></div><div class="route-heading"><b>选择入场路线</b><span>${city.name} / 三种战术</span></div><div class="route-picker">${routes.map(item=>`<button type="button" class="route-choice ${this.config.route===item.id?'is-selected':''}" style="--route-color:${item.color}" data-config="route" data-value="${item.id}" aria-pressed="${this.config.route===item.id}">${routeIcon(city.id,item.id)}<span class="route-number">${item.name.slice(0,2)}</span><strong>${item.short}</strong></button>`).join('')}</div><p class="route-description">${route.description}</p>
      ${rule==='sandbox'?`<section class="loadout-section"><button type="button" class="loadout-toggle" data-action="loadout" aria-expanded="${this.loadoutOpen}" aria-controls="loadout-options"><span><b>配装车间</b></span><span>${BLAST_MODS.find(item=>item.id===this.config.blast)!.name} <i>${this.loadoutOpen?'−':'+'}</i></span></button><div id="loadout-options" class="loadout-options" ${this.loadoutOpen?'':'hidden'}><label>爆破改装<select data-config="blast" ${locked?'disabled':''}>${BLAST_MODS.map(item=>`<option value="${item.id}" ${this.config.blast===item.id?'selected':''}>${item.name} · ${item.description}</option>`).join('')}</select></label><label>被动配装<select data-config="passive" ${locked?'disabled':''}>${PASSIVE_MODS.map(item=>`<option value="${item.id}" ${this.config.passive===item.id?'selected':''}>${item.name} · ${item.description}</option>`).join('')}</select></label></div></section>`:''}
      <div class="launch-block"><button type="button" class="button button-primary launch-button" data-action="start">${this.config.mode==='versus'?locked?'玩家 2，出发！':'玩家 1，出发！':'开始连锁'} ${arrow}</button><p>${this.config.mode==='versus'?locked?'城市、车辆、规则与车流已锁定。选好路线，开始。':'同城 · 同车 · 同一车流，轮流较量':info.objective}</p></div>${locked?'':this.dailyCard()}</aside></div>
      <footer class="menu-footer"><span><b>LOCAL RECORD</b> <strong>${best?money(best):'$000,000,000'}</strong><small>${city.name} / 当前车辆 / 规则</small></span><span>${city.landmark} <i>◆</i> ${city.traffic}</span></footer>
    </div></section>`;
    this.localize(this.overlay);
    try{this.preview??=new CarPreview();this.preview.show(this.overlay.querySelector<HTMLElement>('.vehicle-preview')!,car.id,this.profile.paint);}
    catch(error){console.warn('Vehicle preview unavailable',error);this.overlay.querySelector('.vehicle-preview')!.innerHTML=carIcon(car.id,colorHex(car.color));}
  }

  private paintRow(locked:boolean):string {
    return `<div class="paint-row" role="group" aria-label="车辆涂装"><span>涂装 <b>★ ${this.profile.stars}</b></span><div>${PAINTS.map(paint=>{const open=paint.stars<=this.profile.stars,hex=paintHex(paint.color);return `<button type="button" class="paint-swatch ${this.profile.paint===paint.id?'is-selected':''} ${open?'':'is-locked'} ${hex?'':'is-stock'}" style="${hex?`--paint:${hex}`:''}" data-paint="${paint.id}" aria-pressed="${this.profile.paint===paint.id}" aria-label="${paint.name}${open?'':`，需要累计 ${paint.stars} 星`}" title="${paint.name}${open?'':` · ★${paint.stars}`}" ${locked?'disabled':''}>${open?'':`<i>${paint.stars}</i>`}</button>`;}).join('')}</div></div>`;
  }
  private dailyCard():string {
    const info=this.daily;if(!info)return '';
    const {config,mutator}=info.setup,city=getCity(config.city),m=MUTATORS[mutator];
    return `<div class="daily-card" style="--mutator-color:${m.color}"><div class="daily-head"><span>DAILY CHALLENGE · ${info.setup.date}</span><b>${info.streak?`连续 ${info.streak} 天`:'今日尚未挑战'}</b></div><div class="daily-body"><strong>${city.name} · ${VEHICLES[config.car].name} · ${RULES[rulesOf(config)].zh}</strong><em>${glyph(m.icon,m.color)}${m.name}<small>${m.description}</small></em></div><div class="daily-foot"><span>今日最佳 <b>${info.best?money(info.best):'—'}</b></span><button type="button" class="button button-outline" data-action="daily">挑战今日 ${arrow}</button></div></div>`;
  }

  private choice(field:string,value:string,label:string,current:string):string {
    return `<button type="button" data-config="${field}" data-value="${value}" ${this.container.dataset.challengeRound==='2'?'disabled':''} class="${current===value?'is-selected':''}" aria-pressed="${current===value}">${label}</button>`;
  }

  private buildHud():void {
    this.hud.innerHTML=`<div class="traffic-cluster"><div class="traffic-diamond"><div><span data-field="trafficLabel">TRAFFIC</span><strong data-field="trafficRemaining">—</strong><small data-field="trafficUnit">LEFT</small></div></div><div class="traffic-right"><div class="stage-caption"><span data-field="stageLabel">ROAD TRIP</span><b data-field="wave">01 / 03</b></div><div class="stage-track"><i data-field="featureProgress"></i><span>›</span><span>›</span><span>›</span></div><div class="escape-row" data-field="escapes" aria-label="车辆逃脱次数">${Array.from({length:5},()=>'<i>×</i>').join('')}</div><div class="inferno-info" data-field="inferno" hidden></div></div><div class="multiplier-diamond" data-field="multiplier" hidden><span>INFERNO</span><strong data-field="multiplierValue">×1</strong></div><div class="active-feature" data-field="featureStatus" hidden><b data-field="featureSymbol">★</b><span data-field="featureName"></span><small data-field="featureTime"></small></div></div>
      <div class="score-cluster"><div class="score-plate"><span class="hud-label" data-field="ruleLabel">ROAD TRIP</span><strong data-field="score">$000,000,000</strong></div><div class="hud-stars" data-field="stars" aria-label="0 / 5 星">${starsHTML(0)}</div><div class="star-track"><i data-field="starProgress"></i></div><div class="combo-line"><span data-field="combo" hidden>连锁 ×1</span><span class="chain-mult" data-field="chainMult" hidden>1.0x</span><span data-field="crashes">0 个目标卷入</span></div><div class="combo-track"><i data-field="comboTrack"></i></div></div>
      <button type="button" class="pause-button" data-action="pause" aria-label="暂停游戏，Esc"><span aria-hidden="true">Ⅱ</span><kbd>ESC</kbd></button>
      <div class="hud-notice" data-field="notice" role="status" aria-live="polite" hidden></div>
      <div class="blast-cluster"><div class="blast-status"><span>CRASHBREAKER</span><strong data-field="blastLabel">正在充能</strong></div><button type="button" class="blast-meter" data-action="blast" aria-label="按空格进行爆破"><span data-field="blastBar"></span><b><span data-field="blastAction">CHARGING</span><kbd>SPACE</kbd></b></button><span class="aim-hint">鼠标瞄准 · 空格爆破 · WASD / 方向键空中调整</span></div>
      <div class="ability-cluster" data-field="abilityCluster"><button type="button" class="ability-trigger" data-action="ability" data-field="abilityButton" aria-label="Q 主动技能"><kbd>Q</kbd><span><strong data-field="abilityName">车辆技能</strong><small data-field="abilityState">READY</small></span><b data-field="abilityCountdown">✓</b><i data-field="abilityProgress"></i></button></div>
      <div class="city-event-hud" data-field="cityEvent"><span data-field="cityLabel"></span><div><strong data-field="cityEventName"></strong><small data-field="cityEventCount">0 / 3</small></div><div class="city-event-track"><i data-field="cityEventProgress"></i></div><p data-field="cityEventHint">在标记区爆破</p></div>
      <div class="mechanism-cluster" data-field="mechanismCluster" hidden><button type="button" class="mechanism-trigger" data-action="mechanism-mode"><kbd>E</kbd><span>现场机关</span><b data-field="charges">● ● ●</b></button><span class="mechanism-hint" data-field="mechanismHint">每局 3 次 · 选取时慢动作</span></div>
      <div class="mechanism-panel" data-field="mechanisms" hidden><div class="mechanism-heading"><span>选择现场机关</span><kbd>E 取消</kbd></div><div>${MECHANISMS.map((item,i)=>`<button type="button" data-mechanism="${item.id}"><kbd>${i+1}</kbd><strong>${item.name}</strong><span>${item.description}</span></button>`).join('')}</div></div>
      <div class="pizza-callout" data-field="pizza" hidden><div class="pizza-wheel-wrap" aria-hidden="true"><div class="pizza-pointer"></div><div class="pizza-disc" data-field="pizzaWheel">${PIZZA_FEATURES.map((feature,i)=>`<span class="pizza-symbol" style="--angle:${i*90}deg">${FEATURES[feature].symbol}</span>`).join('')}</div></div><div class="pizza-result-banner"><span>PIZZA OF FORTUNE</span><div class="pizza-reel-window" aria-hidden="true"><div class="pizza-reel" data-field="pizzaReel">${Array.from({length:7},()=>PIZZA_FEATURES.map(feature=>`<span><b>${FEATURES[feature].symbol}</b>${FEATURES[feature].name}</span>`).join('')).join('')}</div><i></i></div><span class="pizza-winner-label" data-field="pizzaWinner">中奖效果</span><strong data-field="pizzaResult">幸运轮盘转动中…</strong><small data-field="pizzaDetail">现场事件</small></div></div><div class="stage-banner" data-field="stageBanner" hidden><span data-field="stageLead"></span><strong data-field="stageTitle"></strong><small data-field="stageHint"></small></div>
      <div class="perk-row" data-field="perkRow" hidden></div><div class="mutator-tag" data-field="mutator" hidden></div>
      <div class="contract-card" data-field="contract" hidden><span class="contract-kicker">CONTRACT <b data-field="contractName"></b></span><p data-field="contractDesc"></p><div class="contract-track"><i data-field="contractBar"></i></div><small data-field="contractCount"></small></div>
      <div class="mega-callout" data-field="mega" hidden><strong data-field="megaText"></strong><small data-field="megaSub"></small></div>
      <div class="draft-panel" data-field="draft" hidden></div>
      <div class="performance-note" data-field="fps"></div>`;
    this.localize(this.hud);
    this.hud.querySelectorAll<HTMLElement>('[data-field]').forEach(item=>{this.fields[item.dataset.field!]=item;});
  }

  update(snapshot:GameSnapshot):void {
    const state=snapshot as RuleSnapshot;
    this.snapshot=state;if(this.screen!=='game')return;
    const now=performance.now(),rule=rulesOf(state.config),timed=rule==='rushhour'||rule==='sandbox';
    if(state.score<this.lastScore&&(state.roundStage==='approach'||state.crashes===0)){this.seenEvents.clear();this.pizzaUntil=0;this.lastFeature='none';this.lastNotice='';this.lastStage='';}
    this.lastScore=state.score;this.hud.hidden=false;this.hud.classList.toggle('has-ended',state.phase==='ended');this.hud.dataset.rules=rule;
    this.setText('score',`$${Math.round(state.score).toString().padStart(9,'0').replace(/\B(?=(\d{3})+(?!\d))/g,',')}`);
    const city=getCity(state.config.city),ability=PLAYER_ABILITIES[state.config.car]!;
    this.setText('ruleLabel',`${city.code} / ${RULES[rule].name}`);
    this.fields.abilityCluster.style.setProperty('--ability-color',ability.color);
    this.setText('abilityName',ability.name);
    const cost=state.abilityCost??ability.cost,abilityReady=state.abilityReady&&state.blastCharge>=cost&&state.abilityCooldown<=0&&state.phase==='running';
    const active=state.abilityActive>0;
    (this.fields.abilityButton as HTMLButtonElement).disabled=!abilityReady;
    this.fields.abilityButton.classList.toggle('is-ready',abilityReady);this.fields.abilityButton.classList.toggle('is-active',active);
    this.setText('abilityState',active?'技能生效中':state.roundStage==='finale'?'终场中暂不可用':state.abilityCooldown>0?'冷却恢复中':abilityReady?`消耗 ${Math.round(cost*100)}% 能量`:`需要 ${Math.round(cost*100)}% 能量`);
    this.setText('abilityCountdown',state.abilityCooldown>0?`${Math.ceil(state.abilityCooldown)}s`:abilityReady?'READY':'充能');
    this.fields.abilityProgress.style.transform=`scaleX(${clamp01(1-state.abilityCooldown/ability.cooldown)})`;
    this.fields.abilityButton.setAttribute('aria-label',this.t(`Q ${ability.name}，${this.fields.abilityState.textContent}`));
    this.fields.cityEvent.style.setProperty('--city-color',city.color);
    this.setText('cityLabel',`${city.name} / ${city.district}`);
    this.setText('cityEventName',state.cityEvent.name);
    this.setText('cityEventCount',state.cityEvent.triggered?'已触发':`${Math.round(clamp01(state.cityEvent.progress)*100)}%`);
    this.fields.cityEventProgress.style.transform=`scaleX(${clamp01(state.cityEvent.progress)})`;
    this.fields.cityEvent.classList.toggle('is-triggered',state.cityEvent.triggered);
    this.setText('cityEventHint',state.cityEvent.triggered?'本城事件已启动':'标记区碰撞 / 爆破，积攒事件');
    this.fields.cityEvent.title=this.t(state.cityEvent.description);
    const seconds=Math.max(0,Math.ceil(state.time));
    this.setText('trafficLabel',timed?'TIME':'TRAFFIC');
    this.setText('trafficRemaining',timed?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:String(state.trafficRemaining??'—'));
    this.fields.trafficRemaining.classList.toggle('is-urgent',timed&&seconds<=15);
    this.setText('trafficUnit',timed?'REMAINING':'LEFT');
    const stage=state.roundStage??'traffic';
    this.setText('stageLabel',stage==='finale'?'SUPER FEATURE':stage==='inferno'?'INFERNO':stage==='approach'?'READY TO CRASH':RULES[rule].name);
    this.setText('wave',stage==='finale'?`POWER ×${(state.finalePower??1).toFixed(1)}`:stage==='inferno'?`×${state.infernoMultiplier??1}`:timed?`${seconds} SEC`:`WAVE ${Math.max(1,state.wave??1)}`);
    this.fields.featureProgress.style.transform=`scaleX(${clamp01(state.featureProgress??(timed?1-state.time/(rule==='rushhour'?90:120):0))})`;
    this.fields.escapes.hidden=timed||rule==='pileup';
    this.fields.multiplier.hidden=rule!=='pileup';
    this.setText('multiplierValue',`×${state.infernoMultiplier??1}`);
    const escapeLimit=state.escapeLimit??5;
    Array.from(this.fields.escapes.children).forEach((item,i)=>{(item as HTMLElement).hidden=i>=escapeLimit;item.classList.toggle('escaped',i<(state.escaped??0));});
    this.fields.escapes.setAttribute('aria-label',this.t(`已逃脱 ${state.escaped??0} / ${escapeLimit}`));
    this.fields.inferno.hidden=stage!=='inferno';
    this.setText('inferno',`保持燃烧 · ${Math.max(0,state.infernoTime??0).toFixed(1)}s`);
    this.hud.classList.toggle('is-inferno',stage==='inferno');
    if(stage!==this.lastStage){
      if(stage==='inferno'||stage==='finale'||stage==='complete'){
        this.stageUntil=now+1700;
        this.setText('stageLead',stage==='inferno'?'NO MORE TRAFFIC!':stage==='finale'?'SUPER FEATURE!':'ROUND OVER');
        this.setText('stageTitle',stage==='inferno'?`×${state.infernoMultiplier??1} INFERNO!`:stage==='finale'?(FEATURES[state.feature??'none']?.name??'终场灾难'):'CRASH COMPLETE!');
        this.setText('stageHint',stage==='inferno'?'KEEP THE FIRES BURNING!':stage==='finale'?'让最后的破坏席卷全场':'每一场连锁，都值得再来一次');
      }
      this.lastStage=stage;
    }
    this.fields.stageBanner.hidden=now>=this.stageUntil;
    const count=Math.max(0,Math.min(5,state.stars??0));
    Array.from(this.fields.stars.children).forEach((item,i)=>item.classList.toggle('earned',i<count));
    this.fields.stars.setAttribute('aria-label',this.t(`${count} / 5 星`));
    this.fields.starProgress.style.transform=`scaleX(${clamp01(state.starProgress??0)})`;
    this.fields.combo.hidden=state.combo<2;this.setText('combo',`CHAIN ×${state.combo}`);this.fields.chainMult.hidden=state.combo<4;this.fields.chainMult.textContent=`${(state.chainMultiplier??1).toFixed(1)}x`;this.fields.chainMult.classList.toggle('is-hot',(state.chainMultiplier??1)>=3);
    this.setText('crashes',`${state.crashes} 个目标卷入`);
    this.fields.comboTrack.style.transform=`scaleX(${clamp01(state.comboTime/5)})`;
    const charge=clamp01(state.blastCharge),ready=charge>=0.99;
    this.fields.blastBar.style.transform=`scaleX(${charge})`;
    this.setText('blastLabel',ready?'就绪 · 引爆！':`${Math.floor(charge*100)}%`);
    this.setText('blastAction',ready?'CRASHBREAKER!':'CHARGING');
    this.hud.querySelector('.blast-cluster')!.classList.toggle('is-ready',ready);
    const sandbox=rule==='sandbox';this.fields.mechanismCluster.hidden=!sandbox;
    this.setText('charges',Array.from({length:3},(_,i)=>i<state.interventions?'●':'○').join(' '));
    (this.hud.querySelector('.mechanism-trigger') as HTMLButtonElement).disabled=state.interventions<=0;
    this.fields.mechanisms.hidden=!sandbox||!state.slowMotion||state.interventions<=0;
    this.setText('mechanismHint',state.interventions>0?'每局 3 次 · 选取时慢动作':'机关已用尽');
    const feature=state.feature??'none',featureInfo=FEATURES[feature]??{name:feature,symbol:'★',description:''};
    const waitingPizza=feature==='none'&&(state.pizzaOnField||state.bonusNextIn!==undefined);
    this.fields.featureStatus.hidden=feature==='none'&&!waitingPizza;
    this.fields.featureStatus.classList.toggle('is-pizza-status',!!waitingPizza);
    this.setText('featureSymbol',waitingPizza?'🍕':featureInfo.symbol);
    this.setText('featureName',waitingPizza?(state.pizzaOnField?'披萨已到场 · 撞毁抽奖':'下一辆披萨'):featureInfo.name);
    this.setText('featureTime',waitingPizza?(state.pizzaOnField?'':`${Math.max(0,Math.ceil(state.bonusNextIn??0))}s`):(state.featureTime??0)>0?`${Math.ceil(state.featureTime!)}s`:'');
    if(feature!==this.lastFeature&&feature!=='none'){this.fields.featureStatus.classList.remove('feature-arrival');void this.fields.featureStatus.offsetWidth;this.fields.featureStatus.classList.add('feature-arrival');}
    this.lastFeature=feature;
    if(state.notice&&state.notice!==this.lastNotice){this.lastNotice=state.notice;this.noticeUntil=now+2400;this.setText('notice',state.notice);}
    if(!state.notice)this.lastNotice='';
    this.fields.notice.hidden=!state.notice||now>this.noticeUntil;
    for(const event of state.events){
      if(this.seenEvents.has(event.id))continue;this.seenEvents.add(event.id);
      if(event.kind==='special'&&(event as typeof event & {effect?:string}).effect==='pizza'){
        this.pizzaStart=now;this.pizzaUntil=now+3600;this.pizzaResult=feature;this.pizzaWinningTime=state.featureTime??0;
      }
    }
    if(this.seenEvents.size>2000)this.seenEvents=new Set(state.events.map(event=>event.id));
    this.fields.pizza.hidden=now>=this.pizzaUntil;
    const spinDuration=this.reducedMotion?150:1500,spinning=now-this.pizzaStart<spinDuration;
    this.fields.pizza.classList.toggle('is-spinning',spinning);
    const winner=FEATURES[this.pizzaResult]??FEATURES.none;
    this.setText('pizzaWinner',spinning?'幸运轮盘转动中…':'中奖效果');
    this.setText('pizzaResult',spinning?'PIZZA OF FORTUNE':`${winner.symbol} ${winner.name}!`);
    const remaining=feature===this.pizzaResult?Math.ceil(state.featureTime??0):Math.max(0,Math.ceil(this.pizzaWinningTime-(now-this.pizzaStart)/1000));
    this.setText('pizzaDetail',spinning?'撞毁披萨车，获得随机奖励':`${winner.description} · 剩余 ${remaining} 秒`);
    const index=Math.max(0,PIZZA_FEATURES.indexOf(this.pizzaResult)),elapsed=clamp01((now-this.pizzaStart)/spinDuration),ease=this.reducedMotion?1:1-Math.pow(1-elapsed,3);
    this.fields.pizzaReel.style.transform=`translateY(-${(20+index)*36*ease}px)`;
    this.fields.pizzaWheel.style.transform=`rotate(${(1080-index*90)*ease}deg)`;
    this.updateRunExtras(state,now);
    this.setText('fps',state.fps?`${Math.round(state.fps)} FPS`:'');
    this.hud.classList.toggle('is-selecting',state.slowMotion);
  }

  private updateRunExtras(state:RuleSnapshot,now:number):void {
    const perks=state.perks??[],row=this.fields.perkRow;
    if(row.dataset.signature!==perks.join()){
      row.dataset.signature=perks.join();row.hidden=!perks.length;
      row.innerHTML=perks.map(id=>{const perk=PERKS[id as PerkId];return `<span class="perk-chip" style="--perk:${perk.color}" title="${perk.name} · ${perk.description}">${glyph(perk.icon,perk.color)}</span>`;}).join('');
      row.querySelectorAll<HTMLElement>('[title]').forEach(el=>{el.title=this.t(el.title.split(' · ')[0])+' · '+this.t(el.title.split(' · ').slice(1).join(' · '));});
    }
    const mutator=state.config.mutator?MUTATORS[state.config.mutator]:undefined;
    this.fields.mutator.hidden=!mutator;
    if(mutator&&this.fields.mutator.dataset.id!==mutator.id){this.fields.mutator.dataset.id=mutator.id;this.fields.mutator.style.setProperty('--mutator-color',mutator.color);this.fields.mutator.innerHTML=`${glyph(mutator.icon,mutator.color)}<span>${mutator.name}</span>`;this.fields.mutator.title=mutator.description;this.localize(this.fields.mutator);}
    const contract=state.contract,def=contract?contractById(contract.id):undefined;
    this.fields.contract.hidden=!contract||!def;
    if(contract&&def){
      this.fields.contract.style.setProperty('--contract-color',def.color);this.fields.contract.classList.toggle('is-done',contract.done);
      this.setText('contractName',def.name);this.setText('contractDesc',def.description);
      this.fields.contractBar.style.transform=`scaleX(${clamp01(contract.progress/contract.target)})`;
      this.setText('contractCount',contract.done?`✓ 已完成 · +${money(contract.reward)}`:def.target>1?`${contract.progress} / ${def.target} · +${money(contract.reward)}`:`终局结算 · +${money(contract.reward)}`);
    }
    const draft=state.draft;
    if(draft){
      if(this.draftId!==draft.id){this.draftId=draft.id;this.renderDraft(draft);}
      this.fields.draft.hidden=false;
    }else{this.draftId=0;this.fields.draft.hidden=true;}
    this.hud.classList.toggle('is-drafting',!!draft);
    for(const event of state.events){
      if(this.megaSeen.has(event.id))continue;this.megaSeen.add(event.id);
      if(event.effect==='mega'&&state.phase==='running'){
        this.megaUntil=now+1500;this.fields.mega.dataset.tier=String(Math.min(4,Math.round(event.power)));
        this.setText('megaText',event.text??'MEGA CRASH!');this.setText('megaSub',`SCORE ×${(state.chainMultiplier??1).toFixed(1)}`);
        this.fields.mega.classList.remove('is-hit');void this.fields.mega.offsetWidth;this.fields.mega.classList.add('is-hit');
      }
    }
    if(this.megaSeen.size>2000)this.megaSeen=new Set(state.events.map(event=>event.id));
    this.fields.mega.hidden=now>=this.megaUntil;
  }
  private megaSeen=new Set<number>();
  private renderDraft(draft:NonNullable<RuleSnapshot['draft']>):void {
    const contract=draft.kind==='contract';
    const cards=draft.options.map((id,i)=>{
      if(contract){const c=contractById(id)!;return `<button type="button" class="draft-card" style="--card:${c.color}" data-draft="${i}"><kbd>${i+1}</kbd><strong>${c.name}</strong><span>${c.description}</span><b>+${money(c.reward)}</b></button>`;}
      const perk=PERKS[id as PerkId];return `<button type="button" class="draft-card" style="--card:${perk.color}" data-draft="${i}"><kbd>${i+1}</kbd>${glyph(perk.icon,perk.color)}<strong>${perk.name}</strong><span>${perk.description}</span></button>`;
    }).join('');
    this.fields.draft.innerHTML=`<div class="draft-heading"><span>${contract?'CONTRACT / 本局合约':'UPGRADE / 选择强化'}</span><h3>${contract?'接一份合约，完成后拿额外奖金':'波间补给：选一项强化，带进下一波'}</h3></div><div class="draft-cards">${cards}</div>${contract?'<button type="button" class="draft-skip" data-draft="-1"><kbd>4</kbd> 不接合约，直接出发</button>':'<small>时间已暂停 · 按数字键选择</small>'}`;
    this.localize(this.fields.draft);
  }
  private resultExtras(result:RunResult,extra?:ResultExtra):string {
    const chips=(result.perks??[]).map(id=>{const perk=PERKS[id as PerkId];return perk?`<span class="perk-chip is-labeled" style="--perk:${perk.color}">${glyph(perk.icon,perk.color)}${perk.name}</span>`:'';}).join('');
    const contract=result.contract?contractById(result.contract.id):undefined;
    const lines=[
      extra?`<span class="result-progress">★ +${extra.gained}<small>累计 ${extra.total} 星</small></span>`:'',
      contract?`<span class="result-contract ${result.contract!.done?'is-done':''}"><i>${result.contract!.done?'✓':'○'}</i>合约 · ${contract.name}<small>${result.contract!.done?`+${money(result.contract!.reward)}`:'未完成'}</small></span>`:'',
      result.config.daily?`<span class="result-daily">DAILY ${result.config.daily}${result.config.mutator?` · ${MUTATORS[result.config.mutator].name}`:''}<small>${extra?.dailyBest?`今日最佳 ${money(extra.dailyBest)}`:''}${extra?.streak?` · 连续 ${extra.streak} 天`:''}</small></span>`:'',
      ...(extra?.unlocked??[]).map(id=>{const paint=PAINTS.find(item=>item.id===id)!;return `<span class="result-unlock"><i style="--paint:${paintHex(paint.color)}"></i>解锁涂装 · ${paint.name}</span>`;}),
    ].filter(Boolean).join('');
    return lines||chips?`<div class="result-extras">${lines}${chips?`<div class="result-perks">${chips}</div>`:''}</div>`:'';
  }

  showResults(result:RunResult,previous?:RunResult,extra?:ResultExtra):void {
    this.preview?.hide();const value=result as RuleResult;this.screen='results';this.resultPair={result,previous,extra};this.hud.hidden=true;this.closeDialog();this.overlay.hidden=false;
    const rule=rulesOf(result.config),car=VEHICLES[result.config.car],city=getCity(result.config.city),route=cityRoutes(city.id).find(item=>item.id===result.config.route)!;
    const best=Math.max(0,...this.records.filter(record=>record.timestamp!==result.timestamp&&recordKey(record.config,record.ruleVersion??RULE_VERSION)===recordKey(result.config)).map(record=>record.score));
    const versus=result.config.mode==='versus',difference=previous?result.score-previous.score:0;
    const escaped=value.outcome==='escaped',timedOut=value.outcome==='timeout',failed=escaped||timedOut,stars=Math.min(5,Math.max(0,value.stars??0));
    const breakdown=value.breakdown;
    const labels=challengeLabels(result.config);
    this.overlay.innerHTML=`<section class="result-screen" aria-label="本局成绩"><div class="result-sheet"><div class="result-topline"><span>CRASH! <i>城市连锁</i></span><button type="button" class="language-toggle" data-action="language" aria-label="界面语言" data-language-name>${this.settings.language==='en'?'中文':'EN'}</button><span>${versus?previous?'PLAYER 02 / 同机挑战':'PLAYER 01 / 同机挑战':RULES[rule].name}</span></div><div class="result-heading"><span class="result-kicker ${failed?'is-failed':''}">${timedOut?'TIME LIMIT / INCOMPLETE':escaped?'TRAFFIC ESCAPED':'EVENT COMPLETE'}</span><h2>${previous?difference===0?'不分高下！':difference>0?'玩家 2，胜出！':'玩家 1，胜出！':timedOut?'车流未解决，挑战未完成。':escaped?'车流逃脱，挑战结束。':'连锁，席卷全城。'}</h2><p>${timedOut?'时间用尽，路口仍有车流未解决。本次挑战未完成。':escaped?`${value.escaped??5} 辆车完整逃脱，下一次封住出口。`:rule==='rushhour'?'90 秒结束，终场爆破已结算。':rule==='pileup'?'火焰熄灭，INFERNO 奖励已结算。':rule==='sandbox'?'120 秒结束，现场破坏已结算。':'整轮车流结束，终场灾难已结算。'}</p></div><div class="result-stars" aria-label="${stars} / 5 星">${starsHTML(stars)}</div><div class="result-score"><strong>${money(result.score)}</strong><span>${!versus&&result.score>0&&result.score>best?'本机新高 · NEW BEST':'TOTAL DAMAGE · 总破坏金额'}</span></div>
      ${previous?`<div class="versus-comparison"><div><span>玩家 1</span><strong>${money(previous.score)}</strong><small>${cityRoutes(previous.config.city).find(item=>item.id===previous.config.route)!.short}</small></div><b>VS</b><div><span>玩家 2</span><strong>${money(result.score)}</strong><small>${route.short}</small></div></div>`:''}
      <div class="damage-breakdown"><div><span>TRAFFIC DAMAGE <small>交通损失</small></span><strong>${breakdown?money(breakdown.traffic):'—'}</strong></div><div><span>PROPERTY DAMAGE <small>建筑与设施</small></span><strong>${breakdown?money(breakdown.property):'—'}</strong></div><div><span>BONUS TOTAL <small>额外奖励</small></span><strong>${breakdown?money(breakdown.bonus):'—'}</strong></div></div>
      <div class="result-stats"><span><b>×${result.bestCombo}</b> 最高连锁</span><span><b>${result.crashes}</b> 命中目标</span><span><b>${result.destroyed}</b> 摧毁目标</span></div><div class="result-challenges">${result.challenges.map((complete,i)=>`<span class="${complete?'complete':''}"><i>${complete?'★':'☆'}</i>${labels[i]??`挑战 ${i+1}`}</span>`).join('')}</div>${this.resultExtras(result,extra)}<div class="result-build"><span>${city.name} · ${city.district} / ${car.name} / ${route.short}</span><span>${RULES[rule].name}</span></div><div class="result-actions"><button type="button" class="button button-primary" data-action="${versus&&!previous?'next-player':'retry'}">${versus&&!previous?'交棒给玩家 2':previous?'再比一轮':'再来一局'} ${arrow}</button><button type="button" class="button button-outline" data-action="share">导出成绩图 <span aria-hidden="true">↓</span></button></div><div class="result-bottom"><button type="button" data-action="menu">‹ 回车库</button><small>${value.ruleVersion??RULE_VERSION} · 挑战编号 ${result.config.seed}</small></div></div></section>`;
    this.localize(this.overlay);
    this.overlay.querySelector<HTMLButtonElement>('.button-primary')?.focus({preventScroll:true});
  }

  showPause(settings:Settings):void {
    if(this.screen!=='pause')this.pauseStarted=performance.now();
    this.preview?.hide();this.settings={...settings};this.screen='pause';this.hud.hidden=true;this.overlay.hidden=false;this.closeDialog();
    this.overlay.innerHTML=`<section class="pause-screen"><div class="pause-sheet"><span class="eyebrow">PAUSED / TIME OUT</span><h2>混乱，等你回来。</h2><p>现场已暂停，时间不会流逝。</p><button type="button" class="button button-primary" data-action="resume">继续连锁 ${arrow}</button><div class="pause-secondary"><button type="button" data-action="retry">重新开始 <kbd>R</kbd></button><button type="button" data-action="menu">回车库 <span>›</span></button></div><div class="pause-settings">${this.settingsContent()}</div><button type="button" class="text-button" data-action="guide">查看操作说明 ›</button></div></section>`;
    this.localize(this.overlay);
    this.overlay.querySelector<HTMLButtonElement>('[data-action="resume"]')?.focus({preventScroll:true});
  }

  showLoading(message:string):void {
    this.preview?.hide();this.screen='loading';this.hud.hidden=true;this.overlay.hidden=false;
    this.overlay.innerHTML=`<section class="loading-screen"><div class="loading-wordmark">CRASH!</div><span class="loading-subtitle">城市连锁</span><div class="loading-line"><i></i></div><p role="status">${escapeHTML(message)}</p><span>STAND BY / CITY BREAKERS</span></section>`;this.localize(this.overlay);
  }

  showError(message:string):void {
    this.preview?.hide();this.screen='error';this.hud.hidden=true;this.overlay.hidden=false;this.closeDialog();
    this.overlay.innerHTML=`<section class="pause-screen"><div class="pause-sheet"><span class="eyebrow">PIT STOP</span><h2>稍等，修一下路。</h2><p>${escapeHTML(message)}</p><button type="button" class="button button-primary" data-action="reload">重新加载 ↻</button><small class="error-note">建议使用支持 WebGL 的桌面浏览器。</small></div></section>`;this.localize(this.overlay);
  }

  resetRun():void {
    window.clearTimeout(this.toastTimer);this.toastElement.hidden=true;this.lastToast='';
    this.snapshot=undefined;this.seenEvents.clear();this.lastFeature='none';this.lastStage='';this.lastNotice='';this.lastScore=0;
    this.pauseStarted=0;this.stageUntil=0;this.noticeUntil=0;this.pizzaUntil=0;this.pizzaStart=0;this.pizzaResult='none';this.draftId=0;this.megaUntil=0;this.megaSeen.clear();
    this.fields.stageBanner.hidden=true;this.fields.draft.hidden=true;this.fields.mega.hidden=true;this.fields.pizza.hidden=true;this.fields.notice.hidden=true;this.fields.featureStatus.hidden=true;
    this.hud.classList.remove('has-ended','is-inferno','is-selecting');
  }

  hideOverlays():void {
    if(this.screen!=='pause')this.resetRun();
    else if(this.pauseStarted){const pausedFor=performance.now()-this.pauseStarted;this.stageUntil+=pausedFor;this.noticeUntil+=pausedFor;this.pizzaUntil+=pausedFor;this.pizzaStart+=pausedFor;this.pauseStarted=0;}
    this.preview?.hide();this.closeDialog();this.overlay.hidden=true;this.overlay.innerHTML='';this.screen='game';this.hud.hidden=false;
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    if(this.snapshot)this.update(this.snapshot);
  }

  toast(text:string):void {
    window.clearTimeout(this.toastTimer);this.lastToast=text;this.toastElement.textContent=this.t(text);this.toastElement.hidden=false;
    this.toastTimer=window.setTimeout(()=>{this.toastElement.hidden=true;},3200);
  }

  private settingsContent():string {
    return `<div class="settings-fields"><label class="quality-label"><span>界面语言</span><select data-setting="language" aria-label="界面语言"><option value="zh" data-language-name ${this.settings.language!=='en'?'selected':''}>中文</option><option value="en" ${this.settings.language==='en'?'selected':''}>English</option></select></label><label><span>音效 <output data-output="volume">${Math.round(this.settings.volume*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value="${this.settings.volume}" data-setting="volume" aria-label="音效音量"></label><label><span>音乐 <output data-output="music">${Math.round(this.settings.music*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value="${this.settings.music}" data-setting="music" aria-label="音乐音量"></label><label class="checkbox-label"><span>撞击震屏</span><input type="checkbox" data-setting="shake" ${this.settings.shake?'checked':''}></label><label class="quality-label"><span>画面质量</span><select data-setting="quality"><option value="high" ${this.settings.quality==='high'?'selected':''}>高画质</option><option value="low" ${this.settings.quality==='low'?'selected':''}>流畅优先</option></select></label></div>`;
  }

  private showDialog(kind:string):void {
    this.lastFocus=document.activeElement as HTMLElement;this.dialogKind=kind;
    if(this.dialogVehicle){this.preview?.hide();this.dialogVehicle=false;this.restoreMenuPreview();}
    let title='',body='';
    if(kind==='settings'){title='调整你的现场。';body=this.settingsContent();}
    if(kind==='guide'){
      const config=this.snapshot&&this.screen==='pause'?this.snapshot.config:this.config,rule=rulesOf(config),sandbox=rule==='sandbox',city=getCity(config.city),ability=PLAYER_ABILITIES[config.car]!;title='一撞，只是开始。';
      body=`<div class="guide-intro"><strong>${city.name} · ${city.district} / ${RULES[rule].name} / ${RULES[rule].zh}</strong><br>${RULES[rule].description}</div><div class="guide-columns"><ol class="guide-steps"><li><span>01</span><div><h3>堵住路口</h3><p>驶入车流，撞上第一辆车。把残骸留在路上，让新的碰撞继续发生。</p></div></li><li><span>02</span><div><h3>充能、引爆、空中调整</h3><p>鼠标选择推进方向，爆破槽满后按 <kbd>SPACE</kbd>。用 <kbd>WASD</kbd> 或方向键调整空中落点。${sandbox?'能量会自动恢复。':'充能自动恢复，现场碰撞让它更快。'}</p></div></li><li><span>03</span><div><h3>${sandbox?'用机关改变现场':'看懂特殊事件'}</h3><p>${sandbox?'按 <kbd>E</kbd> 开启机关慢动作，再按 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 选择。每局 3 次；慢动作时仍计时。':rule==='rushhour'?'炸毁披萨车触发幸运轮盘。最后一秒把自己放在值得引爆的位置。':rule==='pileup'?'保留可燃残骸，进入 INFERNO 再连环引爆。逃脱的车会削弱奖励倍率。':'让救护车安全通过，消除 1 个逃脱叉。拦住整轮车流，等终场灾难收尾。'}</p></div></li></ol><aside class="guide-objectives"><span>FIVE STAR CHALLENGE</span><h3>五星挑战</h3><ul>${challengeLabels(this.snapshot&&this.screen==='pause'?this.snapshot.config:this.config).map(label=>`<li><b>★</b><span>${label}</span></li>`).join('')}</ul></aside></div><div class="guide-tactics"><article style="--ability-color:${ability.color}"><kbd>Q</kbd><div><h3>${VEHICLES[config.car].name} · ${ability.name}</h3><p>${ability.description}</p><small>${ability.cooldown} 秒冷却 · 消耗 ${Math.round(ability.cost*100)}% 爆破能量。能量不足时先等待充能。</small></div></article><article><span class="city-event-symbol">◆</span><div><h3>${city.name}现场事件 · ${city.eventTargets[0].name}</h3><p>${city.eventTargets[0].description}</p><small>区域内的首次碰撞也可充能。留意路面彩色标记，用技能与爆破把车流带进来。</small></div></article></div><div class="guide-footer"><span><kbd>ESC</kbd> 暂停</span><span><kbd>R</kbd> 快速重开</span><span>${rule==='rushhour'?'90 秒':rule==='sandbox'?'120 秒':rule==='pileup'?'有限车流 + INFERNO':'5 次逃脱即结束'}</span></div><p class="guide-note">披萨奖励在所有模式出现：撞毁配送车，抽取封路、磁吸、双倍或冻结奖励。</p><p class="guide-note">经典规则中的特殊事件由现场进度触发；自由连锁可手动选择机关。没有可见人物，只有机械破坏。</p>`;
    }
    if(kind==='vehicles'){
      title='认准它，再下手。';
      const city=getCity(this.snapshot&&this.screen==='pause'?this.snapshot.config.city:this.config.city);
      body=`<p class="guide-intro"><strong>${city.name}重点车流：${city.traffic}</strong><br>长车身用来封路，特殊交通改变局势。救护车需要放行；披萨车、运钞车值得追击。</p><div class="vehicle-codex">${Object.values(VEHICLES).sort((a,b)=>Number(city.specialTraffic.includes(b.id))-Number(city.specialTraffic.includes(a.id))).map(vehicle=>`<article class="${city.specialTraffic.includes(vehicle.id)?'is-local':''}"><button type="button" class="codex-thumb" data-vehicle="${vehicle.id}" aria-label="${vehicle.name}，点击查看三维模型"><img src="/models/previews/${vehicle.id}.png" alt="${vehicle.name}" loading="lazy" width="240" height="160"><span>点击查看三维模型</span></button><div><h3>${vehicle.name}${city.specialTraffic.includes(vehicle.id)?'<em>本城重点</em>':''}${vehicle.special?'<em>特性</em>':''}</h3><span>${vehicle.tag}</span><p>${vehicle.description}</p>${PLAYER_ABILITIES[vehicle.id]?`<p class="codex-ability"><kbd>Q</kbd> ${PLAYER_ABILITIES[vehicle.id]!.name} · ${PLAYER_ABILITIES[vehicle.id]!.description}</p>`:''}</div></article>`).join('')}</div>`;
    }
    if(kind.startsWith('vehicle:')){
      const id=kind.slice(8) as VehicleKind,vehicle=VEHICLES[id],ability=PLAYER_ABILITIES[id];
      title=vehicle.name;
      body=`<div class="codex-model-preview" role="img" aria-label="${vehicle.name}，游戏内三维模型"></div><div class="codex-detail"><span>${vehicle.tag}</span><p>${vehicle.description}</p>${ability?`<div class="vehicle-ability" style="--ability-color:${ability.color}"><kbd>Q</kbd><div><b>${ability.name}</b><p>${ability.description}</p><small>${ability.cooldown} 秒冷却 · 消耗 ${Math.round(ability.cost*100)}% 爆破能量</small></div></div>`:''}<button type="button" class="button button-outline" data-action="vehicles">‹ 返回图鉴</button></div>`;
    }
    this.dialog.hidden=false;
    this.dialog.innerHTML=`<section class="dialog-card ${kind==='vehicles'||kind==='guide'||kind.startsWith('vehicle:')?'dialog-wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div><span class="eyebrow">CRASH! / ${kind==='vehicles'?'TRAFFIC GUIDE':kind==='guide'?'QUICK START':kind.startsWith('vehicle:')?'MODEL SHOWCASE':'SETTINGS'}</span><h2 id="dialog-title">${title}</h2></div><button type="button" class="dialog-close" data-action="close-dialog" aria-label="关闭">×</button></header><div class="dialog-content">${body}</div></section>`;
    this.localize(this.dialog);
    if(kind.startsWith('vehicle:')){this.preview??=new CarPreview();this.dialogVehicle=true;this.preview.show(this.dialog.querySelector<HTMLElement>('.codex-model-preview')!,kind.slice(8) as VehicleKind);}
    this.dialog.querySelector<HTMLButtonElement>('.dialog-close')?.focus({preventScroll:true});
  }

  private closeDialog():void {
    const wasOpen=!this.dialog.hidden;this.dialogKind='';
    if(this.dialogVehicle){this.preview?.hide();this.dialogVehicle=false;this.restoreMenuPreview();}
    this.dialog.hidden=true;this.dialog.innerHTML='';
    if(wasOpen&&this.lastFocus?.isConnected)this.lastFocus.focus({preventScroll:true});
  }

  private trapFocus(event:KeyboardEvent):void {
    const elements=Array.from(this.dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]'));
    if(!elements.length)return;
    if(event.shiftKey&&document.activeElement===elements[0]){event.preventDefault();elements.at(-1)!.focus();}
    else if(!event.shiftKey&&document.activeElement===elements.at(-1)){event.preventDefault();elements[0].focus();}
  }

  private handleClick=(event:MouseEvent):void=>{
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target||target.disabled)return;
    if(target.dataset.config){
      if(this.container.dataset.challengeRound==='2'&&target.dataset.config!=='route')return;
      this.config=normalizedConfig({...this.config,[target.dataset.config]:target.dataset.value});this.callbacks.onConfig({...this.config});this.renderMenu();
      this.overlay.querySelector<HTMLButtonElement>(`[data-config="${target.dataset.config}"][data-value="${target.dataset.value}"]`)?.focus({preventScroll:true});return;
    }
    if(target.dataset.draft!==undefined){this.callbacks.onDraft(Number(target.dataset.draft));return;}
    if(target.dataset.paint){const paint=PAINTS.find(item=>item.id===target.dataset.paint)!;if(paint.stars>this.profile.stars){this.toast(`累计 ${paint.stars} 星解锁「${paint.name}」，当前 ${this.profile.stars} 星`);return;}this.profile={...this.profile,paint:paint.id};this.callbacks.onPaint(paint.id);this.renderMenu();return;}
    if(target.dataset.vehicle){this.showDialog(`vehicle:${target.dataset.vehicle}`);return;}
    if(target.dataset.mechanism){this.callbacks.onMechanism(target.dataset.mechanism as MechanismId);return;}
    switch(target.dataset.action){
      case 'language':this.changeLanguage(this.settings.language==='en'?'zh':'en');break;
      case 'start':this.callbacks.onStart({...this.config});break;
      case 'daily':if(this.daily)this.callbacks.onStart({...this.daily.setup.config});break;
      case 'loadout':this.loadoutOpen=!this.loadoutOpen;this.renderMenu();this.overlay.querySelector<HTMLButtonElement>('[data-action="loadout"]')?.focus({preventScroll:true});break;
      case 'pause':this.callbacks.onPause();break;case 'resume':this.callbacks.onResume();break;case 'retry':this.callbacks.onRetry();break;case 'menu':this.callbacks.onMenu();break;
      case 'ability':this.callbacks.onAbility();break;
      case 'mechanism-mode':this.callbacks.onMechanismMode();break;
      case 'blast':if((this.snapshot?.blastCharge??0)>=0.99)this.callbacks.onBlast();else this.toast('爆破正在充能，现场碰撞会让它更快。');break;
      case 'share':this.callbacks.onShare();break;case 'next-player':this.callbacks.onNextPlayer();break;
      case 'guide':case 'vehicles':case 'settings':this.showDialog(target.dataset.action);break;
      case 'close-dialog':this.closeDialog();break;case 'reload':window.location.reload();break;
    }
  };

  private handleInput=(event:Event):void=>{
    const input=event.target as HTMLInputElement;
    if(input.dataset.setting==='volume'||input.dataset.setting==='music'){
      const key=input.dataset.setting;this.settings={...this.settings,[key]:Number(input.value)};
      this.container.querySelectorAll<HTMLOutputElement>(`[data-output="${key}"]`).forEach(output=>{output.value=`${Math.round(Number(input.value)*100)}%`;});this.callbacks.onSettings({...this.settings});
    }
  };

  private handleChange=(event:Event):void=>{
    const input=event.target as HTMLInputElement;
    if(input.dataset.setting==='language'){this.changeLanguage(input.value as Language);return;}
    if(input.dataset.config){if(this.container.dataset.challengeRound==='2')return;this.config={...this.config,[input.dataset.config]:input.value};this.callbacks.onConfig({...this.config});const field=input.dataset.config;this.renderMenu();this.overlay.querySelector<HTMLSelectElement>(`select[data-config="${field}"]`)?.focus({preventScroll:true});}
    if(input.dataset.setting==='shake'||input.dataset.setting==='quality'){this.settings={...this.settings,[input.dataset.setting]:input.dataset.setting==='shake'?input.checked:input.value};this.callbacks.onSettings({...this.settings});}
  };
}
