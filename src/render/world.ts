import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUILDINGS,groundHeight,seeded,type CityId} from '../shared.ts';
import {getCity,cityGroundHeight,type BuildingDef} from '../cities.ts';

/** Vertex-colour authoring keeps the road and each damage stage in separate batches. */
function kit(){
  const parts:THREE.BufferGeometry[]=[],color=new THREE.Color();
  const hash=(x:number,z:number)=>{const value=Math.sin(x*127.1+z*311.7)*43758.5453;return value-Math.floor(value);};
  function noise(x:number,z:number){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),sx),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),sx),sz);}
  function add(g:THREE.BufferGeometry,c:number,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    const grain=Number(g.userData.grain??0);
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const geom=g.index?g.toNonIndexed():g;geom.deleteAttribute('uv');color.set(c);
    const values=new Float32Array(geom.attributes.position.count*3);
    const position=geom.attributes.position;
    for(let i=0;i<values.length;i+=3){const vertex=i/3,px=position.getX(vertex),pz=position.getZ(vertex),variation=grain?1+(noise(px/12,pz/12)*.78+noise(px/2,pz/2)*.22-.5)*grain:1;values[i]=color.r*variation;values[i+1]=color.g*variation;values[i+2]=color.b*variation;}
    geom.setAttribute('color',new THREE.BufferAttribute(values,3));parts.push(geom);
  }
  const box=(w:number,h:number,d:number,c:number,x:number,y:number,z:number)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  function finish(name:string){
    const geometry=mergeGeometries(parts,false);if(!geometry)throw new Error('Cannot merge '+name);
    geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.89,metalness:.02}));
    mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=true;parts.forEach(g=>g.dispose());return mesh;
  }
  return {add,box,finish};
}

