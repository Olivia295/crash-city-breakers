import {afterEach,beforeAll,describe,expect,it} from 'vitest';
import {DEFAULT_CONFIG,PLAYER_ABILITIES,PLAYER_CARS,VEHICLES,type CityId,type RunConfig,type Vec3,type VehicleKind} from '../src/shared';
import {CITIES,getCity,cityRoutes,cityGroundHeight} from '../src/cities';
import {GameSimulation,type GameInput} from '../src/simulation/GameSimulation';
import {TrafficPlan} from '../src/simulation/trafficPlan';
import {sampleLane} from '../src/simulation/routePath';
import {Box3,Mesh} from 'three';
import {createBuilding} from '../src/render/world';

const games:GameSimulation[]=[];
const idle:GameInput={x:0,z:0,aim:{x:1,y:0,z:0},blast:false};
type Entity=NonNullable<ReturnType<GameSimulation['entities']['get']>>;
type Internals={age:number;recycleDebris():void;remove(e:Entity):void;vehicle(kind:VehicleKind,x:number,z:number,dx:number,dz:number):Entity;hit(e:Entity,damage:number):void;areaDamage(p:Vec3,radius:number,power:number):void;chargeCityEvent(p:Vec3,source:string,amount?:number):void};
function internals(game:GameSimulation){return game as unknown as Internals;}
function make(config:Partial<RunConfig>={}){const game=new GameSimulation({...DEFAULT_CONFIG,rules:'sandbox',...config});games.push(game);return game;}
function advance(game:GameSimulation,seconds:number,input:GameInput=idle){for(let f=0;f<Math.ceil(seconds*60);f++)game.update(1/60,input);}
function isolate(game:GameSimulation){for(const entity of [...game.entities.values()])if(!entity.player)internals(game).remove(entity);const player=game.entities.get(game.playerId)!;player.wrecked=true;player.body.setTranslation({x:0,y:50,z:0},true);player.body.setLinvel({x:0,y:0,z:0},true);return player;}
function isolatedVehicle(game:GameSimulation,kind:VehicleKind,x=10,z=0){const car=internals(game).vehicle(kind,x,z,0,1);car.body.setTranslation({x,y:50,z},true);car.body.setLinvel({x:0,y:0,z:0},true);return car;}
beforeAll(async()=>GameSimulation.init());
afterEach(()=>games.splice(0).forEach(game=>game.dispose()));

