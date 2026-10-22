import RAPIER from '@dimforge/rapier3d-compat';
import {BUILDINGS,VEHICLES,ROUTES,MECHANISMS,groundHeight,seeded,type VehicleKind,type ModelKind,type PropKind,type RunConfig,type Vec3,type RenderEntity,type GameSnapshot,type GameEvent,type EventKind,type MechanismId,type RunResult} from '../shared';
import {ScoreKeeper,medalFor,challengeFlags,clamp} from './rules';
import {TrafficPlan} from './trafficPlan';

interface Entity {
 id:number;kind:ModelKind;body:RAPIER.RigidBody;collider:RAPIER.Collider;player:boolean;
 maxHealth:number;health:number;mass:number;value:number;wrecked:boolean;destroyed:boolean;
 direction:Vec3;speed:number;triggered:boolean;fuse:number;scale?:Vec3;age:number;lastInteraction:number;
}
export interface GameInput {x:number;z:number;aim:Vec3;blast:boolean}
const DT=1/60;
const TRAM_TRACK_X=-4.25;
export class GameSimulation {
 static async init(){await RAPIER.init();}
 readonly world:RAPIER.World;
 readonly entities=new Map<number,Entity>();
 readonly scores=new ScoreKeeper();
 readonly config:RunConfig;
 phase:GameSnapshot['phase']='ready';time=120;blastCharge=0.45;interventions=3;slowMotion=false;notice='选择路线，准备制造连锁';
 playerId=0;aim:Vec3={x:0,y:0,z:1};
 private collisions=new RAPIER.EventQueue(true);private byCollider=new Map<number,Entity>();
 private nextId=1;private eventId=0;private events:GameEvent[]=[];private physicsRand:()=>number;
 private trafficPlan:TrafficPlan;private surgePlan:TrafficPlan;
 private accumulator=0;private trafficTimer=0;private age=0;private slowAge=0;private signalTime=0;
 private noticeTime=0;private mechanismsUsed=0;private rampaged=false;
 private cleanupTimer=0;private trafficCandidates=0;private trafficSpawned=0;private debrisRecycled=0;
 private preVelocity=new Map<number,Vec3>();private interactionCooldown=new Map<string,number>();
 private phaseBeforePause:GameSnapshot['phase']='running';
 constructor(config:RunConfig){
  this.config={...config};this.physicsRand=seeded(config.seed^0x4f1bbcdc);
  this.trafficPlan=new TrafficPlan(config.seed);this.surgePlan=new TrafficPlan(config.seed^0x6c8e9cf5);
  this.world=new RAPIER.World({x:0,y:-18,z:0});
  this.world.timestep=DT;this.world.numSolverIterations=5;this.buildWorld();this.seedTraffic();this.createPlayer();
 }
 private buildWorld(){
  const zs=[-90,-56,-15,15,55,90];const vertices:number[]=[];const indices:number[]=[];
  for(const z of zs)vertices.push(-90,groundHeight(-90,z)-0.12,z,90,groundHeight(90,z)-0.12,z);
  for(let i=0;i<zs.length-1;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)).setFriction(.65).setRestitution(.07));
  for(const b of BUILDINGS){this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,groundHeight(b.x,b.z)+b.h/2,b.z).setFriction(.4));}
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
  const d=VEHICLES[kind];let mass=d.mass;if(player&&this.config.passive==='heavy')mass*=1.45;
  const yaw=Math.atan2(dx,dz);
  const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,groundHeight(x,z)+d.height/2+.3+yOffset,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setLinearDamping(.12).setAngularDamping(.9).setCcdEnabled(true).setCanSleep(!player));
  body.setEnabledRotations(false,true,false,true);
  if(kind==='tram'){body.setEnabledTranslations(false,true,true,true);body.setEnabledRotations(false,false,false,true);}
  const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(d.width/2,d.height/2,d.length/2).setMass(mass).setFriction(.45).setRestitution(player&&this.config.passive==='elastic'?.5:.12).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
  const e:Entity={id:this.nextId++,kind,body,collider,player,maxHealth:d.health,health:d.health,mass,value:d.value,wrecked:false,destroyed:false,direction:{x:dx,y:0,z:dz},speed:d.speed,triggered:false,fuse:-1,age:0,lastInteraction:this.age};
  this.entities.set(e.id,e);this.byCollider.set(collider.handle,e);return e;
 }
 private prop(kind:PropKind,x:number,z:number,size:Vec3,mass:number,value:number,yaw=0,yOffset=0):Entity{
  const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,groundHeight(x,z)+size.y/2+yOffset,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setLinearDamping(.25).setAngularDamping(.6).setCanSleep(true));
  const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setMass(mass).setFriction(.65).setRestitution(.1).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
  const e:Entity={id:this.nextId++,kind,body,collider,player:false,maxHealth:kind==='facade'?90:32,health:kind==='facade'?90:32,mass,value,wrecked:false,destroyed:false,direction:{x:0,y:0,z:0},speed:0,triggered:false,fuse:-1,scale:size,age:0,lastInteraction:this.age};
  if(kind==='sign'||kind==='facade'||kind==='lamp'||kind==='barrier')body.setBodyType(RAPIER.RigidBodyType.Fixed,true);
  this.entities.set(e.id,e);this.byCollider.set(collider.handle,e);return e;
 }
 private seedTraffic(){
  const types:VehicleKind[]=['compact','taxi','bus','van','sport','pickup'];
  for(let lane=0;lane<4;lane++)for(let j=0;j<4;j++){
   const pos=-32+j*17+(lane%2)*5;
   if(lane===0)this.vehicle(types[(j+lane)%types.length],pos,-3,1,0);
   if(lane===1)this.vehicle(types[(j+lane)%types.length],pos,3,-1,0);
   if(lane===2)this.vehicle(types[(j+lane)%types.length],3,pos,0,1);
   if(lane===3)this.vehicle(types[(j+lane)%types.length],-3,pos,0,-1);
  }
  // Distinct route opportunities are present from launch, never dependent on a lucky random draw.
  this.vehicle('tram',-3,-47,0,1);this.vehicle('van',-24,3,1,0);
  this.vehicle('tanker',23,-3,-1,0);this.vehicle('carrier',41,3,-1,0);
 }
 private createPlayer(){const r=ROUTES.find(r=>r.id===this.config.route)!;const e=this.vehicle(this.config.car,r.x,r.z,r.dx,r.dz,true);this.playerId=e.id;this.aim={x:r.dx,y:0,z:r.dz};}
 start(){this.phase='running';this.notice='冲进路口 · 首次撞击会充满爆破';this.noticeTime=7;const p=this.entities.get(this.playerId)!;p.body.setLinvel({x:p.direction.x*(p.speed+9),y:-1,z:p.direction.z*(p.speed+9)},true);this.emit('launch',p.body.translation(),1);}
 pause(){if(this.phase==='running'){this.phaseBeforePause=this.phase;this.phase='paused';}}
 resume(){if(this.phase==='paused')this.phase=this.phaseBeforePause;}
 toggleMechanisms(){if(this.phase!=='running')return;if(this.interventions<=0){this.say('本局现场干预已用完');return;}this.slowMotion=!this.slowMotion;this.slowAge=0;}
 useMechanism(id:MechanismId):boolean{
  if(this.phase!=='running'||this.interventions<=0)return false;
  this.interventions--;this.mechanismsUsed++;this.slowMotion=false;const m=MECHANISMS.find(m=>m.id===id)!;const p={x:m.x,y:groundHeight(m.x,m.z)+1,z:m.z};
  this.emit('mechanism',p,1,m.name);this.say(`${m.name}！剩余 ${this.interventions} 次干预`);
  if(id==='signal'){this.signalTime=9;for(let i=0;i<4;i++)this.spawnTraffic(i,true);}
  if(id==='cargo'){
   for(let i=0;i<8;i++){const e=this.prop('crate',-20+(i%4)*2,1+Math.floor(i/4)*2,{x:1.5,y:1.5,z:1.5},100,900,0,9+Math.floor(i/4)*2);e.wrecked=true;e.body.setLinvel({x:4,y:-4,z:(this.physicsRand()-.5)*5},true);}
  }
  if(id==='billboard'){
   const e=this.prop('sign',18,-3,{x:9,y:1.2,z:2},1100,5500,Math.PI/3,9);e.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);e.wrecked=true;e.body.setLinvel({x:-5,y:-8,z:1},true);e.body.setAngvel({x:.5,y:0,z:1},true);
  }
  return true;
 }
 private emit(kind:EventKind,p:Vec3,power:number,text?:string){this.events.push({id:++this.eventId,kind,p:{...p},power,text});if(this.events.length>90)this.events.shift();}
 private say(s:string){this.notice=s;this.noticeTime=4;}
 update(realDt:number,input:GameInput){
  if(this.phase==='paused'||this.phase==='ended')return;
  const frameDt=clamp(realDt,0,.1);
  if(this.phase==='running'){
   this.time=Math.max(0,this.time-frameDt);this.age+=frameDt;
   if(this.noticeTime>0){this.noticeTime-=frameDt;if(this.noticeTime<=0)this.notice='';}
   if(this.slowMotion){this.slowAge+=frameDt;if(this.slowAge>=2.6)this.slowMotion=false;}
   this.aim={x:input.aim.x,y:0,z:input.aim.z};
   const al=Math.hypot(this.aim.x,this.aim.z);if(al>0){this.aim.x/=al;this.aim.z/=al;}
   this.blastCharge=Math.min(1,this.blastCharge+frameDt/(this.config.car==='semi'?4.8:3.8));
   this.scores.update(frameDt);
   if(input.blast&&this.blastCharge>=1)this.blast();
   if(this.time<=0){this.phase='ended';this.slowMotion=false;this.emit('end',{x:0,y:0,z:0},1);return;}
  }
  const simDt=frameDt*(this.slowMotion?.22:1);this.accumulator+=simDt;
  let count=0;while(this.accumulator>=DT&&count<6){this.step(DT,input);this.accumulator-=DT;count++;}
 }
 private step(dt:number,input:GameInput){
  this.trafficTimer-=dt;this.signalTime=Math.max(0,this.signalTime-dt);
  if(this.trafficTimer<=0){const interval=this.spawnTraffic();this.trafficTimer=this.signalTime>0?.38:interval;}
  for(const e of this.entities.values()){
   e.age+=dt;const p=e.body.translation();const v=e.body.linvel();
   if(e.player){
    if(this.phase==='running'){
     if(!e.wrecked){const target=e.speed+10;e.body.setLinvel({x:e.direction.x*target+input.x*5,y:v.y,z:e.direction.z*target+input.z*5},true);}
     else if(input.x||input.z){const air=p.y-groundHeight(p.x,p.z)>2;const force=(air?10:5)*(this.config.passive==='heavy'?.65:1);e.body.applyImpulse({x:input.x*e.mass*force*dt,y:0,z:input.z*e.mass*force*dt},true);}
     if(Math.abs(p.x)>65||Math.abs(p.z)>65||p.y<-20){e.body.setTranslation({x:clamp(p.x,-32,32),y:groundHeight(0,0)+7,z:clamp(p.z,-25,25)},true);e.body.setLinvel({x:0,y:0,z:0},true);this.say('残骸回到现场 · 继续连锁！');}
    }
   }else if(!e.scale&&!e.wrecked){
    let speed=e.speed*(this.signalTime>0?1.45:1);let dodge=0;
    for(const other of this.entities.values()){
     if(other.id===e.id||other.kind==='lamp'||other.kind==='facade'||other.kind==='sign')continue;
     const q=other.body.translation();const dx=q.x-p.x,dz=q.z-p.z;
     const ahead=dx*e.direction.x+dz*e.direction.z;const side=Math.abs(dx*e.direction.z-dz*e.direction.x);
     const length=VEHICLES[e.kind as VehicleKind].length;
     if(ahead>0&&ahead<length/2+8&&side<2.2&&Math.abs(q.y-p.y)<3){
      if(e.kind==='tram')speed*=.88;
      else if(e.kind==='taxi'&&ahead>4){dodge=2.8;speed*=.85;}
      else speed=Math.min(speed,Math.max(0,(ahead-length/2-2)*1.9));
     }
    }
    const mix=Math.min(1,dt*(e.kind==='semi'?1.0:e.kind==='bus'?1.5:3.2));
    const tx=e.direction.x*speed+e.direction.z*dodge,tz=e.direction.z*speed-e.direction.x*dodge;
    e.body.setLinvel({x:v.x+(tx-v.x)*mix,y:v.y,z:v.z+(tz-v.z)*mix},true);
    e.body.setAngvel({x:0,y:0,z:0},true);
    if(e.age>.2&&(Math.abs(p.x)>69||Math.abs(p.z)>69))this.remove(e);
   }
   if(e.fuse>0){e.fuse-=dt;if(e.fuse<=0){e.fuse=-1;this.explode(e,18,1.5);this.hit(e,e.maxHealth*2);}}
   if(e.triggered&&e.kind==='magnet'&&e.age%12<7){for(const o of this.entities.values()){if(o.id===e.id||!o.wrecked)continue;const q=o.body.translation();const dx=p.x-q.x,dz=p.z-q.z;const dist=Math.hypot(dx,dz);if(dist>2&&dist<15){o.lastInteraction=this.age;o.body.applyImpulse({x:dx/dist*o.mass*5*dt,y:0,z:dz/dist*o.mass*5*dt},true);}}}
   if(e.wrecked&&Math.abs(p.x)+Math.abs(p.z)>150&&!e.player)this.remove(e);
   this.preVelocity.set(e.id,{...v});
  }
  this.world.step(this.collisions);
  this.collisions.drainCollisionEvents((ha,hb,started)=>{
   if(!started||this.phase!=='running')return;const a=this.byCollider.get(ha),b=this.byCollider.get(hb);if(!a||!b)return;
   if(!a.player&&!b.player&&!a.wrecked&&!b.wrecked)return;
   const av=this.preVelocity.get(a.id)||a.body.linvel(),bv=this.preVelocity.get(b.id)||b.body.linvel();
   const speed=Math.hypot(av.x-bv.x,av.y-bv.y,av.z-bv.z);if(speed<2.2)return;
   const key=a.id<b.id?`${a.id}:${b.id}`:`${b.id}:${a.id}`;if((this.interactionCooldown.get(key)||0)>this.age)return;this.interactionCooldown.set(key,this.age+.7);
   const power=clamp(speed/17,.12,2);const p=a.body.translation();
   this.emit('impact',p,power);this.hit(a,speed*3.7*(b.mass/a.mass)**.2);this.hit(b,speed*3.7*(a.mass/b.mass)**.2);
   if(a.player||b.player){const hero=a.player?a:b;if(!this.rampaged){this.rampaged=true;this.blastCharge=1;this.say('CRASHBREAKER 就绪！按空格引爆 · 鼠标指向下一股车流');}hero.wrecked=true;hero.body.setEnabledRotations(true,true,true,true);}
  });
  this.cleanupTimer-=dt;
  if(this.cleanupTimer<=0){this.cleanupTimer=1;this.recycleDebris();}
 }
 private recycleDebris(){
  if(this.entities.size<=95)return;
  const player=this.entities.get(this.playerId)?.body.translation();if(!player)return;
  const candidates=[...this.entities.values()].filter(e=>{
   if(!e.destroyed||e.player||this.age-e.lastInteraction<12)return false;
   const velocity=e.body.linvel();return e.body.isSleeping()||Math.hypot(velocity.x,velocity.y,velocity.z)<1.3;
  }).map(e=>{const p=e.body.translation();return {entity:e,priority:Math.hypot(p.x-player.x,p.z-player.z)+Math.hypot(p.x,p.z)*.7};});
  candidates.sort((a,b)=>b.priority-a.priority);
  for(const candidate of candidates.slice(0,Math.min(4,this.entities.size-95))){this.remove(candidate.entity);this.debrisRecycled++;}
 }
 private spawnTraffic(laneOverride?:number,surge=false):number{
  // Consume the entire candidate before occupancy checks. A blocked arrival cannot
  // shift the subsequent vehicle roster, and green-light surges have their own plan.
  const candidate=(surge?this.surgePlan:this.trafficPlan).next(laneOverride);
  this.trafficCandidates++;
  const {lane,kind,interval}=candidate;if(this.entities.size>115)return interval;
  const coords=[{x:-65,z:-3,dx:1,dz:0},{x:65,z:3,dx:-1,dz:0},{x:3,z:-64,dx:0,dz:1},{x:-3,z:64,dx:0,dz:-1}];const r={...coords[lane]};if(kind==='tram')r.x=TRAM_TRACK_X;
  for(const e of this.entities.values()){const p=e.body.translation();if(Math.hypot(p.x-r.x,p.z-r.z)<10)return interval;}
  const e=this.vehicle(kind,r.x,r.z,r.dx,r.dz);if(surge)e.speed*=1.25;
  this.trafficSpawned++;
  if(kind==='magnet'||kind==='booster'||kind==='tanker')this.emit('warning',e.body.translation(),1,`${VEHICLES[kind].name}驶入！`);
  return interval;
 }
 private hit(e:Entity,damage:number){
  if(e.player){e.wrecked=true;e.body.setEnabledRotations(true,true,true,true);return;}
  e.health=Math.max(0,e.health-damage);
  if(damage>=5){
   e.lastInteraction=this.age;
   e.wrecked=true;if(e.body.bodyType()===RAPIER.RigidBodyType.Fixed)e.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
   e.body.setEnabledRotations(true,true,true,true);e.body.setAngularDamping(.65);e.body.wakeUp();
   if(e.kind==='tram')e.body.setEnabledTranslations(true,true,true,true);
   const points=this.scores.reward(e.id,'hit',e.value,e.kind);if(points)this.emit('score',e.body.translation(),.5,`+${points.toLocaleString()}`);
   if(!e.triggered&&!e.scale)this.special(e);
  }
  if(e.health<=0&&!e.destroyed){e.destroyed=true;const points=this.scores.reward(e.id,'destroy',e.value,e.kind);if(points)this.emit('score',e.body.translation(),1,`+${points.toLocaleString()}`);this.emit('impact',e.body.translation(),.7);}
 }
 private special(e:Entity){
  e.triggered=true;const p=e.body.translation();
  if(e.kind==='tanker'){e.fuse=2.5;this.emit('special',p,1,'罐车即将引爆！');}
  if(e.kind==='van'){for(let i=0;i<4;i++){const c=this.prop('crate',p.x+(this.physicsRand()-.5)*3,p.z+(this.physicsRand()-.5)*3,{x:1.2,y:1.2,z:1.2},90,800,0,2);c.wrecked=true;c.body.setLinvel({x:(this.physicsRand()-.5)*14,y:5,z:(this.physicsRand()-.5)*14},true);}this.emit('special',p,1,'货物散落');}
  if(e.kind==='carrier'){for(let i=0;i<2;i++){const c=this.vehicle('compact',p.x+(i-.5)*3,p.z+(i-.5)*4,1,0,false,4);c.wrecked=true;c.body.setEnabledRotations(true,true,true,true);c.body.setLinvel({x:(i-.5)*14,y:4,z:3},true);}this.emit('special',p,1,'小车滚落！');}
  if(e.kind==='booster'){e.body.applyImpulse({x:e.direction.x*e.mass*28,y:e.mass*4,z:e.direction.z*e.mass*28},true);this.emit('special',p,1,'二次推进！');}
  if(e.kind==='magnet'){this.emit('special',p,1,'磁场启动');}
  if(e.kind==='semi'){e.body.applyTorqueImpulse({x:e.mass*.2,y:e.mass*3,z:e.mass*.8},true);this.emit('special',p,.8,'重卡横封！');}
 }
 blast(){
  const hero=this.entities.get(this.playerId);if(!hero||this.phase!=='running'||this.blastCharge<1)return false;
  this.blastCharge=0;hero.wrecked=true;hero.body.setEnabledRotations(true,true,true,true);
  const radius=this.config.car==='semi'?17:13;this.explode(hero,radius,1);
  let up=this.config.blast==='leap'?19:11;let forward=this.config.blast==='focused'?22:13;
  if(this.config.passive==='elastic')up*=1.25;if(this.config.passive==='heavy'){up*=.72;forward*=.8;}
  hero.body.setLinvel({x:this.aim.x*forward,y:up,z:this.aim.z*forward},true);hero.body.setAngvel({x:this.aim.z*1.6,y:.8,z:-this.aim.x*1.6},true);
  return true;
 }
 private explode(source:Entity,radius:number,power:number){
  const p=source.body.translation();this.emit('explosion',p,power,source.player?'CRASHBREAKER!':'CHAIN REACTION!');
  const affected=[...this.entities.values()];
  for(const e of affected){if(e.id===source.id)continue;const q=e.body.translation();const dx=q.x-p.x,dz=q.z-p.z,dy=q.y-p.y;const distance=Math.hypot(dx,dz,dy*.5);if(distance>radius)continue;
   const direction=distance>.1?{x:dx/distance,z:dz/distance}:{x:1,z:0};
   const cone=source.player&&this.config.blast==='focused'?clamp((direction.x*this.aim.x+direction.z*this.aim.z+.2)*1.6,.12,1.8):1;
   const force=(1-distance/radius)*power*cone;this.hit(e,Math.max(8,force*95));
   const mass=e.mass;e.body.applyImpulse({x:direction.x*mass*force*18,y:mass*force*9,z:direction.z*mass*force*18},true);
   e.body.applyTorqueImpulse({x:mass*force*2*(this.physicsRand()-.5),y:mass*force*2,z:mass*force*2*(this.physicsRand()-.5)},true);
  }
 }
 private remove(e:Entity){this.entities.delete(e.id);this.byCollider.delete(e.collider.handle);this.preVelocity.delete(e.id);this.world.removeRigidBody(e.body);}
 diagnostics(){return {entities:this.entities.size,trafficCandidates:this.trafficCandidates,trafficSpawned:this.trafficSpawned,debrisRecycled:this.debrisRecycled};}
 snapshot():GameSnapshot {
  const entities:RenderEntity[]=[];
  for(const e of this.entities.values()){entities.push({id:e.id,kind:e.kind,p:{...e.body.translation()},q:{...e.body.rotation()},v:{...e.body.linvel()},damage:1-e.health/e.maxHealth,destroyed:e.destroyed,player:e.player,active:e.wrecked,scale:e.scale,fuse:e.fuse});}
  return {phase:this.phase,time:this.time,score:this.scores.score,combo:this.scores.combo,comboTime:this.scores.comboTime,bestCombo:this.scores.bestCombo,crashes:this.scores.crashes,destroyed:this.scores.destroyed,blastCharge:this.blastCharge,interventions:this.interventions,slowMotion:this.slowMotion,aim:this.aim,playerId:this.playerId,entities,events:[...this.events],config:{...this.config},notice:this.notice,challengeProgress:[Math.min(1,this.scores.crashes/30),Math.min(1,this.scores.bestCombo/12),this.mechanismsUsed/3]};
 }
 result():RunResult{return {score:this.scores.score,bestCombo:this.scores.bestCombo,crashes:this.scores.crashes,destroyed:this.scores.destroyed,config:{...this.config},medal:medalFor(this.scores.score),challenges:challengeFlags(this.scores.crashes,this.scores.bestCombo,this.mechanismsUsed),timestamp:Date.now()};}
 dispose(){this.collisions.free();this.world.free();this.entities.clear();}
}