function buildSanFrancisco():THREE.Group {
  const world=new THREE.Group();world.name='Baybreak Junction';const {add,box,finish}=kit();const random=seeded(931);
  function surface(x1:number,x2:number,z1:number,z2:number,c:number,offset=0){
    const steps=Math.max(1,Math.ceil((z2-z1)/2.3)),columns=Math.max(1,Math.ceil((x2-x1)/2.3)),positions:number[]=[];
    for(let i=0;i<steps;i++)for(let j=0;j<columns;j++){const a=z1+(z2-z1)*i/steps,b=z1+(z2-z1)*(i+1)/steps,ya=groundHeight(0,a)+offset,yb=groundHeight(0,b)+offset,l=x1+(x2-x1)*j/columns,r=x1+(x2-x1)*(j+1)/columns;positions.push(l,ya,a,l,yb,b,r,ya,a,r,ya,a,l,yb,b,r,yb,b);}
    const g=new THREE.BufferGeometry();g.userData.grain=c===0x568746?.15:c===0x30363a?.04:.018;g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(g,c);
  }
  surface(-78,78,-73,73,0x568746,-.12);
  for(const b of BUILDINGS)surface(b.x-b.w/2-1.2,b.x+b.w/2+1.2,b.z-b.d/2-1.4,b.z+b.d/2+1.4,0xb4b3a6,.01);
  for(const side of [-1,1])for(const [a,b] of [[-66,-9],[9,66]])surface(side<0?-14:10,side<0?-10:14,a,b,0xc1c0b3,.18);
  for(const side of [-1,1])for(const [a,b] of [[-66,-10],[10,66]])surface(a,b,side<0?-13:9,side<0?-9:13,0xc1c0b3,.18);
  surface(-10,10,-66,66,0x30363a,.02);surface(-66,66,-9,9,0x30363a,.025);
  for(const x of [-10.13,10.13])surface(x-.12,x+.12,-66,66,0xe0dfd0,.21);
  for(const z of [-9.15,9.15])surface(-66,66,z-.12,z+.12,0xe0dfd0,.21);
  for(const x of [-10.13,10.13])surface(x-.15,x+.15,-9.2,9.2,0x30363a,.22);
  for(const z of [-9.15,9.15])surface(-10.3,10.3,z-.15,z+.15,0x30363a,.22);
  for(const x of [-.22,.22])for(const z of [-66,12])surface(x-.045,x+.045,z,z<0?-12:66,0xeab956,.06);
  for(const z of [-.22,.22])for(const x of [-66,14])surface(x,x<0?-14:66,z-.045,z+.045,0xeab956,.062);
  for(const x of [-4.78,-3.72])surface(x-.045,x+.045,-66,66,0xaeb4ad,.065);
  for(let z=-63;z<66;z+=2.4)surface(-4.88,-3.62,z,z+.07,0x59615d,.067);
  for(let z=-61;z<62;z+=5.8)if(Math.abs(z)>13)for(const x of [-7,6.8])surface(x-.06,x+.06,z,z+2.4,0xd4d4c5,.071);
  for(let x=-63;x<65;x+=5.8)if(Math.abs(x)>14)for(const z of [-5.8,5.8])surface(x,x+2.4,z-.06,z+.06,0xd4d4c5,.071);
  for(const z of [-10.8,10.8])surface(-9,9,z-.12,z+.12,0xf1eeda,.073);
  for(const x of [-11.8,11.8])surface(x-.12,x+.12,-8,8,0xf1eeda,.073);
  for(const x of [-7.8,7.8])surface(x-.09,x+.09,-6.8,6.8,0xe3d39d,.079);
  for(const z of [-6.8,6.8])surface(-7.8,7.8,z-.09,z+.09,0xe3d39d,.079);
  function arrow(x:number,z:number,rotation:number){const shape=new THREE.Shape();shape.moveTo(-.23,-1.3);shape.lineTo(.23,-1.3);shape.lineTo(.23,.15);shape.lineTo(.83,.15);shape.lineTo(0,1.3);shape.lineTo(-.83,.15);shape.lineTo(-.23,.15);shape.closePath();const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.rotateY(rotation);add(g,0xe6e4d8,x,groundHeight(x,z)+.08,z);}
  arrow(3,-22,Math.PI);arrow(-7,23,0);arrow(-24,3,-Math.PI/2);arrow(24,-3,Math.PI/2);
  for(let z=-62;z<63;z+=3)if(Math.abs(z)>9)for(const x of [-12,12])surface(x-1.7,x+1.7,z,z+.035,0xa5a99c,.19);
  for(let i=0;i<12;i++){const z=-56+i*10.4,x=i%2?-9.15:9.15;surface(x-.28,x+.28,z,z+.6,0x172627,.081);}
  function tree(x:number,z:number,palm=false){const y=groundHeight(x,z);box(1.6,.16,1.6,0x487a39,x,y+.14,z);add(new THREE.CylinderGeometry(.15,.22,palm?4.7:2.2,7),0x796947,x,y+(palm?2.5:1.2),z);if(palm){for(let i=0;i<7;i++){const g=new THREE.ConeGeometry(.52,2.6,4);g.rotateZ(1.15);g.rotateY(i*Math.PI*2/7);add(g,0x3d8148,x,y+4.8,z);}}else{add(new THREE.IcosahedronGeometry(1.6,1),0x4d873d,x,y+3.15,z);add(new THREE.IcosahedronGeometry(1.1,0),0x78a252,x-.4,y+4,z);}}
  for(const x of [-12.3,12.3])for(const z of [-42,-16,16,42])tree(x,z,z>0);
  for(const z of [-11.5,11.5])for(const x of [-56,-36,36,57])tree(x,z,true);
  for(const [x,z] of [[-11.6,-10.6],[11.7,-10.7],[-11.5,10.7],[11.5,10.7]]){
    const y=groundHeight(x,z);add(new THREE.CylinderGeometry(.085,.12,4.3,7),0x40514a,x,y+2.15,z);box(.46,1.1,.38,0x273632,x,y+4,z);for(let i=0;i<3;i++)add(new THREE.SphereGeometry(.12,6,4),i===0?0xd95137:i===2?0x62d86b:0x887e35,x,y+4.3-i*.3,z+.205);
  }
  for(const x of [-36,37])for(const z of [-11.5,11.5]){box(2.2,.13,.6,0x785e40,x,.65,z);box(2.2,.55,.12,0x96734c,x,.94,z+.3);}
  for(const [px,pz] of [[-46,-52],[47,52]]){
    surface(px-9,px+9,pz-8,pz+8,0x74776b,.03);
    for(let i=0;i<5;i++)surface(px-7+i*3,px-6.9+i*3,pz-7,pz-2,0xe1ddc7,.06);
  }
  box(180,.6,240,0x258b91,155,-7.6,5);box(5,9,140,0x858d7c,78,-4,0);box(4,.3,140,0xc3c1aa,75.5,.05,0);
  for(let i=0;i<30;i++){const x=81+random()*42,z=-70+random()*140;box(1+random()*3,.025,.09,0x68b6ad,x,-7.27,z);}
  world.add(finish('street-and-surroundings'));return world;
}