describe('three cities with distinct actual traffic',()=>{
 it.each(['sydney','london'] as CityId[])('keeps damaged %s landmark geometry aligned with its physical roof through stages 1, 2 and 3',city=>{
  const game=make({city}),index=getCity(city).buildings.findIndex(b=>b.landmark),building=[...game.entities.values()].find(e=>e.buildingIndex===index)!;
  for(const [stage,damage] of [[1,120],[2,120],[3,100]]){
   if(damage)internals(game).hit(building,damage);expect(building.stage).toBe(stage);
   const model=createBuilding(index,stage,city),scale=building.scale!,p=building.body.translation();
   model.scale.set(scale.x,scale.y,scale.z);model.position.set(p.x,cityGroundHeight(city,p.x,p.z)+scale.y/2,p.z);model.updateMatrixWorld(true);
   const bounds=new Box3().setFromObject(model),colliderHalfHeight=building.collider.halfExtents().y;
   try{expect(bounds.min.y,`${city} stage ${stage} foundation`).toBeCloseTo(p.y-colliderHalfHeight,4);expect(bounds.max.y,`${city} stage ${stage} roof`).toBeCloseTo(p.y+colliderHalfHeight,4);}
   finally{model.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});}
  }
 });
 it.each(['sf','sydney','london'] as CityId[])('uses the %s building footprints and player routes',city=>{
  for(const route of cityRoutes(city)){const game=make({city,route:route.id});const p=game.entities.get(game.playerId)!.body.translation();expect(p.x).toBeCloseTo(route.x,5);expect(p.z).toBeCloseTo(route.z,5);expect([...game.entities.values()].filter(e=>e.kind==='building')).toHaveLength(getCity(city).buildings.length);}
 });
 it('keeps every planned lane clear of buildings, including the turning sections',()=>{
  for(const city of Object.values(CITIES))for(const path of city.lanes)for(let segment=1;segment<path.length;segment++){
   const a=path[segment-1],b=path[segment],length=Math.hypot(b.x-a.x,b.z-a.z);
   for(let s=0;s<=length;s+=1){const x=a.x+(b.x-a.x)*s/length,z=a.z+(b.z-a.z)*s/length;
    for(const building of city.buildings)expect(Math.abs(x-building.x)>building.w/2+1.4||Math.abs(z-building.z)>building.d/2+1.4,`${city.id}: lane intersects building at ${x},${z}`).toBe(true);
   }
  }
 });
 it('uses city-specific seeded pools without leaking cable cars into other cities',()=>{
  for(const city of ['sf','sydney','london'] as CityId[]){const a=new TrafficPlan(381,'roadtrip',city),b=new TrafficPlan(381,'roadtrip',city);const candidates=Array.from({length:160},()=>a.next());expect(candidates).toEqual(Array.from({length:160},()=>b.next()));const kinds=candidates.map(c=>c.kind);
   if(city==='sf')expect(kinds).toContain('tram');else expect(kinds).not.toContain('tram');
   for(const kind of city==='sydney'?['ute','roadtrain']:city==='london'?['doubledecker','blackcab']:['taxi','bus'])expect(kinds).toContain(kind);
  }
 });
 it.each(['sydney','london'] as CityId[])('physically turns intact %s traffic through its lane without driving into a building',city=>{
  const game=make({city});game.start();isolate(game);
  const path=getCity(city).lanes[2],point=sampleLane(path,25);const car=internals(game).vehicle('compact',point.x,point.z,point.dx,point.dz);car.path=path;car.pathIndex=point.index;
  let turned=false;for(let i=0;i<480&&game.entities.has(car.id);i++){game.update(1/60,idle);const p=car.body.translation();if(Math.abs(car.direction.x)>.35)turned=true;for(const b of getCity(city).buildings)expect(Math.abs(p.x-b.x)>b.w/2||Math.abs(p.z-b.z)>b.d/2).toBe(true);}
  expect(turned).toBe(true);expect(car.wrecked).toBe(false);
 });
 it.each(['sydney','london'] as CityId[])('places sandbox interventions on the %s accident site',city=>{
  const game=make({city});game.start();const ids=new Set(game.entities.keys());game.useMechanism('cargo');const target=getCity(city).eventTargets[0];const crates=[...game.entities.values()].filter(e=>!ids.has(e.id));expect(crates).toHaveLength(8);for(const crate of crates){const p=crate.body.translation();expect(Math.hypot(p.x-target.x,p.z-target.z)).toBeLessThan(7);}
 });
 it.each(['sydney','london'] as CityId[])('recovers an out-of-bounds player onto a clear %s road',city=>{
  const game=make({city});game.start();const hero=game.entities.get(game.playerId)!;hero.wrecked=true;hero.body.setTranslation({x:80,y:1,z:-25},true);advance(game,.05);const p=hero.body.translation();expect(Math.abs(p.x)).toBeLessThan(50);expect(Math.abs(p.z)).toBeLessThan(50);for(const b of getCity(city).buildings)expect(Math.abs(p.x-b.x)>b.w/2||Math.abs(p.z-b.z)>b.d/2).toBe(true);
 });
 it('unblocks settled off-scene traffic below the entity budget without changing scores or counting an escape',()=>{
  const game=make({city:'sydney',rules:'roadtrip'});const cars=[...game.entities.values()].filter(e=>!e.player&&!e.scale);const old=cars[0],pending=cars[1],api=internals(game);api.hit(old,10);old.body.setTranslation({x:75,y:2,z:5},true);old.body.setLinvel({x:0,y:0,z:0},true);old.lastInteraction=0;pending.wrecked=true;pending.body.setTranslation({x:80,y:2,z:5},true);pending.body.setLinvel({x:0,y:0,z:0},true);api.age=20;
  expect(game.entities.size).toBeLessThan(95);const before={score:game.scores.score,resolved:game.round.resolved,escaped:game.round.escaped};api.recycleDebris();expect(game.entities.has(old.id)).toBe(false);expect(game.entities.has(pending.id)).toBe(true);expect({score:game.scores.score,resolved:game.round.resolved,escaped:game.round.escaped}).toEqual(before);
 });
 it.each([{city:'sydney',rules:'roadtrip'},{city:'london',rules:'roadtrip'},{city:'sydney',rules:'pileup'},{city:'london',rules:'pileup'}] as const)('resolves a natural $city $rules round without relying on the guard timeout',config=>{
  const game=make({...config,seed:72191});game.start();
  for(let frame=0;frame<145*30&&game.phase!=='ended';frame++){
   const p=game.entities.get(game.playerId)!.body.translation();let target=getCity(config.city).center,nearest=Infinity;
   for(const e of game.entities.values()){if(e.player||e.wrecked||e.scale)continue;const q=e.body.translation(),distance=Math.hypot(q.x-p.x,q.z-p.z);if(distance<nearest){nearest=distance;target=q;}}
   const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
   game.update(1/30,{x:dx/d,z:dz/d,aim:{x:dx/d,y:0,z:dz/d},blast:frame%8===0,ability:frame%30===0});
  }
  expect(game.phase).toBe('ended');expect(game.result().outcome).not.toBe('timeout');expect(game.scores.score).toBeGreaterThan(0);
  expect(game.round.spawned).toBe(config.rules==='pileup'?30:60);expect(game.round.resolved).toBe(config.rules==='pileup'?30:60);expect(game.result().outcome).toBe('complete');
 },20_000);
});

