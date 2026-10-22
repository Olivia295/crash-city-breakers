import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createModel,createWreckModel,createRoadtrainCab} from './models.ts';
import {applyPaint} from './paint';
import {paintById} from '../simulation/perks';
import {buildWorld,createBuilding,roadLabel} from './world.ts';
import {VEHICLES,PLAYER_ABILITIES,type GameSnapshot,type GameEvent,type ModelKind,type RenderEntity,type RouteId,type CityId,type Settings,type Vec3,type Feature,type VehicleKind,type Language} from '../shared.ts';
import {getCity,cityGroundHeight,cityRoadSlope,cityRoutes} from '../cities.ts';
import {translate} from '../i18n';

interface EntityView {object:THREE.Group;material:THREE.MeshStandardMaterial[];damage:number;kind:ModelKind;stage:number;wreck:boolean;detached:boolean;frozen:boolean;burning:boolean;}
interface Particle {alive:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;color:THREE.Color;smoke:boolean;}
interface Debris {alive:boolean;age:number;life:number;p:THREE.Vector3;v:THREE.Vector3;rotation:THREE.Vector3;spin:THREE.Vector3;scale:THREE.Vector3;color:THREE.Color;}
interface Ring {mesh:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;age:number;life:number;radius:number;alive:boolean;}
interface Floater {el:HTMLDivElement;p:THREE.Vector3;age:number;life:number;big:boolean;key:string;}
interface Fireball {alive:boolean;age:number;life:number;p:THREE.Vector3;size:number;}
const SPECIAL_TARGETS:Partial<Record<VehicleKind,{text:string;color:string;priority:number}>>={
 pizza:{text:'披萨车 · 撞毁抽奖',color:'#ffd765',priority:100},ambulance:{text:'救护车 · 放行减罚',color:'#a6ffcb',priority:95},
 bank:{text:'运钞车 · 炸出钱袋',color:'#ffe59b',priority:85},tanker:{text:'罐车 · 连锁爆炸',color:'#ffad71',priority:75},
 icecream:{text:'冰淇淋车 · 冻结交通',color:'#a7eaff',priority:80},missile:{text:'导弹车 · 远程爆破',color:'#f5c4ff',priority:80},
 bulldozer:{text:'推土机 · 清除路障',color:'#ffdc7a',priority:65},doubledecker:{text:'双层巴士 · 侧翻封路',color:'#ff9da7',priority:50},
 roadtrain:{text:'双挂重卡 · 撞断挂车',color:'#81dfff',priority:55},
};