/** Hand-built city silhouettes share the physical map coordinates with traffic. */
export function buildWorld(city:CityId='sf'):THREE.Group {
  const def=getCity(city);const world=city==='sf'?buildSanFrancisco():buildFlatCity(city);
  world.name=def.englishName;world.add(cityLandmarks(city));world.add(citySurroundings(city));
  const target=def.eventTargets[0],ring=new THREE.Mesh(new THREE.RingGeometry(target.radius-0.12,target.radius,64),new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:.4,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(target.x,cityGroundHeight(city,target.x,target.z)+.28,target.z);ring.name='city-event-zone';world.add(ring);
  return world;
}

/** Continue the city well beyond every playable camera position; no exposed tabletop edge. */
function citySurroundings(city:CityId):THREE.Group {
 const group=new THREE.Group(),def=getCity(city),{add,box,finish}=kit(),rand=seeded(city==='sf'?604:city==='sydney'?605:606);
 const surface=(x1:number,x2:number,z1:number,z2:number,color:number,lift=-.14)=>{
  const zs=[z1,...[-56,-15,15,55].filter(z=>z>z1&&z<z2),z2],positions:number[]=[];
  for(let i=1;i<zs.length;i++){const a=zs[i-1],b=zs[i],ya=cityGroundHeight(city,0,a)+lift,yb=cityGroundHeight(city,0,b)+lift;positions.push(x1,ya,a,x1,yb,b,x2,ya,a,x2,ya,a,x1,yb,b,x2,yb,b);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();add(geometry,color);
 };
 surface(-550,city==='sf'?78:550,-550,550,city==='sf'?0x568746:def.ground,-.31);
 const roadColor=city==='sf'?0x30363a:city==='london'?0x303941:0x3e4950,walk=city==='sf'?0xc1c0b3:city==='london'?0xc1b9aa:0xe0d5b7;
 const roads=city==='sf'?[{x:0,z:0,w:20,vertical:true},{x:0,z:0,w:18,vertical:false}]:city==='sydney'?[{x:-18,z:-200,w:18,vertical:true},{x:18,z:200,w:18,vertical:true},{x:0,z:8,w:18,vertical:false}]:[{x:0,z:0,w:18,vertical:true},{x:0,z:0,w:18,vertical:false}];
 for(const road of roads)for(const side of [-1,1]){
  if(city==='sydney'&&road.vertical&&Math.sign(road.z)!==side)continue;
  const edge=city==='sf'?66:78,lo=side<0?-520:edge,hi=side<0?-edge:520;
  if(road.vertical){surface(road.x-road.w/2-2.5,road.x+road.w/2+2.5,lo,hi,walk,.0);surface(road.x-road.w/2,road.x+road.w/2,lo,hi,roadColor,.025);}
  else{surface(lo,hi,road.z-road.w/2-2.5,road.z+road.w/2+2.5,walk,.0);surface(lo,hi,road.z-road.w/2,road.z+road.w/2,roadColor,.025);}
  for(let t=edge+3;t<510;t+=7){const value=side*t;const x=road.vertical?road.x:value,z=road.vertical?value:road.z;box(road.vertical?.13:3,.025,road.vertical?3:.13,0xdfd9be,x,cityGroundHeight(city,x,z)+.07,z);}
 }
 // Long coastlines and river banks extend beyond the camera's orthographic frustum.
 if(city==='sf')box(480,.25,1100,0x258b91,318,-7.53,0);
 else if(city==='sydney'){box(480,.1,1100,0x218da6,303,-.18,0);box(1000,.1,500,0x218da6,0,-.18,-306);}
 else{box(70,.1,1100,0x466777,106.5,-.2,0);box(3,.2,1100,0xa9aa9c,70,0,0);box(3,.2,1100,0xb2ada0,143,0,0);}
 // Low-detail neighbouring blocks, kept away from the interactive district and traffic lanes.
 for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){
  const x=col*32+(row%2)*5,z=row*32;if(Math.abs(x)<87&&Math.abs(z)<87)continue;
  if(city==='sydney'&&(x>53||z<-68)||city==='sf'&&x>63||city==='london'&&x>68&&x<154)continue;
  if(roads.some(road=>road.vertical?Math.abs(x-road.x)<23:Math.abs(z-road.z)<23))continue;
  const w=16+rand()*7,d=15+rand()*8,h=4+rand()*7,y=cityGroundHeight(city,x,z),tone=city==='london'?0xa39988:city==='sf'?0xc7b79b:0xd6c3a1;
  box(w+2,.18,d+2,walk,x,y+.05,z);box(w,h,d,tone,x,y+h/2,z);box(w+.5,.24,d+.5,city==='sf'?0x99795c:0x81908b,x,y+h+.12,z);
  for(let n=0;n<4;n++)box(1.7,1.25,.045,0x334c52,x-w*.34+n*w*.225,y+h*.6,z+d/2+.03);
 }
 const mesh=finish(city+'-extended-surroundings');mesh.castShadow=false;group.add(mesh);return group;
}

function buildFlatCity(city:CityId):THREE.Group {
 const def=getCity(city),world=new THREE.Group(),{add,box,finish}=kit(),random=seeded(city==='sydney'?728:933);
 box(180,.15,180,def.ground,0,-.22,0);
 const roadColor=city==='london'?0x303941:0x3e4950,walk=city==='london'?0xc1b9aa:0xe0d5b7;
 const slab=(x:number,z:number,w:number,d:number,color:number,y=.03)=>box(w,.06,d,color,x,y,z);
 for(const b of def.buildings)slab(b.x,b.z,b.w+3,b.d+3,walk,.03);
 for(const road of def.roads){
  const a=road.points[0],b=road.points.at(-1)!;const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;
  add(new THREE.BoxGeometry(road.width+5,.18,l),walk,cx,.0,cz,0,yaw);
  add(new THREE.BoxGeometry(road.width,.09,l+.08),roadColor,cx,.105,cz,0,yaw);
  for(let t=0;t<l;t+=5.5){const f=(t+1.1)/l;add(new THREE.BoxGeometry(.10,.025,2.3),0xe5e1cf,a.x+dx*f,.167,a.z+dz*f,0,yaw);}
  for(const side of [-1,1])for(let t=0;t<l;t+=3){const f=t/l,x=a.x+dx*f+Math.cos(yaw)*(road.width/2+.08)*side,z=a.z+dz*f-Math.sin(yaw)*(road.width/2+.08)*side;add(new THREE.BoxGeometry(.16,.14,2.7),city==='sydney'&&t%9===0?0xe4b747:0xe5e0d2,x,.15,z,0,yaw);}
 }
 if(city==='london'){
  add(new THREE.CylinderGeometry(31,31,.12,96),walk,0,.03,0);add(new THREE.CylinderGeometry(28.8,28.8,.1,96),roadColor,0,.13,0);
  add(new THREE.CylinderGeometry(13,13,.48,80),0xc2baa7,0,.35,0);add(new THREE.CylinderGeometry(12.5,12.5,.12,80),0x527253,0,.65,0);
  for(let i=0;i<72;i++){const a=i/72*Math.PI*2;add(new THREE.BoxGeometry(.13,.02,.95),0xefead8,Math.sin(a)*21.4,.21,Math.cos(a)*21.4,0,a);}
  box(4.6,.6,4.6,0xc6bca5,0,1,0);box(2.8,1.8,2.8,0xa89f90,0,2.1,0);add(new THREE.CylinderGeometry(.42,.65,4.8,12),0x3e584c,0,5.4,0);add(new THREE.SphereGeometry(.88,12,8),0x728776,0,8.2,0);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.cos(a)*9,z=Math.sin(a)*9;add(new THREE.IcosahedronGeometry(1.3,1),0x618657,x,1.9,z);}
  // Thames and a stone riverside promenade run beside the district.
  slab(84,0,25,170,0x466777,-.15);slab(70,0,3,165,0xa9aa9c,.23);
  for(let z=-73;z<75;z+=2.3){box(.15,1.1,.15,0x3d4a4b,69,.82,z);box(.13,.12,2.3,0x475351,69,1.4,z+1.15);}
 }else{
  slab(81,0,44,160,0x218da6,-.15);slab(42,-66,100,20,0x218da6,-.15);slab(61,0,3,154,0xd8c6a7,.15);
  for(let i=0;i<70;i++){const x=60+random()*28,z=-61+random()*55;box(.8+random()*3,.015,.08,0x60bcc9,x,-.04,z);}
  for(let z=-49;z<-10;z+=10){slab(68,z,19,2.7,0xa7835a,.33);for(let x=62;x<77;x+=2.5)box(.2,.7,.2,0x766246,x,.3,z+1.1);}
  // Gantry supports mark the active cargo drop at the staggered intersection.
  for(const x of [-5,7]){box(.45,8,.45,0xd0a54b,x,4,-4);box(2,.4,2,0x56626b,x,.2,-4);}box(15,.5,.6,0xf0bf4b,1,8,-4);
  for(let x=-5;x<8;x+=3){box(.05,3,.05,0x6e6d60,x,6.5,-4);box(2.4,1.4,2,0xb37941,x,4.4,-4);}
 }
 // Pavement tiles, plantings, street fixtures and road-painted traffic direction.
 for(const b of def.buildings){
  for(let x=b.x-b.w/2;x<b.x+b.w/2;x+=2.8)box(.03,.015,1.7,0x93998a,x,.09,b.z+b.d/2+1);
  for(const side of [-1,1]){const x=b.x+side*(b.w/2+1.3),z=b.z+b.d*.25;box(1.7,.2,1.7,0x485f48,x,.2,z);add(new THREE.CylinderGeometry(.15,.22,2.7,7),0x6e614e,x,1.6,z);add(new THREE.IcosahedronGeometry(1.5,1),city==='sydney'?0x667f4a:0x667948,x,3.5,z);}
 }
 for(const road of def.roads){const a=road.points[0],b=road.points.at(-1)!,dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
  for(let t=10;t<l-6;t+=19){const x=a.x+dx*t/l+Math.cos(yaw)*(road.width/2+1.5),z=a.z+dz*t/l-Math.sin(yaw)*(road.width/2+1.5);box(.14,4.8,.14,0x59636a,x,2.5,z);box(.85,.12,.45,0xc7cabc,x,4.9,z);}
 }
 if(city==='london')for(const [x,z] of [[-31,-13],[29,32]]){box(1.15,2.7,1.15,0xb4252b,x,1.45,z);box(1.34,.2,1.34,0x872528,x,2.9,z);for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(.24,.36,.025,0x86a4a5,x-.33+i*.33,1.2+j*.48,z+.59);}
 world.add(finish(city+'-streets'));
 const labels=city==='sydney'?[['GEORGE ST',-18,-27,0],['CAHILL',-42,8,Math.PI/2]]:[['WESTMINSTER',0,-42,0],['WHITEHALL',-46,0,Math.PI/2]];
 for(const [label,x,z,a] of labels)world.add(roadLabel(String(label),Number(x),Number(z),8,Number(a),city));
 return world;
}