describe('distinct player decisions',()=>{
 it.each(PLAYER_CARS)('%s spends energy once, rejects repeated activation, and freezes cooldown during pause',car=>{
  const game=make({car});expect(game.activateAbility()).toBe(false);game.start();isolate(game);game.blastCharge=0;expect(game.activateAbility()).toBe(false);expect(game.snapshot().abilityReady).toBe(false);
  game.blastCharge=1;expect(game.snapshot().abilityReady).toBe(true);expect(game.activateAbility()).toBe(true);expect(game.blastCharge).toBeCloseTo(1-PLAYER_ABILITIES[car]!.cost,6);expect(game.activateAbility()).toBe(false);expect(game.snapshot().abilityCooldown).toBe(PLAYER_ABILITIES[car]!.cooldown);
  game.pause();const before=game.snapshot();advance(game,2,{...idle,ability:true});expect(game.snapshot()).toEqual(before);game.resume();advance(game,.2);expect(game.snapshot().abilityCooldown).toBeCloseTo(PLAYER_ABILITIES[car]!.cooldown-.2,5);
 });
 it('compact attracts intact traffic then converts the cluster into an upward bounce',()=>{
  const game=make({car:'compact'});game.start();const hero=isolate(game),car=isolatedVehicle(game,'compact');game.blastCharge=1;game.activateAbility();advance(game,.2);expect(car.body.linvel().x).toBeLessThan(-.5);advance(game,1.82);expect(game.snapshot().abilityActive).toBe(0);expect(hero.body.linvel().y).toBeGreaterThan(10);expect(game.snapshot().events.some(e=>e.text==='MAGNET BOUNCE!')).toBe(true);
  advance(game,10.1);game.blastCharge=1;expect(game.snapshot().abilityCooldown).toBe(0);expect(game.snapshot().abilityReady).toBe(true);expect(game.activateAbility()).toBe(true);
 });
 it('sport performs exactly three aimed damaging pulses',()=>{
  const game=make({car:'sport'});game.start();const hero=isolate(game);const target=isolatedVehicle(game,'compact',5);game.aim={x:1,y:0,z:0};game.blastCharge=1;game.activateAbility();advance(game,.82);expect(target.health).toBeLessThan(target.maxHealth);expect(hero.body.translation().x).toBeGreaterThan(10);expect(game.snapshot().events.filter(e=>e.text?.startsWith('PIERCING DASH'))).toHaveLength(3);expect(game.snapshot().abilityActive).toBe(0);
 });
 it('pickup launches an existing wreck while semi stays broadside as a heavy roadblock',()=>{
  const pickup=make({car:'pickup'});pickup.start();isolate(pickup);const wreck=isolatedVehicle(pickup,'bus',10);wreck.wrecked=true;pickup.aim={x:1,y:0,z:0};pickup.blastCharge=1;pickup.activateAbility();expect(wreck.body.linvel().x).toBeGreaterThan(20);expect(wreck.body.linvel().y).toBeGreaterThan(5);
  const semi=make({car:'semi'});semi.start();const hero=isolate(semi);semi.aim={x:0,y:0,z:1};semi.blastCharge=1;semi.activateAbility();expect(Math.abs(hero.body.rotation().y)).toBeCloseTo(Math.SQRT1_2,5);hero.body.setLinvel({x:20,y:0,z:10},true);advance(semi,.1);expect(Math.hypot(hero.body.linvel().x,hero.body.linvel().z)).toBeLessThan(1);
 });
 it('does not refill charge or score by hitting an already destroyed vehicle again',()=>{
  const game=make();game.start();isolate(game);const car=isolatedVehicle(game,'compact',5);internals(game).hit(car,car.maxHealth+1);game.blastCharge=.2;const score=game.scores.score;for(let i=0;i<10;i++)internals(game).hit(car,100);expect(game.blastCharge).toBe(.2);expect(game.scores.score).toBe(score);
 });
});

