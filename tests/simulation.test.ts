import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, DEFAULT_SETTINGS, PLAYER_CARS, ROUTES, type RunConfig, type Vec3 } from '../src/shared';
import { GameSimulation, type GameInput } from '../src/simulation/GameSimulation';
import { GameAudio } from '../src/audio/GameAudio';
import { TrafficPlan } from '../src/simulation/trafficPlan';
import { RoundProgress } from '../src/simulation/roundProgress';

const liveGames: GameSimulation[] = [];
const FRAME = 1 / 30;
function makeGame(overrides: Partial<RunConfig> = {}) {
  const game = new GameSimulation({ ...DEFAULT_CONFIG,rules:'sandbox', ...overrides });
  liveGames.push(game);
  return game;
}
function inputFor(game: GameSimulation, blast = false): GameInput {
  const player = game.entities.get(game.playerId)!.body.translation();
  const length = Math.hypot(player.x, player.z) || 1;
  return { x: 0, z: 0, aim: { x: -player.x / length, y: 0, z: -player.z / length }, blast };
}
function advance(game: GameSimulation, seconds: number, blast = false) {
  for (let frame = 0; frame < Math.ceil(seconds / FRAME); frame++) {
    game.update(FRAME, inputFor(game, blast));
  }
}
function pursueTraffic(game:GameSimulation,maxSeconds:number){
 const features=new Set<string>();
 for(let frame=0;frame<maxSeconds/FRAME&&game.phase!=='ended';frame++){
  const p=game.entities.get(game.playerId)!.body.translation();let target={x:0,z:0},nearest=Infinity;
  for(const entity of game.entities.values()){if(entity.player||entity.wrecked||entity.scale)continue;const q=entity.body.translation(),distance=Math.hypot(q.x-p.x,q.z-p.z);if(distance<nearest){nearest=distance;target=q;}}
  const dx=target.x-p.x,dz=target.z-p.z,length=Math.hypot(dx,dz)||1;
  game.update(FRAME,{x:dx/length,z:dz/length,aim:{x:dx/length,y:0,z:dz/length},blast:frame%8===0});features.add(game.round.feature);
 }
 return features;
}

beforeAll(async () => { await GameSimulation.init(); });
afterEach(() => { liveGames.splice(0).forEach(game => game.dispose()); vi.restoreAllMocks(); });

