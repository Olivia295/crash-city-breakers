import RAPIER from '@dimforge/rapier3d-compat';
import {VEHICLES,MECHANISMS,RULE_VERSION,PLAYER_STATS,PLAYER_ABILITIES,seeded,type VehicleKind,type ModelKind,type PropKind,type RunConfig,type Vec3,type RenderEntity,type GameSnapshot,type GameEvent,type EventKind,type MechanismId,type RunResult,type Feature,type DraftView,type ContractView} from '../shared';
import {getCity,cityRoutes,cityGroundHeight,type CityEventTarget} from '../cities';
import {ScoreKeeper,medalFor,clamp,starsFor,starProgressFor,runChallenges} from './rules';
import {TrafficPlan,type TrafficCandidate} from './trafficPlan';
import {RoundProgress} from './roundProgress';
import {sampleLane} from './routePath';
import {BonusPlan} from './bonusPlan';
import {DraftState,PERKS,CONTRACTS,contractById,emptyStats,type PerkId,type RunStats} from './perks';

interface Entity {
 id:number;kind:ModelKind;body:RAPIER.RigidBody;collider:RAPIER.Collider;player:boolean;
 maxHealth:number;health:number;mass:number;value:number;wrecked:boolean;destroyed:boolean;
 direction:Vec3;speed:number;triggered:boolean;fuse:number;scale?:Vec3;age:number;lastInteraction:number;
 buildingIndex?:number;stage?:0|1|2|3;burning:number;frozenUntil:number;cash?:number;detonated?:boolean;chainDepth?:number;contactAge?:number;
 path?:Vec3[];pathIndex?:number;dodgeUntil?:number;dodgeSign?:number;dodgeCooldown?:number;boosted?:boolean;
}
export interface GameInput {x:number;z:number;aim:Vec3;blast:boolean;ability?:boolean}
const DT=1/60;
const TRAM_TRACK_X=-4.25;
export class GameSimulation {
 static async init(){await RAPIER.init();}
 readonly world:RAPIER.World;
 readonly entities=new Map<number,Entity>();
 readonly scores=new ScoreKeeper();
 readonly config:RunConfig;
 phase:GameSnapshot['phase']='ready';blastCharge=0.45;interventions=3;slowMotion=false;notice='选择路线，准备制造连锁';
 readonly round:RoundProgress;
 get time(){return this.round.time;}set time(value:number){this.round.time=value;}
 playerId=0;aim:Vec3={x:0,y:0,z:1};
 private collisions=new RAPIER.EventQueue(true);private byCollider=new Map<number,Entity>();
 private nextId=1;private eventId=0;private events:GameEvent[]=[];private physicsRand:()=>number;
 private trafficPlan:TrafficPlan;private surgePlan:TrafficPlan;
 private accumulator=0;private trafficTimer=0;private age=0;private slowAge=0;private signalTime=0;
 private noticeTime=0;private mechanismsUsed=0;private rampaged=false;
 private cleanupTimer=0;private trafficCandidates=0;private trafficSpawned=0;private debrisRecycled=0;
 private pendingTraffic?:TrafficCandidate;private pendingWait=0;private featureRand:()=>number;private featurePulse=0;private blastLock=0;private effectSequence=0;private superTriggered=false;private localChallenge=false;
 private featureBurstDone=false;private smashTime=-100;private smashCount=0;private flightOrigin?:Vec3;private flightId=0;private airborne=false;
 private featureBlocks=new Set<number>();
 private abilityCooldown=0;private abilityActive=0;private abilityPulse=0;private abilityStage=0;private abilityAim:Vec3={x:0,y:0,z:1};
 private cityProgress=new Map<string,number>();private cityTriggered=new Set<string>();private citySources=new Set<string>();
 private bonusPlan:BonusPlan;private encounterRand:()=>number;private bonusNextIn=4;private bonusWarned=false;private bonusDraws=0;private lastPizzaAt=-100;private rewardActive=false;private waveFeatures:Feature[]=[];
 private preVelocity=new Map<number,Vec3>();private interactionCooldown=new Map<string,number>();
 private phaseBeforePause:GameSnapshot['phase']='running';
 /** 'manual' lets the player pick perks and contracts; scripted runs stay 'auto' and never pause for a draft. */
 draftMode:'auto'|'manual'='auto';stats:RunStats=emptyStats();
 private draft:DraftState;private draftOffer:{id:number;kind:'perk'|'contract';options:string[]}|null=null;private draftId=0;
 private contractId?:string;private contractDone=false;private milestone=0;private mutRand:()=>number;
 constructor(config:RunConfig){
  this.config={...config,city:config.city||'sf',rules:config.rules||'roadtrip'};this.round=new RoundProgress(this.config.rules!);this.physicsRand=seeded(config.seed^0x4f1bbcdc);this.featureRand=seeded(config.seed^0x3da89e7b);
  this.draft=new DraftState(config.seed,this.config.rules!);this.mutRand=seeded(config.seed^0x51ed270b);this.bonusPlan=new BonusPlan(config.seed);this.encounterRand=seeded(config.seed^0x79db4631);
  this.trafficPlan=new TrafficPlan(config.seed,this.config.rules,this.config.city);this.surgePlan=new TrafficPlan(config.seed^0x6c8e9cf5,this.config.rules,this.config.city);
  if(this.config.rules!=='sandbox'){this.blastCharge=.1;this.interventions=0;}
  this.world=new RAPIER.World({x:0,y:this.config.mutator==='lowgrav'?-9:-18,z:0});
  this.world.timestep=DT;this.world.numSolverIterations=5;this.buildWorld();this.seedTraffic();this.createPlayer();
 }
 private groundHeight(x:number,z:number){return cityGroundHeight(this.config.city,x,z);}
 private get city(){return getCity(this.config.city);}
 private buildWorld(){
  const zs=[-180,-56,-15,15,55,180];const vertices:number[]=[];const indices:number[]=[];
  for(const z of zs)vertices.push(-180,this.groundHeight(-180,z)-0.12,z,180,this.groundHeight(180,z)-0.12,z);
  for(let i=0;i<zs.length-1;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)).setFriction(this.config.mutator==='ice'?.12:.65).setRestitution(.07));
  this.city.buildings.forEach((b,index)=>{const e=this.prop('building',b.x,b.z,{x:b.w,y:b.h,z:b.d},50000,18000);e.buildingIndex=index;e.stage=0;e.maxHealth=e.health=340;});
  if(this.config.city!=='sf'){
   for(const road of this.city.roads){const a=road.points[0],b=road.points[road.points.length-1],length=Math.hypot(b.x-a.x,b.z-a.z)||1;
    for(const t of[.28,.7]){const x=a.x+(b.x-a.x)*t+(b.z-a.z)/length*(road.width/2+1),z=a.z+(b.z-a.z)*t-(b.x-a.x)/length*(road.width/2+1);this.prop('lamp',x,z,{x:.35,y:4,z:.35},70,500);}
   }return;
  }
  // Every destructible object is physical: cargo and street furniture can carry a chain into a new lane.
  for(const z of [-40,-22,22,40])for(const x of [-11.8,11.8])this.prop('lamp',x,z,{x:.35,y:4,z:.35},70,500);
  for(const x of [-40,-26,25,42])for(const z of [-10.8,10.8])this.prop('barrier',x,z,{x:3.8,y:.85,z:.55},130,900);
  for(let i=0;i<7;i++)this.prop('crate',-17-(i%3)*1.6,1+Math.floor(i/3)*1.7,{x:1.35,y:1.3,z:1.35},65,550);
  this.prop('sign',17,-11,{x:6,y:3,z:.55},260,3500,0,3.3);
  for(const x of [-24,24])this.prop('facade',x,-17,{x:7,y:3,z:.6},420,5000);
  for(let i=0;i<4;i++)this.prop('barrier',16+i*2.8,-13,{x:2.5,y:1,z:.5},160,1000);
 }
 private vehicle(kind:VehicleKind,x:number,z:number,dx:number,dz:number,player=false,yOffset=0):Entity {
  if(kind==='tram'){x=TRAM_TRACK_X;dx=0;dz=1;}
  const d=VEHICLES[kind];let mass=d.mass;const mutator=this.config.mutator;if(player&&this.config.passive==='heavy')mass*=1.45;
  const yaw=Math.atan2(dx,dz);
  const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,this.groundHeight(x,z)+d.height/2+.3+yOffset,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setLinearDamping(.12).setAngularDamping(.9).setCcdEnabled(true).setCanSleep(!player));
  body.setEnabledRotations(false,true,false,true);
  if(kind==='tram'){body.setEnabledTranslations(false,true,true,true);body.setEnabledRotations(false,false,false,true);}
  const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(d.width/2,d.height/2,d.length/2).setMass(mass).setFriction(mutator==='ice'?.1:.45).setRestitution(player&&this.config.passive==='elastic'?.5:.12).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
  const e:Entity={id:this.nextId++,kind,body,collider,player,maxHealth:d.health,health:d.health,mass,value:d.value*(mutator==='gold'&&!player?1.6:1),wrecked:false,destroyed:false,direction:{x:dx,y:0,z:dz},speed:d.speed*(player?1:mutator==='rush'?1.25:mutator==='gold'?1.15:1),triggered:false,fuse:-1,age:0,lastInteraction:this.age,burning:0,frozenUntil:0};
  this.entities.set(e.id,e);this.byCollider.set(collider.handle,e);return e;
 }
 private prop(kind:PropKind,x:number,z:number,size:Vec3,mass:number,value:number,yaw=0,yOffset=0):Entity{
  const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,this.groundHeight(x,z)+size.y/2+yOffset,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setLinearDamping(.25).setAngularDamping(.6).setCanSleep(true));
  const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setMass(mass).setFriction(this.config.mutator==='ice'?.15:.65).setRestitution(.1).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
  const e:Entity={id:this.nextId++,kind,body,collider,player:false,maxHealth:kind==='facade'?90:32,health:kind==='facade'?90:32,mass,value,wrecked:false,destroyed:false,direction:{x:0,y:0,z:0},speed:0,triggered:false,fuse:-1,scale:size,age:0,lastInteraction:this.age,burning:0,frozenUntil:0};
  if(kind==='sign'||kind==='facade'||kind==='lamp'||kind==='barrier'||kind==='building'||kind==='money')body.setBodyType(RAPIER.RigidBodyType.Fixed,true);
  if(kind==='money')collider.setSensor(true);
  this.entities.set(e.id,e);this.byCollider.set(collider.handle,e);return e;
 }
 private vehicleOnLane(kind:VehicleKind,lane:number,distance=0,registered=false){
  const path=this.city.lanes[lane],point=sampleLane(path,distance);const e=this.vehicle(kind,point.x,point.z,point.dx,point.dz);
  if(this.config.city!=='sf'){e.path=path;e.pathIndex=point.index;}
  if(registered)this.round.register(e.id);return e;
 }
 private followLane(e:Entity,p:Vec3){
  if(!e.path)return false;const path=e.path;let index=e.pathIndex||1;
  while(index<path.length){const a=path[index-1],b=path[index],dx=b.x-a.x,dz=b.z-a.z;
   const passed=(p.x-b.x)*dx+(p.z-b.z)*dz>=0;
   if(Math.hypot(b.x-p.x,b.z-p.z)<2.3||passed){if(index===path.length-1)return true;index++;}else break;
  }
  e.pathIndex=index;const point=path[index],dx=point.x-p.x,dz=point.z-p.z,d=Math.hypot(dx,dz)||1;
  e.direction={x:dx/d,y:0,z:dz/d};const yaw=Math.atan2(e.direction.x,e.direction.z);
  e.body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);return false;
 }
 private exitTraffic(e:Entity){
  if(this.round.isPending(e.id)){const rescue=e.kind==='ambulance'&&!e.wrecked;this.round.resolve(e.id,rescue?'rescue':'escape');if(rescue)this.emit('special',e.body.translation(),1,'救护车安全通过，抵消一次逃脱','ambulance');}
  this.remove(e);
 }
 private recoveryPoint(p:Vec3){
  let nearest={...this.city.center},distance=Infinity;
  for(const path of this.city.lanes)for(let index=1;index<path.length;index++){
   const a=path[index-1],b=path[index],length=Math.hypot(b.x-a.x,b.z-a.z);
   for(let s=0;s<=length;s+=4){const x=a.x+(b.x-a.x)*s/length,z=a.z+(b.z-a.z)*s/length;if(Math.abs(x)>46||Math.abs(z)>46)continue;const d=Math.hypot(x-p.x,z-p.z);if(d<distance){distance=d;nearest={x,z};}}
  }
  return {x:nearest.x,y:this.groundHeight(nearest.x,nearest.z)+8,z:nearest.z};
 }
 private seedTraffic(){
  const types:VehicleKind[]=this.config.city==='sydney'?['ute','compact','roadtrain','van','tanker']:this.config.city==='london'?['doubledecker','blackcab','compact','bank','bus']:['compact','taxi','bus','van','sport','pickup'];
  const entry=cityRoutes(this.config.city).find(route=>route.id===this.config.route)!;
  for(let lane=0;lane<4;lane++)for(let j=0;j<5;j++){
   let kind=types[(lane+j)%types.length];
   if(this.config.city==='sf'){if(lane===2&&j===1)kind='tram';if(lane===0&&j===0)kind='van';if(lane===1&&j===0)kind='tanker';if(lane===3&&j===0)kind='carrier';}
   // All twenty entrants begin before the junction. Reserve the player's arrival footprint.
   let distance=32-j*12;const point=sampleLane(this.city.lanes[lane],distance);
   if(kind!=='tram'&&Math.hypot(point.x-entry.x,point.z-entry.z)<(VEHICLES[kind].length+VEHICLES[this.config.car].length)/2+2)distance=-28;
   this.vehicleOnLane(kind,lane,distance,true);
  }
 }
 private createPlayer(){const r=cityRoutes(this.config.city).find(r=>r.id===this.config.route)!;const e=this.vehicle(this.config.car,r.x,r.z,r.dx,r.dz,true);this.playerId=e.id;this.aim={x:r.dx,y:0,z:r.dz};}
 start(){this.phase='running';this.notice='冲进路口，首次撞击会充满爆破槽';this.noticeTime=7;const p=this.entities.get(this.playerId)!;p.body.setLinvel({x:p.direction.x*(p.speed+9),y:-1,z:p.direction.z*(p.speed+9)},true);this.emit('launch',p.body.translation(),1);}
 pause(){if(this.phase==='running'){this.phaseBeforePause=this.phase;this.phase='paused';}}
 resume(){if(this.phase==='paused')this.phase=this.phaseBeforePause;}
 private get abilityCost(){const ability=PLAYER_ABILITIES[this.config.car];return ability?ability.cost*(this.perk('cooldown')?.7:1):0;}
 private get abilityReady(){const ability=PLAYER_ABILITIES[this.config.car];return !!ability&&!this.draftOffer&&this.phase==='running'&&this.round.stage!=='finale'&&this.abilityCooldown<=0&&this.abilityActive<=0&&this.blastCharge>=this.abilityCost;}
 activateAbility():boolean{
  const ability=PLAYER_ABILITIES[this.config.car];if(!ability||this.draftOffer||this.phase!=='running'||this.round.stage==='finale'||this.abilityCooldown>0||this.abilityActive>0)return false;
  const cost=this.abilityCost;if(this.blastCharge<cost){this.say(`主动技能需要 ${Math.round(cost*100)}% 爆破能量`);return false;}
  this.blastCharge-=cost;this.abilityCooldown=ability.cooldown*(this.perk('cooldown')?.65:1);this.stats.abilityUses++;this.abilityAim={...this.aim};this.abilityStage=0;this.abilityPulse=0;
  const hero=this.entities.get(this.playerId)!;hero.wrecked=true;hero.body.setEnabledRotations(true,true,true,true);const p=hero.body.translation();
  this.emit('special',p,1.5,ability.name,'ability',hero.id);this.say(`${ability.name}，消耗 ${Math.round(cost*100)}% 能量`);
  if(this.config.car==='compact')this.abilityActive=2;
  if(this.config.car==='sport')this.abilityActive=.78;
  if(this.config.car==='pickup'){
   this.abilityActive=.65;const candidates=[...this.entities.values()].filter(e=>e.id!==hero.id&&e.wrecked&&e.kind!=='building'&&e.kind!=='money'&&Math.hypot(e.body.translation().x-p.x,e.body.translation().z-p.z)<24).sort((a,b)=>Math.hypot(a.body.translation().x-p.x,a.body.translation().z-p.z)-Math.hypot(b.body.translation().x-p.x,b.body.translation().z-p.z));
   for(const e of candidates.slice(0,5)){e.lastInteraction=this.age;e.body.wakeUp();e.body.setLinvel({x:this.abilityAim.x*29,y:10,z:this.abilityAim.z*29},true);e.body.applyTorqueImpulse({x:e.mass*.5,y:e.mass*.3,z:e.mass*.5},true);}
   this.areaDamage({x:p.x+this.abilityAim.x*5,y:p.y,z:p.z+this.abilityAim.z*5},10,.68,hero.id,1);hero.body.applyImpulse({x:-this.abilityAim.x*hero.mass*6,y:hero.mass*3,z:-this.abilityAim.z*hero.mass*6},true);
  }
  if(this.config.car==='semi'){
   this.abilityActive=1.1;this.areaDamage(p,20,1.12,hero.id,1);const yaw=Math.atan2(this.abilityAim.x,this.abilityAim.z)+Math.PI/2;
   hero.body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);hero.body.setLinvel({x:0,y:2,z:0},true);hero.body.setAngvel({x:0,y:0,z:0},true);
  }
  return true;
 }
 private stepAbility(dt:number){
  if(this.abilityActive<=0)return;const hero=this.entities.get(this.playerId)!;const p=hero.body.translation();this.abilityActive=Math.max(0,this.abilityActive-dt);
  if(this.config.car==='compact'){
   for(const e of this.entities.values()){if(e.player||e.kind==='building'||e.kind==='money'||e.body.isFixed())continue;const q=e.body.translation(),dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);if(d>2&&d<23){e.lastInteraction=this.age;e.body.applyImpulse({x:dx/d*e.mass*22*dt,y:e.mass*.6*dt,z:dz/d*e.mass*22*dt},true);}}
   if(this.abilityActive===0){this.areaDamage(p,14,.86,hero.id,1);hero.body.setLinvel({x:this.abilityAim.x*14,y:18,z:this.abilityAim.z*14},true);this.emit('special',p,1.2,'MAGNET BOUNCE!','ability',hero.id);}
  }
  if(this.config.car==='sport'){
   this.abilityPulse-=dt;if(this.abilityPulse<=0&&this.abilityStage<3){this.abilityStage++;this.abilityPulse=.24;this.areaDamage({x:p.x+this.abilityAim.x*4,y:p.y,z:p.z+this.abilityAim.z*4},7,.92,hero.id,1);hero.body.setLinvel({x:this.abilityAim.x*38,y:2.5,z:this.abilityAim.z*38},true);this.emit('impact',p,.85,`PIERCING DASH ${this.abilityStage}/3`,'ability',hero.id);}
  }
  if(this.config.car==='semi'){const v=hero.body.linvel();hero.body.setLinvel({x:v.x*.2,y:v.y,z:v.z*.2},true);hero.body.setAngvel({x:0,y:0,z:0},true);}
 }
 private chargeCityEvent(p:Vec3,source:string,amount=1){
  for(const target of this.city.eventTargets){const key=`${target.id}:${source}`;if(this.cityTriggered.has(target.id)||this.citySources.has(key)||Math.hypot(p.x-target.x,p.z-target.z)>target.radius)continue;
   this.citySources.add(key);const progress=Math.min(3,(this.cityProgress.get(target.id)||0)+amount);this.cityProgress.set(target.id,progress);
   if(progress>=3-1e-6){this.cityTriggered.add(target.id);this.triggerCityEvent(target);}
  }
 }
 private triggerCityEvent(target:CityEventTarget){
  const p={x:target.x,y:this.groundHeight(target.x,target.z)+1,z:target.z};this.emit('special',p,3,target.name,'city');this.say(`${target.name}已触发`);this.scores.bonus(`city:${target.id}`,18000);
  if(target.kind==='derail'){
   for(let i=0;i<2;i++){const tram=this.vehicle('tram',TRAM_TRACK_X,-58-i*11,0,1);tram.wrecked=true;tram.body.setEnabledTranslations(true,true,true,true);tram.body.setEnabledRotations(true,true,true,true);tram.body.setLinvel({x:i?3:-2,y:2,z:33-i*3},true);}
  }else if(target.kind==='harbour'){
   for(let i=0;i<7;i++){if(this.entities.size>143)break;const cargo=this.prop(i<2?'trailer':'crate',target.x+(i%4-1.5)*4,target.z+(Math.floor(i/4)-.5)*5,i<2?{x:2.8,y:2.6,z:6}:{x:2,y:1.8,z:2},i<2?1500:180,i<2?4200:1400,Math.PI/2,12+i*.7);cargo.wrecked=true;cargo.body.setLinvel({x:(i%2?1:-1)*5,y:-7,z:4},true);}
  }else{
   for(let lane=0;lane<4;lane++){if(this.entities.size>140)break;const bus=this.vehicleOnLane('doubledecker',lane,30);bus.speed*=1.5;bus.body.setLinvel({x:bus.direction.x*20,y:0,z:bus.direction.z*20},true);}
  }
 }
 private get pizzaOnField(){return [...this.entities.values()].some(e=>e.kind==='pizza'&&!e.destroyed);}
 private stepBonuses(dt:number){
  if(this.round.stage==='finale'||this.round.stage==='inferno'||this.round.stage==='complete')return;
  if(!this.round.featureTime&&this.waveFeatures.length){this.rewardActive=false;this.activateFeature(this.waveFeatures.shift()!,8);}
  if(this.pizzaOnField)return;
  this.bonusNextIn=Math.max(0,this.bonusNextIn-dt);
  if(this.bonusNextIn<=2.5&&!this.bonusWarned){this.bonusWarned=true;this.emit('warning',{x:this.city.center.x,y:2,z:this.city.center.z},1,'披萨车即将到场，撞毁后抽奖','pizza');}
  if(this.bonusNextIn<=0&&this.age-this.lastPizzaAt>=10&&this.entities.size<140){
   this.spawnBonusVehicle('pizza');this.lastPizzaAt=this.age;this.bonusNextIn=18+this.encounterRand()*6;this.bonusWarned=false;
  }
 }
 toggleMechanisms(){if(this.phase!=='running'||this.config.rules!=='sandbox')return;if(this.interventions<=0){this.say('本局现场干预已用完');return;}this.slowMotion=!this.slowMotion;this.slowAge=0;}
 useMechanism(id:MechanismId):boolean{
  if(this.phase!=='running'||this.interventions<=0||this.config.rules!=='sandbox')return false;
  this.interventions--;this.mechanismsUsed++;this.slowMotion=false;const m=MECHANISMS.find(m=>m.id===id)!;const location=this.config.city==='sf'?m:id==='signal'?this.city.center:this.city.eventTargets[0];const p={x:location.x,y:this.groundHeight(location.x,location.z)+1,z:location.z};
  this.emit('mechanism',p,1,m.name);this.say(`${m.name}！剩余 ${this.interventions} 次干预`);
  if(id==='signal'){this.signalTime=9;for(let i=0;i<4;i++)this.spawnTraffic(i,true);}
  if(id==='cargo'){
   for(let i=0;i<8;i++){const e=this.prop('crate',(this.config.city==='sf'?-20:p.x-4)+(i%4)*2,(this.config.city==='sf'?1:p.z-1)+Math.floor(i/4)*2,{x:1.5,y:1.5,z:1.5},100,900,0,9+Math.floor(i/4)*2);e.wrecked=true;e.body.setLinvel({x:4,y:-4,z:(this.physicsRand()-.5)*5},true);}
  }
  if(id==='billboard'){
   const e=this.prop('sign',this.config.city==='sf'?18:p.x+4,this.config.city==='sf'?-3:p.z,{x:9,y:1.2,z:2},1100,5500,Math.PI/3,9);e.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);e.wrecked=true;e.body.setLinvel({x:-5,y:-8,z:1},true);e.body.setAngvel({x:.5,y:0,z:1},true);
  }
  return true;
 }
 private emit(kind:EventKind,p:Vec3,power:number,text?:string,effect?:GameEvent['effect'],sourceId?:number){this.events.push({id:++this.eventId,kind,p:{...p},power,text,effect,sourceId});if(this.events.length>90)this.events.shift();}
 private say(s:string){this.notice=s;this.noticeTime=4;}
 update(realDt:number,input:GameInput){
  if(this.phase!=='running'||this.draftOffer)return;
  const frameDt=clamp(realDt,0,.1);
  if(this.phase==='running'){
   this.age+=frameDt;this.blastLock=Math.max(0,this.blastLock-frameDt);this.abilityCooldown=Math.max(0,this.abilityCooldown-frameDt);
   const burning=[...this.entities.values()].filter(e=>e.burning>0).length;this.round.tick(frameDt,burning);this.processRoundActions();if(this.round.stage==='complete')return;
   this.stepBonuses(frameDt);
   if(this.noticeTime>0){this.noticeTime-=frameDt;if(this.noticeTime<=0)this.notice='';}
   if(this.slowMotion){this.slowAge+=frameDt;if(this.slowAge>=2.6)this.slowMotion=false;}
   this.aim={x:input.aim.x,y:0,z:input.aim.z};
   const al=Math.hypot(this.aim.x,this.aim.z);if(al>0){this.aim.x/=al;this.aim.z/=al;}
   this.blastCharge=Math.min(1,this.blastCharge+frameDt*this.rechargeRate/(this.config.rules==='sandbox'?(this.config.car==='semi'?4.8:3.8):(this.config.car==='semi'?17:14)));
   this.scores.multiplier=(this.round.feature==='double'?2:1)*(this.perk('loot')?1.2:1);if(!this.scores.combo)this.milestone=0;this.stats.bestCombo=this.scores.bestCombo;this.checkContract();
   this.scores.update(frameDt);
   if(input.ability)this.activateAbility();
   if(input.blast&&this.blastCharge>=1)this.blast();
   this.stepAbility(frameDt);
  }
  const simDt=frameDt*(this.slowMotion?.22:1);this.accumulator+=simDt;
  let count=0;while(this.accumulator>=DT&&count<6&&this.phase==='running'){this.step(DT,input);this.accumulator-=DT;count++;}this.processRoundActions();
 }
 private step(dt:number,input:GameInput){
  this.trafficTimer-=dt;this.signalTime=Math.max(0,this.signalTime-dt);
  if(this.trafficTimer<=0&&this.round.canSpawn){const interval=this.spawnTraffic();this.trafficTimer=this.signalTime>0?.38:interval;}
  this.stepFeature(dt);
  for(const e of this.entities.values()){
   e.age+=dt;e.burning=Math.max(0,e.burning-dt);const p=e.body.translation();const v=e.body.linvel();
   if(e.kind==='money'){const hero=this.entities.get(this.playerId)?.body.translation();if(hero&&Math.hypot(hero.x-p.x,hero.z-p.z)<4.5){const points=this.scores.bonus(`money:${e.id}`,e.cash||5000);this.localChallenge=true;this.emit('score',p,1,`+$${points.toLocaleString()}`,'bank');this.remove(e);}continue;}
   if(e.player){
    if(this.phase==='running'){
     if(!e.wrecked){const target=e.speed+10;e.body.setLinvel({x:e.direction.x*target+input.x*5,y:v.y,z:e.direction.z*target+input.z*5},true);}
     else if(input.x||input.z){const air=p.y-this.groundHeight(p.x,p.z)>2;const control=PLAYER_STATS[this.config.car]?.aftertouch??4;const force=(10+control*1.35)*(air?1.15:1)*(this.config.passive==='heavy'?.65:1);e.body.applyImpulse({x:input.x*e.mass*force*dt,y:0,z:input.z*e.mass*force*dt},true);}
     if(Math.abs(p.x)>65||Math.abs(p.z)>65||p.y<-20){e.body.setTranslation(this.recoveryPoint(p),true);e.body.setLinvel({x:0,y:0,z:0},true);this.say('残骸已回到场内');}
     if(this.flightOrigin){const height=p.y-this.groundHeight(p.x,p.z);if(height>2.5)this.airborne=true;else if(this.airborne&&v.y<1){const distance=Math.hypot(p.x-this.flightOrigin.x,p.z-this.flightOrigin.z);if(distance>12){this.stats.skillshots++;const points=this.scores.bonus(`flight:${this.flightId}`,Math.min(12000,distance*150));this.emit('special',p,1,`${Math.round(distance*1.094)} yd SKILLSHOT +$${points.toLocaleString()}`);}this.flightOrigin=undefined;this.airborne=false;}}
    }
   }else if(!e.scale&&(!e.wrecked||e.kind==='bulldozer'&&!e.destroyed)){
    if(!e.wrecked&&this.followLane(e,p)){this.exitTraffic(e);continue;}
    let speed=e.speed*(this.signalTime>0?1.45:1)*(e.age<4?.55+e.age*.1125:1);let dodge=0;
    for(const other of this.entities.values()){
     if(other.id===e.id||other.kind==='lamp'||other.kind==='facade'||other.kind==='sign'||other.kind==='money')continue;
     const q=other.body.translation();const dx=q.x-p.x,dz=q.z-p.z;
     const ahead=dx*e.direction.x+dz*e.direction.z;const side=Math.abs(dx*e.direction.z-dz*e.direction.x);
     const length=VEHICLES[e.kind as VehicleKind].length;
     const otherWidth=other.scale?(Math.abs(e.direction.x)*other.scale.z+Math.abs(e.direction.z)*other.scale.x):VEHICLES[other.kind as VehicleKind].width;
     const clearance=(VEHICLES[e.kind as VehicleKind].width+otherWidth)/2+.1;
     if(ahead>0&&ahead<length/2+8&&side<clearance&&Math.abs(q.y-p.y)<3){
      if(e.kind==='tram')speed*=.88;
      else if(e.kind==='blackcab'&&ahead>4&&(e.dodgeCooldown||0)<=this.age){
       const sideScore=(sign:number)=>{const tx=p.x+e.direction.x*6+e.direction.z*3.8*sign,tz=p.z+e.direction.z*6-e.direction.x*3.8*sign;let clearance=20;
        for(const blocker of this.entities.values()){if(blocker.id===e.id||blocker.kind==='money')continue;const q=blocker.body.translation();clearance=Math.min(clearance,Math.hypot(q.x-tx,q.z-tz)-(blocker.scale?Math.max(blocker.scale.x,blocker.scale.z)/2:2));}return clearance;};
       const left=sideScore(-1),right=sideScore(1);if(Math.max(left,right)>1.1){e.dodgeSign=left>right?-1:1;e.dodgeUntil=this.age+.65;e.dodgeCooldown=this.age+2.4;this.emit('special',p,.65,'黑出租钻缝加速',undefined,e.id);}
      }
      else if(e.kind==='taxi'&&ahead>4){dodge=2.8;speed*=.85;}
      else if(e.kind!=='bulldozer')speed=Math.min(speed,Math.max(other.wrecked&&this.config.rules!=='sandbox'?3.5:0,(ahead-length/2-2)*1.9));
     }
    }
    // Motor response must overcome tire friction even when a heavy truck slows for traffic.
    const mix=Math.min(1,dt*(e.kind==='semi'?8:e.kind==='bus'?10:12));
    if((e.dodgeUntil||0)>this.age){dodge=5*(e.dodgeSign||1);speed=e.speed*1.5;}
    if(e.frozenUntil>this.age||this.round.feature==='freeze')speed=0;
    if(this.round.feature==='magnet'){const hero=this.entities.get(this.playerId)?.body.translation();if(hero&&Math.hypot(hero.x-p.x,hero.z-p.z)<25)speed=0;}
    if(this.abilityActive>0&&this.config.car==='compact'){const hero=this.entities.get(this.playerId)?.body.translation();if(hero&&Math.hypot(hero.x-p.x,hero.z-p.z)<23){speed=0;dodge=0;}}
    let tx=e.direction.x*speed+e.direction.z*dodge,tz=e.direction.z*speed-e.direction.x*dodge;
    if(e.kind==='police'&&!e.wrecked){const h=this.entities.get(this.playerId)?.body.translation();if(h){const dx=h.x-p.x,dz=h.z-p.z,d=Math.hypot(dx,dz)||1;tx=dx/d*e.speed;tz=dz/d*e.speed;if(d<4){this.blastLock=2;this.say('坏警察干扰！Crashbreaker 暂时锁定');}}}
    e.body.setLinvel({x:v.x+(tx-v.x)*mix,y:v.y,z:v.z+(tz-v.z)*mix},true);
    e.body.setAngvel({x:0,y:0,z:0},true);
    if(!e.path&&e.age>.2&&(p.x*e.direction.x+p.z*e.direction.z>69)){this.exitTraffic(e);continue;}
   }
   if(e.fuse>0){e.fuse-=dt;if(e.fuse<=0){e.fuse=-1;e.detonated=true;this.explode(e,e.kind==='tanker'?18:this.perk('ember')?13:10.5,e.kind==='tanker'?1.5:.9);this.hit(e,e.maxHealth*2);}}
   if(e.triggered&&e.kind==='magnet'&&e.age%12<7){for(const o of this.entities.values()){if(o.id===e.id||!o.wrecked)continue;const q=o.body.translation();const dx=p.x-q.x,dz=p.z-q.z;const dist=Math.hypot(dx,dz);if(dist>2&&dist<15){o.lastInteraction=this.age;o.body.applyImpulse({x:dx/dist*o.mass*5*dt,y:0,z:dz/dist*o.mass*5*dt},true);}}}
   if(e.wrecked&&e.kind!=='building'&&Math.abs(p.x)+Math.abs(p.z)>150&&!e.player)this.remove(e);
   this.preVelocity.set(e.id,{...v});
  }
  this.world.step(this.collisions);
  this.collisions.drainCollisionEvents((ha,hb,started)=>{
   if(!started||this.phase!=='running')return;const a=this.byCollider.get(ha),b=this.byCollider.get(hb);if(!a||!b)return;
   if(!a.player&&!b.player&&!a.wrecked&&!b.wrecked)return;
   const av=this.preVelocity.get(a.id)||a.body.linvel(),bv=this.preVelocity.get(b.id)||b.body.linvel();
   const speed=Math.hypot(av.x-bv.x,av.y-bv.y,av.z-bv.z);if(speed<(this.config.rules==='sandbox'?2.2:.8))return;
   const key=a.id<b.id?`${a.id}:${b.id}`:`${b.id}:${a.id}`;if((this.interactionCooldown.get(key)||0)>this.age)return;this.interactionCooldown.set(key,this.age+.7);
   const power=clamp(speed/17,.12,2);const p=a.body.translation();
   this.emit('impact',p,power);this.hit(a,speed*3.7*(b.mass/a.mass)**.2);this.hit(b,speed*3.7*(a.mass/b.mass)**.2);this.chargeCityEvent(p,`collision:${key}`,1/3);
   if(a.player||b.player){const hero=a.player?a:b;if(!this.rampaged){this.rampaged=true;this.blastCharge=1;this.say('爆破就绪，瞄准下一股车流引爆');}hero.wrecked=true;hero.body.setEnabledRotations(true,true,true,true);}
  });
  if(this.config.rules!=='sandbox')for(const e of this.entities.values()){
   if(e.scale||e.wrecked||e.player)continue;let touchingWreck=false;
   this.world.contactPairsWith(e.collider,other=>{const target=this.byCollider.get(other.handle);if(target?.wrecked&&target.value>0)touchingWreck=true;});
   e.contactAge=touchingWreck?(e.contactAge||0)+dt:0;
   if(e.contactAge>=1.2){this.hit(e,12);this.emit('impact',e.body.translation(),.3,'PILE-UP!');}
  }
  this.cleanupTimer-=dt;
  if(this.cleanupTimer<=0){this.cleanupTimer=1;this.recycleDebris();}
 }
 private recycleDebris(){
  const player=this.entities.get(this.playerId)?.body.translation();if(!player)return;
  const offScene=(e:Entity)=>{const p=e.body.translation();return e.wrecked&&!e.scale&&!this.round.isPending(e.id)&&(Math.abs(p.x)>64||Math.abs(p.z)>64);};
  const candidates=[...this.entities.values()].filter(e=>{
   if(e.player||e.kind==='building'||this.age-e.lastInteraction<12)return false;
   if(!offScene(e)&&(!e.destroyed||this.entities.size<=95))return false;
   const velocity=e.body.linvel();return e.body.isSleeping()||Math.hypot(velocity.x,velocity.y,velocity.z)<1.3;
  }).map(e=>{const p=e.body.translation();return {entity:e,offScene:offScene(e),priority:Math.hypot(p.x-player.x,p.z-player.z)+Math.hypot(p.x,p.z)*.7};});
  candidates.sort((a,b)=>b.priority-a.priority);
  let removed=0;for(const candidate of candidates){if(removed>=4)break;if(!candidate.offScene&&this.entities.size<=95)continue;this.remove(candidate.entity);this.debrisRecycled++;removed++;}
 }
 private spawnTraffic(laneOverride?:number,surge=false):number{
  const finite=this.round.total>0;
  if(!surge&&!this.round.canSpawn)return 1;
  let candidate=finite&&!surge?this.pendingTraffic:undefined;
  if(!candidate){candidate=(surge?this.surgePlan:this.trafficPlan).next(laneOverride);this.trafficCandidates++;if(finite&&!surge){this.pendingTraffic=candidate;this.pendingWait=0;}}
  if(this.config.mutator==='fuel'&&!surge&&!candidate.mutated){candidate.mutated=true;if(['compact','taxi','pickup','sport','blackcab','ute','van'].includes(candidate.kind)&&this.mutRand()<.3)candidate.kind='tanker';}
  const {kind,interval}=candidate;
  if(this.entities.size>125)return finite?.3:interval;
  const entries=this.config.city==='sf'?[{x:-65,z:-3,dx:1,dz:0},{x:65,z:3,dx:-1,dz:0},{x:3,z:-64,dx:0,dz:1},{x:-3,z:64,dx:0,dz:-1}]:this.city.lanes.map(path=>sampleLane(path,0));
  let chosen:{x:number;z:number;dx:number;dz:number;lane:number}|undefined;
  const lanes=finite&&this.pendingWait>=1.8&&kind!=='tram'?[candidate.lane,(candidate.lane+1)%4,(candidate.lane+2)%4,(candidate.lane+3)%4]:[candidate.lane];
  for(const lane of lanes){for(const offset of [0,11]){const r={...entries[lane],lane};r.x-=r.dx*offset;r.z-=r.dz*offset;if(kind==='tram')r.x=TRAM_TRACK_X;
   const d=VEHICLES[kind];const occupied=[...this.entities.values()].some(e=>{if(e.scale)return false;const p=e.body.translation(),dx=p.x-r.x,dz=p.z-r.z,other=VEHICLES[e.kind as VehicleKind];return Math.abs(dx*r.dx+dz*r.dz)<(d.length+other.length)/2+1&&Math.abs(dx*r.dz-dz*r.dx)<(d.width+other.width)/2+.4;});if(!occupied){chosen=r;break;}}if(chosen)break;}
  if(!chosen){if(finite)this.pendingWait+=.3;return finite?.3:interval;}
  const e=this.vehicle(kind,chosen.x,chosen.z,chosen.dx,chosen.dz);if(this.config.city!=='sf'){e.path=this.city.lanes[chosen.lane];e.pathIndex=1;}if(surge)e.speed*=1.25;
  this.trafficSpawned++;if(!surge)this.round.register(e.id);if(finite&&!surge)this.pendingTraffic=undefined;
  if(VEHICLES[kind].special)this.emit('warning',e.body.translation(),1,`${VEHICLES[kind].name}驶入！`);
  return this.config.rules==='sandbox'?interval:interval*.7;
 }
 private hit(e:Entity,damage:number){
  if(e.kind==='money'||!e.player&&e.value<=0)return;
  if(e.player){e.wrecked=true;e.body.setEnabledRotations(true,true,true,true);return;}
  const first=!this.scores.hasReached(e.id);
  e.health=Math.max(0,e.health-damage);
  if(damage>=5){
   e.lastInteraction=this.age;
   e.wrecked=true;
   if(e.kind!=='building'){if(e.body.bodyType()===RAPIER.RigidBodyType.Fixed)e.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);e.body.setEnabledRotations(true,true,true,true);e.body.setAngularDamping(.65);e.body.wakeUp();}
   if(e.kind==='tram')e.body.setEnabledTranslations(true,true,true,true);
   const points=this.scores.reward(e.id,'hit',e.value,e.kind);if(points)this.emit('score',e.body.translation(),.5,`+${points.toLocaleString()}`);if(points)this.checkMilestone(e.body.translation());
   if(first){this.blastCharge=Math.min(1,this.blastCharge+(e.scale?.045:.17)*(this.perk('recharge')?1.5:1));this.round.resolve(e.id,'crash');this.round.start();}
   if(!e.destroyed)e.burning=Math.max(e.burning,e.kind==='building'?9:6);
   if(!e.triggered&&!e.scale)this.special(e);
  }
  if(e.kind==='building')this.updateBuilding(e);
  if(e.health<=0&&!e.destroyed){e.destroyed=true;if(!e.scale)this.blastCharge=Math.min(1,this.blastCharge+.035);const points=this.scores.reward(e.id,'destroy',e.value,e.kind);if(points)this.emit('score',e.body.translation(),1,`+${points.toLocaleString()}`);this.emit('impact',e.body.translation(),.7);this.round.ignite();this.destroySpecial(e);if(!e.scale&&!e.player&&e.kind in VEHICLES&&VEHICLES[e.kind as VehicleKind].special)this.stats.specialsDown++;
   if(e.scale&&e.value>0){this.smashCount=this.age-this.smashTime<2.5?this.smashCount+1:1;this.smashTime=this.age;if(this.smashCount>=3){const bonus=this.scores.bonus(`smash:${e.id}`,this.smashCount*400*this.chainBonus);this.emit('special',e.body.translation(),1,`SMASH CHAIN ×${this.smashCount} +$${bonus.toLocaleString()}`);}}
  }
 }
 private updateBuilding(e:Entity){
  const stage:0|1|2|3=e.health<=0?3:e.health<=e.maxHealth*.34?2:e.health<=e.maxHealth*.68?1:0;
  const previous=e.stage||0;if(stage<=previous)return;e.stage=stage;
  for(let s=previous+1;s<=Math.min(stage,2);s++){const points=this.scores.reward(e.id,s===1?'damage1':'damage2',e.value,e.kind);if(points)this.emit('score',e.body.translation(),1,`建筑破坏 +${points.toLocaleString()}`);}
  const size=e.scale!,p=e.body.translation(),height=stage===3?.55:size.y*(stage===2?.43:.7);
  e.collider.setHalfExtents({x:size.x/2,y:height/2,z:size.z/2});e.body.setTranslation({x:p.x,y:this.groundHeight(p.x,p.z)+height/2,z:p.z},false);
  this.emit('special',{x:p.x,y:this.groundHeight(p.x,p.z)+height,z:p.z},stage===3?2:1,stage===3?'BUILDING DOWN!':'建筑受损','collapse',e.id);
  if(stage===3){this.localChallenge=true;this.stats.buildingsDown++;for(let i=0;i<3;i++){if(this.entities.size>140)break;const rubble=this.prop('crate',p.x+(this.physicsRand()-.5)*size.x,p.z+(this.physicsRand()-.5)*size.z,{x:1.8,y:.8,z:1.5},140,0,0,1);rubble.wrecked=true;rubble.destroyed=true;rubble.health=0;rubble.body.setLinvel({x:(this.physicsRand()-.5)*5,y:3,z:(this.physicsRand()-.5)*5},true);}}
 }
 private special(e:Entity){
  e.triggered=true;const p=e.body.translation();
  if(e.kind==='tanker'){e.fuse=2.5;this.emit('special',p,1,'罐车即将引爆！');}
  if(e.kind==='van'){for(let i=0;i<4;i++){const c=this.prop('crate',p.x+(this.physicsRand()-.5)*3,p.z+(this.physicsRand()-.5)*3,{x:1.2,y:1.2,z:1.2},90,800,0,2);c.wrecked=true;c.body.setLinvel({x:(this.physicsRand()-.5)*14,y:5,z:(this.physicsRand()-.5)*14},true);}this.emit('special',p,1,'货物散落');}
  if(e.kind==='carrier'){for(let i=0;i<2;i++){const c=this.vehicle('compact',p.x+(i-.5)*3,p.z+(i-.5)*4,1,0,false,4);c.wrecked=true;c.body.setEnabledRotations(true,true,true,true);c.body.setLinvel({x:(i-.5)*14,y:4,z:3},true);}this.emit('special',p,1,'小车滚落！');}
  if(e.kind==='booster'){e.body.applyImpulse({x:e.direction.x*e.mass*28,y:e.mass*4,z:e.direction.z*e.mass*28},true);this.emit('special',p,1,'二次推进！');}
  if(e.kind==='magnet'){this.emit('special',p,1,'磁场启动');}
  if(e.kind==='semi'){e.body.applyTorqueImpulse({x:e.mass*.2,y:e.mass*3,z:e.mass*.8},true);this.emit('special',p,.8,'重卡横封！');}
  if(e.kind==='doubledecker'){e.body.setAngvel({x:e.direction.x*2.8,y:.5,z:e.direction.z*2.8},true);e.body.applyImpulse({x:e.direction.z*e.mass*5,y:e.mass*2,z:-e.direction.x*e.mass*5},true);this.emit('special',p,1.4,'双层巴士侧翻，横封车道',undefined,e.id);}
  if(e.kind==='ute'){for(let i=0;i<3;i++){if(this.entities.size>140)break;const tool=this.prop('crate',p.x+(i-1)*1.3,p.z,{x:.85,y:.65,z:1.2},130,950,0,2);tool.wrecked=true;tool.body.setLinvel({x:(i-1)*9,y:6,z:-e.direction.z*8},true);}this.emit('special',p,1,'工程皮卡散落工具',undefined,e.id);}
  if(e.kind==='roadtrain'){
   e.collider.setHalfExtents({x:VEHICLES.roadtrain.width/2,y:VEHICLES.roadtrain.height/2,z:2.6});
   const yaw=Math.atan2(e.direction.x,e.direction.z);
   for(let i=0;i<2;i++){if(this.entities.size>140)break;const trailer=this.prop('trailer',p.x-e.direction.x*(3+i*5)+e.direction.z*(i-.5)*2,p.z-e.direction.z*(3+i*5)-e.direction.x*(i-.5)*2,{x:2.6,y:2.6,z:5.5},2400,3200,yaw+(i-.5)*.25,.5);trailer.wrecked=true;trailer.maxHealth=trailer.health=90;trailer.body.setLinvel({x:e.direction.x*7+e.direction.z*(i-.5)*9,y:2,z:e.direction.z*7-e.direction.x*(i-.5)*9},true);trailer.body.setAngvel({x:0,y:(i-.5)*1.8,z:0},true);}
   this.emit('special',p,1.5,'双挂重卡脱离挂车',undefined,e.id);
  }
 }
 private destroySpecial(e:Entity){
  const p=e.body.translation();
  if(!e.scale&&!e.player&&!e.detonated&&e.fuse<0)e.fuse=(.65+this.physicsRand()*.55)*(this.perk('ember')?.6:1);
  if(e.kind==='bank'){for(let i=0;i<5;i++){const bag=this.prop('money',p.x+Math.cos(i*1.256)*3,p.z+Math.sin(i*1.256)*3,{x:.9,y:.8,z:.8},1,0);bag.cash=5000;}this.emit('special',p,1,'靠近钱袋领取奖金','bank',e.id);}
  if(e.kind==='pizza'&&this.phase==='running'&&this.round.stage!=='finale'&&this.round.stage!=='complete'){
   this.randomFeature();this.emit('special',p,1,'PIZZA OF FORTUNE!','pizza',e.id);this.bonusDraws++;
   if(this.bonusDraws%2===0&&this.entities.size<135){const kinds:VehicleKind[]=['bank','icecream','missile','carrier'];this.spawnBonusVehicle(kinds[Math.floor(this.encounterRand()*kinds.length)]);}
  }
  if(e.kind==='missile'){const targets=[...this.entities.values()].filter(o=>!o.player&&!o.destroyed&&o.kind!=='money').sort((a,b)=>Math.hypot(b.body.translation().x-p.x,b.body.translation().z-p.z)-Math.hypot(a.body.translation().x-p.x,a.body.translation().z-p.z));const target=targets[0];if(target){this.emit('special',target.body.translation(),1,'MISSILE STRIKE!','airstrike',e.id);this.areaDamage(target.body.translation(),15,1.6,e.id,1);}}
  if(e.kind==='icecream'){for(const o of this.entities.values()){const q=o.body.translation();if(!o.player&&!o.scale&&Math.hypot(p.x-q.x,p.z-q.z)<24)o.frozenUntil=this.age+6;}this.emit('special',p,1,'ICE CREAM FREEZE!','freeze',e.id);}
 }
 private spawnBonusVehicle(kind:VehicleKind){
  if(this.config.city!=='sf'){const e=this.vehicleOnLane(kind,Math.floor(this.featureRand()*4),12);this.emit('warning',e.body.translation(),1,`${VEHICLES[kind].name}到达！`,kind==='pizza'?'pizza':undefined,e.id);return e;}
  const lane=Math.floor(this.featureRand()*4);const entries=[{x:-53,z:-3,dx:1,dz:0},{x:53,z:3,dx:-1,dz:0},{x:3,z:-52,dx:0,dz:1},{x:-3,z:52,dx:0,dz:-1}];const r=entries[lane];
  const e=this.vehicle(kind,r.x,r.z,r.dx,r.dz);this.emit('warning',e.body.translation(),1,`${VEHICLES[kind].name}到达！`,kind==='pizza'?'pizza':undefined,e.id);return e;
 }
 private randomFeature(){this.activateFeature(this.bonusPlan.nextFeature(),this.perk('pizza')?12:8);this.rewardActive=true;}
 activateFeature(feature:Feature,duration=8){
  this.rewardActive=false;
  this.round.feature=feature;this.round.featureTime=duration;this.featurePulse=0;this.featureBurstDone=false;
  if(this.round.stage!=='finale'&&this.round.stage!=='inferno')this.round.stage='feature';
  const names:Record<Feature,string>={none:'',goodcop:'GOOD COP',badcop:'BAD COP',magnet:'MAGNET',double:'DOUBLE TROUBLE',freeze:'FREEZE!',tornado:'TORNADO!',airstrike:'AIR STRIKE!',tidalwave:'TIDAL WAVE!',ufo:'ALIEN INVASION!',asteroid:'ASTEROID!',monster:'MONSTER RAMPAGE!'};
  this.emit('special',{x:0,y:1,z:0},2,names[feature],feature);this.say(names[feature]);
  if(feature==='badcop')this.spawnBonusVehicle('police');
  if(feature==='goodcop'){
   const exits=this.config.city==='sf'?[{x:52,z:-3,dx:0,dz:1},{x:-52,z:3,dx:0,dz:1},{x:3,z:52,dx:1,dz:0},{x:-3,z:-52,dx:1,dz:0}]:this.city.lanes.map(path=>{const a=path[path.length-2],b=path[path.length-1],d=Math.hypot(b.x-a.x,b.z-a.z)||1,dx=(b.x-a.x)/d,dz=(b.z-a.z)/d;return {x:b.x-dx*18,z:b.z-dz*18,dx:dz,dz:-dx};});const exit=exits[Math.floor(this.featureRand()*4)];
   const cop=this.vehicle('police',exit.x,exit.z,exit.dx,exit.dz);cop.wrecked=true;cop.value=0;cop.body.setBodyType(RAPIER.RigidBodyType.Fixed,true);this.featureBlocks.add(cop.id);this.say('好警察封住了一个出口');
  }
 }
 private processRoundActions(){
  for(const action of this.round.drain()){
   if(action.kind==='draft'&&this.round.stage!=='finale'&&this.round.stage!=='inferno')this.openDraft('perk',this.draft.perkOptions());
   if(action.kind==='feature'){const feature=this.round.wave===2?'goodcop':'magnet';if(this.rewardActive&&this.round.featureTime>0)this.waveFeatures.push(feature);else this.activateFeature(feature,8);}
   if(action.kind==='pizza'&&!this.pizzaOnField)this.bonusNextIn=Math.min(this.bonusNextIn,Math.max(2.5,10-(this.age-this.lastPizzaAt)));
   if(action.kind==='inferno'){this.superTriggered=true;this.emit('special',{x:0,y:1,z:0},2,`INFERNO! ×${this.round.infernoMultiplier}`,'super');this.say('进入燃烧加时，逃脱数决定最终倍率');}
   if(action.kind==='finale'){
    this.waveFeatures=[];
    this.superTriggered=true;this.emit('special',{x:0,y:1,z:0},action.power,'SUPER FEATURE!','super');
    if(this.config.rules==='rushhour'){const p=this.entities.get(this.playerId)!.body.translation();this.emit('explosion',p,action.power,'SUPER CRASHBREAKER!','super');this.areaDamage(p,32+action.power*5,action.power,undefined,1);}
    else this.activateFeature(this.config.route==='hill'?'tornado':this.config.route==='market'?'airstrike':'tidalwave',8);
   }
   if(action.kind==='finish'){
    if(this.config.rules==='sandbox'&&action.outcome==='complete')this.superTriggered=true;
    if(this.config.rules==='pileup')this.scores.bonus('inferno-final',(this.scores.breakdown.traffic+this.scores.breakdown.property)*(this.round.infernoMultiplier-1));
    this.stats.finished=action.outcome==='complete';this.stats.escaped=this.round.escaped;this.checkContract();
    this.phase='ended';this.slowMotion=false;this.emit('end',{x:0,y:0,z:0},1,action.outcome==='escaped'?'5 辆车逃脱，挑战失败':action.outcome==='timeout'?'路口仍有车流未解决':'TOTAL DAMAGE!');
   }
  }
 }
 private stepFeature(dt:number){
  const feature=this.round.feature;if(feature!=='goodcop'&&this.featureBlocks.size){for(const id of this.featureBlocks){const e=this.entities.get(id);if(e)this.remove(e);}this.featureBlocks.clear();}if(feature==='none')return;
  const strength=this.round.stage==='finale'?this.round.finalePower/4:1;
  const hero=this.entities.get(this.playerId)?.body.translation()||{x:0,y:0,z:0};
  for(const e of this.entities.values()){
   if(e.kind==='building'||e.kind==='money')continue;const p=e.body.translation();
   if(feature==='magnet'&&!e.player&&!e.scale){const dx=hero.x-p.x,dz=hero.z-p.z,d=Math.hypot(dx,dz);if(d>2&&d<25){e.lastInteraction=this.age;e.body.applyImpulse({x:dx/d*e.mass*10*dt,y:0,z:dz/d*e.mass*10*dt},true);}}
   if(feature==='tornado'){const dx=p.x,dz=p.z,d=Math.hypot(dx,dz)||1;if(d<65){e.body.applyImpulse({x:(-dx/d*8-dz/d*13)*e.mass*dt*strength,y:e.mass*11*dt*strength,z:(-dz/d*8+dx/d*13)*e.mass*dt*strength},true);e.body.applyTorqueImpulse({x:e.mass*.2*dt,y:e.mass*2*dt,z:0},true);}}
   if(feature==='tidalwave')e.body.applyImpulse({x:e.mass*18*dt*strength,y:e.mass*2*dt*strength,z:e.mass*3*dt*strength},true);
   if(feature==='ufo'&&Math.hypot(p.x,p.z)<55)e.body.applyImpulse({x:-p.x*e.mass*.14*dt*strength,y:e.mass*15*dt*strength,z:-p.z*e.mass*.14*dt*strength},true);
  }
  this.featurePulse-=dt;if(this.featurePulse>0)return;this.featurePulse=.65;
  if(feature==='airstrike'||feature==='monster'){
   const target=this.city.buildings[this.effectSequence++%this.city.buildings.length],p={x:target.x,y:this.groundHeight(target.x,target.z)+1,z:target.z};this.emit('explosion',p,1.8,feature==='airstrike'?'AIR STRIKE':'MONSTER STOMP',feature);this.areaDamage(p,19,1.8*strength,undefined,1);
  }else if(feature==='tornado'||feature==='tidalwave'){
   const x=feature==='tidalwave'?(-50+(8-this.round.featureTime)*13):Math.sin(this.age)*18;this.areaDamage({x,y:1,z:0},feature==='tidalwave'?28:26,.8*strength,undefined,1);
  }else if((feature==='asteroid'||feature==='ufo')&&this.round.featureTime<3&&!this.featureBurstDone){this.featureBurstDone=true;this.emit('explosion',{x:0,y:0,z:0},4,feature==='asteroid'?'ASTEROID IMPACT!':'ALIEN SHOCKWAVE!',feature);this.areaDamage({x:0,y:0,z:0},85,5*strength,undefined,1);}
 }
 blast(){
  const hero=this.entities.get(this.playerId);if(!hero||this.draftOffer||this.phase!=='running'||this.blastCharge<1||this.blastLock>0||this.round.stage==='finale')return false;
  this.blastCharge=0;hero.wrecked=true;hero.body.setEnabledRotations(true,true,true,true);
  this.flightOrigin={...hero.body.translation()};this.flightId++;this.airborne=false;
  const power=PLAYER_STATS[this.config.car]?.power??4;const radius=(10+power*1.2)*(this.perk('wide')?1.25:1)*(this.config.mutator==='glass'?1.35:1);this.explode(hero,radius,(.85+power*.06)*(this.perk('heavy')?1.2:1));this.blastCharge=Math.min(this.blastCharge,.72);
  this.chargeCityEvent(hero.body.translation(),`blast:${this.flightId}`);
  let up=this.config.blast==='leap'?19:11;let forward=this.config.blast==='focused'?22:13;
  if(this.config.passive==='elastic')up*=1.25;if(this.config.passive==='heavy'){up*=.72;forward*=.8;}
  hero.body.setLinvel({x:this.aim.x*forward,y:up,z:this.aim.z*forward},true);hero.body.setAngvel({x:this.aim.z*1.6,y:.8,z:-this.aim.x*1.6},true);
  return true;
 }
 private explode(source:Entity,radius:number,power:number){
  const p=source.body.translation();this.emit('explosion',p,power,source.player?'CRASHBREAKER!':'CHAIN REACTION!');
  if(!source.player&&(source.chainDepth||0)>0){this.stats.chainDepth=Math.max(this.stats.chainDepth,source.chainDepth||0);const points=this.scores.bonus(`chain:${source.id}`,750*(source.chainDepth||1)*this.chainBonus);this.emit('special',p,1,`EXPLOSION CHAIN ×${source.chainDepth} +$${points.toLocaleString()}`);}
  this.areaDamage(p,radius,power,source.id,source.player?1:(source.chainDepth||0)+1,source.player);
 }
 private areaDamage(p:Vec3,radius:number,power:number,sourceId?:number,depth=0,directional=false){
  const explosionId=++this.effectSequence;let vehiclesDestroyed=0;
  const affected=[...this.entities.values()];
  for(const e of affected){if(e.id===sourceId||e.kind==='money'||!this.entities.has(e.id))continue;const q=e.body.translation();const dx=q.x-p.x,dz=q.z-p.z,dy=q.y-p.y;
   const distance=e.kind==='building'?Math.hypot(Math.max(0,Math.abs(dx)-e.scale!.x/2),Math.max(0,Math.abs(dz)-e.scale!.z/2),Math.max(0,Math.abs(dy)-e.scale!.y/2)*.5):Math.hypot(dx,dz,dy*.5);if(distance>radius)continue;
   const planar=Math.hypot(dx,dz)||1,direction={x:dx/planar,z:dz/planar};
   const cone=directional&&this.config.blast==='focused'?clamp((direction.x*this.aim.x+direction.z*this.aim.z+.2)*1.6,.12,1.8):1;
   const force=(1-distance/radius)*power*cone,wasDestroyed=e.destroyed;if(!wasDestroyed&&!e.scale)e.chainDepth=depth;
   this.hit(e,Math.max(8,force*95));if(!wasDestroyed&&e.destroyed&&!e.scale)vehiclesDestroyed++;
   if(e.kind==='building')continue;
   const mass=e.mass;e.body.applyImpulse({x:direction.x*mass*force*18,y:mass*force*9,z:direction.z*mass*force*18},true);
   e.body.applyTorqueImpulse({x:mass*force*2*(this.physicsRand()-.5),y:mass*force*2,z:mass*force*2*(this.physicsRand()-.5)},true);
   if(e.kind==='ute'&&!e.boosted){e.boosted=true;e.body.applyImpulse({x:e.direction.x*mass*26,y:mass*3,z:e.direction.z*mass*26},true);this.emit('special',q,1,'工程皮卡被爆破推进',undefined,e.id);}
  }
  if(vehiclesDestroyed>=3){const points=this.scores.bonus(`explosion-combo:${explosionId}`,vehiclesDestroyed*1500*this.chainBonus);this.emit('special',p,2,`EXPLOSION COMBO ×${vehiclesDestroyed} +$${points.toLocaleString()}`);if(directional)this.stats.comboBlasts++;if(vehiclesDestroyed>=5)this.emit('special',p,3,`MEGA BLAST ×${vehiclesDestroyed}`,'mega');}
 }
 perk(id:PerkId){return this.draft.has(id);}
 private get chainBonus(){return this.perk('chain')?1.6:1;}
 private get rechargeRate(){return (this.perk('recharge')?1.2:1)*(this.config.mutator==='glass'?.6:1);}
 private openDraft(kind:'perk'|'contract',options:string[]){
  if(this.draftMode!=='manual'||this.draftOffer||!options.length)return;
  this.draftOffer={id:++this.draftId,kind,options};this.accumulator=0;
 }
 /** Offers three contracts before the launch; the round stays frozen until one is picked or skipped. */
 offerContracts(){if(this.contractId)return;this.openDraft('contract',this.draft.contractOptions());}
 pickDraft(index:number):boolean{
  const offer=this.draftOffer;if(!offer)return false;
  if(index<0){if(offer.kind==='perk')return false;this.draftOffer=null;return true;}
  const choice=offer.options[index];if(!choice)return false;this.draftOffer=null;const p=this.entities.get(this.playerId)?.body.translation()??{x:0,y:1,z:0};
  if(offer.kind==='contract'){this.contractId=choice;const c=contractById(choice)!;this.emit('special',p,1,`已接合约 ${c.name}`,'contract');this.say(`合约 ${c.name}：${c.description}`);return true;}
  const id=choice as PerkId;this.draft.owned.push(id);this.emit('special',p,1.4,`获得强化 ${PERKS[id].name}`,'perk');this.say(`强化 ${PERKS[id].name}：${PERKS[id].description}`);
  if(id==='brake'){this.round.escaped=Math.max(0,this.round.escaped-1);this.round.infernoMultiplier=Math.max(1,5-this.round.escaped);this.blastCharge=Math.min(1,this.blastCharge+.25);}
  if(id==='pizza')this.bonusNextIn=Math.min(this.bonusNextIn,3);
  return true;
 }
 private contractView():ContractView|null{
  const c=this.contractId?contractById(this.contractId):undefined;if(!c)return null;
  return {id:c.id,progress:Math.min(c.target,c.metric(this.stats)),target:c.target,done:this.contractDone,reward:c.reward};
 }
 private checkContract(){
  const c=this.contractId?contractById(this.contractId):undefined;if(!c||this.contractDone||c.metric(this.stats)<c.target)return;
  this.contractDone=true;const points=this.scores.bonus(`contract:${c.id}`,c.reward);
  this.emit('special',this.entities.get(this.playerId)?.body.translation()??{x:0,y:1,z:0},2,`合约完成 ${c.name} +$${points.toLocaleString()}`,'contract');
 }
 private checkMilestone(p:Vec3){
  const marks=[8,16,25,40],names=['NICE CHAIN!','GREAT CHAIN!','MEGA CRASH!','TOTAL CARNAGE!'];
  while(this.milestone<marks.length&&this.scores.combo>=marks[this.milestone]){this.emit('special',p,this.milestone+1,`${names[this.milestone]} ×${marks[this.milestone]}`,'mega');this.milestone++;}
 }
 private remove(e:Entity){this.entities.delete(e.id);this.byCollider.delete(e.collider.handle);this.preVelocity.delete(e.id);this.world.removeRigidBody(e.body);}
 diagnostics(){return {entities:this.entities.size,trafficCandidates:this.trafficCandidates,trafficSpawned:this.trafficSpawned,debrisRecycled:this.debrisRecycled};}
 snapshot():GameSnapshot {
  const entities:RenderEntity[]=[];
  for(const e of this.entities.values()){entities.push({id:e.id,kind:e.kind,p:{...e.body.translation()},q:{...e.body.rotation()},v:{...e.body.linvel()},damage:1-e.health/e.maxHealth,destroyed:e.destroyed,player:e.player,active:e.wrecked,scale:e.scale,fuse:e.fuse,buildingIndex:e.buildingIndex,stage:e.stage,burning:e.burning,frozen:e.frozenUntil>this.age||this.round.feature==='freeze'});}
  const target=this.city.eventTargets.find(target=>!this.cityTriggered.has(target.id))||this.city.eventTargets[0];const cityEvent={name:target.name,description:target.description,progress:(this.cityProgress.get(target.id)||0)/3,triggered:this.cityTriggered.has(target.id)};
  const r=this.round;return {draft:this.draftOffer?{...this.draftOffer,options:[...this.draftOffer.options]} as DraftView:null,perks:[...this.draft.owned],contract:this.contractView(),abilityCost:this.abilityCost,chainMultiplier:this.scores.chain,bonusNextIn:this.bonusNextIn,pizzaOnField:this.pizzaOnField,bonusDraws:this.bonusDraws,abilityReady:this.abilityReady,abilityCooldown:this.abilityCooldown,abilityActive:this.abilityActive,cityEvent,phase:this.phase,time:this.time,score:this.scores.score,combo:this.scores.combo,comboTime:this.scores.comboTime,bestCombo:this.scores.bestCombo,crashes:this.scores.crashes,destroyed:this.scores.destroyed,blastCharge:this.blastCharge,interventions:this.interventions,slowMotion:this.slowMotion,aim:this.aim,playerId:this.playerId,entities,events:[...this.events],config:{...this.config},notice:this.notice,stars:starsFor(this.scores.score,this.config.rules,this.superTriggered,this.localChallenge),starProgress:starProgressFor(this.scores.score,this.config.rules),challengeProgress:runChallenges(this.scores.score,this.config.rules,this.superTriggered,this.localChallenge).map(Number),trafficTotal:r.total,trafficRemaining:r.remaining,escaped:r.escaped,escapeLimit:r.escapeLimit,wave:r.wave,featureProgress:r.featureProgress,feature:r.feature,featureTime:r.featureTime,roundStage:r.stage,finalePower:r.finalePower,infernoTime:r.infernoTime,infernoMultiplier:r.infernoMultiplier,breakdown:{...this.scores.breakdown}};
 }
 result():RunResult{return {score:this.scores.score,bestCombo:this.scores.bestCombo,crashes:this.scores.crashes,destroyed:this.scores.destroyed,config:{...this.config},medal:medalFor(this.scores.score,this.config.rules),challenges:runChallenges(this.scores.score,this.config.rules,this.superTriggered,this.localChallenge),perks:[...this.draft.owned],contract:this.contractId?{id:this.contractId,done:this.contractDone,reward:contractById(this.contractId)?.reward??0}:undefined,timestamp:Date.now(),ruleVersion:RULE_VERSION,outcome:this.round.outcome,escaped:this.round.escaped,stars:starsFor(this.scores.score,this.config.rules,this.superTriggered,this.localChallenge),breakdown:{...this.scores.breakdown}};}
 dispose(){this.collisions.free();this.world.free();this.entities.clear();}
}
