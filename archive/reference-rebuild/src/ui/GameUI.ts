import { recordKey } from '../simulation/rules';
import { BLAST_MODS, DEFAULT_CONFIG, DEFAULT_SETTINGS, MECHANISMS, PASSIVE_MODS, PLAYER_CARS, ROUTES, RULE_VERSION, VEHICLES, type GameSnapshot, type MechanismId, type RunConfig, type RunResult, type Settings } from '../shared';

export interface UICallbacks {
  onStart(config:RunConfig):void;
  onConfig(config:RunConfig):void;
  onBlast():void;
  onPause():void;
  onResume():void;
  onRetry():void;
  onMenu():void;
  onMechanism(id:MechanismId):void;
  onMechanismMode():void;
  onSettings(settings:Settings):void;
  onShare():void;
  onNextPlayer():void;
}

const escapeHTML = (value:unknown):string => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const scoreText = (score:number):string => Math.round(score).toLocaleString('en-US');
const colorHex = (color:number):string => `#${color.toString(16).padStart(6,'0')}`;
const arrow = '<span aria-hidden="true">↗</span>';
const carIcon = (kind:string, color:string):string => `<svg viewBox="0 0 104 43" aria-hidden="true" class="car-silhouette" style="--car-color:${color}"><path d="${kind === 'semi' ? 'M5 8h57v23H5z M65 15h19l13 12v7H65z' : kind === 'pickup' ? 'M7 22h35V9h25l13 12h15v12H7z' : kind === 'sport' ? 'M6 26l25-7L45 9h22l17 13 13 5v7H6z' : 'M11 24l10-16h40l17 15 13 4v7H8z'}" fill="currentColor"/><path d="M${kind === 'semi' ? '72 19h10l8 8H72z' : kind === 'pickup' ? '49 13h15l10 10H49z' : kind === 'sport' ? '45 13h18l12 9H35z' : '26 12h29l12 12H19z'}" fill="#183238"/><circle cx="25" cy="33" r="8" fill="#193236"/><circle cx="79" cy="33" r="8" fill="#193236"/><circle cx="25" cy="33" r="3" fill="#e9e4d4"/><circle cx="79" cy="33" r="3" fill="#e9e4d4"/></svg>`;
const routeIcon = (id:string):string => `<svg class="route-map" viewBox="0 0 60 46" aria-hidden="true"><path class="route-base" d="M29 0v46M0 24h60"/><path class="route-grid" d="M8 0v46M49 0v46M0 8h60M0 40h60"/><path class="route-line" d="${id === 'hill' ? 'M29 2v28l12 10' : id === 'market' ? 'M2 24h26l8-8v-9' : 'M59 24H31l-6 7v12'}"/><circle cx="${id === 'hill' ? 29 : id === 'market' ? 5 : 55}" cy="${id === 'hill' ? 5 : 24}" r="3" fill="currentColor"/></svg>`;