describe('traffic payloads and local disaster triggers',()=>{
 it('rolls a double decker sideways on the first impact only',()=>{
  const game=make({city:'london'});game.start();isolate(game);const bus=isolatedVehicle(game,'doubledecker');internals(game).hit(bus,10);expect(Math.abs(bus.body.angvel().z)).toBeGreaterThan(2);expect(Math.abs(bus.body.linvel().x)).toBeGreaterThan(4);internals(game).hit(bus,10);expect(game.snapshot().events.filter(e=>e.text?.includes('横封车道'))).toHaveLength(1);
 });
 it('detaches two independently physical road-train trailers without increasing the finite arrival count',()=>{
  const game=make({city:'sydney',rules:'roadtrip'});game.start();const train=[...game.entities.values()].find(e=>e.kind==='roadtrain')!;const arrivals=game.round.spawned;internals(game).hit(train,15);const trailers=[...game.entities.values()].filter(e=>e.kind==='trailer');expect(trailers).toHaveLength(2);expect(trailers.every(e=>e.body.isDynamic()&&e.scale!.z>5)).toBe(true);expect(train.collider.halfExtents().z).toBeLessThan(VEHICLES.roadtrain.length/2);internals(game).hit(train,15);expect([...game.entities.values()].filter(e=>e.kind==='trailer')).toHaveLength(2);expect(game.round.spawned).toBe(arrivals);
 });
 it('spills ute tools once and reserves its extra propulsion for an explosion',()=>{
  const game=make({city:'sydney'});game.start();isolate(game);const ute=isolatedVehicle(game,'ute',0);internals(game).hit(ute,10);expect([...game.entities.values()].filter(e=>e.kind==='crate')).toHaveLength(3);expect(ute.boosted).not.toBe(true);internals(game).areaDamage({x:0,y:50,z:0},10,.2);expect(ute.boosted).toBe(true);expect(ute.body.linvel().z).toBeGreaterThan(20);internals(game).areaDamage({x:0,y:50,z:0},10,.2);expect(game.snapshot().events.filter(e=>e.text?.includes('爆破推进'))).toHaveLength(1);
 });
 it('lets the black cab choose an open flank and accelerate around a stopped obstacle',()=>{
  const game=make({city:'london'});game.start();isolate(game);const cab=isolatedVehicle(game,'blackcab',0),obstacle=isolatedVehicle(game,'bus',0,7);obstacle.wrecked=true;advance(game,.1);expect(cab.dodgeUntil).toBeGreaterThan(0);expect(Math.abs(cab.body.linvel().x)).toBeGreaterThan(.5);expect(cab.body.linvel().z).toBeGreaterThan(7);
 });
 it.each(['sf','sydney','london'] as CityId[])('triggers the %s physical city event once after three local blasts',city=>{
  const game=make({city});game.start();const hero=isolate(game),target=getCity(city).eventTargets[0];hero.body.setTranslation({x:target.x,y:50,z:target.z},true);
  for(let i=1;i<=3;i++){game.blastCharge=1;expect(game.blast()).toBe(true);expect(game.snapshot().cityEvent.progress).toBeCloseTo(i/3,5);expect(game.snapshot().cityEvent.triggered).toBe(i===3);}
  const count=game.entities.size,score=game.scores.score,arrivals=game.round.spawned;internals(game).chargeCityEvent({x:target.x,y:0,z:target.z},'blast:3');expect(game.entities.size).toBe(count);expect(game.scores.score).toBe(score);expect(game.round.spawned).toBe(arrivals);expect(game.snapshot().events.filter(e=>e.effect==='city')).toHaveLength(1);
  expect([...game.entities.values()].some(e=>city==='sf'?e.kind==='tram':city==='sydney'?e.kind==='trailer':e.kind==='doubledecker')).toBe(true);
 });
});