describe('real physics game loop', () => {
  it('plays an entire two-minute round, scores collisions, and produces a final result', () => {
    const game = makeGame();
    game.start();
    expect(game.result().challenges[3]).toBe(false);
    const checkpoints: ReturnType<GameSimulation['diagnostics']>[] = [];
    for(let checkpoint=0;checkpoint<6;checkpoint++){
      advance(game,20,true);
      checkpoints.push(game.diagnostics());
      if(checkpoint<5)expect(game.result().challenges[3]).toBe(false);
    }
    advance(game, 0.1, true);
    const snapshot = game.snapshot();
    const result = game.result();
    expect(snapshot.phase).toBe('ended');
    expect(snapshot.time).toBe(0);
    expect(result.score).toBeGreaterThan(0);
    expect(result.crashes).toBeGreaterThan(0);
    expect(result.destroyed).toBeGreaterThan(0);
    expect(result.challenges[3]).toBe(true);
    expect(snapshot.challengeProgress?.[3]).toBe(1);
    expect(snapshot.events.some(event => event.kind === 'end')).toBe(true);
    expect(checkpoints[5].trafficSpawned).toBeGreaterThan(checkpoints[3].trafficSpawned);
    expect(checkpoints[5].debrisRecycled).toBeGreaterThan(0);
    const settled = JSON.stringify(snapshot);
    advance(game, 1, true);
    expect(JSON.stringify(game.snapshot())).toBe(settled);
  }, 30_000);

  it('freezes both the clock and physical scene while paused', () => {
    const game = makeGame();
    game.start();
    advance(game, 1);
    game.pause();
    const paused = game.snapshot();
    advance(game, 3, true);
    expect(game.snapshot()).toEqual(paused);
    game.resume();
    advance(game, 0.5);
    expect(game.phase).toBe('running');
    expect(game.time).toBeLessThan(paused.time);
  });

  it('slows the scene for mechanism selection but spends normal wall-clock time', () => {
    const slow = makeGame();
    const normal = makeGame();
    slow.start();
    normal.start();
    const origin = slow.entities.get(slow.playerId)!.body.translation();
    slow.toggleMechanisms();
    advance(slow, 1);
    advance(normal, 1);
    expect(slow.time).toBeCloseTo(119, 7);
    expect(slow.time).toBeCloseTo(normal.time, 7);
    expect(slow.slowMotion).toBe(true);
    const slowPosition = slow.entities.get(slow.playerId)!.body.translation();
    const normalPosition = normal.entities.get(normal.playerId)!.body.translation();
    expect(Math.abs(slowPosition.z - origin.z)).toBeLessThan(Math.abs(normalPosition.z - origin.z) * 0.6);
    advance(slow, 1.7);
    expect(slow.slowMotion).toBe(false);
  });

  it('allows three scene interventions and refuses a fourth without changing the scene', () => {
    const game = makeGame();
    expect(game.useMechanism('signal')).toBe(false);
    game.start();
    expect(game.useMechanism('signal')).toBe(true);
    expect(game.useMechanism('cargo')).toBe(true);
    expect(game.useMechanism('billboard')).toBe(true);
    const snapshot = game.snapshot();
    expect(snapshot.interventions).toBe(0);
    expect(game.useMechanism('signal')).toBe(false);
    expect(game.snapshot()).toEqual(snapshot);
    game.toggleMechanisms();
    expect(game.slowMotion).toBe(false);
  });

  it('keeps the cable car on the visible rail until a damaging collision derails it', () => {
    const game = makeGame();
    const tram = [...game.entities.values()].find(entity => entity.kind === 'tram')!;
    expect(tram.body.translation().x).toBeCloseTo(-4.25, 6);
    game.start();
    tram.body.applyImpulse({ x: 50_000, y: 0, z: 0 }, true);
    advance(game, 0.1);
    expect(tram.wrecked).toBe(false);
    expect(tram.body.translation().x).toBeCloseTo(-4.25, 6);

    const location = tram.body.translation();
    game.entities.get(game.playerId)!.body.setTranslation({ ...location, x: location.x + 3 }, true);
    game.blastCharge = 1;
    expect(game.blast()).toBe(true);
    advance(game, 0.2);
    expect(tram.wrecked).toBe(true);
    expect(Math.abs(tram.body.translation().x + 4.25)).toBeGreaterThan(0.1);
  });

  it('counts the first hit on scattered cargo even though it was already uncontrolled', () => {
    const game = makeGame();
    const existingIds = new Set(game.entities.keys());
    game.start();
    game.useMechanism('cargo');
    const cargo = [...game.entities.values()].find(entity => !existingIds.has(entity.id))!;
    expect(cargo.wrecked).toBe(true);
    // Isolate one released crate high above the scene to measure only its awards.
    cargo.body.setTranslation({ x: 40, y: 50, z: 40 }, true);
    game.entities.get(game.playerId)!.body.setTranslation({ x: 43, y: 50, z: 40 }, true);
    game.blastCharge = 1;
    game.blast();
    expect(game.scores.crashes).toBe(1);
    expect(game.scores.destroyed).toBe(1);
    expect(game.scores.combo).toBe(1);
    const points = game.scores.score;
    game.blastCharge = 1;
    game.blast();
    expect(game.scores.score).toBe(points);
    expect(game.scores.crashes).toBe(1);
  });

  it('recycles at most four old, settled wrecks while preserving fresh and moving chains', () => {
    const game = makeGame();
    type Entity = NonNullable<ReturnType<typeof game.entities.get>>;
    const internals = game as unknown as {
      age: number;
      prop(kind: 'crate', x: number, z: number, size: Vec3, mass: number, value: number): Entity;
      recycleDebris(): void;
    };
    internals.age = 30;
    const debris: Entity[] = [];
    for(let index=0;index<60;index++){
      const entity = internals.prop('crate', 30 + index * 0.5, 40, { x: 1, y: 1, z: 1 }, 60, 100);
      entity.wrecked = true;
      entity.destroyed = true;
      entity.health = 0;
      entity.lastInteraction = index < 4 ? 29 : 0;
      if(index>=4&&index<8)entity.body.setLinvel({ x: 6, y: 0, z: 0 }, true);
      debris.push(entity);
    }
    const count = game.entities.size;
    internals.recycleDebris();
    expect(game.entities.size).toBe(count-4);
    expect(game.diagnostics().debrisRecycled).toBe(4);
    expect(debris.slice(0,8).every(entity=>game.entities.has(entity.id))).toBe(true);
    expect(game.entities.has(game.playerId)).toBe(true);
  });

  it('replays the same seed, configuration, and input with identical results', () => {
    function replay() {
      const game = makeGame({ seed: 382019, car: 'pickup', blast: 'focused' });
      game.start();
      advance(game, 8, true);
      game.useMechanism('cargo');
      advance(game, 10, true);
      const snapshot = game.snapshot();
      return { score: snapshot.score, crashes: snapshot.crashes, bestCombo: snapshot.bestCombo,
        entities: snapshot.entities, events: snapshot.events, time: snapshot.time };
    }
    expect(replay()).toEqual(replay());
  }, 20_000);

  it.each(PLAYER_CARS)('gives the %s player car an effective route into an accident', car => {
    const game = makeGame({ car });
    game.start();
    advance(game, 12, true);
    expect(game.scores.score).toBeGreaterThan(0);
    expect(game.scores.crashes).toBeGreaterThan(0);
    expect(game.snapshot().entities.find(entity => entity.player)?.active).toBe(true);
  }, 10_000);

  it.each(ROUTES.map(route => route.id))('gives the %s route an effective accident opportunity', route => {
    const game = makeGame({ route });
    game.start();
    advance(game, 12, true);
    expect(game.scores.score).toBeGreaterThan(0);
    expect(game.scores.crashes).toBeGreaterThan(0);
  }, 10_000);

  it('starts a replacement run with fresh resources, counters, physics, and event ids', () => {
    const old = makeGame();
    old.start();
    old.useMechanism('cargo');
    advance(old, 5, true);
    expect(old.scores.score).toBeGreaterThan(0);
    const next = makeGame();
    const snapshot = next.snapshot();
    expect(snapshot.phase).toBe('ready');
    expect(snapshot.time).toBe(120);
    expect(snapshot.score).toBe(0);
    expect(snapshot.combo).toBe(0);
    expect(snapshot.interventions).toBe(3);
    expect(snapshot.blastCharge).toBe(0.45);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.entities.filter(entity => entity.destroyed)).toEqual([]);
    next.start();
    expect(next.snapshot().events[0]).toMatchObject({ id: 1, kind: 'launch' });
  });
});