/** DOM-only presentation. Simulation state and input gating remain owned by main.ts. */
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
  private snapshot?:GameSnapshot;
  private lastFocus:HTMLElement|null=null;
  private currentDialog='';
  private readonly fields:Record<string,HTMLElement>={};

  constructor(private readonly container:HTMLElement, private readonly callbacks:UICallbacks) {
    container.classList.add('crash-ui');
    container.innerHTML='<div class="game-hud" hidden></div><div class="screen-layer"></div><div class="dialog-layer" hidden></div><div class="game-toast" role="status" aria-live="polite" hidden></div>';
    this.overlay=container.querySelector('.screen-layer')!;
    this.hud=container.querySelector('.game-hud')!;
    this.dialog=container.querySelector('.dialog-layer')!;
    this.toastElement=container.querySelector('.game-toast')!;
    this.buildHud();
    container.addEventListener('click',this.handleClick);
    container.addEventListener('input',this.handleInput);
    container.addEventListener('change',this.handleChange);
    container.addEventListener('keydown',event=>{
      if(!this.dialog.hidden && event.key==='Escape') {event.preventDefault();event.stopPropagation();this.closeDialog();}
      if(!this.dialog.hidden && event.key==='Tab') this.trapFocus(event);
      const target=event.target as HTMLElement;
      if(target.matches('input,select')) event.stopPropagation();
    });
  }

  showMenu(config:RunConfig,records:RunResult[],settings:Settings):void {
    this.config={...config};this.records=records;this.settings={...settings};this.screen='menu';this.hud.hidden=true;this.closeDialog();this.renderMenu();
  }

  private renderMenu():void {
    const car=VEHICLES[this.config.car];
    const best=Math.max(0,...this.records.filter(record=>recordKey(record.config)===recordKey(this.config)).map(record=>record.score));
    const route=ROUTES.find(item=>item.id===this.config.route)!;
    const locked=this.container.dataset.challengeRound==='2';
    this.overlay.hidden=false;
    this.overlay.innerHTML=`<section class="menu-screen" aria-label="城市连锁车库">
      <div class="menu-world-scrim"></div>
      <div class="menu-layout">
        <header class="brand"><div class="eyebrow"><i></i> CITY BREAKERS <span>VOL. 01</span></div><h1>CRASH<span>!</span></h1><div class="brand-subtitle">城市连锁<span>让混乱，环环相扣。</span></div></header>
        <div class="city-caption"><span class="city-coordinate">37° 47′ N / 122° 25′ W</span><p>坡道。海湾。<br>还有下一次连锁。</p><div class="location-line"><span class="location-dot"></span> 旧金山启发 · 原创街区</div></div>
        <aside class="garage" aria-label="出发准备">
          <div class="garage-top"><span>${locked?'玩家 2，轮到你了':'准备撞个痛快'}</span><span class="edition">${locked?'PLAYER 02 / 条件已锁定':'SF—01 / 120 SEC'}</span></div>
          <div class="mode-switch" aria-label="游戏模式">${this.choice('mode','solo','单人街机',this.config.mode)}${this.choice('mode','versus','同机对决',this.config.mode)}</div>
          <section class="garage-section"><div class="section-caption"><span>01 <b>选择座驾</b></span><span>4 / 4 已就位</span></div><div class="car-picker">${PLAYER_CARS.map(id=>`<button type="button" class="car-choice ${this.config.car===id?'is-selected':''}" data-config="car" data-value="${id}" ${locked?'disabled':''} aria-pressed="${this.config.car===id}" aria-label="${VEHICLES[id].name}，${VEHICLES[id].tag}">${carIcon(id,colorHex(VEHICLES[id].color))}<span>${VEHICLES[id].name}</span></button>`).join('')}</div><div class="car-description"><b>${car.tag}</b><span>${car.description}</span></div></section>
          <section class="garage-section route-section"><div class="section-caption"><span>02 <b>挑一条入场路线</b></span><span>同一街区 · 不同战术</span></div><div class="route-picker">${ROUTES.map(item=>`<button type="button" class="route-choice ${this.config.route===item.id?'is-selected':''}" style="--route-color:${item.color}" data-config="route" data-value="${item.id}" aria-pressed="${this.config.route===item.id}">${routeIcon(item.id)}<span class="route-number">${item.name.slice(0,2)}</span><strong>${item.short}</strong><span class="route-name">${item.name.slice(5)}</span></button>`).join('')}</div><p class="route-description">${route.description}</p></section>
          <section class="loadout-section"><button type="button" class="loadout-toggle" data-action="loadout" aria-expanded="${this.loadoutOpen}" aria-controls="loadout-options"><span>03 <b>微调你的打法</b></span><span>${BLAST_MODS.find(item=>item.id===this.config.blast)!.name} + ${PASSIVE_MODS.find(item=>item.id===this.config.passive)!.name} <i>${this.loadoutOpen?'−':'+'}</i></span></button><div id="loadout-options" class="loadout-options" ${this.loadoutOpen?'':'hidden'}><label>爆破改装<select data-config="blast" ${locked?'disabled':''}>${BLAST_MODS.map(item=>`<option value="${item.id}" ${this.config.blast===item.id?'selected':''}>${item.name} · ${item.description}</option>`).join('')}</select></label><label>被动配装<select data-config="passive" ${locked?'disabled':''}>${PASSIVE_MODS.map(item=>`<option value="${item.id}" ${this.config.passive===item.id?'selected':''}>${item.name} · ${item.description}</option>`).join('')}</select></label></div></section>
          <div class="launch-block"><button type="button" class="button button-primary launch-button" data-action="start">${this.config.mode==='versus'?locked?'玩家 2，出发！':'玩家 1，出发！':'开始连锁'} ${arrow}</button><p>${this.config.mode==='versus'?locked?'车与配装已锁定，选你的路线，放手一搏。':'同车 · 同配装 · 同一车流，轮流较量':'两分钟，看看一次撞击能走多远。'}</p></div>
          <div class="garage-footer"><button type="button" data-action="guide">怎么玩 <span>↗</span></button><button type="button" data-action="vehicles">车流图鉴 <span>↗</span></button><button type="button" data-action="settings">设置 <span>↗</span></button></div>
        </aside>
        <footer class="menu-footer"><span><b>本机 · 当前配装纪录</b> ${best?scoreText(best):'等你来创造'}</span><span class="desktop-note">桌面键鼠体验 <i>·</i> 原创街机实验</span></footer>
      </div>
    </section>`;
  }

  private choice(field:string,value:string,label:string,current:string):string {
    return `<button type="button" data-config="${field}" data-value="${value}" ${this.container.dataset.challengeRound==='2'?'disabled':''} class="${current===value?'is-selected':''}" aria-pressed="${current===value}">${label}</button>`;
  }

  private buildHud():void {
    this.hud.innerHTML=`<div class="hud-top"><div class="score-cluster"><span class="hud-label">城市连锁 <i>SF—01</i></span><strong data-field="score">0</strong><div class="combo-line"><span data-field="combo" hidden>连锁 ×1</span><span data-field="crashes">0 个目标卷入</span></div><div class="combo-track"><i data-field="comboTrack"></i></div></div><div class="timer-cluster"><span class="hud-label">剩余时间</span><strong data-field="time">2:00</strong><button type="button" class="pause-button" data-action="pause" aria-label="暂停游戏，Esc"><span aria-hidden="true">Ⅱ</span><kbd>ESC</kbd></button></div></div>
      <div class="hud-notice" data-field="notice" role="status" aria-live="polite" hidden></div>
      <div class="blast-cluster"><div class="blast-status"><span class="hud-label">定向爆破</span><strong data-field="blastLabel">准备就绪</strong></div><button type="button" class="blast-meter" data-action="blast" aria-label="按空格进行爆破"><span data-field="blastBar"></span><b><kbd>SPACE</kbd> <span data-field="blastAction">引爆</span></b></button><span class="aim-hint">鼠标瞄准 · 空格爆破 · WASD 追击新车流</span></div>
      <div class="mechanism-cluster"><button type="button" class="mechanism-trigger" data-action="mechanism-mode"><kbd>E</kbd><span>现场机关</span><b data-field="charges">● ● ●</b></button><span class="mechanism-hint" data-field="mechanismHint">每局 3 次 · 选取时慢动作</span></div>
      <div class="mechanism-panel" data-field="mechanisms" hidden><div class="mechanism-heading"><span>选一个机关，改变现场。</span><kbd>E 取消</kbd></div><div>${MECHANISMS.map((item,i)=>`<button type="button" data-mechanism="${item.id}"><kbd>${i+1}</kbd><strong>${item.name}</strong><span>${item.description}</span></button>`).join('')}</div></div>
      <div class="performance-note" data-field="fps"></div>`;
    this.hud.querySelectorAll<HTMLElement>('[data-field]').forEach(item=>{this.fields[item.dataset.field!]=item;});
  }

  update(snapshot:GameSnapshot):void {
    this.snapshot=snapshot;
    if(this.screen!=='game') return;
    this.hud.hidden=snapshot.phase==='ended';
    this.fields.score.textContent=scoreText(snapshot.score);
    const seconds=Math.max(0,Math.ceil(snapshot.time));
    this.fields.time.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    this.fields.time.classList.toggle('is-urgent',seconds<=15);
    this.fields.combo.hidden=snapshot.combo<2;
    this.fields.combo.textContent=`连锁 ×${snapshot.combo}`;
    this.fields.crashes.textContent=`${snapshot.crashes} 个目标卷入`;
    this.fields.comboTrack.style.transform=`scaleX(${Math.min(1,Math.max(0,snapshot.comboTime/5))})`;
    const charge=Math.min(1,Math.max(0,snapshot.blastCharge));
    this.fields.blastBar.style.transform=`scaleX(${charge})`;
    this.fields.blastLabel.textContent=charge>=0.99?'准备就绪':`充能 ${Math.floor(charge*100)}%`;
    this.fields.blastAction.textContent=charge>=0.99?'引爆':'充能中';
    this.hud.querySelector('.blast-cluster')!.classList.toggle('is-ready',charge>=0.99);
    this.fields.charges.textContent=Array.from({length:3},(_,i)=>i<snapshot.interventions?'●':'○').join(' ');
    (this.hud.querySelector('.mechanism-trigger') as HTMLButtonElement).disabled=snapshot.interventions<=0;
    this.fields.mechanisms.hidden=!snapshot.slowMotion || snapshot.interventions<=0;
    this.fields.mechanismHint.textContent=snapshot.interventions>0?'每局 3 次 · 选取时慢动作':'机关已用尽 · 继续用爆破制造连锁';
    this.fields.notice.hidden=!snapshot.notice;
    this.fields.notice.textContent=snapshot.notice;
    this.fields.fps.textContent=snapshot.fps?`${Math.round(snapshot.fps)} FPS`:'';
    this.hud.classList.toggle('is-selecting',snapshot.slowMotion);
  }

  showResults(result:RunResult,previous?:RunResult):void {
    this.screen='results';this.hud.hidden=true;this.closeDialog();this.overlay.hidden=false;
    const medal={gold:'金牌连锁大师',silver:'银牌破坏高手',bronze:'铜牌街头新星'}[result.medal];
    const car=VEHICLES[result.config.car];const route=ROUTES.find(item=>item.id===result.config.route)!;
    const best=Math.max(0,...this.records.filter(record=>record.timestamp!==result.timestamp && recordKey(record.config)===recordKey(result.config)).map(record=>record.score));
    const versus=result.config.mode==='versus';
    const difference=previous?result.score-previous.score:0;
    const challengeLabels=['命中 30 个目标','连锁达到 12','用完 3 次现场干预'];
    this.overlay.innerHTML=`<section class="result-screen" aria-label="本局成绩"><div class="result-sheet"><div class="result-topline"><span>CRASH! <i>城市连锁</i></span><span>${versus?previous?'同机挑战 / 玩家 2':'同机挑战 / 玩家 1':'SF—01 / 本局结算'}</span></div><div class="result-heading"><span class="result-medal ${result.medal}"><span aria-hidden="true">✦</span> ${medal}</span><h2>${previous?difference===0?'不分高下。':difference>0?'玩家 2，胜出！':'玩家 1，胜出！':'这一撞，够漂亮。'}</h2></div><div class="result-score"><strong>${scoreText(result.score)}</strong><span>${!versus && result.score>0 && result.score>best?'本机新高 · NEW BEST':'连锁总分 · TOTAL SCORE'}</span></div>${previous?`<div class="versus-comparison"><div><span>玩家 1</span><strong>${scoreText(previous.score)}</strong><small>${ROUTES.find(item=>item.id===previous.config.route)!.short}</small></div><b>VS</b><div><span>玩家 2</span><strong>${scoreText(result.score)}</strong><small>${route.short}</small></div></div>`:''}<div class="result-stats"><div><strong>×${result.bestCombo}</strong><span>最高连锁</span></div><div><strong>${result.crashes}</strong><span>命中目标</span></div><div><strong>${result.destroyed}</strong><span>摧毁目标</span></div></div><div class="result-challenges">${result.challenges.map((complete,i)=>`<span class="${complete?'complete':''}"><i>${complete?'✓':'○'}</i>${challengeLabels[i]||`街区挑战 ${i+1}`}</span>`).join('')}</div><div class="result-build"><span>${car.name} / ${route.short}</span><span>${BLAST_MODS.find(item=>item.id===result.config.blast)!.name} + ${PASSIVE_MODS.find(item=>item.id===result.config.passive)!.name}</span></div><div class="result-actions"><button type="button" class="button button-primary" data-action="${versus&&!previous?'next-player':'retry'}">${versus&&!previous?'交棒给玩家 2':previous?'再比一轮':'再来一局'} ${arrow}</button><button type="button" class="button button-outline" data-action="share">导出成绩图 <span aria-hidden="true">↓</span></button></div><div class="result-bottom"><button type="button" data-action="menu">← 回车库</button><small>${RULE_VERSION} · 挑战编号 ${result.config.seed}</small></div></div></section>`;
    this.overlay.querySelector<HTMLButtonElement>('.button-primary')?.focus({preventScroll:true});
  }

  showPause(settings:Settings):void {
    this.settings={...settings};this.screen='pause';this.hud.hidden=true;this.overlay.hidden=false;this.closeDialog();
    this.overlay.innerHTML=`<section class="pause-screen"><div class="pause-sheet"><span class="eyebrow">TAKE A BREATHER</span><h2>混乱，等你回来。</h2><p>现场已暂停，时间不会流逝。</p><button type="button" class="button button-primary" data-action="resume">继续连锁 ${arrow}</button><div class="pause-secondary"><button type="button" data-action="retry">重新开始 <kbd>R</kbd></button><button type="button" data-action="menu">回车库 <span>↗</span></button></div><div class="pause-settings">${this.settingsContent()}</div><button type="button" class="text-button" data-action="guide">查看操作说明 ↗</button></div></section>`;
    this.overlay.querySelector<HTMLButtonElement>('[data-action="resume"]')?.focus({preventScroll:true});
  }

  showLoading(message:string):void {
    this.screen='loading';this.hud.hidden=true;this.overlay.hidden=false;
    this.overlay.innerHTML=`<section class="loading-screen"><div class="loading-wordmark">CRASH!</div><div class="loading-line"><i></i></div><p role="status">${escapeHTML(message)}</p><span>城市即将就绪。</span></section>`;
  }

  showError(message:string):void {
    this.screen='error';this.hud.hidden=true;this.overlay.hidden=false;this.closeDialog();
    this.overlay.innerHTML=`<section class="pause-screen"><div class="pause-sheet"><span class="eyebrow">PIT STOP</span><h2>稍等，修一下路。</h2><p>${escapeHTML(message)}</p><button type="button" class="button button-primary" data-action="reload">重新加载 ↻</button><small class="error-note">建议使用支持 WebGL 的桌面浏览器。</small></div></section>`;
  }

  hideOverlays():void {
    this.closeDialog();this.overlay.hidden=true;this.overlay.innerHTML='';this.screen='game';this.hud.hidden=false;
    if(document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if(this.snapshot) this.update(this.snapshot);
  }

  toast(text:string):void {
    window.clearTimeout(this.toastTimer);this.toastElement.textContent=text;this.toastElement.hidden=false;
    this.toastTimer=window.setTimeout(()=>{this.toastElement.hidden=true;},3200);
  }

  private settingsContent():string {
    return `<div class="settings-fields"><label><span>音效 <output data-output="volume">${Math.round(this.settings.volume*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value="${this.settings.volume}" data-setting="volume" aria-label="音效音量"></label><label><span>音乐 <output data-output="music">${Math.round(this.settings.music*100)}%</output></span><input type="range" min="0" max="1" step="0.05" value="${this.settings.music}" data-setting="music" aria-label="音乐音量"></label><label class="checkbox-label"><span>撞击震屏</span><input type="checkbox" data-setting="shake" ${this.settings.shake?'checked':''}></label><label class="quality-label"><span>画面质量</span><select data-setting="quality"><option value="high" ${this.settings.quality==='high'?'selected':''}>高画质</option><option value="low" ${this.settings.quality==='low'?'selected':''}>流畅优先</option></select></label></div>`;
  }

  private showDialog(kind:string):void {
    this.lastFocus=document.activeElement as HTMLElement;this.currentDialog=kind;
    let title='',body='';
    if(kind==='settings') {title='调到你喜欢。';body=this.settingsContent();}
    if(kind==='guide') {
      title='一撞，只是开始。';
      body=`<div class="guide-intro">你的残骸，就是下一次连锁的起点。<br>让更多新目标加入，比反复撞同一辆车更值钱。</div><ol class="guide-steps"><li><span>01</span><div><h3>驶入现场</h3><p>选好入场路线。碰撞后，用 <kbd>WASD</kbd> 或方向键调整残骸在空中的落点。</p></div></li><li><span>02</span><div><h3>瞄准，再引爆</h3><p>鼠标指向想推进的方向，按 <kbd>SPACE</kbd> 定向爆破。能量会自动恢复。</p></div></li><li><span>03</span><div><h3>借现场，放大混乱</h3><p>按 <kbd>E</kbd> 开启机关慢动作，再按 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 选择。每局只有 3 次，留给值得的一刻。</p></div></li></ol><div class="guide-footer"><span><kbd>ESC</kbd> 暂停</span><span><kbd>R</kbd> 快速重开</span><span>每局 120 秒</span></div><p class="guide-note">没有可见人物，只有机械破坏。原创新街区的道路布局不对应真实城市。</p>`;
    }
    if(kind==='vehicles') {
      title='每一辆，都有用。';
      body=`<p class="guide-intro">看准车身、载荷和颜色，把路上的特性变成你的连锁。</p><div class="vehicle-codex">${Object.values(VEHICLES).map(vehicle=>`<article>${carIcon(vehicle.id,colorHex(vehicle.color))}<div><h3>${vehicle.name}${vehicle.id==='booster'||vehicle.id==='magnet'?'<em>特殊</em>':''}</h3><span>${vehicle.tag}</span><p>${vehicle.description}</p></div></article>`).join('')}</div>`;
    }
    this.dialog.hidden=false;
    this.dialog.innerHTML=`<section class="dialog-card ${kind==='vehicles'?'dialog-wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div><span class="eyebrow">CRASH! / ${kind==='vehicles'?'TRAFFIC FIELD GUIDE':kind==='guide'?'QUICK START':'YOUR SETUP'}</span><h2 id="dialog-title">${title}</h2></div><button type="button" class="dialog-close" data-action="close-dialog" aria-label="关闭">×</button></header><div class="dialog-content">${body}</div></section>`;
    this.dialog.querySelector<HTMLButtonElement>('.dialog-close')?.focus({preventScroll:true});
  }

  private closeDialog():void {
    const wasOpen=!this.dialog.hidden;this.dialog.hidden=true;this.dialog.innerHTML='';this.currentDialog='';
    if(wasOpen && this.lastFocus?.isConnected) this.lastFocus.focus({preventScroll:true});
  }

  private trapFocus(event:KeyboardEvent):void {
    const elements=Array.from(this.dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]'));
    if(!elements.length) return;
    if(event.shiftKey && document.activeElement===elements[0]) {event.preventDefault();elements.at(-1)!.focus();}
    else if(!event.shiftKey && document.activeElement===elements.at(-1)) {event.preventDefault();elements[0].focus();}
  }

  private handleClick=(event:MouseEvent):void=>{
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if(!target || target.disabled) return;
    if(target.dataset.config) {
      if(this.container.dataset.challengeRound==='2' && target.dataset.config!=='route') return;
      this.config={...this.config,[target.dataset.config]:target.dataset.value};this.callbacks.onConfig({...this.config});this.renderMenu();
      this.overlay.querySelector<HTMLButtonElement>(`[data-config="${target.dataset.config}"][data-value="${target.dataset.value}"]`)?.focus({preventScroll:true});return;
    }
    if(target.dataset.mechanism) {this.callbacks.onMechanism(target.dataset.mechanism as MechanismId);return;}
    switch(target.dataset.action) {
      case 'start':this.callbacks.onStart({...this.config});break;
      case 'loadout':this.loadoutOpen=!this.loadoutOpen;this.renderMenu();this.overlay.querySelector<HTMLButtonElement>('[data-action="loadout"]')?.focus({preventScroll:true});break;
      case 'pause':this.callbacks.onPause();break;
      case 'resume':this.callbacks.onResume();break;
      case 'retry':this.callbacks.onRetry();break;
      case 'menu':this.callbacks.onMenu();break;
      case 'mechanism-mode':this.callbacks.onMechanismMode();break;
      case 'blast':if((this.snapshot?.blastCharge??0)>=0.99)this.callbacks.onBlast();else this.toast('爆破正在充能，很快就绪。');break;
      case 'share':this.callbacks.onShare();break;
      case 'next-player':this.callbacks.onNextPlayer();break;
      case 'guide':case 'vehicles':case 'settings':this.showDialog(target.dataset.action);break;
      case 'close-dialog':this.closeDialog();break;
      case 'reload':window.location.reload();break;
    }
  };

  private handleInput=(event:Event):void=>{
    const input=event.target as HTMLInputElement;
    if(input.dataset.setting==='volume'||input.dataset.setting==='music') {
      const key=input.dataset.setting;this.settings={...this.settings,[key]:Number(input.value)};
      this.container.querySelectorAll<HTMLOutputElement>(`[data-output="${key}"]`).forEach(output=>{output.value=`${Math.round(Number(input.value)*100)}%`;});
      this.callbacks.onSettings({...this.settings});
    }
  };

  private handleChange=(event:Event):void=>{
    const input=event.target as HTMLInputElement;
    if(input.dataset.config) {if(this.container.dataset.challengeRound==='2') return;this.config={...this.config,[input.dataset.config]:input.value};this.callbacks.onConfig({...this.config});const field=input.dataset.config;this.renderMenu();this.overlay.querySelector<HTMLSelectElement>(`select[data-config="${field}"]`)?.focus({preventScroll:true});}
    if(input.dataset.setting==='shake'||input.dataset.setting==='quality') {
      this.settings={...this.settings,[input.dataset.setting]:input.dataset.setting==='shake'?input.checked:input.value};this.callbacks.onSettings({...this.settings});
    }
  };
}