function cityLandmarks(city:CityId):THREE.Group {
 const group=new THREE.Group(),{add,box,finish}=kit();
 const beam=(a:THREE.Vector3,b:THREE.Vector3,r:number,color:number)=>{const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));add(g,color,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);};
 if(city==='sf'){
  const bridgeKit=kit(),deck=3;
  bridgeKit.box(154,.7,8.3,0x424d52,0,deck,0);bridgeKit.box(156,.2,8.8,0xce5736,0,deck-.6,0);
  for(const x of [-29,29]){for(const sz of [-1,1]){bridgeKit.box(1.5,22,1.4,0xc8482f,x,deck+10,sz*4);for(const h of [6,12,18])bridgeKit.box(.9,.9,8.9,0xd85f3e,x,deck+h,0);}bridgeKit.box(4,3,11,0xad9b7a,x,deck-2,0);}
  const cable=(x:number)=>Math.abs(x)<29?deck+4+15*(x/29)**2:deck+19-(Math.abs(x)-29)*.36;
  for(const side of [-1,1])for(let i=0;i<50;i++){const x=-76+i*3,nx=x+3,from=new THREE.Vector3(x,cable(x),side*4),to=new THREE.Vector3(nx,cable(nx),side*4),dir=to.clone().sub(from),g=new THREE.CylinderGeometry(.14,.14,dir.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));bridgeKit.add(g,0xde6a43,(x+nx)/2,(cable(x)+cable(nx))/2,side*4);bridgeKit.box(.055,cable(x)-deck,.055,0xe67a4d,x,(deck+cable(x))/2,side*4);}
  const bridge=bridgeKit.finish('golden-gate-bridge');bridge.rotation.y=Math.PI/2;bridge.position.x=64;group.add(bridge);
  for(let i=0;i<5;i++){const x=-63+i*5.5,z=48,y=groundHeight(x,z);box(4.8,7,9,[0xc88b77,0xddba83,0x89a999,0x8d9aac,0xc6a6a6][i],x,y+3.5,z);const roof=new THREE.ConeGeometry(3.5,2.7,4);roof.rotateY(Math.PI/4);add(roof,0x565663,x,y+8.1,z);for(let f=0;f<2;f++){box(2.4,2,.65,0xe4d5bd,x,y+2.2+f*2.9,z+4.65);box(1.6,1.5,.05,0x3d5962,x,y+2.2+f*2.9,z+5);}}
 }else if(city==='sydney'){
  // Harbour Bridge: twin steel arches over the western approach.
  const cx=-56,z=8,base=.5;box(24,.75,17,0x465960,cx,base,z);
  for(const side of [-1,1]){
   for(let i=0;i<26;i++){const x=-75+i*1.48,nx=x+1.48,h=(v:number)=>base+2+14*Math.sqrt(Math.max(0,1-((v-cx)/19.5)**2));beam(new THREE.Vector3(x,h(x),z+side*9),new THREE.Vector3(nx,h(nx),z+side*9),.45,0x586975);if(i%2===0)beam(new THREE.Vector3(x,base+1,z+side*9),new THREE.Vector3(x,h(x),z+side*9),.10,0x78868a);}
   for(const x of [-75,-37]){box(3,12,3,0xb3a68b,x,6,z+side*10);box(3.6,.65,3.6,0xd2c0a1,x,12.2,z+side*10);}
  }
  for(let i=0;i<11;i++){const x=-73+i*3.4,h=base+2+14*Math.sqrt(Math.max(0,1-((x-cx)/19.5)**2));beam(new THREE.Vector3(x,h,z-9),new THREE.Vector3(x,h,z+9),.13,0x677a83);}
  // Moored ferry silhouette, outside collision space.
  box(6,1.3,15,0xf0efe0,72,.5,-29);box(5,2.4,9,0x1b765f,72,2.3,-28);box(5.7,.3,10,0xe8d6a5,72,3.6,-28);for(let j=0;j<7;j++)box(4.9,.65,.62,0x264d57,72,2.6,-32+j*1.2);
 }else{
  // Westminster gothic roofline along the east bank; clock tower is destructible separately.
  for(let i=0;i<6;i++){const x=38+i*5.5,z=-66;box(5,8,10,0xb5a082,x,4,z);for(const s of [-1,1]){box(.5,10,.5,0xd1b89a,x+s*2.25,5,z+5);add(new THREE.ConeGeometry(.52,2.8,4),0x756f61,x+s*2.25,11,z+5);}for(let j=0;j<3;j++)box(.8,3,.04,0x374b51,x-1.5+j*1.5,5,z+5.02);box(5.3,.5,10.3,0x736c62,x,8.2,z);}
  // London Eye beyond the river: a recognisable thin wheel that does not block the roadway.
  const wheel=new THREE.TorusGeometry(12,.25,7,48);add(wheel,0xc6c8c1,82,13,19);for(let i=0;i<16;i++){const a=i*Math.PI/8;beam(new THREE.Vector3(82,13,19),new THREE.Vector3(82+Math.cos(a)*12,13+Math.sin(a)*12,19),.035,0xcad0c8);add(new THREE.SphereGeometry(.85,8,6),0xa1b9bc,82+Math.cos(a)*12,13+Math.sin(a)*12,19);}beam(new THREE.Vector3(78,0,20),new THREE.Vector3(82,13,19),.38,0xe2dcca);beam(new THREE.Vector3(86,0,20),new THREE.Vector3(82,13,19),.38,0xe2dcca);
 }
 group.add(finish(city+'-landmarks'));return group;
}