describe('predetermined traffic', () => {
  it('recreates the complete candidate lane, type, and timing plan from a seed', () => {
    const a = new TrafficPlan(83119);
    const b = new TrafficPlan(83119);
    const different = new TrafficPlan(83120);
    const plan = Array.from({ length: 100 }, () => a.next());
    expect(Array.from({ length: 100 }, () => b.next())).toEqual(plan);
    expect(Array.from({ length: 100 }, () => different.next())).not.toEqual(plan);
    expect(plan[12].kind).toBe('booster');
    expect(plan[18].kind).toBe('magnet');
    expect(plan.every(candidate => candidate.lane >= 0 && candidate.lane <= 3 &&
      candidate.interval >= 1 && candidate.interval < 1.55)).toBe(true);
  });

  it('keeps natural traffic candidates identical despite different blasts, cargo, and surges', () => {
    const quiet = makeGame();
    const chaotic = makeGame();
    const plannerOf = (game: GameSimulation) => (game as unknown as { trafficPlan: TrafficPlan }).trafficPlan;
    const quietCandidates = vi.spyOn(plannerOf(quiet), 'next');
    const chaoticCandidates = vi.spyOn(plannerOf(chaotic), 'next');
    quiet.start();
    chaotic.start();
    chaotic.useMechanism('cargo');
    chaotic.useMechanism('signal');
    advance(quiet, 20, false);
    advance(chaotic, 20, true);

    const quietPlan = quietCandidates.mock.results.map(result => result.value);
    const chaoticPlan = chaoticCandidates.mock.results.map(result => result.value);
    const sharedCount = Math.min(quietPlan.length, chaoticPlan.length);
    expect(sharedCount).toBeGreaterThan(10);
    // The signal deliberately accelerates arrivals; it cannot replace later candidates.
    expect(chaoticPlan.length).toBeGreaterThan(quietPlan.length);
    expect(chaoticPlan.slice(0, sharedCount)).toEqual(quietPlan.slice(0, sharedCount));
    expect(chaotic.scores.score).toBeGreaterThan(0);
  }, 20_000);
});

