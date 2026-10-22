import {afterEach,beforeAll,describe,expect,it} from 'vitest';
import {DEFAULT_CONFIG,VEHICLES,type CityId,type Feature,type GameRules,type RunConfig,type VehicleKind} from '../src/shared';
import {cityRoutes} from '../src/cities';
import {GameSimulation,type GameInput} from '../src/simulation/GameSimulation';
import {BonusPlan} from '../src/simulation/bonusPlan';
import {TrafficPlan} from '../src/simulation/trafficPlan';

type Entity=NonNullable<ReturnType<GameSimulation['entities']['get']>>;
type Internals={bonusNextIn:number;age:number;lastPizzaAt:number;physicsRand:()=>number;featureRand:()=>number;stepBonuses(dt:number):void;processRoundActions():void;spawnBonusVehicle(kind:VehicleKind):Entity;hit(e:Entity,damage:number):void;remove(e:Entity):void};
const games:GameSimulation[]=[];
const idle:GameInput={x:0,z:0,aim:{x:1,y:0,z:0},blast:false};
const rewards:Feature[]=['goodcop','magnet','double','freeze'];
function api(game:GameSimulation){return game as unknown as Internals;}
function make(config:Partial<RunConfig>={}){const game=new GameSimulation({...DEFAULT_CONFIG,rules:'sandbox',...config});games.push(game);game.start();return game;}
function advance(game:GameSimulation,seconds:number){for(let i=0;i<Math.ceil(seconds*30);i++)game.update(1/30,idle);}
function draw(game:GameSimulation){const pizza=api(game).spawnBonusVehicle('pizza');api(game).hit(pizza,pizza.maxHealth+1);return pizza;}
beforeAll(async()=>GameSimulation.init());
afterEach(()=>games.splice(0).forEach(game=>game.dispose()));

describe('seeded positive pizza lottery',()=>{
 it('replays the reward bag, covers every reward each four draws, and never repeats consecutively',()=>{
  const a=new BonusPlan(42),b=new BonusPlan(42),c=new BonusPlan(91);
  const sequence=Array.from({length:40},()=>a.nextFeature());
  expect(sequence).toEqual(Array.from({length:40},()=>b.nextFeature()));
  expect(sequence).not.toEqual(Array.from({length:40},()=>c.nextFeature()));
  for(let i=0;i<sequence.length;i+=4)expect([...sequence.slice(i,i+4)].sort()).toEqual([...rewards].sort());
  expect(sequence.slice(1).every((feature,i)=>feature!==sequence[i])).toBe(true);
 });
 it('does not consume traffic randomness or depend on physics and feature-position randomness',()=>{
  const a=make({seed:381}),b=make({seed:381}),trafficA=new TrafficPlan(381,'sandbox'),trafficB=new TrafficPlan(381,'sandbox');
  const sequenceA:Feature[]=[],sequenceB:Feature[]=[];
  for(let i=0;i<8;i++){
   for(let j=0;j<i*3;j++){api(a).physicsRand();api(a).featureRand();}
   draw(a);draw(b);sequenceA.push(a.round.feature);sequenceB.push(b.round.feature);
   expect(trafficA.next()).toEqual(trafficB.next());
  }
  expect(sequenceA).toEqual(sequenceB);
 });
 it('announces the actual selected effect in the same snapshot and pays one draw per truck',()=>{
  const game=make(),pizza=draw(game),snapshot=game.snapshot();
  expect(snapshot.bonusDraws).toBe(1);expect(rewards).toContain(snapshot.feature);expect(snapshot.featureTime).toBe(8);
  expect(snapshot.events.some(event=>event.kind==='special'&&event.effect==='pizza'&&event.sourceId===pizza.id)).toBe(true);
  const score=game.scores.score,feature=snapshot.feature;
  for(let i=0;i<10;i++)api(game).hit(pizza,100);
  expect(game.snapshot().bonusDraws).toBe(1);expect(game.scores.score).toBe(score);expect(game.round.feature).toBe(feature);
 });
 it('adds one functioning special encounter every second draw without enlarging finite quotas',()=>{
  const game=make({rules:'roadtrip'}),before=new Set(game.entities.keys()),spawned=game.round.spawned,total=game.round.total;
  draw(game);draw(game);
  const extras=[...game.entities.values()].filter(e=>!before.has(e.id)&&['bank','icecream','missile','carrier'].includes(e.kind));
  expect(extras).toHaveLength(1);expect(game.round.spawned).toBe(spawned);expect(game.round.total).toBe(total);expect(game.snapshot().bonusDraws).toBe(2);
 });
 it('keeps a newly drawn reward readable before a pending Road Trip wave feature',()=>{
  const game=make({rules:'roadtrip'});draw(game);const feature=game.round.feature;
  for(const entity of game.entities.values())if(game.round.isPending(entity.id))game.round.resolve(entity.id,'crash');
  api(game).processRoundActions();expect(game.round.feature).toBe(feature);expect(game.snapshot().bonusDraws).toBe(1);
  game.round.tick(8.1,0);api(game).stepBonuses(0);expect(game.round.feature).toBe('goodcop');expect(game.round.featureTime).toBe(8);
 });
});

