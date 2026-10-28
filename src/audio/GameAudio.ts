import type { GameEvent, GameSnapshot, Settings } from '../shared';

type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const MENU_LOOP_SEC = 1344000 / 44100;

/** Original, synthesized arcade sound. No audio is loaded or started before a gesture. */
export class GameAudio {
  private context?: AudioContext;
  private effects?: GainNode;
  private music?: GainNode;
  private gate?: GainNode;
  private engineGain?: GainNode;
  private engineTone?: OscillatorNode;
  private engineFilter?: BiquadFilterNode;
  private noiseBuffer?: AudioBuffer;
  private persistentNodes: AudioNode[] = [];
  private voices = new Set<Voice>();
  private seen = new Set<number>();
  private seenOrder: number[] = [];
  private scheduler?: ReturnType<typeof setInterval>;
  private phase: GameSnapshot['phase'] = 'ready';
  private active = true;
  private disposed = false;
  private nextBeat = 0;
  private beat = 0;
  private lastImpact = -100;
  private lastExplosion = -100;
  private lastAccent = -100;
  private lastCombo = 1;
  private lastCharge = 0;
  private playedEnd = false;
  private lastLaunchEvent?: GameEvent;
  private checkActivation = false;
  private endTailUntil = 0;
  // Title-screen theme: an exact 16-bar loop rendered by claude-code-music (crash_gameshow bundle).
  private menuGain?: GainNode;
  private menuSource?: AudioBufferSourceNode;
  private menuBuffer?: AudioBuffer;
  private menuLoading?: Promise<void>;
  private menuProbe?: AnalyserNode;
  private menuWanted = false;
  private menuStopTimer?: ReturnType<typeof setTimeout>;
  private visibilityBound = false;
  /** Background music is off when the switch is off or the volume is zero. */
  private get musicLevel(): number { return this.settings.bgm === false ? 0 : this.settings.music; }
  private settings: Settings = { volume: 0.65, music: 0.3, bgm: true, shake: true, quality: 'high', language: 'zh' };

  constructor() {}

  resetRun(): void {
    this.seen.clear(); this.seenOrder.length = 0; this.lastLaunchEvent = undefined;
    this.lastCombo = 1; this.lastCharge = 0; this.playedEnd = false;
    this.beat = 0; this.nextBeat = 0; this.endTailUntil = 0;
    this.phase = 'ready';
  }