describe('audio run boundaries', () => {
  it('deduplicates normal frames, preserves pause state, and clears ids on an immediate retry', () => {
    const audio = new GameAudio();
    const first = makeGame();
    first.start();
    first.useMechanism('cargo');
    const firstFrame = first.snapshot();
    audio.update(firstFrame, DEFAULT_SETTINGS);
    const internals = audio as unknown as { seen: Set<number>; seenOrder: number[]; lastLaunchEvent: unknown };
    expect(internals.seenOrder).toEqual([1, 2]);
    audio.update(first.snapshot(), DEFAULT_SETTINGS);
    expect(internals.seenOrder).toEqual([1, 2]);

    first.pause();
    audio.setActive(false);
    audio.update(first.snapshot(), DEFAULT_SETTINGS);
    first.resume();
    audio.setActive(true);
    audio.update(first.snapshot(), DEFAULT_SETTINGS);
    expect(internals.seenOrder).toEqual([1, 2]);

    // Retry at precisely the same remaining time: a clock heuristic cannot identify it.
    const next = makeGame();
    next.start();
    const newFrame = next.snapshot();
    expect(newFrame.time).toBe(firstFrame.time);
    audio.setActive(false);
    audio.setActive(true);
    audio.update(newFrame, DEFAULT_SETTINGS);
    expect(internals.lastLaunchEvent).toBe(newFrame.events[0]);
    expect(internals.seenOrder).toEqual([1]);
    expect(internals.seen.size).toBe(1);
    audio.dispose();
  });
  it('keeps already consumed events when the same round gains time or changes stage',()=>{
    const audio=new GameAudio(),game=makeGame();game.start();game.useMechanism('cargo');
    audio.resetRun();audio.update(game.snapshot(),DEFAULT_SETTINGS);
    const state=audio as unknown as{seenOrder:number[]};const before=[...state.seenOrder];
    const snapshot=game.snapshot();snapshot.time+=15;snapshot.roundStage='feature';audio.update(snapshot,DEFAULT_SETTINGS);
    expect(state.seenOrder).toEqual(before);audio.dispose();
  });
});

