import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLES, type ModelKind, type VehicleKind } from '../shared.ts';

/** Original miniature vehicle kit. Metres, +Z forward, collider-centred origin. */
export function createModel(kind: ModelKind): THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  function add(g: THREE.BufferGeometry, tint: number, x=0,y=0,z=0, rx=0,ry=0,rz=0) {
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const geometry=g.index ? g.toNonIndexed() : g;
    color.set(tint);const values=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(values,3));parts.push(geometry);
  }
  function box(w:number,h:number,l:number,tint:number,x=0,y=0,z=0){add(new THREE.BoxGeometry(w,h,l),tint,x,y,z);}
  function cylinder(r:number,len:number,tint:number,x:number,y:number,z:number,axis:'x'|'z'|'y'='x',segments=10){add(new THREE.CylinderGeometry(r,r,len,segments),tint,x,y,z,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);}
  function cabin(w:number,h:number,l:number,tint:number,y:number,z:number){
    // A chamfered roof and slanted windscreens distinguish this from a box proxy.
    const shape=new THREE.Shape();shape.moveTo(-l/2,0);shape.lineTo(l/2,0);shape.lineTo(l*.32,h);shape.lineTo(-l*.3,h);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:w,bevelEnabled:false,steps:1});
    g.rotateY(Math.PI/2);g.translate(-w/2,y,z);add(g,tint);
    box(w*.93,h*.63,.045,0x203e48,0,y+h*.45,z+l*.35);
    box(w*.93,h*.61,.045,0x294a51,0,y+h*.43,z-l*.35);
    for(const sx of [-1,1]) box(.035,h*.62,l*.48,0x254751,sx*w*.505,y+h*.46,z);
    box(.06,h*.72,.095,tint,-w*.51,y+h*.5,z);box(.06,h*.72,.095,tint,w*.51,y+h*.5,z);
  }
  const defs=VEHICLES as Partial<Record<ModelKind,(typeof VEHICLES)[VehicleKind]>>;
  const def=defs[kind];
  if(def){
    const {width:w,height:h,length:l}=def,c=def.color;
    const big=['bus','semi','tanker','carrier','tram','magnet','van'].includes(kind);
    const tire=big?.34:.27,base=-h/2+tire;
    box(w*.88,.15,l*.86,0x26373c,0,base-.02,0);
    const axles=kind==='semi'||kind==='carrier'?[-l*.35,-l*.2,l*.33]:kind==='bus'||kind==='tanker'?[-l*.34,l*.33]:[-l*.31,l*.3];
    for(const z of axles) for(const sign of [-1,1]){
      cylinder(tire,.22,0x202b30,sign*w*.46,base,z);
      cylinder(tire*.5,.024,0xbac8bf,sign*w*.522,base,z);
    }
    const bodyY=-h/2+tire+.2,bodyH=big?.46:.37;
    box(w*.94,bodyH,l*.95,c,0,bodyY,0);
    box(w*.9,.13,.15,0xe5e9df,0,bodyY-.05,l*.487);
    box(w*.9,.11,.12,0x45545a,0,bodyY-.06,-l*.487);
    for(const sign of [-1,1]){
      box(w*.19,.11,.04,0xffedb6,sign*w*.32,bodyY+.1,l*.497);
      box(w*.14,.1,.04,0xee5447,sign*w*.33,bodyY+.09,-l*.494);
    }
    if(['compact','sport','taxi','booster'].includes(kind)){
      cabin(w*.82,h*.46,l*.5,c,bodyY+bodyH/2,kind==='sport'?-l*.08:0);
      if(kind==='sport'||kind==='booster'){
        box(w*.18,.018,l*.87,0xffe7bb,0,bodyY+bodyH/2+.015,0);
        box(w*.96,.09,.24,0x28383c,0,h*.44,-l*.38);
      }
      if(kind==='taxi'){box(.57,.16,.3,0xffed9c,0,h*.51,0);box(w*.96,.08,l*.64,0x303d41,0,bodyY+.09,0);}
      if(kind==='booster')for(const x of [-w*.3,w*.3]){cylinder(.18,.38,0x343f52,x,bodyY,-l*.48,'z');cylinder(.115,.02,0x97e9ed,x,bodyY,-l*.675,'z');}
    }else if(kind==='pickup'){
      cabin(w*.86,h*.46,l*.4,c,bodyY+bodyH/2,l*.13);
      box(w*.76,.06,l*.36,0x4a504a,0,bodyY+bodyH/2,-l*.26);
      for(const x of [-w*.44,w*.44])box(.15,.28,l*.41,c,x,bodyY+.25,-l*.25);
      box(w*.85,.27,.12,c,0,bodyY+.25,-l*.45);
    }else if(kind==='bus'){
      box(w*.93,h*.69,l*.91,c,0,h*.15,0);
      box(w*.95,.17,l*.92,0xf6e2b0,0,h*.33,0);
      for(const sx of [-1,1])for(let i=0;i<7;i++)box(.025,h*.29,.69,0x254852,sx*w*.47,h*.22,-l*.35+i*l*.115);
      box(w*.83,h*.3,.025,0x254852,0,h*.23,l*.461);
      box(w*.72,.16,.028,0x354d4c,0,h*.43,l*.464);
      box(w*.55,.09,l*.57,0xeee1b5,0,h*.518,0);
      for(const z of [-1.6,1.6])box(w*.46,.12,.68,0xbfc7b7,0,h*.57,z);
    }else if(kind==='tram'){
      box(w*.93,h*.19,l*.92,0xb75e46,0,-h*.13,0);
      box(w*.89,.13,l*.88,0xf7d9a2,0,h*.02,0);
      box(w*1.04,.17,l*.98,0x553f35,0,h*.47,0);
      box(w*.8,.13,l*.84,0xcbaf6e,0,h*.54,0);
      for(const sx of [-1,1])for(let i=0;i<6;i++){box(.075,h*.4,.09,0xf2d69e,sx*w*.44,h*.24,-l*.35+i*l*.14);box(.025,h*.32,l*.095,0x335a5d,sx*w*.443,h*.24,-l*.29+i*l*.14);}
      for(const z of [-l*.43,l*.43]){box(w*.83,h*.3,.03,0x31565c,0,h*.24,z);box(w*.93,.08,.26,0x8b754d,0,-h*.29,z);}
    }else if(kind==='van'){
      box(w*.9,h*.77,l*.58,0xebeee2,0,h*.105,-l*.17);
      cabin(w*.89,h*.6,l*.34,c,bodyY+bodyH/2,l*.3);
      for(const x of [-w*.455,w*.455]){box(.018,h*.2,l*.47,c,x,h*.16,-l*.17);box(.025,.22,.62,0xf9e4a9,x,h*.16,-l*.17);}
    }else{
      const front=l*.32;cabin(w*.9,h*.59,l*.25,c,bodyY+bodyH/2,front);
      if(kind==='semi'){
        box(w*.94,h*.82,l*.64,0xe5ddd1,0,h*.09,-l*.15);
        for(const sx of [-1,1]){box(.015,h*.16,l*.56,c,sx*w*.478,h*.08,-l*.15);for(let i=0;i<8;i++)box(.026,h*.7,.035,0xc9c6b8,sx*w*.477,h*.08,-l*.42+i*l*.076);}
      }else if(kind==='tanker'){
        cylinder(w*.45,l*.63,0xced9d3,0,h*.11,-l*.145,'z',14);
        for(const z of [-l*.37,-l*.16,l*.055]){cylinder(w*.458,.11,0xd8ae52,0,h*.11,z,'z',14);}
        box(.32,.14,l*.5,0x738886,0,h*.57,-l*.15);
      }else if(kind==='carrier'){
        for(const y of [-h*.14,h*.43])box(w*.93,.11,l*.66,c,0,y,-l*.15);
        for(const x of [-w*.44,w*.44])for(const z of [-l*.42,l*.06])box(.1,h*.67,.13,c,x,h*.16,z);
        for(const z of [-l*.33,-l*.04]){box(w*.71,.32,l*.24,0xf0b950,0,h*.49,z);box(w*.56,.28,l*.12,0x244850,0,h*.67,z);}
      }else if(kind==='magnet'){
        box(w*.91,.36,l*.61,c,0,-h*.04,-l*.16);
        box(.26,h*.66,.31,0xecd074,0,h*.24,-l*.26);
        box(.25,.22,l*.32,0xecd074,0,h*.59,-l*.14);
        cylinder(.6,.26,0x364c54,0,h*.25,-l*.04,'y',14);
        cylinder(.62,.07,0x81f3df,0,h*.14,-l*.04,'y',14);
      }
    }
  }else if(kind==='crate'){
    box(1.2,1.2,1.2,0xbe8e52);for(const y of [-.45,.45])box(1.25,.095,1.25,0xead19a,0,y,0);
    for(const x of [-.45,.45])box(.09,1.23,1.24,0xead19a,x,0,0);
  }else if(kind==='barrier'){
    box(3.2,.7,.8,0xe8e5d4,0,-.13,0);box(2.8,.38,.38,0xfbb441,0,.39,0);
    for(const x of [-1,-.3,.4,1.1])box(.22,.38,.4,0x414c4d,x,.4,0);
  }else if(kind==='sign'){
    box(.12,3.6,.12,0x647d7e,0,-.35,0);box(2.4,1.2,.14,0x136c69,0,1.05,0);
    box(1.65,.1,.03,0xf3e4be,0,1.24,.085);box(1.22,.09,.03,0xf3e4be,-.2,.86,.085);
  }else if(kind==='lamp'){
    cylinder(.09,5.2,0x546e70,0,-.4,0,'y',8);box(1.6,.13,.13,0x546e70,.7,2.17,0);box(.66,.13,.36,0xf4d492,1.3,2.08,0);
    cylinder(.22,.25,0x536367,0,-2.88,0,'y',8);
  }else{
    box(7,3.1,.65,0x197f79,0,.5,0);box(7.3,.18,.82,0xf4d591,0,2.1,0);
    for(const x of [-2.4,2.4])box(.28,2,.3,0x506267,x,-1.95,0);
    for(const x of [-2,-.7,.6,1.9])box(.65,1.25,.03,0xf0d7a0,x,.5,.34);
  }
  const merged=mergeGeometries(parts,false)!;
  if(!def){merged.computeBoundingBox();const bounds=merged.boundingBox!,size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());merged.translate(-centre.x,-centre.y,-centre.z);merged.scale(1/size.x,1/size.y,1/size.z);}
  merged.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,metalness:.07});
  const mesh=new THREE.Mesh(merged,material);mesh.name=`${kind}_body`;mesh.castShadow=true;mesh.receiveShadow=true;
  const group=new THREE.Group();group.name=kind;group.add(mesh);group.userData={original:true,units:'metres',forward:'+Z',pivot:'collider centre'};
  parts.forEach(p=>p.dispose());return group;
}