  async unlock(): Promise<void> {
    if (this.disposed || typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
        if (!Constructor) return;
        this.context = new Constructor({ latencyHint: 'interactive' });
        this.buildGraph(this.context);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.scheduler) this.scheduler = setInterval(() => this.scheduleMusic(), 40);
      if (!this.visibilityBound) {
        this.visibilityBound = true;
        document.addEventListener('visibilitychange', () => {
          const context = this.context;
          if (!context) return;
          if (document.hidden) void context.suspend();
          else void context.resume();
        });
      }
      this.applyLevels();
    } catch {
      // Private browsing, denied audio, and devices without an output stay playable.
    }
  }

  get running(): boolean { return this.context?.state === 'running'; }

  /** Dev diagnostics: is the title theme actually reaching the output? */
  debugMenu(): { running: boolean; wanted: boolean; decoded: boolean; playing: boolean; gain: number; rms: number } {
    let rms = 0;
    if (this.context && this.menuGain) {
      this.menuProbe ??= (() => { const node = this.context!.createAnalyser(); node.fftSize = 2048; this.menuGain!.connect(node); return node; })();
      const data = new Float32Array(this.menuProbe.fftSize);
      this.menuProbe.getFloatTimeDomainData(data);
      rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    }
    return { running: this.running, wanted: this.menuWanted, decoded: !!this.menuBuffer, playing: !!this.menuSource, gain: this.menuGain?.gain.value ?? 0, rms };
  }

  /** Ask for the title theme (menu, results). It starts as soon as audio is unlocked and decoded. */
  setMenuMusic(on: boolean): void {
    this.menuWanted = on;
    this.applyLevels();
  }

  private loadMenuMusic(): void {
    if (this.menuBuffer || this.menuLoading || !this.context) return;
    const context = this.context;
    this.menuLoading = fetch(`${import.meta.env.BASE_URL}audio/crash_gameshow.mp3`)
      .then(response => response.arrayBuffer())
      .then(data => context.decodeAudioData(data))
      .then(buffer => { this.menuBuffer = buffer; })
      .catch(() => { /* the game stays fully playable without the theme */ })
      .finally(() => { this.menuLoading = undefined; this.applyLevels(); });
  }

  private syncMenuMusic(time: number): void {
    const context = this.context, gain = this.menuGain;
    if (!context || !gain) return;
    const want = this.menuWanted && this.musicLevel > 0 && this.phase !== 'running' && this.phase !== 'paused';
    const level = want ? Math.min(0.9, clamp(this.musicLevel) / 0.3 * 0.5) : 0;
    gain.gain.setTargetAtTime(level, time, want ? 0.35 : 0.2);
    if (want) {
      if (this.menuStopTimer) { clearTimeout(this.menuStopTimer); this.menuStopTimer = undefined; }
      if (!this.menuBuffer) { this.loadMenuMusic(); return; }
      if (!this.menuSource) {
        const source = context.createBufferSource();
        source.buffer = this.menuBuffer;
        source.loop = true;
        source.loopStart = 0;
        // Encoders pad the tail; the loop is exactly 1,344,000 samples at 44.1 kHz.
        source.loopEnd = Math.min(this.menuBuffer.duration, MENU_LOOP_SEC);
        source.connect(gain);
        source.start();
        this.menuSource = source;
      }
    } else if (this.menuSource && !this.menuStopTimer) {
      const source = this.menuSource;
      this.menuStopTimer = setTimeout(() => {
        try { source.stop(); } catch { /* already stopped */ }
        source.disconnect();
        if (this.menuSource === source) this.menuSource = undefined;
        this.menuStopTimer = undefined;
      }, 1100);
    }
  }

  setActive(active: boolean): void {
    if (!active && this.active) {
      this.checkActivation = true;
      if (this.phase === 'ended' && this.playedEnd && this.context) {
        this.endTailUntil = this.context.currentTime + 1.2;
      }
    }
    this.active = active;
    this.applyLevels();
    if (!active) this.nextBeat = 0;
  }

  update(snapshot: GameSnapshot, settings: Settings): void {
    this.settings = settings;
    const previousPhase = this.phase;
    const launchEvent = snapshot.events.find(event => event.id === 1 && event.kind === 'launch');
    // Snapshot arrays are copied, but each run's event objects are stable. This also
    // distinguishes an immediate retry from pausing and resuming the same run.
    const newLaunch = this.checkActivation && launchEvent && launchEvent !== this.lastLaunchEvent;
    const freshRun = snapshot.phase === 'running' &&
      (previousPhase === 'ready' || previousPhase === 'ended' || newLaunch);
    if (freshRun) {
      this.seen.clear();
      this.seenOrder.length = 0;
      this.lastCombo = 1;
      this.lastCharge = snapshot.blastCharge;
      this.playedEnd = false;
      this.beat = 0;
      this.nextBeat = 0;
      this.endTailUntil = 0;
    }
    if (launchEvent) this.lastLaunchEvent = launchEvent;
    if (this.active && snapshot.phase === 'running') this.checkActivation = false;
    this.phase = snapshot.phase;
    this.applyLevels();

    const context = this.context;
    const audible = context?.state === 'running' && this.active &&
      (snapshot.phase === 'running' || snapshot.phase === 'ended');
    // Consume every event even while muted: resuming must not replay an old pile-up.
    const pending: GameEvent[] = [];
    for (const event of snapshot.events) {
      if (this.seen.has(event.id)) continue;
      this.remember(event.id);
      if (audible) pending.push(event);
    }
    // A hundred collision contacts must not drown out the player's explosion cue.
    const priority = { end: 8, explosion: 7, launch: 6, warning: 5, mechanism: 4, special: 3, impact: 2, score: 0 };
    pending.sort((a, b) => priority[b.kind] - priority[a.kind] || b.power - a.power);
    pending.slice(0, 7).forEach(event => this.playEvent(event));

    if (audible && context && snapshot.phase === 'running') {
      if (snapshot.combo > this.lastCombo && snapshot.combo >= 2 && context.currentTime - this.lastAccent > 0.2) {
        this.lastAccent = context.currentTime;
        this.comboAccent(snapshot.combo);
      }
      if (snapshot.blastCharge >= 0.995 && this.lastCharge < 0.995 && !freshRun) this.chargeReady();
    }
    if (audible && snapshot.phase === 'ended' && !this.playedEnd) this.endSting();
    this.lastCombo = snapshot.combo;
    this.lastCharge = snapshot.blastCharge;

    if (context && this.engineGain && this.engineTone && this.engineFilter) {
      const player = snapshot.entities.find(entity => entity.player);
      const speed = player ? Math.hypot(player.v.x, player.v.z) : 0;
      const amount = snapshot.phase === 'running' && this.active ? clamp(speed / 23) : 0;
      this.engineGain.gain.setTargetAtTime(amount * 0.035, context.currentTime, 0.08);
      this.engineTone.frequency.setTargetAtTime(37 + amount * 82, context.currentTime, 0.09);
      this.engineFilter.frequency.setTargetAtTime(170 + amount * 650, context.currentTime, 0.09);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = undefined;
    for (const voice of this.voices) {
      try { voice.source.stop(); } catch { /* Already ended. */ }
      voice.nodes.forEach(node => node.disconnect());
    }
    this.voices.clear();
    try { this.engineTone?.stop(); } catch { /* Audio never started. */ }
    this.persistentNodes.forEach(node => node.disconnect());
    this.persistentNodes.length = 0;
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }

  private buildGraph(context: AudioContext): void {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.knee.value = 15;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;
    this.gate = context.createGain();
    this.gate.gain.value = 0;
    compressor.connect(this.gate).connect(context.destination);
    this.effects = context.createGain();
    this.music = context.createGain();
    this.effects.gain.value = 0;
    this.music.gain.value = 0;
    this.effects.connect(compressor);
    this.music.connect(compressor);
    // The title theme bypasses the in-game gate: the gate is shut whenever no round is running.
    this.menuGain = context.createGain();
    this.menuGain.gain.value = 0;
    this.menuGain.connect(context.destination);

    // A shared, damped echo adds a short urban rumble without a reverb per impact.
    const send = context.createGain();
    send.gain.value = 0.13;
    const delay = context.createDelay(0.4);
    delay.delayTime.value = 0.17;
    const damping = context.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.value = 1350;
    const feedback = context.createGain();
    feedback.gain.value = 0.24;
    this.effects.connect(send).connect(delay).connect(damping).connect(compressor);
    damping.connect(feedback).connect(delay);

    this.engineTone = context.createOscillator();
    this.engineTone.type = 'sawtooth';
    this.engineTone.frequency.value = 40;
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 220;
    this.engineGain = context.createGain();
    this.engineGain.gain.value = 0;
    this.engineTone.connect(this.engineFilter).connect(this.engineGain).connect(this.effects);
    this.engineTone.start();
    this.persistentNodes.push(compressor, this.gate, this.effects, this.music, send, delay,
      damping, feedback, this.engineTone, this.engineFilter, this.engineGain);

    this.noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  }

  private applyLevels(): void {
    if (!this.context || !this.effects || !this.music || !this.gate) return;
    const time = this.context.currentTime;
    const playing = this.phase === 'running' && this.active;
    const ending = this.phase === 'ended' && (this.active || time < this.endTailUntil);
    const audible = playing || ending;
    this.effects.gain.setTargetAtTime(clamp(this.settings.volume) * 0.75, time, 0.025);
    this.music.gain.setTargetAtTime(playing ? clamp(this.musicLevel) * 0.4 : 0, time, 0.07);
    this.gate.gain.setTargetAtTime(audible ? 0.85 : 0, time, 0.035);
    this.syncMenuMusic(time);
  }

  private remember(id: number): void {
    this.seen.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > 1024) this.seen.delete(this.seenOrder.shift()!);
  }

  private playEvent(event: GameEvent): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const pan = clamp(event.p.x / 42, -0.85, 0.85);
    const power = clamp(event.power / 1.5, 0.12, 1);
    switch (event.kind) {
      case 'impact':
        if (now - this.lastImpact < 0.055) return;
        this.lastImpact = now;
        this.tone(92 - power * 24, 0.17, 0.24 * power, 'sine', this.effects, now, 30, pan);
        this.noise(0.12 + power * 0.12, 0.17 * power, 'bandpass', 1450, this.effects, now, pan);
        this.tone(415 + (event.id % 7) * 53, 0.08, 0.038 * power, 'triangle', this.effects, now, 130, pan);
        break;
      case 'explosion':
        if (now - this.lastExplosion < 0.14) return;
        this.lastExplosion = now;
        this.tone(102, 0.75, 0.47, 'sine', this.effects, now, 25, pan);
        this.noise(1.15, 0.5, 'lowpass', 1650, this.effects, now, pan, 120);
        this.noise(0.16, 0.2, 'highpass', 850, this.effects, now, pan);
        this.tone(56, 0.85, 0.12, 'triangle', this.effects, now + 0.04, 29, pan);
        break;
      case 'special':
        if(event.effect==='ability') {
          this.tone(105,.3,.16,'sawtooth',this.effects,now,650,pan,1600);
          [330,495,660].forEach((f,i)=>this.tone(f,.13,.075,'triangle',this.effects!,now+i*.07,undefined,pan));
          break;
        }
        if(event.effect==='city') {
          this.noise(1.7,.3,'lowpass',1150,this.effects,now,pan,90);
          this.tone(84,1.4,.24,'sine',this.effects,now,25,pan);
          [147,220,294,440].forEach((f,i)=>this.tone(f,.28,.09,'square',this.effects!,now+i*.16,undefined,pan,1400));
          break;
        }
        if(event.effect==='pizza') {
          [392,494,587,784,988,1175].forEach((f,i)=>this.tone(f,.16,.085,'square',this.effects!,now+i*.13,undefined,pan,1800));
          break;
        }
        if(event.effect==='bank') {
          [1200,1600,1900,2400].forEach((f,i)=>this.tone(f,.22,.055,'sine',this.effects!,now+i*.09,undefined,pan));
          break;
        }
        // Burnout CRASH! scores each event with its own tune. These are original two-second riffs in the same spirit.
        if(event.effect==='goodcop') {            // upbeat skank: offbeat major stabs, then a rising answer
          [0.12,0.36,0.6].forEach(offset=>[392,494,587].forEach(f=>this.tone(f,.12,.05,'square',this.effects!,now+offset,undefined,pan,2400)));
          [523,659,784].forEach((f,i)=>this.tone(f,.14,.07,'triangle',this.effects!,now+.84+i*.1,undefined,pan));
          break;
        }
        if(event.effect==='badcop') {             // minor-second siren dive
          for(let i=0;i<5;i++)this.tone(i%2?311:330,.2,.08,'sawtooth',this.effects,now+i*.16,i%2?277:294,pan,1500);
          this.noise(.5,.08,'lowpass',900,this.effects,now,pan,80);
          break;
        }
        if(event.effect==='freeze') {             // glassy bells sliding down a whole-tone ladder
          [1568,1397,1245,1109,988].forEach((f,i)=>{this.tone(f,.5,.06,'sine',this.effects!,now+i*.09,f*.97,pan);this.tone(f*2.76,.22,.025,'sine',this.effects!,now+i*.09,undefined,pan);});
          this.noise(.8,.05,'highpass',5200,this.effects,now,pan,0);
          break;
        }
        if(event.effect==='ambulance') {
          for(let i=0;i<4;i++)this.tone(i%2?550:780,.18,.08,'triangle',this.effects,now+i*.19,undefined,pan);
          break;
        }
        if(event.effect==='mega') {
          const tier=clamp(event.power,1,4);
          this.noise(.5+tier*.2,.2+tier*.05,'lowpass',2200,this.effects,now,pan,120);
          this.tone(70,.7,.26,'sine',this.effects,now,24,pan);
          [392,523,659,784,1047].slice(0,2+tier).forEach((f,i)=>this.tone(f,.2,.09,'square',this.effects!,now+i*.07,undefined,pan,2200));
          return;
        }
        if(event.effect==='perk'||event.effect==='contract') {
          [523,659,784,1047].forEach((f,i)=>this.tone(f,.16,.07,'triangle',this.effects!,now+i*.06,undefined,pan));
          return;
        }
        if(event.effect==='collapse') {
          this.noise(1.1,.22,'lowpass',800,this.effects,now,pan,100);
          this.tone(65,.8,.2,'sine',this.effects,now,24,pan);
          break;
        }
        if(['tornado','airstrike','tidalwave','ufo','asteroid','monster','super'].includes(event.effect||'')) {
          this.noise(2,.32,'lowpass',1800,this.effects,now,pan,140);
          this.tone(100,1.9,.28,'sawtooth',this.effects,now,27,pan,500);
          [196,247,294,392].forEach((f,i)=>this.tone(f,.4,.07,'square',this.effects!,now+i*.22,undefined,pan,1600));
          break;
        }
        this.tone(180, 0.35, 0.1, 'sawtooth', this.effects, now, 640, pan, 1300);
        this.tone(273, 0.45, 0.055, 'sine', this.effects, now + 0.08, 920, pan);
        break;
      case 'mechanism':
        this.noise(0.35, 0.2, 'bandpass', 470, this.effects, now, pan);
        this.tone(240, 0.22, 0.1, 'square', this.effects, now, 84, pan, 700);
        break;
      case 'warning':
        this.tone(660, 0.1, 0.085, 'triangle', this.effects, now, 660, pan);
        this.tone(880, 0.1, 0.075, 'triangle', this.effects, now + 0.16, 880, pan);
        break;
      case 'launch':
        this.noise(0.32, 0.15, 'bandpass', 450, this.effects, now, 0, 3000);
        this.tone(70, 0.42, 0.17, 'sawtooth', this.effects, now, 210, 0, 600);
        break;
      case 'end': this.endSting(); break;
      case 'score': break; // Combo crossings are the musical cue; individual points stay quiet.
    }
  }

  private comboAccent(combo: number): void {
    if (!this.context || !this.effects) return;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    const frequency = 330 * Math.pow(2, scale[Math.min(scale.length - 1, Math.floor(combo) - 2)] / 12);
    this.tone(frequency, 0.14, 0.09, 'triangle', this.effects, this.context.currentTime);
    this.tone(frequency * 1.5, 0.18, 0.045, 'sine', this.effects, this.context.currentTime + 0.065);
  }

  private chargeReady(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [440, 660, 880].forEach((frequency, index) =>
      this.tone(frequency, 0.16, 0.065, 'sine', this.effects!, now + index * 0.065));
  }

  private endSting(): void {
    if (!this.context || !this.effects || this.playedEnd) return;
    this.playedEnd = true;
    const now = this.context.currentTime;
    [185, 247, 277, 370].forEach((frequency, index) =>
      this.tone(frequency, 0.5, 0.095, 'triangle', this.effects!, now + index * 0.13));
    this.tone(46.25, 0.9, 0.2, 'sine', this.effects, now + 0.39);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || !this.music || context.state !== 'running' || !this.active ||
      this.phase !== 'running' || this.musicLevel <= 0) {
      this.nextBeat = 0;
      return;
    }
    const now = context.currentTime;
    if (this.nextBeat < now - 0.15) this.nextBeat = now + 0.025;
    const stepDuration = 60 / 134 / 4;
    // Look ahead only 120 ms. A background tab cannot create minutes of queued notes.
    let count = 0;
    while (this.nextBeat < now + 0.12 && count++ < 4) {
      this.musicStep(this.beat++, this.nextBeat);
      this.nextBeat += stepDuration;
    }
  }

  private musicStep(beat: number, time: number): void {
    if (!this.music) return;
    const step = beat % 16;
    const bar = Math.floor(beat / 16) % 4;
    // An original syncopated break with a four-bar minor bass response.
    if ([0, 6, 8, 11].includes(step) || (bar === 3 && step === 14)) {
      this.tone(142, 0.23, 0.65, 'sine', this.music, time, 43);
      this.noise(0.015, 0.12, 'highpass', 1600, this.music, time);
    }
    if (step === 4 || step === 12 || (bar === 3 && step === 15)) {
      this.noise(0.14, 0.24, 'highpass', 1700, this.music, time, 0.12);
      this.tone(165, 0.1, 0.19, 'triangle', this.music, time, 75);
    }
    if (step % 2 === 0 || step === 7 || step === 15) {
      this.noise(step === 10 ? 0.105 : 0.032, step % 4 === 2 ? 0.115 : 0.065,
        'highpass', 6500, this.music, time, step % 4 === 0 ? -0.28 : 0.28);
    }
    const bassSteps = [0, 3, 6, 8, 10, 14];
    const noteIndex = bassSteps.indexOf(step);
    if (noteIndex !== -1) {
      const notes = bar === 2 ? [30, 30, 37, 33, 30, 40] : bar === 3 ? [28, 28, 35, 31, 28, 37] : [30, 30, 42, 37, 33, 37];
      const frequency = 440 * Math.pow(2, (notes[noteIndex] - 69) / 12);
      this.tone(frequency, step === 14 ? 0.17 : 0.115, 0.17, 'sawtooth', this.music,
        time, frequency, 0, 550 + (step % 3) * 240);
    }
    if (bar % 2 === 1 && (step === 2 || step === 9)) {
      this.tone(step === 2 ? 370 : 440, 0.085, 0.035, 'square', this.music, time, undefined, -0.25, 1400);
    }
  }

  private tone(frequency: number, duration: number, level: number, type: OscillatorType,
    bus: AudioNode, when: number, target?: number, pan = 0, lowpass?: number): void {
    const context = this.context;
    if (!context || this.voices.size >= 48) return;
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(Math.max(10, frequency), when);
    if (target !== undefined) source.frequency.exponentialRampToValueAtTime(Math.max(10, target), when + duration);
    const filter = lowpass ? context.createBiquadFilter() : undefined;
    if (filter) { filter.type = 'lowpass'; filter.frequency.value = lowpass!; filter.Q.value = 1.4; }
    this.envelope(source, duration, level, bus, when, pan, filter);
  }

  private noise(duration: number, level: number, type: BiquadFilterType, frequency: number,
    bus: AudioNode, when: number, pan = 0, targetFrequency?: number): void {
    const context = this.context;
    if (!context || !this.noiseBuffer || this.voices.size >= 48) return;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, when);
    filter.Q.value = type === 'bandpass' ? 0.7 : 0.5;
    if (targetFrequency) filter.frequency.exponentialRampToValueAtTime(targetFrequency, when + duration);
    this.envelope(source, duration, level, bus, when, pan, filter);
  }

  private envelope(source: OscillatorNode | AudioBufferSourceNode, duration: number,
    level: number, bus: AudioNode, when: number, pan: number, filter?: BiquadFilterNode): void {
    const context = this.context!;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, level), when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    let tail: AudioNode = source;
    const nodes: AudioNode[] = [source, gain];
    if (filter) { tail.connect(filter); tail = filter; nodes.push(filter); }
    tail.connect(gain);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner).connect(bus);
      nodes.push(panner);
    } else gain.connect(bus);
    const voice: Voice = { source, nodes };
    this.voices.add(voice);
    source.onended = () => {
      nodes.forEach(node => node.disconnect());
      this.voices.delete(voice);
    };
    source.start(when);
    source.stop(when + duration + 0.025);
  }
}
