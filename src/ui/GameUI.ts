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
const glyph=(path:string,color:string):string=>`<svg viewBox="0 0 24 24" class="glyph" style="--glyph:${color}" aria-hidden="true"><path d="${path}"/></svg>`;
const paintHex=(color:number):string=>color?colorHex(color):'';
const RULES:Record<RuleMode,{name:string;zh:string;description:string;objective:string}>={
  roadtrip:{name:'ROAD TRIP',zh:'公路之旅',description:'分三波处理 60 辆车，5 辆完整逃脱即失败。通关后触发终场灾难，逃脱越少威力越大。',objective:'60 辆车，逃脱 5 辆即失败'},
  rushhour:{name:'RUSH HOUR',zh:'高峰时刻',description:'90 秒内尽量扩大破坏，逃脱不扣机会。时间到后在你的位置发生终场大爆破。',objective:'90 秒限时竞分'},
  pileup:{name:'PILE UP',zh:'连环堆撞',description:'处理 30 辆车后进入燃烧加时，持续有新破坏就能延长时间。逃脱的车会降低最终倍率。',objective:'30 辆车，之后进入燃烧加时'},
  sandbox:{name:'SANDBOX',zh:'自由连锁',description:'120 秒自由练习，可自选配装，并使用 3 次现场机关。',objective:'120 秒，自选配装与机关'},
};
const FEATURES:Record<string,{name:string;symbol:string;description:string}>={
  none:{name:'等待下一次事件',symbol:'★',description:'制造碰撞来推进事件'},
  goodcop:{name:'好警察',symbol:'✦',description:'警车封住一个出口'},
  badcop:{name:'坏警察',symbol:'!',description:'被追上会暂时无法爆破'},
  magnet:{name:'磁力吸引',symbol:'∩',description:'附近车辆被吸向你的残骸'},
  double:{name:'双倍得分',symbol:'×2',description:'这段时间内得分翻倍'},
  freeze:{name:'冰封路口',symbol:'❄',description:'路面结冰，残骸滑得更远'},
  tornado:{name:'龙卷风',symbol:'≋',description:''},
  airstrike:{name:'空中冲击',symbol:'✈',description:''},
  tidalwave:{name:'巨浪来袭',symbol:'≈',description:''},
  ufo:{name:'不明飞行物',symbol:'◉',description:''},
  asteroid:{name:'陨石冲击',symbol:'✹',description:''},
  monster:{name:'巨兽来袭',symbol:'♜',description:''},
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
  return `<svg class="city-map" viewBox="0 0 240 130" role="img" aria-label="${escapeHTML(getCity(id).name)}，${id==='sf'?'坡道十字路口':id==='sydney'?'错位双 T 路口':'环岛道路'}">${common}${roads}${landmark}<g class="map-pins"><circle cx="${id==='sydney'?62:78}" cy="${id==='sydney'?86:id==='sf'?98:86}" r="5"/><circle cx="${id==='sydney'?62:78}" cy="${id==='sydney'?86:id==='sf'?98:86}" r="10"/></g></svg>`;
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
  private audioReady=false;
  private readonly showFps=new URLSearchParams(location.search).has('fps');
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
    const startLabel=this.config.mode==='versus'?locked?'玩家 2 出发':'玩家 1 出发':'开始游戏';
    const cost=Math.round(ability.cost*100);
    this.overlay.innerHTML=`<section class="menu-screen" style="--city-color:${city.color}" aria-label="主菜单"><div class="menu-layout">
      <header class="menu-header"><div class="brand"><h1>CRASH<span>!</span></h1><div class="brand-subtitle">城市破坏者</div></div><div class="menu-header-right"><div class="garage-footer"><button type="button" data-action="guide">怎么玩</button><button type="button" data-action="vehicles">车流图鉴</button><button type="button" data-action="music" aria-pressed="${this.settings.bgm!==false}">音乐 ${this.settings.bgm!==false?'开':'关'}</button><button type="button" data-action="settings">设置</button><button type="button" class="language-toggle" data-action="language" aria-label="界面语言" data-language-name>${this.settings.language==='en'?'中文':'EN'}</button></div><span class="sound-hint" ${this.audioReady||this.settings.bgm===false?'hidden':''}>轻点任意处开启音乐</span></div></header>
      <section class="city-selection" aria-label="选择城市"><div class="city-section-heading"><b>选择城市</b>${locked?'<span>第二轮已锁定</span>':''}</div><div class="city-picker">${Object.values(CITIES).map(item=>`<button type="button" class="city-choice ${city.id===item.id?'is-selected':''}" data-config="city" data-value="${item.id}" style="--city-color:${item.color}" aria-pressed="${city.id===item.id}" ${locked?'disabled':''}><span class="city-card-copy"><strong>${item.name}<em>${item.englishName}</em></strong></span>${cityMap(item.id)}</button>`).join('')}</div></section>
      <nav class="rules-picker" aria-label="玩法规则">${(Object.keys(RULES) as RuleMode[]).map(id=>`<button type="button" data-config="rules" data-value="${id}" class="rule-choice ${rule===id?'is-selected':''}" aria-pressed="${rule===id}" ${locked?'disabled':''}><span>${RULES[id].name}</span><b>${RULES[id].zh}</b></button>`).join('')}</nav>
      <div class="garage-main"><section class="vehicle-stage" aria-label="选择座驾"><div class="vehicle-showcase"><div class="vehicle-preview" role="img" aria-label="${car.name}，游戏内三维模型"></div><div class="vehicle-title"><span>${car.tag}</span><h2>${car.name}</h2></div><div class="car-attributes"><div class="power-stat"><span>爆破威力</span><div>${statArrows(stats.power)}</div></div><div class="aftertouch-stat"><span>空中控制</span><div>${statArrows(stats.aftertouch)}</div></div></div></div>
      <div class="car-picker">${PLAYER_CARS.map(id=>`<button type="button" class="car-choice ${this.config.car===id?'is-selected':''}" data-config="car" data-value="${id}" ${locked?'disabled':''} aria-pressed="${this.config.car===id}" aria-label="${VEHICLES[id].name}，${VEHICLES[id].tag}">${carIcon(id,colorHex(VEHICLES[id].color))}<span>${VEHICLES[id].name}</span></button>`).join('')}</div>${this.paintRow(locked)}<div class="vehicle-ability" style="--ability-color:${ability.color}"><kbd>Q</kbd><div><span>技能 <b>${ability.name}</b></span><p>${ability.description}</p><small>冷却 ${ability.cooldown} 秒，消耗 ${cost}% 能量</small></div></div></section>
      <aside class="race-setup" aria-label="出发设置"><div class="mode-switch" aria-label="游戏模式">${this.choice('mode','solo','单人',this.config.mode)}${this.choice('mode','versus','同机对决',this.config.mode)}</div><div class="event-description"><span>${info.name}</span><h3>${info.zh}</h3><p>${info.objective}</p></div><div class="route-heading"><b>入场路线</b></div><div class="route-picker">${routes.map(item=>`<button type="button" class="route-choice ${this.config.route===item.id?'is-selected':''}" style="--route-color:${item.color}" data-config="route" data-value="${item.id}" aria-pressed="${this.config.route===item.id}">${routeIcon(city.id,item.id)}<strong>${item.short}</strong></button>`).join('')}</div>
      ${rule==='sandbox'?`<section class="loadout-section"><button type="button" class="loadout-toggle" data-action="loadout" aria-expanded="${this.loadoutOpen}" aria-controls="loadout-options"><span><b>配装</b></span><span>${BLAST_MODS.find(item=>item.id===this.config.blast)!.name} <i>${this.loadoutOpen?'−':'+'}</i></span></button><div id="loadout-options" class="loadout-options" ${this.loadoutOpen?'':'hidden'}><label>爆破改装<select data-config="blast" ${locked?'disabled':''}>${BLAST_MODS.map(item=>`<option value="${item.id}" ${this.config.blast===item.id?'selected':''}>${item.name}：${item.description}</option>`).join('')}</select></label><label>被动配装<select data-config="passive" ${locked?'disabled':''}>${PASSIVE_MODS.map(item=>`<option value="${item.id}" ${this.config.passive===item.id?'selected':''}>${item.name}：${item.description}</option>`).join('')}</select></label></div></section>`:''}
      <div class="launch-block"><button type="button" class="button button-primary launch-button" data-action="start">${startLabel}</button></div>${locked?'':this.dailyCard()}</aside></div>
      <footer class="menu-footer"><span><b>最高纪录</b> <strong>${best?money(best):'$0'}</strong></span></footer>
    </div><div class="sticky-start"><button type="button" class="button button-primary" data-action="start">${startLabel}</button>${!locked&&this.daily?'<button type="button" class="button button-outline" data-action="daily">每日挑战</button>':''}</div></section>`;
    this.localize(this.overlay);
    try{this.preview??=new CarPreview();this.preview.show(this.overlay.querySelector<HTMLElement>('.vehicle-preview')!,car.id,this.profile.paint);}
    catch(error){console.warn('Vehicle preview unavailable',error);this.overlay.querySelector('.vehicle-preview')!.innerHTML=carIcon(car.id,colorHex(car.color));}
  }

  private paintRow(locked:boolean):string {
    return `<div class="paint-row" role="group" aria-label="车辆涂装"><span>涂装 <b>${this.profile.stars} 星</b></span><div>${PAINTS.map(paint=>{const open=paint.stars<=this.profile.stars,hex=paintHex(paint.color);return `<button type="button" class="paint-swatch ${this.profile.paint===paint.id?'is-selected':''} ${open?'':'is-locked'} ${hex?'':'is-stock'}" style="${hex?`--paint:${hex}`:''}" data-paint="${paint.id}" aria-pressed="${this.profile.paint===paint.id}" aria-label="${paint.name}${open?'':`，${paint.stars} 星解锁`}" title="${paint.name}${open?'':`，${paint.stars} 星解锁`}" ${locked?'disabled':''}>${open?'':`<i>${paint.stars}</i>`}</button>`;}).join('')}</div></div>`;
  }
  private dailyCard():string {
    const info=this.daily;if(!info)return '';
    const {config,mutator}=info.setup,city=getCity(config.city),m=MUTATORS[mutator];
    const label=(info.best?`今日最佳 <b>${money(info.best)}</b>`:'')+(info.streak?`${info.best?'　':''}连续 ${info.streak} 天`:'');
    return `<div class="daily-card" style="--mutator-color:${m.color}"><div class="daily-head"><span>每日挑战</span><b>${info.setup.date}</b></div><div class="daily-body"><strong><span>${city.name}</span><span>${VEHICLES[config.car].name}</span><span>${RULES[rulesOf(config)].zh}</span></strong><em title="${m.description}">${glyph(m.icon,m.color)}${m.name}</em></div><div class="daily-foot"><span>${label}</span><button type="button" class="button button-outline" data-action="daily">开始</button></div></div>`;
  }

  private choice(field:string,value:string,label:string,current:string):string {
    return `<button type="button" data-config="${field}" data-value="${value}" ${this.container.dataset.challengeRound==='2'?'disabled':''} class="${current===value?'is-selected':''}" aria-pressed="${current===value}">${label}</button>`;
  }

  private buildHud():void {
    this.hud.innerHTML=`<div class="traffic-cluster"><div class="traffic-diamond"><div><span data-field="trafficLabel">TRAFFIC</span><strong data-field="trafficRemaining">—</strong><small data-field="trafficUnit">LEFT</small></div></div><div class="traffic-right"><div class="stage-caption"><span data-field="stageLabel">ROAD TRIP</span><b data-field="wave">01 / 03</b></div><div class="stage-track"><i data-field="featureProgress"></i><span>›</span><span>›</span><span>›</span></div><div class="escape-row" data-field="escapes" aria-label="车辆逃脱次数">${Array.from({length:5},()=>'<i>×</i>').join('')}</div><div class="inferno-info" data-field="inferno" hidden></div></div><div class="multiplier-diamond" data-field="multiplier" hidden><span>INFERNO</span><strong data-field="multiplierValue">×1</strong></div><div class="active-feature" data-field="featureStatus" hidden><b data-field="featureSymbol">★</b><span data-field="featureName"></span><small data-field="featureTime"></small></div></div>
      <div class="score-cluster"><div class="score-plate"><span class="hud-label" data-field="ruleLabel">ROAD TRIP</span><strong data-field="score">$000,000,000</strong></div><div class="hud-stars" data-field="stars" aria-label="0 / 5 星">${starsHTML(0)}</div><div class="star-track"><i data-field="starProgress"></i></div><div class="combo-line"><span data-field="combo" hidden>CHAIN ×1</span><span class="chain-mult" data-field="chainMult" hidden>1.0x</span><span data-field="crashes">命中 0</span></div><div class="combo-track"><i data-field="comboTrack"></i></div></div>
      <button type="button" class="pause-button" data-action="pause" aria-label="暂停游戏，Esc"><span aria-hidden="true">Ⅱ</span><kbd>ESC</kbd></button>
      <div class="hud-notice" data-field="notice" role="status" aria-live="polite" hidden></div>
      <div class="blast-cluster"><div class="blast-status"><span>CRASHBREAKER</span><strong data-field="blastLabel">0%</strong></div><button type="button" class="blast-meter" data-action="blast" aria-label="按空格进行爆破"><span data-field="blastBar"></span><b><span data-field="blastAction">CHARGING</span><kbd>SPACE</kbd></b></button></div>
      <div class="ability-cluster" data-field="abilityCluster"><button type="button" class="ability-trigger" data-action="ability" data-field="abilityButton" aria-label="Q 主动技能"><kbd>Q</kbd><span><strong data-field="abilityName">车辆技能</strong><small data-field="abilityState">READY</small></span><b data-field="abilityCountdown">✓</b><i data-field="abilityProgress"></i></button></div>
      <div class="city-event-hud" data-field="cityEvent"><div><strong data-field="cityEventName"></strong><small data-field="cityEventCount">0 / 3</small></div><div class="city-event-track"><i data-field="cityEventProgress"></i></div></div>
      <div class="mechanism-cluster" data-field="mechanismCluster" hidden><button type="button" class="mechanism-trigger" data-action="mechanism-mode"><kbd>E</kbd><span>现场机关</span><b data-field="charges">● ● ●</b></button></div>
      <div class="mechanism-panel" data-field="mechanisms" hidden><div class="mechanism-heading"><span>选择现场机关</span><kbd>E 取消</kbd></div><div>${MECHANISMS.map((item,i)=>`<button type="button" data-mechanism="${item.id}"><kbd>${i+1}</kbd><strong>${item.name}</strong><span>${item.description}</span></button>`).join('')}</div></div>
      <div class="pizza-callout" data-field="pizza" hidden><div class="pizza-wheel-wrap" aria-hidden="true"><div class="pizza-pointer"></div><div class="pizza-disc" data-field="pizzaWheel">${PIZZA_FEATURES.map((feature,i)=>`<span class="pizza-symbol" style="--angle:${i*90}deg">${FEATURES[feature].symbol}</span>`).join('')}</div></div><div class="pizza-result-banner"><span>PIZZA OF FORTUNE</span><div class="pizza-reel-window" aria-hidden="true"><div class="pizza-reel" data-field="pizzaReel">${Array.from({length:7},()=>PIZZA_FEATURES.map(feature=>`<span><b>${FEATURES[feature].symbol}</b>${FEATURES[feature].name}</span>`).join('')).join('')}</div><i></i></div><span class="pizza-winner-label" data-field="pizzaWinner">获得</span><strong data-field="pizzaResult">PIZZA OF FORTUNE</strong><small data-field="pizzaDetail"></small></div></div><div class="stage-banner" data-field="stageBanner" hidden><span data-field="stageLead"></span><strong data-field="stageTitle"></strong></div>
      <div class="perk-row" data-field="perkRow" hidden></div><div class="mutator-tag" data-field="mutator" hidden></div>
      <div class="contract-card" data-field="contract" hidden><span class="contract-kicker">合约 <b data-field="contractName"></b></span><p data-field="contractDesc"></p><div class="contract-track"><i data-field="contractBar"></i></div><small data-field="contractCount"></small></div>
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
    this.setText('ruleLabel',`${city.name} ${RULES[rule].zh}`);
    this.fields.abilityCluster.style.setProperty('--ability-color',ability.color);
    this.setText('abilityName',ability.name);
    const cost=state.abilityCost??ability.cost,abilityReady=state.abilityReady&&state.blastCharge>=cost&&state.abilityCooldown<=0&&state.phase==='running';
    const active=state.abilityActive>0;
    (this.fields.abilityButton as HTMLButtonElement).disabled=!abilityReady;
    this.fields.abilityButton.classList.toggle('is-ready',abilityReady);this.fields.abilityButton.classList.toggle('is-active',active);
    this.setText('abilityState',active?'生效中':state.roundStage==='finale'?'终场不可用':state.abilityCooldown>0?'冷却中':abilityReady?`消耗 ${Math.round(cost*100)}% 能量`:`需要 ${Math.round(cost*100)}% 能量`);
    this.setText('abilityCountdown',state.abilityCooldown>0?`${Math.ceil(state.abilityCooldown)}s`:abilityReady?'READY':'');
    this.fields.abilityProgress.style.transform=`scaleX(${clamp01(1-state.abilityCooldown/ability.cooldown)})`;
    this.fields.abilityButton.setAttribute('aria-label',this.t(`Q ${ability.name}，${this.fields.abilityState.textContent}`));
    this.fields.cityEvent.style.setProperty('--city-color',city.color);
    this.setText('cityEventName',state.cityEvent.name);
    this.setText('cityEventCount',state.cityEvent.triggered?'已触发':`${Math.round(clamp01(state.cityEvent.progress)*100)}%`);
    this.fields.cityEventProgress.style.transform=`scaleX(${clamp01(state.cityEvent.progress)})`;
    this.fields.cityEvent.classList.toggle('is-triggered',state.cityEvent.triggered);
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
    this.setText('inferno',`保持燃烧 ${Math.max(0,state.infernoTime??0).toFixed(1)}s`);
    this.hud.classList.toggle('is-inferno',stage==='inferno');
    if(stage!==this.lastStage){
      if(stage==='inferno'||stage==='finale'||stage==='complete'){
        this.stageUntil=now+1700;
        this.setText('stageLead',stage==='inferno'?'NO MORE TRAFFIC!':stage==='finale'?'SUPER FEATURE!':'ROUND OVER');
        this.setText('stageTitle',stage==='inferno'?`×${state.infernoMultiplier??1} INFERNO!`:stage==='finale'?(FEATURES[state.feature??'none']?.name??'终场灾难'):'CRASH COMPLETE!');
      }
      this.lastStage=stage;
    }
    this.fields.stageBanner.hidden=now>=this.stageUntil;
    const count=Math.max(0,Math.min(5,state.stars??0));
    Array.from(this.fields.stars.children).forEach((item,i)=>item.classList.toggle('earned',i<count));
    this.fields.stars.setAttribute('aria-label',this.t(`${count} / 5 星`));
    this.fields.starProgress.style.transform=`scaleX(${clamp01(state.starProgress??0)})`;
    this.fields.combo.hidden=state.combo<2;this.setText('combo',`CHAIN ×${state.combo}`);this.fields.chainMult.hidden=state.combo<4;this.fields.chainMult.textContent=`${(state.chainMultiplier??1).toFixed(1)}x`;this.fields.chainMult.classList.toggle('is-hot',(state.chainMultiplier??1)>=3);
    this.setText('crashes',`命中 ${state.crashes}`);
    this.fields.comboTrack.style.transform=`scaleX(${clamp01(state.comboTime/5)})`;
    const charge=clamp01(state.blastCharge),ready=charge>=0.99;
    this.fields.blastBar.style.transform=`scaleX(${charge})`;
    this.setText('blastLabel',ready?'就绪':`${Math.floor(charge*100)}%`);
    this.setText('blastAction',ready?'CRASHBREAKER!':'CHARGING');
    this.hud.querySelector('.blast-cluster')!.classList.toggle('is-ready',ready);
    const sandbox=rule==='sandbox';this.fields.mechanismCluster.hidden=!sandbox;
    this.setText('charges',Array.from({length:3},(_,i)=>i<state.interventions?'●':'○').join(' '));
    (this.hud.querySelector('.mechanism-trigger') as HTMLButtonElement).disabled=state.interventions<=0;
    this.fields.mechanisms.hidden=!sandbox||!state.slowMotion||state.interventions<=0;
    const feature=state.feature??'none',featureInfo=FEATURES[feature]??{name:feature,symbol:'★',description:''};
    const waitingPizza=feature==='none'&&(state.pizzaOnField||state.bonusNextIn!==undefined);
    this.fields.featureStatus.hidden=feature==='none'&&!waitingPizza;
    this.fields.featureStatus.classList.toggle('is-pizza-status',!!waitingPizza);
    this.setText('featureSymbol',waitingPizza?'🍕':featureInfo.symbol);
    this.setText('featureName',waitingPizza?(state.pizzaOnField?'披萨车已到场':'下一辆披萨车'):featureInfo.name);
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
    this.setText('pizzaWinner',spinning?'抽奖中':'获得');
    this.setText('pizzaResult',spinning?'PIZZA OF FORTUNE':`${winner.symbol} ${winner.name}!`);
    const remaining=feature===this.pizzaResult?Math.ceil(state.featureTime??0):Math.max(0,Math.ceil(this.pizzaWinningTime-(now-this.pizzaStart)/1000));
    this.setText('pizzaDetail',spinning?'':`${winner.description}，剩余 ${remaining} 秒`);
    const index=Math.max(0,PIZZA_FEATURES.indexOf(this.pizzaResult)),elapsed=clamp01((now-this.pizzaStart)/spinDuration),ease=this.reducedMotion?1:1-Math.pow(1-elapsed,3);
    this.fields.pizzaReel.style.transform=`translateY(-${(20+index)*36*ease}px)`;
    this.fields.pizzaWheel.style.transform=`rotate(${(1080-index*90)*ease}deg)`;
    this.updateRunExtras(state,now);
    this.setText('fps',this.showFps&&state.fps?`${Math.round(state.fps)} FPS`:'');
    this.hud.classList.toggle('is-selecting',state.slowMotion);
  }

  private updateRunExtras(state:RuleSnapshot,now:number):void {
    const perks=state.perks??[],row=this.fields.perkRow;
    if(row.dataset.signature!==perks.join()){
      row.dataset.signature=perks.join();row.hidden=!perks.length;
      row.innerHTML=perks.map(id=>{const perk=PERKS[id as PerkId];return `<span class="perk-chip" style="--perk:${perk.color}" data-perk="${perk.id}">${glyph(perk.icon,perk.color)}</span>`;}).join('');
      row.querySelectorAll<HTMLElement>('[data-perk]').forEach(el=>{const perk=PERKS[el.dataset.perk as PerkId];el.title=`${this.t(perk.name)}：${this.t(perk.description)}`;});
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
      this.setText('contractCount',contract.done?`已完成，获得 ${money(contract.reward)}`:def.target>1?`${contract.progress} / ${def.target}，奖励 ${money(contract.reward)}`:`终局结算，奖励 ${money(contract.reward)}`);
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
  /** Keep every music control in step with the switch without redrawing the whole screen. */
  private refreshMusicControls():void {
    const on=this.settings.bgm!==false;
    this.container.querySelectorAll<HTMLElement>('[data-action="music"]').forEach(item=>{item.setAttribute('aria-pressed',String(on));item.textContent=this.t(`音乐 ${on?'开':'关'}`);});
    this.container.querySelectorAll<HTMLInputElement>('input[data-setting="bgm"]').forEach(item=>{item.checked=on;});
    this.container.querySelectorAll<HTMLElement>('.sound-hint').forEach(item=>{item.hidden=this.audioReady||!on;});
  }
  get screenName():string {return this.screen;}
  /** Enter on the menu starts the game; Enter or R on the results plays again. False when nothing applies. */
  activatePrimary():boolean {
    if(!this.dialog.hidden)return false;
    const selector=this.screen==='menu'?'.launch-button':this.screen==='results'?'.result-actions .button-primary':'';
    const button=selector?this.overlay.querySelector<HTMLButtonElement>(selector):null;
    if(!button||button.disabled)return false;
    button.click();return true;
  }
  setAudioReady(ready:boolean):void {
    this.audioReady=ready;
    this.container.querySelectorAll<HTMLElement>('.sound-hint').forEach(item=>{item.hidden=ready||this.settings.bgm===false;});
  }
  private renderDraft(draft:NonNullable<RuleSnapshot['draft']>):void {
    const contract=draft.kind==='contract';
    const cards=draft.options.map((id,i)=>{
      if(contract){const c=contractById(id)!;return `<button type="button" class="draft-card" style="--card:${c.color}" data-draft="${i}"><kbd>${i+1}</kbd><strong>${c.name}</strong><span>${c.description}</span><b>奖励 ${money(c.reward)}</b></button>`;}
      const perk=PERKS[id as PerkId];return `<button type="button" class="draft-card" style="--card:${perk.color}" data-draft="${i}"><kbd>${i+1}</kbd>${glyph(perk.icon,perk.color)}<strong>${perk.name}</strong><span>${perk.description}</span></button>`;
    }).join('');
    this.fields.draft.innerHTML=`<div class="draft-heading"><h3>${contract?'选择合约':'选择强化'}</h3></div><div class="draft-cards">${cards}</div>${contract?'<button type="button" class="draft-skip" data-draft="-1"><kbd>4</kbd> 不接合约</button>':''}`;
    this.localize(this.fields.draft);
  }
  private resultExtras(result:RunResult,extra?:ResultExtra):string {
    const chips=(result.perks??[]).map(id=>{const perk=PERKS[id as PerkId];return perk?`<span class="perk-chip is-labeled" style="--perk:${perk.color}">${glyph(perk.icon,perk.color)}${perk.name}</span>`:'';}).join('');
    const contract=result.contract?contractById(result.contract.id):undefined;
    const lines=[
      extra&&extra.gained>0?`<span class="result-progress">本局获得 ${extra.gained} 星<small>累计 ${extra.total} 星</small></span>`:'',
      contract?`<span class="result-contract ${result.contract!.done?'is-done':''}"><i>${result.contract!.done?'✓':'○'}</i>合约 ${contract.name}<small>${result.contract!.done?`获得 ${money(result.contract!.reward)}`:'未完成'}</small></span>`:'',
      result.config.daily?`<span class="result-daily">每日挑战${result.config.mutator?` ${MUTATORS[result.config.mutator].name}`:''}<small>${extra?.dailyBest?`今日最佳 ${money(extra.dailyBest)}`:''}${extra?.streak?`${extra?.dailyBest?'　':''}连续 ${extra.streak} 天`:''}</small></span>`:'',
      ...(extra?.unlocked??[]).map(id=>{const paint=PAINTS.find(item=>item.id===id)!;return `<span class="result-unlock"><i style="--paint:${paintHex(paint.color)}"></i>新涂装 ${paint.name}</span>`;}),
    ].filter(Boolean).join('');
    return lines||chips?`<div class="result-extras">${lines}${chips?`<div class="result-perks">${chips}</div>`:''}</div>`:'';
  }

  showResults(result:RunResult,previous?:RunResult,extra?:ResultExtra):void {
    this.preview?.hide();const value=result as RuleResult;this.screen='results';this.resultPair={result,previous,extra};this.hud.hidden=true;this.closeDialog();this.overlay.hidden=false;
    const rule=rulesOf(result.config),city=getCity(result.config.city),route=cityRoutes(city.id).find(item=>item.id===result.config.route)!;
    const best=Math.max(0,...this.records.filter(record=>record.timestamp!==result.timestamp&&recordKey(record.config,record.ruleVersion??RULE_VERSION)===recordKey(result.config)).map(record=>record.score));
    const versus=result.config.mode==='versus',difference=previous?result.score-previous.score:0;
    const escaped=value.outcome==='escaped',timedOut=value.outcome==='timeout',failed=escaped||timedOut,stars=Math.min(5,Math.max(0,value.stars??0));
    const breakdown=value.breakdown;
    const labels=challengeLabels(result.config);
    const heading=previous?difference===0?'不分高下':difference>0?'玩家 2 获胜':'玩家 1 获胜':timedOut?'时间到，未完成':escaped?'挑战失败':'本局结算';
    const reason=timedOut?'路口仍有车流未解决':escaped?`${value.escaped??5} 辆车完整逃脱`:'';
    this.overlay.innerHTML=`<section class="result-screen" aria-label="本局成绩"><div class="result-sheet"><div class="result-topline"><span>CRASH! <i>城市破坏者</i></span><button type="button" class="language-toggle" data-action="language" aria-label="界面语言" data-language-name>${this.settings.language==='en'?'中文':'EN'}</button><span>${versus?previous?'玩家 2':'玩家 1':RULES[rule].zh}</span></div><div class="result-heading"><h2 class="${failed?'is-failed':''}">${heading}</h2>${reason?`<p>${reason}</p>`:''}</div><div class="result-stars" aria-label="${stars} / 5 星">${starsHTML(stars)}</div><div class="result-score"><strong>${money(result.score)}</strong><span>${!versus&&result.score>0&&result.score>best?'本机新纪录':'总破坏金额'}</span></div>
      ${previous?`<div class="versus-comparison"><div><span>玩家 1</span><strong>${money(previous.score)}</strong><small>${cityRoutes(previous.config.city).find(item=>item.id===previous.config.route)!.short}</small></div><b>VS</b><div><span>玩家 2</span><strong>${money(result.score)}</strong><small>${route.short}</small></div></div>`:''}
      <div class="damage-breakdown"><div><span>交通损失</span><strong>${breakdown?money(breakdown.traffic):'—'}</strong></div><div><span>建筑与设施</span><strong>${breakdown?money(breakdown.property):'—'}</strong></div><div><span>额外奖励</span><strong>${breakdown?money(breakdown.bonus):'—'}</strong></div></div>
      <div class="result-stats"><span><b>×${result.bestCombo}</b> 最高连锁</span><span><b>${result.crashes}</b> 命中目标</span><span><b>${result.destroyed}</b> 摧毁目标</span></div><div class="result-challenges">${result.challenges.map((complete,i)=>`<span class="${complete?'complete':''}"><i>${complete?'★':'☆'}</i>${labels[i]??`挑战 ${i+1}`}</span>`).join('')}</div>${this.resultExtras(result,extra)}<div class="result-actions"><button type="button" class="button button-primary" data-action="${versus&&!previous?'next-player':'retry'}">${versus&&!previous?'交给玩家 2':previous?'再比一轮':'再来一局'}</button><button type="button" class="button button-outline" data-action="share">导出成绩图</button></div><div class="result-bottom"><button type="button" data-action="menu">返回菜单</button><small>挑战编号 ${result.config.seed}</small></div></div></section>`;
    this.localize(this.overlay);
    this.overlay.querySelector<HTMLButtonElement>('.button-primary')?.focus({preventScroll:true});
  }

  showPause(settings:Settings):void {
    if(this.screen!=='pause')this.pauseStarted=performance.now();
    this.preview?.hide();this.settings={...settings};this.screen='pause';this.hud.hidden=true;this.overlay.hidden=false;this.closeDialog();
    this.overlay.innerHTML=`<section class="pause-screen"><div class="pause-sheet"><h2>已暂停</h2><button type="button" class="button button-primary" data-action="resume">继续</button><div class="pause-secondary"><button type="button" data-action="retry">重新开始 <kbd>R</kbd></button><button type="button" data-action="menu">返回菜单</button></div><div class="pause-settings">${this.settingsContent()}</div><button type="button" class="text-button" data-action="guide">操作说明</button></div></section>`;
    this.localize(this.overlay);
    this.overlay.querySelector<HTMLButtonElement>('[data-action="resume"]')?.focus({preventScroll:true});
  }

  showLoading(message:string):void {
    this.preview?.hide();this.screen='loading';this.hud.hidden=true;this.overlay.hidden=false;
    this.overlay.innerHTML=`<section class="loading-screen"><div class="loading-wordmark">CRASH!</div><span class="loading-subtitle">城市破坏者</span><div class="loading-line"><i></i></div><p role="status">${escapeHTML(message)}</p></section>`;this.localize(this.overlay);
  }

  showError(message:string):void {
    this.preview?.hide();this.screen='error';this.hud.hidden=true;this.overlay.hidden=false;this.closeDialog();
    this.overlay.innerHTML=`<section class="pause-screen"><div class="pause-sheet"><h2>游戏未能加载</h2><p>${escapeHTML(message)}</p><button type="button" class="button button-primary" data-action="reload">重新加载</button></div></section>`;this.localize(this.overlay);
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
    return `<div class="settings-fields"><label class="quality-label"><span>界面语言</span><select data-setting="language" aria-label="界面语言"><option value="zh" data-language-name ${this.settings.language!=='en'?'selected':''}>中文</option><option value="en" ${this.settings.language==='en'?'selected':''}>English</option></select></label><label><span>音效 <output data-output="volume">${Math.round(this.settings.volume*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value="${this.settings.volume}" data-setting="volume" aria-label="音效音量"></label><label class="checkbox-label"><span>背景音乐</span><input type="checkbox" data-setting="bgm" ${this.settings.bgm!==false?'checked':''}></label><label><span>音乐音量 <output data-output="music">${Math.round(this.settings.music*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value="${this.settings.music}" data-setting="music" aria-label="音乐音量"></label><label class="checkbox-label"><span>屏幕震动</span><input type="checkbox" data-setting="shake" ${this.settings.shake?'checked':''}></label><label class="quality-label"><span>画质</span><select data-setting="quality"><option value="high" ${this.settings.quality==='high'?'selected':''}>高画质</option><option value="low" ${this.settings.quality==='low'?'selected':''}>流畅</option></select></label></div>`;
  }

  private showDialog(kind:string):void {
    this.lastFocus=document.activeElement as HTMLElement;this.dialogKind=kind;
    if(this.dialogVehicle){this.preview?.hide();this.dialogVehicle=false;this.restoreMenuPreview();}
    let title='',body='';
    if(kind==='settings'){title='设置';body=this.settingsContent();}
    if(kind==='guide'){
      const config=this.snapshot&&this.screen==='pause'?this.snapshot.config:this.config,rule=rulesOf(config),city=getCity(config.city),touch=document.documentElement.classList.contains('is-touch');
      title='玩法说明';
      const controls:string[][]=touch?[['左侧摇杆','转向，空中调整落点'],['点屏幕','指定爆破方向'],['爆破键','能量满时引爆'],['技能键','释放车辆技能']]:[['鼠标','瞄准爆破方向'],['空格','能量满时引爆'],['WASD 或方向键','空中调整落点'],['Q','释放车辆技能'],['Esc','暂停'],['R','重新开始']];
      if(rule==='sandbox')controls.push(touch?['机关键','在慢动作中选择现场机关']:['E 再按 1 2 3','在慢动作中选择现场机关']);
      body=`<div class="guide-grid"><section><h3>操作</h3><dl class="guide-controls">${controls.map(([key,text])=>`<dt>${key}</dt><dd>${text}</dd>`).join('')}</dl></section><section><h3>${RULES[rule].zh}</h3><p>${RULES[rule].description}</p><h3>${city.name}事件</h3><p>${city.eventTargets[0].name}：${city.eventTargets[0].description}</p></section><section><h3>五星目标</h3><ul class="guide-stars">${challengeLabels(config).map(label=>`<li><b>★</b><span>${label}</span></li>`).join('')}</ul></section></div>`;
    }
    if(kind==='vehicles'){
      title='车流图鉴';
      const city=getCity(this.snapshot&&this.screen==='pause'?this.snapshot.config.city:this.config.city);
      body=`<div class="vehicle-codex">${Object.values(VEHICLES).sort((a,b)=>Number(city.specialTraffic.includes(b.id))-Number(city.specialTraffic.includes(a.id))).map(vehicle=>`<article class="${city.specialTraffic.includes(vehicle.id)?'is-local':''}"><button type="button" class="codex-thumb" data-vehicle="${vehicle.id}" aria-label="${vehicle.name}，查看三维模型"><img src="${import.meta.env.BASE_URL}models/previews/${vehicle.id}.png" alt="" loading="lazy" width="240" height="160"></button><div><h3>${vehicle.name}${city.specialTraffic.includes(vehicle.id)?'<em>本城重点</em>':''}</h3><p>${vehicle.description}</p></div></article>`).join('')}</div>`;
    }
    if(kind.startsWith('vehicle:')){
      const id=kind.slice(8) as VehicleKind,vehicle=VEHICLES[id];
      title=vehicle.name;
      body=`<div class="codex-model-preview" role="img" aria-label="${vehicle.name}，游戏内三维模型"></div><div class="codex-detail"><p>${vehicle.description}</p><button type="button" class="button button-outline" data-action="vehicles">返回图鉴</button></div>`;
    }
    this.dialog.hidden=false;
    this.dialog.innerHTML=`<section class="dialog-card ${kind==='vehicles'||kind==='guide'||kind.startsWith('vehicle:')?'dialog-wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><h2 id="dialog-title">${title}</h2><button type="button" class="dialog-close" data-action="close-dialog" aria-label="关闭">×</button></header><div class="dialog-content">${body}</div></section>`;
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
      case 'music':this.settings={...this.settings,bgm:this.settings.bgm===false};this.callbacks.onSettings({...this.settings});this.refreshMusicControls();break;
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
    if(input.dataset.setting==='shake'||input.dataset.setting==='quality'||input.dataset.setting==='bgm'){this.settings={...this.settings,[input.dataset.setting]:input.dataset.setting==='quality'?input.value:input.checked};this.callbacks.onSettings({...this.settings});if(input.dataset.setting==='bgm')this.refreshMusicControls();}
  };
}
