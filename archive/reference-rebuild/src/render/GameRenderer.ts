import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createModel} from './models.ts';
import {buildWorld,roadLabel} from './world.ts';
import {groundHeight,ROUTES,VEHICLES,type GameSnapshot,type GameEvent,type ModelKind,type RenderEntity,type RouteId,type Settings,type Vec3} from '../shared.ts';

interface EntityView {object:THREE.Group;material:THREE.MeshStandardMaterial[];damage:number;kind:ModelKind;}
interface Particle {alive:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;color:THREE.Color;smoke:boolean;}
interface Ring {mesh:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;age:number;life:number;radius:number;alive:boolean;}
interface Floater {el:HTMLDivElement;p:THREE.Vector3;age:number;life:number;}

/** Renderer is a read-only adapter: all collisions, scoring and progress remain in the simulation. */
export class GameRenderer {
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-60,60,40,-40,.1,400);
  private models=new Map<ModelKind,THREE.Group>();
  private views=new Map<number,EntityView>();
  private world=new THREE.Group();
  private target=new THREE.Vector3(0,0,-2);
  private desiredTarget=new THREE.Vector3();
  private cameraOffset=new THREE.Vector3(43,108,62);
  private direction=new THREE.Vector3();
  private screen=new THREE.Vector3();
  private raycaster=new THREE.Raycaster();
  private pointer=new THREE.Vector2();
  private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private intersect=new THREE.Vector3();
  private overlay:HTMLDivElement;
  private playerMarker:HTMLDivElement;
  private playerMarkerArrow:HTMLSpanElement;
  private floaters:Floater[]=[];
  private floaterPool:HTMLDivElement[]=[];
  private seenEvents=new Set<number>();
  private particleMesh:THREE.InstancedMesh;
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
  private frustum=72;
  private route:RouteId='hill';
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
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;
    this.renderer.setClearColor(0xb5dacc);
    this.renderer.domElement.setAttribute('aria-label','旧金山海湾立体交通路口');
    this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none;';
    this.renderer.domElement.addEventListener('webglcontextlost',this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.onContextRestored);
    container.append(this.renderer.domElement);
    this.overlay=document.createElement('div');this.overlay.className='world-fx';this.overlay.setAttribute('aria-hidden','true');
    this.overlay.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;';container.append(this.overlay);
    this.playerMarker=document.createElement('div');this.playerMarker.className='player-marker';
    this.playerMarker.style.cssText='position:absolute;display:none;left:0;top:0;align-items:center;gap:6px;padding:5px 9px;background:#243f3df2;border:1px solid #ffe19a;border-radius:3px;color:#ffdfa0;font:700 12px Arial,"PingFang SC",sans-serif;letter-spacing:1px;box-shadow:0 2px 12px #10262566;white-space:nowrap;will-change:transform;';
    this.playerMarkerArrow=document.createElement('span');this.playerMarkerArrow.textContent='➤';this.playerMarkerArrow.style.cssText='display:inline-block;font-size:13px;';
    const markerText=document.createElement('span');markerText.textContent='你的车';this.playerMarker.append(this.playerMarkerArrow,markerText);this.overlay.append(this.playerMarker);
    this.scene.background=new THREE.Color(0xb5dacc);this.scene.fog=new THREE.Fog(0xb5dacc,160,285);
    this.scene.add(new THREE.HemisphereLight(0xfff3d1,0x4c9895,2.25));
    this.sun=new THREE.DirectionalLight(0xffe4b4,3.3);this.sun.position.set(-42,82,24);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:180});
    this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.25;this.sun.shadow.radius=3;this.scene.add(this.sun);this.scene.add(this.sun.target);
    const fill=new THREE.DirectionalLight(0xa6e6dd,.8);fill.position.set(38,20,-24);this.scene.add(fill);
    this.particleMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),320);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;this.particleMesh.count=320;this.scene.add(this.particleMesh);
    for(let i=0;i<320;i++){this.particles.push({alive:false,age:0,life:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:1,color:new THREE.Color(),smoke:false});this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);}
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
    this.world.add(roadLabel('CALIFORNIA ST',7,-35,15,Math.PI/2));
    this.world.add(roadLabel('BAYBREAK AVE',-33,-7.45,19));
    this.world.add(roadLabel('THE EMBARCADERO',38,7.5,21));
    const loader=new GLTFLoader();
    const kinds=[...Object.keys(VEHICLES),'crate','barrier','sign','lamp','facade'] as ModelKind[];
    await Promise.all(kinds.map(async kind=>{
      try{const asset=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${kind}.glb`);this.models.set(kind,asset.scene);}
      catch{this.models.set(kind,createModel(kind));}
    }));
    this.loaded=true;this.setOverview(this.route);
  }

  setOverview(route:RouteId):void{
    this.route=route;const entry=ROUTES.find(r=>r.id===route)!;
    this.clearEffects();
    const oldMaterials=new Set<THREE.Material>();
    this.routeLine.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();for(const material of Array.isArray(child.material)?child.material:[child.material])oldMaterials.add(material);}});
    oldMaterials.forEach(material=>material.dispose());
    this.routeLine.clear();
    const mat=new THREE.MeshBasicMaterial({color:entry.color,transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
    for(let t=0;t<7;t++){
      const x=entry.x+entry.dx*(8+t*5),z=entry.z+entry.dz*(8+t*5);
      const shape=new THREE.Shape();shape.moveTo(-.62,-.48);shape.lineTo(0,.42);shape.lineTo(.62,-.48);shape.lineTo(.4,-.66);shape.lineTo(0,-.08);shape.lineTo(-.4,-.66);shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);mesh.rotation.set(-Math.PI/2,0,Math.atan2(entry.dx,entry.dz));mesh.position.set(x,groundHeight(x,z)+.12,z);this.routeLine.add(mesh);
    }
  }

  render(snapshot:GameSnapshot,dt:number,settings:Settings):void{
    if(this.disposed||this.contextLost)return;
    dt=Math.min(.06,Math.max(0,dt));this.clock+=dt;if(dt>.001)this.fps+=(1/dt-this.fps)*.035;
    if(snapshot.phase==='ready'&&(this.lastPhase!=='ready'||snapshot.time<this.lastTime))this.clearEffects();
    this.lastPhase=snapshot.phase;this.lastTime=snapshot.time;
    if(this.quality!==settings.quality){this.quality=settings.quality;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,settings.quality==='high'?1.65:1));this.renderer.shadowMap.enabled=settings.quality==='high';this.resize();}
    if(this.loaded){
      const alive=new Set<number>();let smokeBudget=this.quality==='high'?4:2;
      for(const entity of snapshot.entities){
        alive.add(entity.id);let view=this.views.get(entity.id);
        if(view&&view.kind!==entity.kind){this.removeView(entity.id);view=undefined;}
        if(!view){view=this.createView(entity);this.views.set(entity.id,view);this.scene.add(view.object);}
        const {object}=view;object.visible=true;object.position.set(entity.p.x,entity.p.y,entity.p.z);object.quaternion.set(entity.q.x,entity.q.y,entity.q.z,entity.q.w);
        if(entity.scale)object.scale.set(entity.scale.x,entity.scale.y,entity.scale.z);else object.scale.setScalar(1);
        const damage=Math.max(0,Math.min(1,entity.damage));
        if(entity.kind in VEHICLES)object.scale.y*=1-damage*.11;
        const burning=entity.fuse!==undefined&&entity.fuse>0;
        if(Math.abs(damage-view.damage)>.02||burning||entity.destroyed){
          view.damage=damage;for(const material of view.material){
            const shade=entity.destroyed?.47:1-damage*.4;material.color.setRGB(shade,shade*(1-damage*.08),shade*(1-damage*.12));
            material.emissive.set(burning&&Math.sin(this.clock*17)>0?0xe95318:entity.destroyed?0x230900:0x000000);material.emissiveIntensity=burning?.7:1;
          }
        }
        if(entity.active&&smokeBudget>0&&(damage>.55||entity.destroyed||burning)&&Math.random()<dt*(burning?13:4)){
          smokeBudget--;this.emitParticle(entity.p.x+(Math.random()-.5),entity.p.y+.8,entity.p.z,.2,1.8,.1,.65,1.55,0x556667,true);
          if(entity.destroyed||burning)this.emitParticle(entity.p.x,entity.p.y+.7,entity.p.z,(Math.random()-.5)*.5,1.2,0,.35,.45,burning?0xffcc5b:0xf28b34,false);
        }
      }
      for(const id of this.views.keys())if(!alive.has(id))this.removeView(id);
    }
    for(const event of snapshot.events)if(!this.seenEvents.has(event.id)){this.seenEvents.add(event.id);if(snapshot.phase!=='ready')this.handleEvent(event);}
    const player=snapshot.entities.find(e=>e.id===snapshot.playerId);
    const running=snapshot.phase==='running'||snapshot.phase==='paused';
    if(player){
      this.desiredTarget.set(THREE.MathUtils.clamp(player.p.x*.58,-42,42),Math.max(0,player.p.y*.12),THREE.MathUtils.clamp(player.p.z*.55,-42,42));
      if(!running)this.desiredTarget.set(-1,0,-3);
      this.target.lerp(this.desiredTarget,Math.min(1,dt*(running?3.7:1.5)));
      const py=groundHeight(player.p.x,player.p.z)+.14;
      this.playerRing.position.set(player.p.x,py,player.p.z);this.playerRing.scale.setScalar(1+Math.sin(this.clock*4)*.045);
      this.playerRing.material.opacity=snapshot.blastCharge>=1?1:.86;
      this.direction.set(snapshot.aim.x,0,snapshot.aim.z);
      if(this.direction.lengthSq()<.2)this.direction.set(0,0,1);this.direction.normalize();
      const arrowLength=3.8;this.aimLine.position.set(player.p.x+this.direction.x*3.5,py+.05,player.p.z+this.direction.z*3.5);this.aimLine.rotation.y=Math.atan2(this.direction.x,this.direction.z);this.aimLine.scale.z=arrowLength;
      this.aimHead.position.set(player.p.x+this.direction.x*5.6,py+.12,player.p.z+this.direction.z*5.6);this.aimHead.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),this.direction);
    }
    this.playerRing.visible=!!player&&snapshot.phase!=='ended';this.aimLine.visible=!!player&&running;this.aimHead.visible=!!player&&running;
    this.routeLine.visible=snapshot.phase==='ready';
    const distance=player?Math.hypot(player.p.x,player.p.z):0;
    const desiredFrustum=running?THREE.MathUtils.clamp(64+Math.max(0,distance-33)*.45,64,88):74;
    this.frustum+=(desiredFrustum-this.frustum)*Math.min(1,dt*2.4);
    this.updateCamera(dt,settings.shake&&running);
    this.updatePlayerMarker(player,running);
    this.updateEffects(dt,snapshot.phase==='paused');this.updateFloaters(dt);
    this.renderer.render(this.scene,this.camera);
  }

  private createView(entity:RenderEntity):EntityView{
    const source=this.models.get(entity.kind)??createModel(entity.kind),object=source.clone(true);const materials:THREE.MeshStandardMaterial[]=[];
    object.traverse(child=>{if(child instanceof THREE.Mesh){child.castShadow=true;child.receiveShadow=true;const original=child.material as THREE.MeshStandardMaterial;child.material=original.clone();materials.push(child.material as THREE.MeshStandardMaterial);}});
    return {object,material:materials,damage:-1,kind:entity.kind};
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

  private handleEvent(event:GameEvent):void{
    const {p}=event;
    if(event.kind==='explosion'){
      const power=THREE.MathUtils.clamp(event.power,1,20),count=this.quality==='high'?45:22;
      this.shake=Math.max(this.shake,Math.min(1.45,.4+power*.07));
      const ring=this.rings[this.ringCursor++%this.rings.length];ring.alive=true;ring.age=0;ring.life=.72;ring.radius=8+power*.32;ring.mesh.position.set(p.x,groundHeight(p.x,p.z)+.18,p.z);ring.mesh.material.color.set(event.color??0xffd27b);ring.mesh.visible=true;
      for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=3+Math.random()*(6+power*.28);this.emitParticle(p.x,p.y+.4,p.z,Math.cos(angle)*speed,2+Math.random()*9,Math.sin(angle)*speed,.25+Math.random()*.85,.5+Math.random()*.6,i%3===0?0xffedb0:i%2?0xfc9b38:0xe96b30,false);}
      for(let i=0;i<9;i++)this.emitParticle(p.x+(Math.random()-.5)*3,p.y+1,p.z+(Math.random()-.5)*3,(Math.random()-.5)*3,2+Math.random()*3,(Math.random()-.5)*3,1+Math.random(),1.1+Math.random(),0x526463,true);
      if(event.text)this.addFloater(event.text,p,event.color??'#ffe8a7',true);
    }else if(event.kind==='impact'){
      const count=Math.min(this.quality==='high'?14:7,4+Math.floor(event.power*.4));
      for(let i=0;i<count;i++)this.emitParticle(p.x,p.y+.4,p.z,(Math.random()-.5)*8,2+Math.random()*4,(Math.random()-.5)*8,.07+Math.random()*.12,.25+Math.random()*.45,i%2?0xffe3a4:0xf2ac61,false);
      if(event.power>8)this.shake=Math.max(this.shake,.14);
    }else if(event.kind==='score'||event.kind==='special'||event.kind==='mechanism'||event.kind==='warning'){
      if(event.text)this.addFloater(event.text,p,event.color??(event.kind==='warning'?'#ffb097':event.kind==='score'?'#ffdfa1':'#adf4db'),event.kind!=='score');
      if(event.kind==='special'||event.kind==='mechanism'){
        const ring=this.rings[this.ringCursor++%this.rings.length];ring.alive=true;ring.age=0;ring.life=1;ring.radius=7;ring.mesh.position.set(p.x,groundHeight(p.x,p.z)+.15,p.z);ring.mesh.material.color.set(event.color??0x8de5d4);ring.mesh.visible=true;
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
    for(let i=0;i<this.particles.length;i++){
      const p=this.particles[i];if(p.alive){p.age+=step;if(p.age>=p.life)p.alive=false;else{
        p.x+=p.vx*step;p.y+=p.vy*step;p.z+=p.vz*step;if(!p.smoke)p.vy-=12*step;
        if(p.y<groundHeight(p.x,p.z)+.12){p.y=groundHeight(p.x,p.z)+.12;p.vy*=-.24;p.vx*=.85;p.vz*=.85;}
        const t=p.age/p.life,scale=p.size*(p.smoke?.55+t*1.1:1-t*.8)*Math.min(1,(1-t)*5);
        this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(scale);this.dummy.rotation.set(p.age*2,p.age*1.6,p.age*.4);this.particleMesh.setColorAt(i,p.color);
      }}
      if(!p.alive)this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate=true;if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
    for(const ring of this.rings)if(ring.alive){ring.age+=step;const t=ring.age/ring.life;if(t>=1){ring.alive=false;ring.mesh.visible=false;}else{ring.mesh.scale.setScalar((.12+Math.pow(t,.7))*ring.radius);ring.mesh.material.opacity=(1-t)*.9;}}
  }

  private addFloater(text:string,p:Vec3,color:string,big=false):void{
    if(this.floaters.length>13){const oldest=this.floaters.shift()!;oldest.el.remove();this.floaterPool.push(oldest.el);}
    const el=this.floaterPool.pop()??document.createElement('div');el.textContent=text;
    el.style.cssText=`position:absolute;left:0;top:0;white-space:nowrap;font-family:Arial,'PingFang SC',sans-serif;font-size:${big?21:16}px;font-weight:900;letter-spacing:${big?'1px':'0'};color:${color};text-shadow:0 2px 0 #234b4d,0 0 9px #234b4d,0 2px 15px #173f48;will-change:transform,opacity;`;
    this.overlay.append(el);this.floaters.push({el,p:new THREE.Vector3(p.x,p.y+3.5,p.z),age:0,life:big?1.6:1.05});
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

  private clearEffects():void{this.seenEvents.clear();for(const p of this.particles)p.alive=false;for(const r of this.rings){r.alive=false;r.mesh.visible=false;}for(const f of this.floaters){f.el.remove();this.floaterPool.push(f.el);}this.floaters.length=0;this.shake=0;}

  worldFromPointer(clientX:number,clientY:number):Vec3{
    const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    this.plane.constant=0;this.raycaster.ray.intersectPlane(this.plane,this.intersect);
    for(let i=0;i<3;i++){this.plane.constant=-groundHeight(this.intersect.x,this.intersect.z);this.raycaster.ray.intersectPlane(this.plane,this.intersect);}
    return {x:this.intersect.x,y:groundHeight(this.intersect.x,this.intersect.z),z:this.intersect.z};
  }

  resize():void{const bounds=this.container.getBoundingClientRect();this.width=Math.max(1,bounds.width);this.height=Math.max(1,bounds.height);this.renderer.setSize(this.width,this.height,false);this.updateCamera(0,false);}
  screenshot():string{return this.renderer.domElement.toDataURL('image/png');}
  getStats():{drawCalls:number;triangles:number;fps:number}{return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,fps:Math.round(this.fps)};}
  dispose():void{
    if(this.disposed)return;this.disposed=true;this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost',this.onContextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.onContextRestored);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    const collect=(object:THREE.Object3D)=>object.traverse(child=>{if(child instanceof THREE.Mesh){geometries.add(child.geometry);for(const m of Array.isArray(child.material)?child.material:[child.material]){materials.add(m);const mat=m as THREE.MeshStandardMaterial;if(mat.map)textures.add(mat.map);}}});
    collect(this.scene);for(const model of this.models.values())collect(model);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    this.renderer.dispose();this.renderer.domElement.remove();this.overlay.remove();this.views.clear();this.models.clear();
  }
}