describe('finite traffic and mode progression',()=>{
 it('naturally completes all sixty Road Trip vehicles and plays both features before the finale',()=>{
  const game=makeGame({rules:'roadtrip',seed:72191});game.start();const features=pursueTraffic(game,120);
  expect(game.phase).toBe('ended');expect(game.result().outcome).toBe('complete');
  expect(game.round.spawned).toBe(60);expect(game.round.resolved).toBe(60);expect(game.round.escaped).toBeLessThan(5);
  expect(features.has('goodcop')).toBe(true);expect(features.has('magnet')).toBe(true);expect(features.has('tornado')).toBe(true);
 },20_000);
 it('naturally reaches Pile Up Inferno after thirty actual vehicles and settles its result',()=>{
  const game=makeGame({rules:'pileup',seed:72191});game.start();pursueTraffic(game,100);
  expect(game.phase).toBe('ended');expect(game.result().outcome).toBe('complete');expect(game.round.spawned).toBe(30);expect(game.round.resolved).toBe(30);
  expect(game.result().challenges[3]).toBe(true);
 },15_000);
 it('defaults to Road Trip and counts actual arrivals rather than skipped candidates',()=>{
  const game=makeGame({rules:undefined});expect(game.config.rules).toBe('roadtrip');
  expect(game.snapshot().trafficTotal).toBe(60);expect(game.round.spawned).toBe(20);expect(game.round.canSpawn).toBe(false);
  expect(game.snapshot().escaped).toBe(0);expect(game.snapshot().escapeLimit).toBe(5);
 });
 it('fails on the fifth intact escape and lets a safe ambulance undo one earlier escape',()=>{
  const round=new RoundProgress('roadtrip');for(let id=1;id<=8;id++)round.register(id);
  for(let id=1;id<=4;id++)round.resolve(id,'escape');expect(round.stage).not.toBe('complete');
  round.resolve(5,'rescue');expect(round.escaped).toBe(3);
  round.resolve(6,'escape');round.resolve(7,'escape');expect(round.stage).toBe('complete');expect(round.outcome).toBe('escaped');
  expect(round.resolve(7,'escape')).toBe(false);expect(round.escaped).toBe(5);
 });
 it('advances three real 20-car waves, triggers two features, and resolves the Super Feature before scoring ends',()=>{
  const round=new RoundProgress('roadtrip');const actions:string[]=[];
  for(let wave=0;wave<3;wave++){
   for(let i=1;i<=20;i++)expect(round.register(wave*20+i)).toBe(true);
   expect(round.register(1000+wave)).toBe(false);
   for(let i=1;i<=20;i++)round.resolve(wave*20+i,'crash');
   actions.push(...round.drain().map(action=>action.kind));
  }
  expect(round.spawned).toBe(60);expect(round.remaining).toBe(0);expect(actions).toEqual(['feature','draft','feature','draft','finale']);
  expect(round.stage).toBe('finale');round.tick(7.9,0);expect(round.stage).toBe('finale');round.tick(.2,0);expect(round.outcome).toBe('complete');expect(round.stage).toBe('complete');
 });
 it('gives Rush Hour 90 seconds and a separate explosion settlement window',()=>{
  const game=makeGame({rules:'rushhour'});expect(game.time).toBe(90);game.start();game.time=.02;advance(game,.1);
  expect(game.phase).toBe('running');expect(game.round.stage).toBe('finale');
  expect(game.snapshot().events.some(event=>event.effect==='super')).toBe(true);
  advance(game,5);expect(game.phase).toBe('ended');expect(game.result().outcome).toBe('complete');
 });
 it('rewards zero escapes with a stronger Road Trip finale after the same sixty resolved arrivals',()=>{
  const powers=[0,4].map(escapes=>{
   const round=new RoundProgress('roadtrip');
   for(let id=1;id<=60;id++){
    expect(round.register(id)).toBe(true);
    expect(round.resolve(id,id<=escapes?'escape':'crash')).toBe(true);
   }
   expect(round.spawned).toBe(60);expect(round.resolved).toBe(60);expect(round.remaining).toBe(0);
   expect(round.escaped).toBe(escapes);expect(round.crashed).toBe(60-escapes);expect(round.stage).toBe('finale');
   expect(round.drain().find(action=>action.kind==='finale')).toEqual({kind:'finale',power:round.finalePower});
   return round.finalePower;
  });
  expect(powers[0]).toBe(4);expect(powers[1]).toBeCloseTo(.8,8);expect(powers[0]/powers[1]).toBeCloseTo(5,8);
 });
 it('enters Inferno only after all Pile Up arrivals resolve and extends it while burning',()=>{
  const burning=new RoundProgress('pileup'),cold=new RoundProgress('pileup');
  for(const round of[burning,cold]){for(let id=1;id<=30;id++){round.register(id);round.resolve(id,id<=2?'escape':'crash');}}
  expect(burning.stage).toBe('inferno');expect(burning.infernoMultiplier).toBe(3);
  burning.tick(5,4);cold.tick(5,0);expect(burning.infernoTime).toBeGreaterThan(cold.infernoTime);
  burning.tick(40,4);expect(burning.stage).toBe('complete');expect(burning.outcome).toBe('complete');
 });
 it('reserves experimental booster and magnetic traffic vehicles for sandbox',()=>{
  const plan=new TrafficPlan(72191,'roadtrip');const kinds=Array.from({length:200},()=>plan.next().kind);
  expect(kinds).not.toContain('booster');expect(kinds).not.toContain('magnet');
  for(const kind of['ambulance','bank','bulldozer','missile','icecream'])expect(kinds).toContain(kind);
 });
});