function signatureBuilding(def:BuildingDef,stage:number):THREE.Group {
 const {w,d,h}=def,{add,box,finish}=kit(),floor=-h/2,rand=seeded(120+stage);
 for(let i=0;i<4;i++)box(w-i*.6,.24,d-i*.6,def.landmark==='opera'?0xcab18a:0xa89d87,0,floor+.12+i*.24,0);
 if(def.landmark==='opera'){
  const shell=(cx:number,cz:number,width:number,len:number,height:number)=>{
   const pos:number[]=[],cols=14,rows=14;
   const point=(u:number,v:number)=>[cx+v*width*.5*Math.pow(1-u,.6),floor+1.1+height*(.04+.96*u)*Math.pow(Math.max(0,1-v*v),.55),cz+len*(u-.5)];
   for(let a=0;a<rows;a++)for(let b=0;b<cols;b++){if(stage===1&&a>8&&b>7)continue;const u=a/rows,nu=(a+1)/rows,v=b/cols*2-1,nv=(b+1)/cols*2-1;pos.push(...point(u,v),...point(nu,v),...point(u,nv),...point(u,nv),...point(nu,v),...point(nu,nv));}
   const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.computeVertexNormals();add(geom,0xf3ecdc);
   // Tile ribs and a dark glazed entrance make the shells read at both scales.
   for(let j=0;j<=6;j++){const v=j/6*2-1;for(let a=0;a<12;a++){const p=point(a/12,v),q=point((a+1)/12,v),from=new THREE.Vector3(p[0],p[1],p[2]),to=new THREE.Vector3(q[0],q[1],q[2]),dir=to.clone().sub(from),g=new THREE.CylinderGeometry(.035,.035,dir.length(),4);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));add(g,0xd9d3c6,(p[0]+q[0])/2,(p[1]+q[1])/2+.035,(p[2]+q[2])/2);}}
   box(width*.73,1.1,.08,0x254650,cx,floor+1.4,cz-len*.45);
  };
  if(stage<2){for(const side of [-1,1])for(let j=0;j<3;j++)shell(side*w*.21,-d*.27+j*d*.24,w*.41,d*.53,(h-1.4)*(j===1?1:j===0?.78:.58));}
  else{for(let i=0;i<5;i++)box(w*.4,.4+rand()*2,.26,0xe4ddd0,(i%2?1:-1)*w*.2,floor+1,d*(i/5-.4));}
 }else{
  const level=stage===0?1:stage===1?.77:stage===2?.36:.07,tw=w*.56,td=d*.54;
  box(tw,(h-4)*level,td,0xc2ae8b,0,floor+1+(h-4)*level/2,0);
  for(let k=0;k<7*level;k++){const y=floor+2+k*(h-5)/7;box(tw+.35,.22,td+.35,0xe0c9a3,0,y,0);for(const sign of [-1,1])for(let n=0;n<3;n++){box(.5,1.45,.035,0x3d4948,-tw*.3+n*tw*.3,y+.9,sign*(td/2+.025));box(.035,1.45,.5,0x3d4948,sign*(tw/2+.025),y+.9,-td*.3+n*td*.3);}}
  if(stage<=1){const y=floor+h*.73;box(tw+1,4.4,td+1,0xc8b08a,0,y,0);for(let face=0;face<4;face++){
   const a=face*Math.PI/2,cx=Math.sin(a)*(tw/2+.54),cz=Math.cos(a)*(td/2+.54);add(new THREE.CircleGeometry(1.7,40),0xf6edcf,cx,y,cz,0,a);add(new THREE.TorusGeometry(1.74,.12,6,40),0xd6a646,cx,y,cz,0,a);
   for(let i=0;i<12;i++){const t=i*Math.PI/6,rx=Math.sin(t)*1.38,ry=Math.cos(t)*1.38;add(new THREE.BoxGeometry(.11,.27,.035),0x2d4552,cx+Math.cos(a)*rx,y+ry,cz-Math.sin(a)*rx,0,a,-t);}
   add(new THREE.BoxGeometry(.12,1.25,.05),0x28485e,cx,y+.58,cz,0,a);add(new THREE.BoxGeometry(.92,.14,.05),0x28485e,cx+Math.cos(a)*.39,y,cz-Math.sin(a)*.39,0,a);
  }if(stage===0){add(new THREE.ConeGeometry(tw*.78,4.5,4),0x4b6068,0,floor+h-2.5,0,0,Math.PI/4);add(new THREE.ConeGeometry(.18,1.5,8),0xd5b164,0,floor+h+.35,0);}}
 }
 if(stage>0)for(let i=0;i<stage*22;i++){const s=.3+rand()*.9;add(new THREE.BoxGeometry(s,.5,s),def.landmark==='opera'?0xe3dcca:0xb9a483,(rand()-.5)*w*.9,floor+1+rand(),(rand()-.5)*d*.9,rand(),rand(),rand());}
 const mesh=finish(def.landmark+'-'+stage);
 // Keep the collapsed silhouette and physical roof at the same height above the foundation.
 if(stage>0){
  mesh.geometry.computeBoundingBox();const visibleHeight=mesh.geometry.boundingBox!.max.y-floor;
  const physicalHeight=stage===3?.55:h*(stage===2?.43:.7);
  mesh.geometry.translate(0,-floor,0);mesh.geometry.scale(1,physicalHeight/visibleHeight,1);mesh.geometry.translate(0,floor,0);
 }
 mesh.geometry.scale(1/w,1/h,1/d);mesh.geometry.computeBoundingSphere();const group=new THREE.Group();group.add(mesh);return group;
}