describe('visible bonus timing across every mode',()=>{
 it.each(['sf','sydney','london'] as CityId[])('starts every %s entry route with upstream traffic and space around the player',city=>{
  for(const route of cityRoutes(city)){
   const game=make({city,route:route.id,rules:'roadtrip'}),hero=game.entities.get(game.playerId)!,p=hero.body.translation();
   const traffic=[...game.entities.values()].filter(e=>!e.player&&!e.scale);
   expect(traffic).toHaveLength(20);expect(game.round.spawned).toBe(20);
   for(const e of traffic){const q=e.body.translation(),dx=q.x-p.x,dz=q.z-p.z,parallel=Math.abs(dx*e.direction.x+dz*e.direction.z),cross=Math.abs(dx*e.direction.z-dz*e.direction.x);
    expect(parallel>(VEHICLES[e.kind as VehicleKind].length+VEHICLES.compact.length)/2||cross>(VEHICLES[e.kind as VehicleKind].width+VEHICLES.compact.width)/2,`${city}/${route.id}: player starts inside ${e.kind}`).toBe(true);
   }
   advance(game,4);expect(game.round.escaped).toBe(0);expect(game.phase).toBe('running');
  }
 });
 it.each(['roadtrip','rushhour','pileup','sandbox'] as GameRules[])('prewarns and sends an uncounted first pizza in %s',rules=>{
  const game=make({rules});advance(game,1.7);
  expect(game.snapshot().events.some(event=>event.kind==='warning'&&event.text?.includes('即将到场'))).toBe(true);
  expect([...game.entities.values()].filter(e=>e.kind==='pizza')).toHaveLength(0);
  advance(game,2.4);const pizza=[...game.entities.values()].find(e=>e.kind==='pizza');
  expect(pizza).toBeDefined();expect(game.round.isPending(pizza!.id)).toBe(false);
  expect(game.round.total).toBe(rules==='roadtrip'?60:rules==='pileup'?30:0);
 });
 it('holds the timer while a live reward truck exists and bounds subsequent arrival spacing',()=>{
  const game=make({rules:'rushhour'});api(game).stepBonuses(4.1);
  const pizza=[...game.entities.values()].find(e=>e.kind==='pizza')!;expect(pizza).toBeDefined();
  const delay=game.snapshot().bonusNextIn!;expect(delay).toBeGreaterThanOrEqual(18);expect(delay).toBeLessThan(24);
  api(game).stepBonuses(100);expect(game.snapshot().bonusNextIn).toBe(delay);expect([...game.entities.values()].filter(e=>e.kind==='pizza'&&!e.destroyed)).toHaveLength(1);
  api(game).hit(pizza,pizza.maxHealth+1);api(game).bonusNextIn=0;api(game).age=9;api(game).stepBonuses(.1);
  expect([...game.entities.values()].filter(e=>e.kind==='pizza'&&!e.destroyed)).toHaveLength(0);
  api(game).age=10;api(game).stepBonuses(.1);expect([...game.entities.values()].filter(e=>e.kind==='pizza'&&!e.destroyed)).toHaveLength(1);
 });
 it('freezes countdown and draw state during pause and after the round ends',()=>{
  const game=make();advance(game,1);game.pause();const paused=game.snapshot();advance(game,5);expect(game.snapshot()).toEqual(paused);
  game.resume();advance(game,.5);expect(game.snapshot().bonusNextIn).toBeCloseTo(paused.bonusNextIn!-.5,6);
  game.round.finish('complete');api(game).processRoundActions();const ended=game.snapshot();advance(game,10);expect(game.snapshot()).toEqual(ended);
 });
 it('does not let an old truck replace a Super Feature or schedule arrivals during the finale',()=>{
  const game=make({rules:'roadtrip'}),pizza=api(game).spawnBonusVehicle('pizza');game.round.beginFinale();api(game).processRoundActions();
  const feature=game.round.feature,entities=game.entities.size;api(game).hit(pizza,pizza.maxHealth+1);
  expect(game.snapshot().bonusDraws).toBe(0);expect(game.round.feature).toBe(feature);api(game).bonusNextIn=0;api(game).stepBonuses(10);expect(game.entities.size).toBe(entities);
 });
 it('stops summoning new traffic while Pile Up Inferno resolves',()=>{
  const game=make({rules:'pileup'});game.round.stage='inferno';api(game).bonusNextIn=0;const count=game.entities.size;api(game).stepBonuses(20);expect(game.entities.size).toBe(count);
 });
});