/** Renderer is a read-only adapter: all collisions, scoring and progress remain in the simulation. */
export class GameRenderer {
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-60,60,40,-40,.1,400);
  private models=new Map<ModelKind,THREE.Group>();
  private wreckModels=new Map<VehicleKind,THREE.Group>();
  private detachedCabModels=new Map<boolean,THREE.Group>();
  private buildingModels=new Map<string,THREE.Group>();
  private views=new Map<number,EntityView>();
  private world=new THREE.Group();
  private target=new THREE.Vector3(0,0,-2);
  private desiredTarget=new THREE.Vector3();
  private cameraOffset=new THREE.Vector3(0,138,80);
  private direction=new THREE.Vector3();
  private screen=new THREE.Vector3();
  private raycaster=new THREE.Raycaster();
  private pointer=new THREE.Vector2();
  private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private intersect=new THREE.Vector3();
  private overlay:HTMLDivElement;
  private playerMarker:HTMLDivElement;
  private playerMarkerArrow:HTMLSpanElement;
  private playerMarkerText:HTMLSpanElement;
  private specialMarkers:HTMLDivElement[]=[];
  private specialRings:THREE.InstancedMesh;
  private language:Language='zh';
  private floaters:Floater[]=[];
  private floaterPool:HTMLDivElement[]=[];
  private seenEvents=new Set<number>();
  private particleMesh:THREE.InstancedMesh;
  private smokeMesh:THREE.InstancedMesh;
  private fireballMesh:THREE.InstancedMesh;
  private fireballs:Fireball[]=[];
  private fireballCursor=0;
  private effectColor=new THREE.Color();
  private debrisMesh:THREE.InstancedMesh;
  private debris:Debris[]=[];
  private debrisCursor=0;
  private scorchMesh:THREE.InstancedMesh;
  private scorchCursor=0;
  private smokeTexture:THREE.CanvasTexture;
  private fireTexture:THREE.CanvasTexture;
  private scorchTexture:THREE.CanvasTexture;
  private featureGroup=new THREE.Group();
  private featureObjects=new Map<Feature,THREE.Group>();
  private feature:'none'|Feature='none';
  private featureAge=0;
  private featureCenter=new THREE.Vector3();
  private flash:HTMLDivElement;
  private flashAmount=0;
  private effectCenter=new THREE.Vector3();
  private featureLastTime=0;
  private particles:Particle[]=[];
  private particleCursor=0;
  private rings:Ring[]=[];
  private ringCursor=0;
  private dummy=new THREE.Object3D();
  private playerRing:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
  private aimLine:THREE.Mesh;
  private aimHead:THREE.Mesh;
  private routeLine=new THREE.Group();
  private clock=0;
  private shake=0;
  private fps=60;
  private frustum=82;
  private route:RouteId='hill';
  private city:CityId='sf';
  private playerKind:VehicleKind='compact';private paintColor=0;
  private quality:Settings['quality']='high';
  private lastPhase='ready';
  private lastTime=0;
  private width=1;
  private height=1;
  private loaded=false;
  private disposed=false;
  private sun:THREE.DirectionalLight;
  private resizeObserver:ResizeObserver;
  private contextLost=false;
  private onContextLost=(event:Event)=>{event.preventDefault();this.contextLost=true;};
  private onContextRestored=()=>{this.contextLost=false;this.resize();};

  constructor(private container:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.setClearColor(0xb5dacc);
    this.renderer.domElement.setAttribute('aria-label','旧金山海湾立体交通路口');
    this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none;';
    this.renderer.domElement.addEventListener('webglcontextlost',this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.onContextRestored);
    container.append(this.renderer.domElement);
    this.overlay=document.createElement('div');this.overlay.className='world-fx';this.overlay.setAttribute('aria-hidden','true');
    this.overlay.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;';container.append(this.overlay);
    this.flash=document.createElement('div');this.flash.style.cssText='position:absolute;inset:0;background:#fff4d2;opacity:0;pointer-events:none;mix-blend-mode:screen;';this.overlay.append(this.flash);
    this.playerMarker=document.createElement('div');this.playerMarker.className='player-marker';
    this.playerMarker.style.cssText='position:absolute;display:none;left:0;top:0;align-items:center;gap:6px;padding:5px 9px;background:#243f3df2;border:1px solid #ffe19a;border-radius:3px;color:#ffdfa0;font:700 12px Arial,"PingFang SC",sans-serif;letter-spacing:1px;box-shadow:0 2px 12px #10262566;white-space:nowrap;will-change:transform;';
    this.playerMarkerArrow=document.createElement('span');this.playerMarkerArrow.textContent='➤';this.playerMarkerArrow.style.cssText='display:inline-block;font-size:13px;';
    this.playerMarkerText=document.createElement('span');this.playerMarkerText.textContent='你的车';this.playerMarker.append(this.playerMarkerArrow,this.playerMarkerText);this.overlay.append(this.playerMarker);
    for(let i=0;i<3;i++){
      const marker=document.createElement('div');marker.className='special-vehicle-marker';marker.style.cssText='position:absolute;display:none;padding:4px 8px;border:1px solid currentColor;border-left-width:3px;border-radius:3px;background:#17282ae6;font:800 11px Arial,"PingFang SC",sans-serif;white-space:nowrap;box-shadow:0 2px 9px #10202066;will-change:transform;';this.overlay.append(marker);this.specialMarkers.push(marker);
    }
    const targetGeometry=new THREE.RingGeometry(.88,1,32);targetGeometry.rotateX(-Math.PI/2);
    this.specialRings=new THREE.InstancedMesh(targetGeometry,new THREE.MeshBasicMaterial({transparent:true,opacity:.67,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),6);this.specialRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.specialRings.count=0;this.specialRings.frustumCulled=false;this.scene.add(this.specialRings);
    this.scene.background=new THREE.Color(0x8db8ad);this.scene.fog=new THREE.Fog(0x8db8ad,235,360);
    this.scene.add(new THREE.HemisphereLight(0xfff7e1,0x617557,2));
    this.sun=new THREE.DirectionalLight(0xffeed1,3.3);this.sun.position.set(-38,88,-26);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:180});
    this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.25;this.sun.shadow.radius=3;this.scene.add(this.sun);this.scene.add(this.sun.target);
    const fill=new THREE.DirectionalLight(0xa6e6dd,.8);fill.position.set(38,20,-24);this.scene.add(fill);
    this.smokeTexture=this.radialTexture('smoke');this.fireTexture=this.radialTexture('fire');this.scorchTexture=this.radialTexture('scorch');
    this.particleMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.fireTexture,color:0xffffff,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),320);
    this.smokeMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.smokeTexture,color:0xffffff,transparent:true,opacity:.68,depthWrite:false,toneMapped:false}),320);
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.smokeMesh.frustumCulled=false;this.smokeMesh.renderOrder=4;this.scene.add(this.smokeMesh);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;this.particleMesh.count=320;this.scene.add(this.particleMesh);
    for(let i=0;i<320;i++){this.particles.push({alive:false,age:0,life:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:1,color:new THREE.Color(),smoke:false});this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);this.smokeMesh.setMatrixAt(i,this.dummy.matrix);}
    this.fireballMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.fireTexture,color:0xffffff,transparent:true,opacity:.96,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),24);this.fireballMesh.frustumCulled=false;this.fireballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.fireballMesh);
    for(let i=0;i<24;i++){this.fireballs.push({alive:false,age:0,life:.45,p:new THREE.Vector3(),size:1});this.fireballMesh.setMatrixAt(i,this.dummy.matrix);}
    this.debrisMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:.82,metalness:.13}),320);this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.debrisMesh.frustumCulled=false;this.debrisMesh.castShadow=true;this.debrisMesh.receiveShadow=true;this.scene.add(this.debrisMesh);
    for(let i=0;i<320;i++){this.debris.push({alive:false,age:0,life:30,p:new THREE.Vector3(),v:new THREE.Vector3(),rotation:new THREE.Vector3(),spin:new THREE.Vector3(),scale:new THREE.Vector3(),color:new THREE.Color()});this.debrisMesh.setMatrixAt(i,this.dummy.matrix);}
    this.scorchMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.scorchTexture,transparent:true,opacity:.76,depthWrite:false,color:0x33251d,polygonOffset:true,polygonOffsetFactor:-2}),64);this.scorchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scorchMesh.frustumCulled=false;this.scorchMesh.renderOrder=1;this.scene.add(this.scorchMesh);
    for(let i=0;i<64;i++)this.scorchMesh.setMatrixAt(i,this.dummy.matrix);
    this.scene.add(this.featureGroup);this.buildFeatureObjects();
    for(let i=0;i<12;i++){
      const mesh=new THREE.Mesh(new THREE.RingGeometry(.92,1,48),new THREE.MeshBasicMaterial({color:0xffd987,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;this.scene.add(mesh);this.rings.push({mesh,age:0,life:1,radius:10,alive:false});
    }
    this.playerRing=new THREE.Mesh(new THREE.RingGeometry(1.65,1.92,48),new THREE.MeshBasicMaterial({color:0xffdf8e,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}));this.playerRing.rotation.x=-Math.PI/2;this.playerRing.renderOrder=20;this.scene.add(this.playerRing);
    const arrowMaterial=new THREE.MeshBasicMaterial({color:0xffd781,transparent:true,opacity:.86,depthTest:false,depthWrite:false,toneMapped:false});
    this.aimLine=new THREE.Mesh(new THREE.BoxGeometry(.18,.055,1),arrowMaterial);this.scene.add(this.aimLine);
    this.aimHead=new THREE.Mesh(new THREE.ConeGeometry(.64,1.3,3),arrowMaterial);this.scene.add(this.aimHead);
    this.aimLine.renderOrder=21;this.aimHead.renderOrder=21;
    this.scene.add(this.routeLine);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.resize();this.updateCamera(1,false);
  }

  async init():Promise<void>{
    this.world=buildWorld();this.scene.add(this.world);
    this.world.add(roadLabel('STOP',3,-15,4.6));this.world.add(roadLabel('STOP',-7,15,4.6,Math.PI));
    this.world.add(roadLabel('STOP',-17,3,4.6,-Math.PI/2));this.world.add(roadLabel('STOP',17,-3,4.6,Math.PI/2));
    const loader=new GLTFLoader();
    const kinds=[...Object.keys(VEHICLES),'crate','barrier','sign','lamp','facade','money','trailer'] as ModelKind[];
    await Promise.all(kinds.map(async kind=>{
      if(['ambulance','bank','pizza','bulldozer','police','missile','icecream','money'].includes(kind)){this.models.set(kind,createModel(kind));return;}
      try{const asset=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${kind}.glb`);this.models.set(kind,asset.scene);}
      catch{this.models.set(kind,createModel(kind));}
    }));
    this.loaded=true;this.setOverview(this.route);
  }

  private floor(x:number,z:number){return cityGroundHeight(this.city,x,z);}
  private replaceCityWorld(){
    this.scene.remove(this.world);
    this.world.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const m of Array.isArray(object.material)?object.material:[object.material]){const material=m as THREE.MeshStandardMaterial;material.map?.dispose();material.dispose();}}});
    for(const id of this.views.keys())this.removeView(id);
    this.world=buildWorld(this.city);this.scene.add(this.world);
    const city=getCity(this.city);this.scene.background=new THREE.Color(city.sky);this.scene.fog=new THREE.Fog(city.sky,235,360);
    this.sun.color.set(this.city==='london'?0xdde6ff:0xffeed1);this.sun.intensity=this.city==='london'?2.8:3.3;
    this.updateWorldLabel();
    this.target.set(city.center.x,0,city.center.z);this.clearEffects();
  }

  private updateWorldLabel(){
    const city=getCity(this.city);
    this.renderer.domElement.setAttribute('aria-label',`${translate(city.name,this.language)} · ${translate(city.district,this.language)} · ${this.language==='en'?'3D crash scene':'三维交通现场'}`);
  }

  setOverview(route:RouteId,city:CityId='sf'):void{
    if(this.city!==city){this.city=city;this.replaceCityWorld();}
    this.route=route;const entry=cityRoutes(city).find(r=>r.id===route)!;
    this.clearEffects();
    const oldMaterials=new Set<THREE.Material>();
    this.routeLine.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();for(const material of Array.isArray(child.material)?child.material:[child.material])oldMaterials.add(material);}});
    oldMaterials.forEach(material=>material.dispose());
    this.routeLine.clear();
    const mat=new THREE.MeshBasicMaterial({color:entry.color,transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
    for(let t=0;t<7;t++){
      const x=entry.x+entry.dx*(8+t*5),z=entry.z+entry.dz*(8+t*5);
      const shape=new THREE.Shape();shape.moveTo(-.62,-.48);shape.lineTo(0,.42);shape.lineTo(.62,-.48);shape.lineTo(.4,-.66);shape.lineTo(0,-.08);shape.lineTo(-.4,-.66);shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);mesh.rotation.set(-Math.PI/2,0,Math.atan2(entry.dx,entry.dz));mesh.position.set(x,this.floor(x,z)+.12,z);this.routeLine.add(mesh);
    }
  }

  render(snapshot:GameSnapshot,dt:number,settings:Settings):void{
    if(this.disposed||this.contextLost)return;
    if(this.language!==settings.language){this.language=settings.language;this.playerMarkerText.textContent=translate('你的车',this.language);this.updateWorldLabel();for(const f of this.floaters)f.age=f.life;}
    this.playerKind=snapshot.config.car;this.paintColor=paintById(snapshot.config.paint).color;
    if((snapshot.config.city??'sf')!==this.city)this.setOverview(snapshot.config.route,snapshot.config.city);
    dt=Math.min(.06,Math.max(0,dt));this.clock+=dt;if(dt>.001)this.fps+=(1/dt-this.fps)*.035;
    if(snapshot.phase==='ready'&&(this.lastPhase!=='ready'||snapshot.time<this.lastTime))this.clearEffects();
    this.lastPhase=snapshot.phase;this.lastTime=snapshot.time;
    if(this.quality!==settings.quality){this.quality=settings.quality;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,settings.quality==='high'?1.65:1));this.renderer.shadowMap.enabled=settings.quality==='high';this.resize();}
    if(this.loaded){
      const alive=new Set<number>();let smokeBudget=this.quality==='high'?4:2;
      for(const entity of snapshot.entities){
        alive.add(entity.id);let view=this.views.get(entity.id);
        const stage=entity.kind==='building'?(entity.stage??(entity.destroyed?3:Math.floor(entity.damage*3))):0;
        const wreck=entity.kind in VEHICLES&&entity.damage>.64;
        const detached=entity.kind==='roadtrain'&&entity.active;
        if(view&&(view.kind!==entity.kind||view.stage!==stage||view.wreck!==wreck||view.detached!==detached)){
          if(snapshot.phase==='running'&&(stage>view.stage||wreck&&!view.wreck)){
            this.emitDebris(entity.p,entity.kind==='building'?28:11,entity.kind==='building'?0xc6b99a:VEHICLES[entity.kind as VehicleKind].color,entity.kind==='building',entity.v);
            this.addScorch(entity.p,entity.kind==='building'?(entity.scale?.x??14)*.72:3.5);
            if(entity.kind==='building')for(let i=0;i<8;i++)this.emitParticle(entity.p.x+(Math.random()-.5)*8,this.floor(entity.p.x,entity.p.z)+1,entity.p.z+(Math.random()-.5)*8,0,1.5,0,2.6,3.2,0xbdb49d,true);
          }
          this.removeView(entity.id);view=undefined;
        }
        if(!view){view=this.createView(entity);this.views.set(entity.id,view);this.scene.add(view.object);}
        const {object}=view;object.visible=true;object.position.set(entity.p.x,entity.kind==='building'?this.floor(entity.p.x,entity.p.z)+(entity.scale?.y??1)/2:entity.p.y,entity.p.z);object.quaternion.set(entity.q.x,entity.q.y,entity.q.z,entity.q.w);
        if(entity.scale)object.scale.set(entity.scale.x,entity.scale.y,entity.scale.z);else object.scale.setScalar(1);
        const damage=Math.max(0,Math.min(1,entity.damage));
        if(entity.kind in VEHICLES&&!wreck)object.scale.y*=1-damage*.16;
        const burning=(entity.fuse!==undefined&&entity.fuse>0)||(entity.burning??0)>0;
        if(Math.abs(damage-view.damage)>.02||burning||entity.destroyed||entity.frozen||view.frozen!==!!entity.frozen||view.burning!==burning||entity.kind==='police'){
          view.damage=damage;view.frozen=!!entity.frozen;view.burning=burning;for(const material of view.material){
            const shade=wreck?.96:entity.kind==='building'?1-damage*.22:1-damage*.3;material.color.setRGB(shade,shade*(1-damage*.06),shade*(1-damage*.1));
            if(entity.frozen)material.color.set(0x9ad9ef);
            material.emissive.set(entity.frozen?0x154a63:burning&&Math.sin(this.clock*17)>0?0xdf4814:wreck?0x511100:entity.kind==='police'?(Math.sin(this.clock*14)>0?0x660c07:0x06236b):0x000000);material.emissiveIntensity=burning?.8:wreck?.75:1;
          }
        }
        if(snapshot.phase==='running'&&entity.active&&smokeBudget>0&&(damage>.55||entity.destroyed||burning)&&!entity.frozen&&Math.random()<dt*(burning?11:4)){
          const big=entity.kind==='building',px=entity.p.x+(Math.random()-.5)*(big?9:1),pz=entity.p.z+(Math.random()-.5)*(big?9:1),py=big?this.floor(px,pz)+.7:entity.p.y+.6;
          smokeBudget--;this.emitParticle(px,py,pz,.5,2,.2,big?2.4:1.05,big?3:2.2,big?0x625d52:0x272a29,true);
          if(entity.destroyed||burning)this.emitParticle(px,py,pz,(Math.random()-.5)*.5,1.6,0,big?1.8:1,.65,0xff9e32,false);
        }
      }
      for(const id of this.views.keys())if(!alive.has(id))this.removeView(id);
    }
    for(const event of snapshot.events)if(!this.seenEvents.has(event.id)){this.seenEvents.add(event.id);if(snapshot.phase!=='ready')this.handleEvent(event);}
    const player=snapshot.entities.find(e=>e.id===snapshot.playerId);
    const running=snapshot.phase==='running'||snapshot.phase==='paused';
    if(player){
      this.desiredTarget.set(THREE.MathUtils.clamp(player.p.x*.28,-18,18),Math.max(0,player.p.y*.08),THREE.MathUtils.clamp(player.p.z*.27,-18,18));
      if(!running){const center=getCity(this.city).center;this.desiredTarget.set(center.x,0,center.z-3);}
      this.target.lerp(this.desiredTarget,Math.min(1,dt*(running?3.7:1.5)));
      const py=this.floor(player.p.x,player.p.z)+.14;
      this.playerRing.position.set(player.p.x,py,player.p.z);this.playerRing.scale.setScalar(1+Math.sin(this.clock*4)*.045);
      this.playerRing.material.opacity=snapshot.blastCharge>=1?1:.86;
      this.direction.set(snapshot.aim.x,0,snapshot.aim.z);
      if(this.direction.lengthSq()<.2)this.direction.set(0,0,1);this.direction.normalize();
      const arrowLength=3.8;this.aimLine.position.set(player.p.x+this.direction.x*3.5,py+.05,player.p.z+this.direction.z*3.5);this.aimLine.rotation.y=Math.atan2(this.direction.x,this.direction.z);this.aimLine.scale.z=arrowLength;
      this.aimHead.position.set(player.p.x+this.direction.x*5.6,py+.12,player.p.z+this.direction.z*5.6);this.aimHead.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),this.direction);
    }
    this.playerRing.visible=!!player&&snapshot.phase!=='ended';this.aimLine.visible=!!player&&running;this.aimHead.visible=!!player&&running;
    this.routeLine.visible=snapshot.phase==='ready';
    const cityZone=this.world.getObjectByName('city-event-zone') as THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>|undefined;
    if(cityZone){cityZone.visible=running&&!snapshot.cityEvent?.triggered;cityZone.material.opacity=.17+(snapshot.cityEvent?.progress??0)*.32+Math.sin(this.clock*3)*.06;}
    if(player&&snapshot.phase==='running'&&snapshot.abilityActive>0){const color=new THREE.Color(PLAYER_ABILITIES[snapshot.config.car]?.color??'#ffffff').getHex();
      for(let i=0;i<2;i++){const a=this.clock*7+i*Math.PI,r=snapshot.config.car==='compact'?2+(snapshot.abilityActive%1)*10:3;this.emitParticle(player.p.x+Math.cos(a)*r,player.p.y+.4,player.p.z+Math.sin(a)*r,snapshot.config.car==='sport'?-player.v.x*.1:-Math.cos(a)*4,2,snapshot.config.car==='sport'?-player.v.z*.1:-Math.sin(a)*4,.23,.35,color,false);}
    }
    const distance=player?Math.hypot(player.p.x,player.p.z):0;
    const finale=snapshot.roundStage==='finale'||snapshot.feature==='tornado';
    const desiredFrustum=running?THREE.MathUtils.clamp((finale?86:90)+Math.max(0,distance-36)*.32,86,110):102;
    this.frustum+=(desiredFrustum-this.frustum)*Math.min(1,dt*2.4);
    this.updateCamera(dt,settings.shake&&running);
    this.updatePlayerMarker(player,running);
    this.updateSpecialTargets(snapshot);
    this.updateFeature(snapshot,dt);this.updateEffects(dt,snapshot.phase==='paused');this.updateFloaters(dt);
    this.flashAmount=Math.max(0,this.flashAmount-dt*2.3);this.flash.style.opacity=String(settings.shake?this.flashAmount:Math.min(.12,this.flashAmount));
    this.renderer.render(this.scene,this.camera);
  }

  private createView(entity:RenderEntity):EntityView{
    const stage=entity.kind==='building'?(entity.stage??(entity.destroyed?3:Math.floor(entity.damage*3))):0,wreck=entity.kind in VEHICLES&&entity.damage>.64;
    const detached=entity.kind==='roadtrain'&&entity.active;
    let source:THREE.Group;
    if(entity.kind==='building'){
      const key=`${this.city}:${entity.buildingIndex??0}:${stage}`;source=this.buildingModels.get(key)!;
      if(!source){source=createBuilding(entity.buildingIndex??0,stage,this.city);this.buildingModels.set(key,source);}
    }else if(detached){
      source=this.detachedCabModels.get(wreck)!;
      if(!source){source=createRoadtrainCab(wreck);this.detachedCabModels.set(wreck,source);}
    }else if(wreck){
      const kind=entity.kind as VehicleKind;source=this.wreckModels.get(kind)!;
      if(!source){source=createWreckModel(kind);this.wreckModels.set(kind,source);}
    }else source=this.models.get(entity.kind)??createModel(entity.kind);
    const object=source.clone(true);if(entity.player&&!wreck)applyPaint(object,entity.kind as VehicleKind,this.paintColor);const materials:THREE.MeshStandardMaterial[]=[];
    object.traverse(child=>{if(child instanceof THREE.Mesh){child.castShadow=true;child.receiveShadow=true;const original=child.material as THREE.MeshStandardMaterial;child.material=original.clone();materials.push(child.material as THREE.MeshStandardMaterial);}});
    return {object,material:materials,damage:-1,kind:entity.kind,stage,wreck,detached,frozen:false,burning:false};
  }

  private removeView(id:number):void{const view=this.views.get(id);if(view){this.scene.remove(view.object);view.material.forEach(m=>m.dispose());this.views.delete(id);}}

  private updateCamera(dt:number,allowShake:boolean):void{
    this.shake=Math.max(0,this.shake-dt*2.7);
    this.camera.position.copy(this.target).add(this.cameraOffset);
    if(allowShake&&this.shake>0){this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.z+=(Math.random()-.5)*this.shake;}
    this.camera.lookAt(this.target);const aspect=this.width/this.height;
    const span=aspect<1?this.frustum*1.28:this.frustum;
    this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  }

  private radialTexture(kind:'fire'|'smoke'|'scorch'):THREE.CanvasTexture{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d')!;
    const gradient=c.createRadialGradient(64,64,kind==='scorch'?5:0,64,64,62);
    if(kind==='fire'){gradient.addColorStop(0,'rgba(255,255,244,1)');gradient.addColorStop(.2,'rgba(255,255,255,.96)');gradient.addColorStop(.47,'rgba(255,255,255,.5)');gradient.addColorStop(1,'rgba(255,255,255,0)');}
    else {gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.38,'rgba(255,255,255,.74)');gradient.addColorStop(.7,'rgba(255,255,255,.27)');gradient.addColorStop(1,'rgba(255,255,255,0)');}
    c.fillStyle=gradient;c.fillRect(0,0,128,128);
    if(kind==='scorch')for(let i=0;i<22;i++){const angle=i*2.399,r=26+Math.sin(i*13)*10;c.fillStyle='rgba(255,255,255,.19)';c.beginPath();c.ellipse(64+Math.cos(angle)*r,64+Math.sin(angle)*r,10+i%5,6+i%7,angle,0,Math.PI*2);c.fill();}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }

  private addScorch(p:Vec3,radius:number):void{
    const i=this.scorchCursor++%64;this.dummy.position.set(p.x,this.floor(p.x,p.z)+.092,p.z);this.dummy.rotation.set(-Math.PI/2-Math.atan(cityRoadSlope(this.city,p.z)),0,Math.random()*Math.PI*2);this.dummy.scale.set(radius*2,radius*(1.5+Math.random()*.6),1);this.dummy.updateMatrix();this.scorchMesh.setMatrixAt(i,this.dummy.matrix);this.scorchMesh.instanceMatrix.needsUpdate=true;
  }

  private emitDebris(p:Vec3,count:number,color:number,masonry=false,velocity:Vec3={x:0,y:0,z:0}):void{
    for(let i=0;i<count;i++){
      const d=this.debris[this.debrisCursor++%this.debris.length],angle=Math.random()*Math.PI*2,speed=(masonry?3:4)+Math.random()*(masonry?8:10);
      d.alive=true;d.age=0;d.life=masonry?55:35;d.p.set(p.x+(Math.random()-.5)*(masonry?9:1),p.y+(Math.random()-.5),p.z+(Math.random()-.5)*(masonry?9:1));d.v.set(Math.cos(angle)*speed+velocity.x*.3,3+Math.random()*8,Math.sin(angle)*speed+velocity.z*.3);
      d.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);d.spin.set((Math.random()-.5)*11,(Math.random()-.5)*11,(Math.random()-.5)*11);
      const size=(masonry?.6:.35)+Math.random()*(masonry?1.1:.65);d.scale.set(size,(masonry?.35:.11)+Math.random()*.24,size*(masonry?.7:1.4));d.color.set(i%5===0?0x303735:i%4===0?0xd0c7b5:color);
    }
  }

  private buildFeatureObjects():void{
    const add=(feature:Feature)=>{const g=new THREE.Group();g.name=feature;g.visible=false;this.featureObjects.set(feature,g);this.featureGroup.add(g);return g;};
    const tornado=add('tornado'),cloud=new THREE.MeshBasicMaterial({color:0x968f7c,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
    const cone=new THREE.Mesh(new THREE.ConeGeometry(8.4,23,32,8,true),cloud);cone.rotation.z=Math.PI;cone.position.y=11.5;tornado.add(cone);
    for(let i=0;i<18;i++){
      const radius=.7+Math.pow(i/17,.87)*7.6,ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.26+i*.009,5,32),new THREE.MeshBasicMaterial({color:i%2?0xb1a78c:0x796f5d,transparent:true,opacity:.26,depthWrite:false}));
      ring.rotation.x=Math.PI/2;ring.position.set(Math.sin(i*.8)*.3,i*1.28,Math.cos(i*.7)*.3);ring.scale.y=.78;tornado.add(ring);
    }
    const wave=add('tidalwave'),waterMat=new THREE.MeshStandardMaterial({color:0x198daa,roughness:.27,metalness:.25,transparent:true,opacity:.88});
    const water=new THREE.Mesh(new THREE.CylinderGeometry(7,7,66,24,1,true,0,Math.PI*1.1),waterMat);water.rotation.set(0,0,Math.PI/2);water.position.y=1.8;wave.add(water);
    const foam=new THREE.Mesh(new THREE.BoxGeometry(67,.5,1.1),new THREE.MeshBasicMaterial({color:0xd4f6ed,transparent:true,opacity:.85}));foam.position.set(0,8.5,-.4);wave.add(foam);
    const ufo=add('ufo');const saucer=new THREE.Mesh(new THREE.SphereGeometry(5.8,24,10),new THREE.MeshStandardMaterial({color:0x738087,metalness:.8,roughness:.3}));saucer.scale.y=.2;saucer.position.y=17;ufo.add(saucer);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(2.65,16,10),new THREE.MeshStandardMaterial({color:0x86dabd,emissive:0x245a43,roughness:.24,metalness:.35}));dome.scale.y=.65;dome.position.y=18;ufo.add(dome);
    const beam=new THREE.Mesh(new THREE.ConeGeometry(5.2,16,24,1,true),new THREE.MeshBasicMaterial({color:0x8affe1,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));beam.position.y=8;ufo.add(beam);
    const asteroid=add('asteroid');const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(3.2,1),new THREE.MeshStandardMaterial({color:0x573c28,emissive:0xbc370b,emissiveIntensity:.65,roughness:.88}));asteroid.add(rock);
    const monster=add('monster'),skin=new THREE.MeshStandardMaterial({color:0x617c3e,roughness:.82});
    const shape=(g:THREE.BufferGeometry,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const mesh=new THREE.Mesh(g,skin);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;monster.add(mesh);return mesh;};
    shape(new THREE.IcosahedronGeometry(3.6,1),0,5.7,0,1,1.1,.83);shape(new THREE.IcosahedronGeometry(2.5,1),0,10,1.4,1,.75,1.18);
    for(const x of [-2.5,2.5]){shape(new THREE.BoxGeometry(2.1,4.5,2.4),x,2.5,0);shape(new THREE.BoxGeometry(2.5,1,4.2),x,.65,1);shape(new THREE.BoxGeometry(1.3,4,1.5),x*1.65,6.4,1);}
    const tail=shape(new THREE.ConeGeometry(1.8,9,7),0,2.8,-5);tail.rotation.x=-Math.PI*.43;
    for(const x of [-.95,.95]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),new THREE.MeshBasicMaterial({color:0xffd761}));eye.position.set(x,10.6,3.45);monster.add(eye);}
    const airstrike=add('airstrike');for(let i=0;i<5;i++){const missile=new THREE.Mesh(new THREE.ConeGeometry(.23,3.5,8),new THREE.MeshBasicMaterial({color:0xffdba0}));missile.rotation.z=Math.PI;missile.position.set((i-2)*4,18+i*4,Math.sin(i*3)*6);airstrike.add(missile);}
  }

  private updateFeature(snapshot:GameSnapshot,dt:number):void{
    const active=snapshot.featureTime>0?snapshot.feature:'none';
    if(active!==this.feature||(snapshot.featureTime>this.featureLastTime+1)){
      this.feature=active;this.featureAge=0;this.featureCenter.copy(this.effectCenter);
      if(this.featureCenter.lengthSq()<.01)this.featureCenter.set(0,0,0);
      for(const [kind,object]of this.featureObjects)object.visible=kind===active;
      if(active==='tornado')this.emitDebris(this.featureCenter,60,0xbcb09a,true);
    }
    this.featureLastTime=snapshot.featureTime;if(snapshot.phase==='paused'||snapshot.phase==='ready')return;
    this.featureAge+=dt;const age=this.featureAge;
    const object=this.featureObjects.get(active);if(object){
      object.position.copy(this.featureCenter);object.position.y=this.floor(object.position.x,object.position.z);
      if(active==='tornado'){
        object.position.x+=Math.sin(age*.55)*13;object.position.z+=Math.cos(age*.45)*10;object.rotation.y=age*3.5;
        this.featureCenter.y=object.position.y;
        if(Math.random()<dt*22)this.emitParticle(object.position.x+(Math.random()-.5)*12,object.position.y+2+Math.random()*18,object.position.z+(Math.random()-.5)*12,0,2,0,3.5,1.3,0xaca18b,true);
      }else if(active==='tidalwave'){object.position.z=-47+(age*12)%94;object.position.y=this.floor(0,object.position.z);}
      else if(active==='ufo'){object.position.x+=Math.sin(age*.6)*14;object.position.z+=Math.cos(age*.5)*12;object.rotation.y=age*.7;}
      else if(active==='asteroid'){object.position.y+=Math.max(0,35-(age%2.2)*22);object.rotation.set(age*1.5,age,age*.3);if(Math.random()<dt*18)this.emitParticle(object.position.x,object.position.y+2,object.position.z,0,3,0,3,1.1,0xff7c29,false);}
      else if(active==='monster'){object.position.x+=Math.sin(age*.22)*10;object.position.z+=Math.cos(age*.28)*10;object.rotation.y=Math.sin(age*.25)*.6;object.children[2].rotation.x=Math.sin(age*4)*.15;object.children[5].rotation.x=-Math.sin(age*4)*.15;}
      else if(active==='airstrike')object.children.forEach((child,i)=>{child.position.y=35-((age*24+i*7)%35);});
    }
  }

  private handleEvent(event:GameEvent):void{
    const {p}=event;
    if(event.effect&&event.effect!=='collapse')this.effectCenter.set(p.x,p.y,p.z);
    if(event.effect==='ability'||event.effect==='city'){
      const color=new THREE.Color(event.effect==='city'?getCity(this.city).color:PLAYER_ABILITIES[this.playerKind]?.color??'#ffffff');
      for(let i=0;i<22;i++){const a=i*Math.PI/11;this.emitParticle(p.x,p.y+1,p.z,Math.cos(a)*12,2+Math.random()*3,Math.sin(a)*12,.24,.65,color.getHex(),false);}
      this.shake=Math.max(this.shake,event.effect==='city'?.65:.28);
    }
    if(event.effect==='mega'){
      this.flashAmount=Math.max(this.flashAmount,.28+.1*event.power);this.shake=Math.max(this.shake,.45+.3*event.power);
      const ring=this.rings[this.ringCursor++%this.rings.length];ring.alive=true;ring.age=0;ring.life=.9;ring.radius=10+event.power*4;ring.mesh.position.set(p.x,this.floor(p.x,p.z)+.2,p.z);ring.mesh.material.color.set(0xffd24a);ring.mesh.visible=true;
    }
    if(event.effect==='perk'||event.effect==='contract'){const color=event.effect==='perk'?0x9fe8ff:0xffd24a;for(let i=0;i<18;i++){const a=i*Math.PI/9;this.emitParticle(p.x,p.y+1,p.z,Math.cos(a)*7,3+Math.random()*3,Math.sin(a)*7,.22,.6,color,false);}}
    if(event.effect==='collapse'){
      this.emitDebris(p,36,0xcbbd9f,true);this.addScorch(p,9);this.shake=Math.max(this.shake,.42);
      for(let i=0;i<14;i++)this.emitParticle(p.x+(Math.random()-.5)*12,this.floor(p.x,p.z)+1,p.z+(Math.random()-.5)*12,(Math.random()-.5)*3,2,(Math.random()-.5)*3,3,3.3,0xb4ac99,true);
    }else if(event.effect==='bank')this.emitDebris(p,18,0xefc34c,false);
    else if(event.effect==='pizza'){
      for(let i=0;i<16;i++)this.emitParticle(p.x,p.y+2,p.z,(Math.random()-.5)*7,5+Math.random()*5,(Math.random()-.5)*7,.55,1.1,i%3?0xf7d265:0xe74725,false);
    }else if(event.effect==='super'){
      this.flashAmount=.7;this.addScorch(p,17);this.emitDebris(p,36,0x8a7460,false);this.shake=2;
      for(let i=0;i<10;i++)this.emitParticle(p.x+(Math.random()-.5)*15,p.y+2,p.z+(Math.random()-.5)*15,(Math.random()-.5)*12,7+Math.random()*8,(Math.random()-.5)*12,5,.9,0xffaf46,false);
    }
    if(event.kind==='explosion'){
      const power=THREE.MathUtils.clamp(event.power,1,20),count=this.quality==='high'?28:14;
      this.flashAmount=Math.max(this.flashAmount,.2+Math.min(.22,power*.025));this.addScorch(p,3.6+power*.23);this.emitDebris(p,8,0x6e746b,false);
      this.shake=Math.max(this.shake,Math.min(1.45,.4+power*.07));
      const ring=this.rings[this.ringCursor++%this.rings.length];ring.alive=true;ring.age=0;ring.life=.72;ring.radius=8+power*.32;ring.mesh.position.set(p.x,this.floor(p.x,p.z)+.18,p.z);ring.mesh.material.color.set(event.color??0xffd27b);ring.mesh.visible=true;
      for(let i=0;i<3;i++){const b=this.fireballs[this.fireballCursor++%this.fireballs.length];b.alive=true;b.age=0;b.life=.32+i*.09;b.p.set(p.x+(Math.random()-.5)*2,p.y+1+i*.55,p.z+(Math.random()-.5)*2);b.size=i===0?2.7:1.6;}
      this.emitParticle(p.x,p.y+1.5,p.z,0,2,0,2.6,.23,0xffe5a3,false);
      for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=3+Math.random()*(6+power*.28);this.emitParticle(p.x,p.y+.4,p.z,Math.cos(angle)*speed,2+Math.random()*9,Math.sin(angle)*speed,.3+Math.random()*.65,.35+Math.random()*.4,i%3===0?0xffd86b:i%2?0xff8014:0xdd390a,false);}
      for(let i=0;i<10;i++)this.emitParticle(p.x+(Math.random()-.5)*4,p.y+1,p.z+(Math.random()-.5)*4,(Math.random()-.5)*3,2+Math.random()*3,(Math.random()-.5)*3,1.4+Math.random(),1.8+Math.random(),0x292a27,true);
      if(event.text)this.addFloater(event.text,p,event.color??'#ffe8a7',true);
    }else if(event.kind==='impact'){
      const count=Math.min(this.quality==='high'?14:7,4+Math.floor(event.power*.4));
      for(let i=0;i<count;i++)this.emitParticle(p.x,p.y+.4,p.z,(Math.random()-.5)*8,2+Math.random()*4,(Math.random()-.5)*8,.07+Math.random()*.12,.25+Math.random()*.45,i%2?0xffe3a4:0xf2ac61,false);
      if(event.power>8)this.shake=Math.max(this.shake,.14);
    }else if(event.kind==='score'||event.kind==='special'||event.kind==='mechanism'||event.kind==='warning'){
      if(event.text&&event.effect!=='mega')this.addFloater(event.text,p,event.color??(event.kind==='warning'?'#ffb097':event.kind==='score'?'#ffdfa1':'#adf4db'),event.kind!=='score');
      if((event.kind==='special'||event.kind==='mechanism')&&event.effect!=='tornado'&&event.effect!=='collapse'){
        const ring=this.rings[this.ringCursor++%this.rings.length];ring.alive=true;ring.age=0;ring.life=1;ring.radius=7;ring.mesh.position.set(p.x,this.floor(p.x,p.z)+.15,p.z);ring.mesh.material.color.set(event.color??0x8de5d4);ring.mesh.visible=true;
      }
    }else if(event.kind==='launch'){
      for(let i=0;i<12;i++)this.emitParticle(p.x,p.y,p.z,(Math.random()-.5)*4,1+Math.random()*2,(Math.random()-.5)*4,.25,.7,0xe4d5b2,true);
    }
  }

  private emitParticle(x:number,y:number,z:number,vx:number,vy:number,vz:number,size:number,life:number,c:number,smoke:boolean):void{
    const particle=this.particles[this.particleCursor++%this.particles.length];Object.assign(particle,{alive:true,age:0,life,x,y,z,vx,vy,vz,size,smoke});particle.color.set(c);
  }

  private updateEffects(dt:number,paused:boolean):void{
    const step=paused?0:dt;
    for(let i=0;i<this.fireballs.length;i++){
      const b=this.fireballs[i];if(b.alive){b.age+=step;const t=b.age/b.life;if(t>=1)b.alive=false;else{this.dummy.position.copy(b.p);this.dummy.position.y+=t*2;const size=b.size*(.5+Math.sin(t*Math.PI)*.9);this.dummy.scale.set(size*3,size*2.7,1);this.dummy.quaternion.copy(this.camera.quaternion);this.dummy.rotateZ(i*1.73+t*.8);this.effectColor.set(t<.3?0xfff2cd:t<.65?0xffb235:0xf56d17).multiplyScalar(Math.min(1,(1-t)*3));this.fireballMesh.setColorAt(i,this.effectColor);}}
      if(!b.alive)this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.fireballMesh.setMatrixAt(i,this.dummy.matrix);
    }
    this.fireballMesh.instanceMatrix.needsUpdate=true;if(this.fireballMesh.instanceColor)this.fireballMesh.instanceColor.needsUpdate=true;
    for(let i=0;i<this.particles.length;i++){
      const p=this.particles[i];if(p.alive){p.age+=step;if(p.age>=p.life)p.alive=false;else{
        p.x+=p.vx*step;p.y+=p.vy*step;p.z+=p.vz*step;if(!p.smoke)p.vy-=12*step;
        if(p.y<this.floor(p.x,p.z)+.12){p.y=this.floor(p.x,p.z)+.12;p.vy*=-.24;p.vx*=.85;p.vz*=.85;}
        const t=p.age/p.life,scale=p.size*(p.smoke?.7+t*1.6:1-t*.6)*Math.min(1,(1-t)*5);
        this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(scale*(p.smoke?3.6:3.1));this.dummy.quaternion.copy(this.camera.quaternion);this.dummy.rotateZ(p.age*.35);
        if(p.smoke)this.smokeMesh.setColorAt(i,p.color);else this.particleMesh.setColorAt(i,p.color);
      }}
      if(!p.alive)this.dummy.scale.setScalar(0);this.dummy.updateMatrix();
      if(p.alive&&p.smoke){this.smokeMesh.setMatrixAt(i,this.dummy.matrix);this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);}
      else{this.particleMesh.setMatrixAt(i,this.dummy.matrix);this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.smokeMesh.setMatrixAt(i,this.dummy.matrix);}
    }
    this.particleMesh.instanceMatrix.needsUpdate=true;if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
    this.smokeMesh.instanceMatrix.needsUpdate=true;if(this.smokeMesh.instanceColor)this.smokeMesh.instanceColor.needsUpdate=true;
    const vortex=this.feature==='tornado'?this.featureObjects.get('tornado')!:undefined;
    for(let i=0;i<this.debris.length;i++){
      const d=this.debris[i];if(d.alive){d.age+=step;if(d.age>d.life)d.alive=false;else{
        if(vortex){const dx=d.p.x-vortex.position.x,dz=d.p.z-vortex.position.z,r=Math.hypot(dx,dz);if(r<20){d.v.x+=(-dz*.9-dx*.5)*step;d.v.z+=(dx*.9-dz*.5)*step;d.v.y+=28*step;if(d.p.y>vortex.position.y+26){d.p.y=vortex.position.y+.5;d.v.y=4;}}}
        d.v.y-=15*step;d.p.addScaledVector(d.v,step);const floor=this.floor(d.p.x,d.p.z)+d.scale.y*.45+.09;
        if(d.p.y<floor){d.p.y=floor;d.v.y=Math.abs(d.v.y)>.65?-d.v.y*.24:0;d.v.x*=Math.pow(.12,step);d.v.z*=Math.pow(.12,step);d.spin.multiplyScalar(Math.pow(.04,step));}
        d.rotation.addScaledVector(d.spin,step);this.dummy.position.copy(d.p);this.dummy.rotation.set(d.rotation.x,d.rotation.y,d.rotation.z);this.dummy.scale.copy(d.scale).multiplyScalar(Math.min(1,(d.life-d.age)/3));this.debrisMesh.setColorAt(i,d.color);
      }}
      if(!d.alive)this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.debrisMesh.setMatrixAt(i,this.dummy.matrix);
    }
    this.debrisMesh.instanceMatrix.needsUpdate=true;if(this.debrisMesh.instanceColor)this.debrisMesh.instanceColor.needsUpdate=true;
    for(const ring of this.rings)if(ring.alive){ring.age+=step;const t=ring.age/ring.life;if(t>=1){ring.alive=false;ring.mesh.visible=false;}else{ring.mesh.scale.setScalar((.12+Math.pow(t,.7))*ring.radius);ring.mesh.material.opacity=(1-t)*.9;}}
  }

  private addFloater(text:string,p:Vec3,color:string,big=false):void{
    text=translate(text,this.language);
    big=big||/CRASHBREAKER|EXPLOSION CHAIN|SMASH CHAIN|SUPER|TORNADO/i.test(text);
    const key=text.replace(/[\d$,.×+]/g,'').trim();
    const recent=this.floaters.find(f=>f.big===big&&f.age<(big?1:.16)&&(big&&f.key===key||Math.hypot(f.p.x-p.x,f.p.z-p.z)<(big?10:4)));
    if(recent){recent.el.textContent=text;recent.el.style.color=color;recent.age=0;recent.p.set(p.x,p.y+3.5,p.z);return;}
    if(big&&this.floaters.filter(f=>f.big).length>=3){const oldest=this.floaters.findIndex(f=>f.big);const removed=this.floaters.splice(oldest,1)[0];removed.el.remove();this.floaterPool.push(removed.el);}
    if(this.floaters.length>13){const oldest=this.floaters.shift()!;oldest.el.remove();this.floaterPool.push(oldest.el);}
    const el=this.floaterPool.pop()??document.createElement('div');el.textContent=text;
    el.style.cssText=`position:absolute;left:0;top:0;white-space:nowrap;font-family:Arial,'PingFang SC',sans-serif;font-size:${big?20:12}px;font-weight:900;letter-spacing:${big?'.5px':'0'};color:${color};text-shadow:0 2px 0 #26312c,0 0 6px #26312c;will-change:transform,opacity;`;
    this.overlay.append(el);this.floaters.push({el,p:new THREE.Vector3(p.x,p.y+3.5,p.z),age:0,life:big?1.45:.85,big,key});
  }

  private updateFloaters(dt:number):void{
    for(let i=this.floaters.length-1;i>=0;i--){const f=this.floaters[i];f.age+=dt;if(f.age>=f.life){f.el.remove();this.floaterPool.push(f.el);this.floaters.splice(i,1);continue;}
      this.screen.copy(f.p).project(this.camera);const x=(this.screen.x*.5+.5)*this.width,y=(-this.screen.y*.5+.5)*this.height-f.age*28;
      f.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${1+Math.max(0,.14-f.age)*2})`;f.el.style.opacity=String(Math.min(1,(f.life-f.age)*3));
    }
  }

  private updatePlayerMarker(player:RenderEntity|undefined,visible:boolean):void{
    this.playerMarker.style.display=player&&visible?'inline-flex':'none';if(!player||!visible)return;
    this.screen.set(player.p.x,player.p.y+1,player.p.z).project(this.camera);
    const actualX=(this.screen.x*.5+.5)*this.width,actualY=(-this.screen.y*.5+.5)*this.height;
    const horizontalMargin=70,topMargin=138,bottomMargin=112;
    const x=THREE.MathUtils.clamp(actualX,horizontalMargin,Math.max(horizontalMargin,this.width-horizontalMargin));
    const y=THREE.MathUtils.clamp(actualY-37,topMargin,Math.max(topMargin,this.height-bottomMargin));
    const offscreen=actualX<34||actualX>this.width-34||actualY<35||actualY>this.height-40;
    const angle=offscreen?Math.atan2(actualY-y,actualX-x):Math.PI/2;
    this.playerMarkerArrow.style.transform=`rotate(${angle}rad)`;
    this.playerMarker.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
    this.playerMarker.dataset.edge=offscreen?'true':'false';
  }

  private updateSpecialTargets(snapshot:GameSnapshot):void{
    for(const el of this.specialMarkers)el.style.display='none';this.specialRings.count=0;
    if(snapshot.phase!=='running'&&snapshot.phase!=='paused')return;
    const hero=snapshot.entities.find(e=>e.player),chosen=snapshot.entities.filter(e=>!e.player&&SPECIAL_TARGETS[e.kind as VehicleKind]&&(e.kind==='tanker'?(e.fuse??0)>0||!e.destroyed:!e.destroyed&&(!e.active||['pizza','bank','icecream','missile'].includes(e.kind)))).map(e=>{
      const info=SPECIAL_TARGETS[e.kind as VehicleKind]!;this.screen.set(e.p.x,e.p.y+3,e.p.z).project(this.camera);
      return {e,info,x:(this.screen.x*.5+.5)*this.width,y:(-.5*this.screen.y+.5)*this.height,d:hero?Math.hypot(e.p.x-hero.p.x,e.p.z-hero.p.z):0};
    }).sort((a,b)=>(b.info.priority-b.d*.22)-(a.info.priority-a.d*.22)).slice(0,6);
    const occupied:{x:number;y:number}[]=[],labelKinds=new Set<string>();let labelCount=0;
    for(let i=0;i<chosen.length;i++){
      const {e,info,x:actualX,y:actualY}=chosen[i],size=Math.max(2.6,VEHICLES[e.kind as VehicleKind].length*.53),pulse=1+Math.sin(this.clock*4+i)*.045;
      this.dummy.position.set(e.p.x,this.floor(e.p.x,e.p.z)+.32,e.p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(size*pulse,1,size*pulse);this.dummy.updateMatrix();this.specialRings.setMatrixAt(i,this.dummy.matrix);this.specialRings.setColorAt(i,this.effectColor.set(info.color));
      const onScreen=actualX>28&&actualX<this.width-28&&actualY>148&&actualY<this.height-120;
      if(labelCount>=this.specialMarkers.length||labelKinds.has(e.kind)||(!onScreen&&info.priority<95))continue;
      const margin=this.width<700?86:100,x=THREE.MathUtils.clamp(actualX,margin,this.width-margin);let y=THREE.MathUtils.clamp(actualY-24,151,this.height-124);
      if(occupied.some(p=>Math.abs(p.x-x)<174&&Math.abs(p.y-y)<31))y-=35;
      if(occupied.some(p=>Math.abs(p.x-x)<174&&Math.abs(p.y-y)<31)||y<151||y>this.height-110)continue;
      const el=this.specialMarkers[labelCount++],arrow=onScreen?'':actualX<margin?'◀ ':actualX>this.width-margin?'▶ ':actualY<151?'▲ ':'▼ ';
      const text=arrow+translate(info.text,this.language);if(el.textContent!==text)el.textContent=text;el.dataset.kind=e.kind;el.dataset.entity=String(e.id);el.style.display='block';el.style.color=info.color;el.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;occupied.push({x,y});labelKinds.add(e.kind);
    }
    this.specialRings.count=chosen.length;this.specialRings.instanceMatrix.needsUpdate=true;if(this.specialRings.instanceColor)this.specialRings.instanceColor.needsUpdate=true;
  }

  private clearEffects():void{
    for(const marker of this.specialMarkers)marker.style.display='none';this.specialRings.count=0;
    this.seenEvents.clear();for(const p of this.particles)p.alive=false;for(const b of this.fireballs)b.alive=false;for(const d of this.debris)d.alive=false;for(const r of this.rings){r.alive=false;r.mesh.visible=false;}for(const f of this.floaters){f.el.remove();this.floaterPool.push(f.el);}this.floaters.length=0;this.shake=0;
    this.dummy.scale.setScalar(0);this.dummy.updateMatrix();for(let i=0;i<64;i++)this.scorchMesh.setMatrixAt(i,this.dummy.matrix);this.scorchMesh.instanceMatrix.needsUpdate=true;this.scorchCursor=0;
    this.feature='none';this.featureAge=0;this.featureLastTime=0;this.effectCenter.set(0,0,0);this.flashAmount=0;for(const object of this.featureObjects.values())object.visible=false;
  }

  worldFromPointer(clientX:number,clientY:number):Vec3{
    const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    this.plane.constant=0;this.raycaster.ray.intersectPlane(this.plane,this.intersect);
    for(let i=0;i<3;i++){this.plane.constant=-this.floor(this.intersect.x,this.intersect.z);this.raycaster.ray.intersectPlane(this.plane,this.intersect);}
    return {x:this.intersect.x,y:this.floor(this.intersect.x,this.intersect.z),z:this.intersect.z};
  }

  resize():void{const bounds=this.container.getBoundingClientRect();this.width=Math.max(1,bounds.width);this.height=Math.max(1,bounds.height);this.renderer.setSize(this.width,this.height,false);this.updateCamera(0,false);}
  screenshot():string{return this.renderer.domElement.toDataURL('image/png');}
  getStats():{drawCalls:number;triangles:number;fps:number}{return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,fps:Math.round(this.fps)};}
  dispose():void{
    if(this.disposed)return;this.disposed=true;this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost',this.onContextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.onContextRestored);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    const collect=(object:THREE.Object3D)=>object.traverse(child=>{if(child instanceof THREE.Mesh){geometries.add(child.geometry);for(const m of Array.isArray(child.material)?child.material:[child.material]){materials.add(m);const mat=m as THREE.MeshStandardMaterial;if(mat.map)textures.add(mat.map);}}});
    collect(this.scene);for(const model of [...this.models.values(),...this.wreckModels.values(),...this.detachedCabModels.values(),...this.buildingModels.values()])collect(model);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    this.renderer.dispose();this.renderer.domElement.remove();this.overlay.remove();this.views.clear();this.models.clear();
  }
}