describe('physical features and destruction',()=>{
 it('applies the reduced Road Trip finale power to actual Air Strike building damage',()=>{
  const damage=[0,4].map(escapes=>{
   const game=makeGame({rules:'roadtrip',route:'market'});game.start();
   const traffic=[...game.entities.values()].filter(entity=>!entity.player&&!entity.scale);
   for(const entity of traffic.slice(0,escapes))expect(game.round.resolve(entity.id,'escape')).toBe(true);
   // Isolate one finale pulse in the same untouched scene; wave eligibility is tested separately.
   game.round.beginFinale();game.activateFeature('airstrike');
   expect(game.snapshot().finalePower).toBeCloseTo(escapes===0?4:.8,8);
   const building=[...game.entities.values()].find(entity=>entity.buildingIndex===0)!;
   const health=building.health;
   (game as unknown as{stepFeature(dt:number):void}).stepFeature(1/60);
   expect(building.body.isFixed()).toBe(true);
   return health-building.health;
  });
  expect(damage[1]).toBeGreaterThan(0);expect(damage[0]).toBeGreaterThan(damage[1]);
  expect(damage[0]/damage[1]).toBeCloseTo(5,6);
 });
 it('keeps heavy traffic moving against tire friction as it approaches an obstruction',()=>{
  const game=makeGame();game.start();type Entity=NonNullable<ReturnType<typeof game.entities.get>>;
  const make=(game as unknown as{vehicle(kind:'semi'|'ambulance',x:number,z:number,dx:number,dz:number):Entity}).vehicle.bind(game);
  const truck=make('semi',3,-62,0,1),obstruction=make('ambulance',3,-52.5,0,1);obstruction.wrecked=true;
  const start=truck.body.translation().z;advance(game,.8);expect(truck.body.translation().z).toBeGreaterThan(start+.15);
 });
 it('damages building footprints in stages while keeping their foundations fixed',()=>{
  const game=makeGame({rules:'rushhour'});game.start();const building=[...game.entities.values()].find(entity=>entity.kind==='building')!;
  const p=building.body.translation(),initial=building.health;
  const player=game.entities.get(game.playerId)!;player.wrecked=true;player.body.setTranslation({x:p.x+building.scale!.x/2+2,y:p.y,z:p.z},true);
  game.blastCharge=1;game.blast();expect(building.health).toBeLessThan(initial);
  for(let i=0;i<8;i++){game.blastCharge=1;game.blast();}
  expect(building.stage).toBe(3);expect(building.destroyed).toBe(true);expect(building.body.isFixed()).toBe(true);
  expect(building.collider.halfExtents().y).toBeCloseTo(.275,4);
  expect(game.snapshot().events.some(event=>event.effect==='collapse')).toBe(true);
 });
 it('uses slow passive Crashbreaker recovery instead of a constant short cooldown',()=>{
  const game=makeGame({rules:'rushhour'});game.start();const player=game.entities.get(game.playerId)!;
  player.wrecked=true;player.body.setTranslation({x:0,y:140,z:0},true);player.body.setLinvel({x:0,y:0,z:0},true);game.blastCharge=0;
  advance(game,3);expect(game.blastCharge).toBeGreaterThan(.15);expect(game.blastCharge).toBeLessThan(.25);
 });
 it('blocks an exit with stationary Good Cops, then reopens it when the feature expires',()=>{
  const game=makeGame({rules:'rushhour'});game.start();game.activateFeature('goodcop',1);
  const cop=[...game.entities.values()].find(entity=>entity.kind==='police')!;const position={...cop.body.translation()};
  expect(cop.body.isFixed()).toBe(true);advance(game,.3);expect(cop.body.translation()).toEqual(position);
  advance(game,.8);expect(game.entities.has(cop.id)).toBe(false);
 });
 it('magnetizes undamaged traffic, not only existing wrecks',()=>{
  const game=makeGame({rules:'rushhour'});game.start();const player=game.entities.get(game.playerId)!;
  player.wrecked=true;player.body.setTranslation({x:0,y:45,z:0},true);player.body.setLinvel({x:0,y:0,z:0},true);
  const car=[...game.entities.values()].find(entity=>!entity.scale&&!entity.player&&entity.kind==='compact')!;
  car.body.setTranslation({x:15,y:45,z:0},true);car.body.setLinvel({x:0,y:0,z:0},true);game.activateFeature('magnet');advance(game,.3);
  expect(car.wrecked).toBe(false);expect(car.body.linvel().x).toBeLessThan(0);
 });
 it('queues normal vehicle explosions through a fuse rather than recursively detonating immediately',()=>{
  const game=makeGame({rules:'rushhour'});game.start();const car=[...game.entities.values()].find(entity=>!entity.scale&&!entity.player&&entity.kind==='compact')!;
  car.body.setTranslation({x:0,y:25,z:0},true);game.entities.get(game.playerId)!.body.setTranslation({x:1,y:25,z:0},true);
  game.blastCharge=1;game.blast();expect(car.destroyed).toBe(true);expect(car.fuse).toBeGreaterThan(0);expect(car.detonated).not.toBe(true);
  advance(game,1.4);expect(car.detonated).toBe(true);
 });
 it('collects destroyed-bank cash once and awards the local challenge independently of score stars',()=>{
  const game=makeGame({rules:'rushhour'});game.start();type Entity=NonNullable<ReturnType<typeof game.entities.get>>;
  const api=game as unknown as{vehicle(kind:'bank',x:number,z:number,dx:number,dz:number):Entity;hit(entity:Entity,damage:number):void};
  const bank=api.vehicle('bank',35,0,1,0);api.hit(bank,bank.maxHealth+1);
  const bag=[...game.entities.values()].find(entity=>entity.kind==='money')!;expect(bag).toBeDefined();
  const player=game.entities.get(game.playerId)!;player.wrecked=true;player.body.setTranslation(bag.body.translation(),true);player.body.setLinvel({x:0,y:0,z:0},true);
  advance(game,.1);expect(game.entities.has(bag.id)).toBe(false);expect(game.scores.breakdown.bonus).toBeGreaterThanOrEqual(5000);expect(game.result().challenges[4]).toBe(true);
 });
 it('requires destroying the Pizza truck before the roulette feature starts',()=>{
  const game=makeGame({rules:'rushhour'});game.start();type Entity=NonNullable<ReturnType<typeof game.entities.get>>;
  const api=game as unknown as{vehicle(kind:'pizza',x:number,z:number,dx:number,dz:number):Entity;hit(entity:Entity,damage:number):void};
  const pizza=api.vehicle('pizza',35,0,1,0);api.hit(pizza,10);expect(game.round.feature).toBe('none');
  api.hit(pizza,pizza.maxHealth);expect(game.round.feature).not.toBe('none');expect(game.snapshot().events.some(event=>event.effect==='pizza')).toBe(true);
 });
});