/** Unit-sized building shell; entity.scale restores its agreed collision dimensions. */
export function createBuilding(index:number,stage:number,city:CityId='sf'):THREE.Group {
  const buildings=getCity(city).buildings,def=buildings[index%buildings.length];
  if(def.landmark)return signatureBuilding(def,stage);
  const {w:fullW,d:fullD,h}=def,{add,box:rawBox,finish}=kit();
  const random=seeded(400+index*127),floor=-h/2,type=index%6;
  const w=type===5?fullW*.76:fullW,d=type===1?fullD*.35:type===0?fullD*.78:fullD;
  const centreZ=type===1?-fullD*.29:type===0?-fullD*.09:0,pitched=type===0||type===3,roofRise=pitched?Math.min(1.9,h*.3):0,wallHeight=h-roofRise;
  const box=(width:number,height:number,depth:number,c:number,x:number,y:number,z:number)=>rawBox(width,height,depth,c,x,y,z+centreZ);
  const wall=[0xc8b291,0xe4dbc8,0xab9d84,0xc09374,0xb6bca7,0xb99975][type];
  const trim=[0xb44231,0x267166,0x425b58,0x516457,0x4c7b88,0x7b4238][type];
  const roof=[0x6f5546,0xb4b5a3,0x637473,0x9b5c40,0x717f7a,0x666658][type];
  rawBox(fullW,.26,fullD,stage>=2?0x817d70:0xb8b5a5,0,floor+.13,0);
  const remaining=stage===0?1:stage===1?.85:stage===2?.38:.14;
  for(let side=0;side<4;side++){
    const alongX=side<2,span=alongX?w:d,sections=Math.ceil(span/2.4),sign=side%2?1:-1;
    for(let i=0;i<sections;i++){
      const centre=-span/2+(i+.5)*span/sections;let fraction=remaining;
      if(stage===1&&side===(index%4)&&i>1&&i<sections-1)fraction=.22;
      if(stage>=2)fraction*=.6+random()*1.3;
      const sh=Math.max(.35,(wallHeight-.24)*fraction),sx=alongX?centre:sign*(w/2-.16),sz=alongX?sign*(d/2-.16):centre;
      box(alongX?span/sections+.025:.34,sh,alongX?.34:span/sections+.025,wall,sx,floor+.26+sh/2,sz);
      if(stage<=1&&fraction>.55){
        const wz=alongX?sz+sign*.185:sz,wx=alongX?sx:sx+sign*.185;
        box(alongX?1.45:.035,1.55,alongX?.035:1.45,0x243c42,wx,floor+2.1,wz);
        box(alongX?1.68:.14,.13,alongX?.14:1.68,0xe5ddc7,wx,floor+1.26,wz);
      }
    }
  }
  for(const x of [-w*.18,w*.21])box(.22,(wallHeight-.3)*(stage>=2?.27:.72),d*.88,0xcdc4ae,x,floor+.26+(wallHeight-.3)*(stage>=2?.27:.72)/2,0);
  box(w*.8,(wallHeight-.3)*(stage>=2?.23:.72),.2,0xc7bca5,0,floor+.26+(wallHeight-.3)*(stage>=2?.23:.72)/2,d*.08);
  for(let i=0;i<5;i++){const x=(random()-.5)*w*.78,z=(random()-.5)*d*.78;box(1.1,.5,.7,stage>=2?0x737266:0x876e4b,x,floor+.5,z);}
  if(stage<=1){
    const pieces=stage===0?4:2;
    if(pitched){
      const angle=Math.atan2(roofRise,w/2),length=Math.hypot(w/2,roofRise)+.18;
      for(const side of stage===0?[-1,1]:[-1]){
        add(new THREE.BoxGeometry(length,.24,d+.32),roof,side*w/4,h/2-roofRise/2,centreZ,0,0,-side*angle);
        for(let row=0;row<11;row++)add(new THREE.BoxGeometry(length,.065,.09),row%2?0xb47551:0x9e6242,side*w/4,h/2-roofRise/2+.16,centreZ-d*.45+row*d*.09,0,0,-side*angle);
      }
      box(.23,.2,d+.32,0xd19a70,0,h/2+.13,0);
      if(stage===0)for(const x of [-w*.26,w*.26]){box(1.35,.75,1.4,0xd8c2a0,x,h/2-roofRise*.52,d*.12);box(1.58,.15,1.63,0x765447,x,h/2-roofRise*.52+.43,d*.12);}
    }else for(let i=0;i<pieces;i++){const sx=i%2?1:-1,sz=i<2?1:-1;box(w/2+.18,.28,d/2+.18,roof,sx*w/4,h/2-.14,sz*d/4);}
    if(stage===1)for(const x of [-w*.3,0,w*.3])box(.16,.2,d*.93,0x796e56,x,h*.33,0);
    if(!pitched){for(const sx of [-1,1])box(.19,.42,d+.1,trim,sx*w/2,h/2-.1,0);for(const sz of [-1,1])box(w,.42,.19,trim,0,h/2-.1,sz*d/2);}
    if(type===0||type===5){
      for(const sz of [-1,1]){box(w,.55,.12,trim,0,floor+3.35,sz*(d/2+.025));for(let i=0;i<8;i++)box(w/8,.13,1.12,i%2?0xe6d9b4:trim,-w/2+(i+.5)*w/8,floor+3.1,sz*(d/2-.48));}
      if(stage===0){box(w*.6,1.15,.27,trim,0,h/2+.55,0);for(let i=0;i<6;i++)box(.35,.62,.025,0xf1e8bd,-w*.23+i*w*.09,h/2+.6,.15);}
    }else if(type===1){
      const canopyY=floor+3.8,canopyZ=fullD*.22;
      rawBox(fullW*.9,.27,fullD*.46,0xe4dfca,0,canopyY,canopyZ);rawBox(fullW*.91,.24,.3,0xcb4932,0,canopyY+.1,canopyZ+fullD*.23);
      rawBox(fullW*.91,.24,.3,0xcb4932,0,canopyY+.1,canopyZ-fullD*.23);
      for(const x of [-fullW*.28,fullW*.28]){
        rawBox(.2,3.5,.2,0x64756b,x,floor+1.95,canopyZ-.9);rawBox(1.5,.17,3.7,0xcfceba,x,floor+.32,canopyZ);
        for(const z of [canopyZ-1.1,canopyZ+1.1]){rawBox(.7,1.3,.66,0xd7402a,x,floor+1.04,z);rawBox(.74,.5,.7,0xece8d2,x,floor+1.85,z);rawBox(.51,.24,.02,0x233636,x,floor+1.87,z+.36);}
      }
      rawBox(.25,4.8,.25,0x3d6961,fullW*.43,floor+2.65,-fullD*.01);rawBox(2.15,1.05,.19,0x397c6e,fullW*.37,floor+4.68,0);
    }else if(type===2||type===4){
      for(let i=0;i<9;i++)box(w*.91,.06,.075,0x89958b,0,h/2+.04,-d*.4+i*d*.1);
      box(w*.46,2.1,.04,0x52666b,0,floor+1.34,d/2+.045);for(let i=0;i<7;i++)box(w*.44,.06,.06,0x89928b,0,floor+.45+i*.27,d/2+.075);
    }
    if(stage===0&&!pitched){box(2.1,.55,1.5,0x929b93,w*.25,h/2+.28,d*.19);for(let i=0;i<6;i++)box(1.8,.04,.08,0x525f57,w*.25,h/2+.57,d*.13+i*.13);box(.65,.8,.65,0x847467,-w*.25,h/2+.4,d*.17);}
    if(stage===0&&(type===2||type===4)){for(let i=0;i<4;i++){box(1.15,1.1,1.1,0x9b754c,-w*.3+i*1.35,floor+.8,d*.36);box(1.21,.12,1.16,0xd0ad6c,-w*.3+i*1.35,floor+1.16,d*.36);}box(2.3,1.7,1.25,0x477367,w*.28,floor+1.1,d*.32);}
    if(stage===0&&type===5)for(let i=0;i<3;i++){
      const x=fullW*.42,z=-fullD*.29+i*fullD*.28;rawBox(2.8,.035,.055,0xe2ddc8,x,floor+.278,z+2);rawBox(1.65,.48,3.3,[0x7b9e9a,0xd3ba6b,0xa6523c][i],x,floor+.58,z);rawBox(1.38,.55,1.6,0x2f4950,x,floor+1.08,z);rawBox(1.43,.035,1.55,[0x7b9e9a,0xd3ba6b,0xa6523c][i],x,floor+1.38,z);
    }
  }
  if(stage>=1){
    const chunks=stage===1?14:stage===2?38:54;
    for(let i=0;i<chunks;i++){const x=(random()-.5)*fullW*.92,z=(random()-.5)*fullD*.92,s=.3+random()*.8;add(new THREE.BoxGeometry(s,.2+random()*.55,s*.72),i%4===0?0x706b5d:i%3?0xcfc3a7:roof,x,floor+.76+random()*.28,z,random()*.5,random()*Math.PI,random()*.4);}
  }
  const mesh=finish('building-'+index+'-stage-'+stage);mesh.geometry.scale(1/fullW,1/h,1/fullD);mesh.geometry.computeBoundingSphere();
  const group=new THREE.Group();group.name=mesh.name;group.add(mesh);
  if(stage===0&&typeof document!=='undefined'){
    const label=(city==='london'?['THE CROWN','PETROL','BLACK CAB','WESTMINSTER','ROYAL MAIL','BAKERY']:city==='sydney'?['HARBOUR CAFE','FUEL','SURF SHOP','THE ROCKS','WHARF 02','FISH & CHIPS']:['DINER','GAS & GO','AUTO REPAIR','BAY MOTEL','STORAGE','PIZZA'])[type],canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.font='900 70px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eee5ce';ctx.fillText(label,256,65,480);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const labelGeometry=new THREE.PlaneGeometry(fullW*.62,1.65);labelGeometry.rotateX(-Math.PI/2);
    const ly=type===1?floor+4.01:pitched?floor+3.37:h/2+.2,lz=type===1?fullD*.22:pitched?fullD*.32:centreZ;
    labelGeometry.translate(0,ly,lz);labelGeometry.scale(1/fullW,1/h,1/fullD);
    const roofLabel=new THREE.Mesh(labelGeometry,new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.1,roughness:1,depthWrite:false}));roofLabel.name='store-sign';group.add(roofLabel);
  }
  return group;
}

export function roadLabel(text:string,x:number,z:number,size:number,angle=0,city:CityId='sf'):THREE.Mesh {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
  const ctx=canvas.getContext('2d')!;ctx.font='900 135px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e9e6d8';ctx.fillText(text,256,101,492);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size*.4),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.91,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));
  mesh.rotation.set(-Math.PI/2,0,angle);mesh.position.set(x,cityGroundHeight(city,x,z)+.19,z);return mesh;
}
