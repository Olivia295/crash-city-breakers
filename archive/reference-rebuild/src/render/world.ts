import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUILDINGS,groundHeight,seeded} from '../shared.ts';

/** One batched vertex-colour mesh for the city, plus readable street-label decals. */
export function buildWorld():THREE.Group {
  const world=new THREE.Group();world.name='San Francisco · Baybreak Junction';
  const geometries:THREE.BufferGeometry[]=[];const color=new THREE.Color();const random=seeded(931);
  const palette=[0xe4c792,0xe79e79,0xaac4af,0xdfd8ad,0xe9b990,0x6faba0,0xe1c27a,0x92babb];
  function part(g:THREE.BufferGeometry,c:number,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const geom=g.index?g.toNonIndexed():g;geom.deleteAttribute('uv');color.set(c);
    const arr=new Float32Array(geom.attributes.position.count*3);for(let i=0;i<arr.length;i+=3){arr[i]=color.r;arr[i+1]=color.g;arr[i+2]=color.b;}
    geom.setAttribute('color',new THREE.BufferAttribute(arr,3));geometries.push(geom);
  }
  function box(w:number,h:number,d:number,c:number,x:number,y:number,z:number){part(new THREE.BoxGeometry(w,h,d),c,x,y,z);}
  function surface(x1:number,x2:number,z1:number,z2:number,c:number,offset=0){
    const steps=Math.max(1,Math.ceil((z2-z1)/4));const positions:number[]=[];
    for(let i=0;i<steps;i++){const a=z1+(z2-z1)*i/steps,b=z1+(z2-z1)*(i+1)/steps,ya=groundHeight(0,a)+offset,yb=groundHeight(0,b)+offset;positions.push(x1,ya,a,x1,yb,b,x2,ya,a,x2,ya,a,x1,yb,b,x2,yb,b);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();part(g,c);
  }
  surface(-67,67,-66,66,0xbaa98a,-.16);
  // Raised sandstone sidewalks trace the road rather than floating through the hill.
  for(const side of [-1,1])surface(side<0?-14:10,side<0?-10:14,-64,64,0xe0c8a4,.19);
  for(const side of [-1,1])surface(-64,64,side<0?-13:9,side<0?-9:13,0xe0c8a4,.2);
  surface(-10,10,-64,64,0x35464c,.015);surface(-64,64,-9,9,0x35464c,.022);
  // Fine warm curb edges and cool asphalt keep every vehicle silhouette legible.
  for(const x of [-10.18,10.18])surface(x-.16,x+.16,-64,64,0xf9ddb0,.23);
  for(const z of [-9.2,9.2])surface(-64,64,z-.13,z+.13,0xf9ddb0,.235);
  for(const x of [-10.18,10.18])surface(x-.18,x+.18,-9.1,9.1,0x35464c,.24);
  for(const z of [-9.2,9.2])surface(-10.3,10.3,z-.18,z+.18,0x35464c,.245);
  // Double yellow centre lines split at the intersection; tram tracks are inset alongside them.
  for(const x of [-.22,.22])for(const z of [-64,11])surface(x-.045,x+.045,z,z<0?-11:64,0xeab45e,.055);
  for(const x of [-4.78,-3.72])surface(x-.055,x+.055,-64,64,0xafbdb8,.055);
  for(let z=-61;z<64;z+=2.4)surface(-4.9,-3.6,z,z+.09,0x7f8e88,.057);
  for(let z=-60;z<61;z+=6)if(Math.abs(z)>12)for(const x of [-6.9,6.8])surface(x-.055,x+.055,z,z+2.4,0xcbd0bc,.06);
  for(let x=-60;x<61;x+=6)if(Math.abs(x)>13){surface(x,x+2.5,-.24,-.14,0xeab45e,.063);surface(x,x+2.5,.14,.24,0xeab45e,.063);surface(x,x+2.4,-5.8,-5.69,0xcbd0bc,.065);surface(x,x+2.4,5.69,5.8,0xcbd0bc,.065);}
  for(const z of [-11,10])for(let x=-8.8;x<9;x+=1.5)surface(x,x+.79,z,z+1.45,0xf0e4c6,.07);
  for(const x of [-12,10.5])for(let z=-7.7;z<8;z+=1.5)surface(x,x+1.5,z,z+.79,0xf0e4c6,.07);
  // Arrow paint uses simple extruded direction glyphs, all part of the static batch.
  function arrow(x:number,z:number,angle:number){const shape=new THREE.Shape();shape.moveTo(-.25,-1.4);shape.lineTo(.25,-1.4);shape.lineTo(.25,.2);shape.lineTo(.85,.2);shape.lineTo(0,1.35);shape.lineTo(-.85,.2);shape.lineTo(-.25,.2);shape.closePath();const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.rotateY(angle);part(g,0xe5ddc6,x,groundHeight(x,z)+.07,z);}
  arrow(3,-20,Math.PI);arrow(-7,21,0);arrow(-21,3,-Math.PI/2);arrow(22,-3,Math.PI/2);
  // City buildings have matching simulation footprints, hand-set miniature facade detail.
  BUILDINGS.forEach((b,index)=>{
    const {x,z,w,d,h}=b,base=groundHeight(x,z),c=palette[index%palette.length];
    box(w,h,d,c,x,base+h/2,z);
    box(w+.28,.35,d+.28,0xe8d5ad,x,base+h-.05,z);
    box(w-.7,.18,d-.7,0x8f9d90,x,base+h+.2,z);
    for(const sx of [-1,1])box(.18,.65,d+.25,0xe8d5ad,x+sx*w/2,base+h+.15,z);
    for(const sz of [-1,1])box(w,.65,.18,0xe8d5ad,x,base+h+.15,z+sz*d/2);
    // Quiet dark storefronts below bright facades; windows sit in masonry surrounds.
    for(const sx of [-1,1]){
      box(.1,2.2,d*.91,0x3e6462,x+sx*(w/2+.04),base+1.55,z);
      for(let row=0;row<Math.floor((h-2.2)/2.6);row++)for(let col=0;col<Math.floor(d/3);col++){
        const wz=z-d/2+1.7+col*3,wy=base+4+row*2.6;
        box(.15,1.69,1.34,0xf4deba,x+sx*(w/2+.045),wy,wz);
        box(.18,1.33,.98,0x3c6869,x+sx*(w/2+.09),wy+.07,wz);
        box(.29,.13,1.49,0xf6e7c8,x+sx*(w/2+.12),wy-.9,wz);
      }
      for(let col=0;col<Math.floor(d/4);col++){const wz=z-d/2+2+col*4;box(1.03,.24,2.9,index%2?0x2e857d:0xc97750,x+sx*(w/2+.46),base+2.8,wz);box(.09,2.05,.16,0xe6d1ab,x+sx*(w/2+.11),base+1.5,wz-1.43);}
    }
    for(const sz of [-1,1]){
      box(w*.9,2.15,.1,0x3f6362,x,base+1.5,z+sz*(d/2+.04));
      for(let row=0;row<Math.floor((h-2.2)/2.6);row++)for(let col=0;col<Math.floor(w/3);col++){
        const wx=x-w/2+1.7+col*3,wy=base+4+row*2.6;
        box(1.4,1.68,.15,0xf0d9b3,wx,wy,z+sz*(d/2+.045));
        box(1.07,1.32,.18,0x396768,wx,wy+.07,z+sz*(d/2+.09));
        box(1.52,.14,.28,0xf4dfb9,wx,wy-.89,z+sz*(d/2+.1));
      }
      for(let col=0;col<Math.floor(w/4);col++)box(2.9,.24,1.02,index%2?0x2e857d:0xc97750,x-w/2+2+col*4,base+2.8,z+sz*(d/2+.45));
    }
    box(w*.29,.55,d*.24,0xbec4ad,x-w*.18,base+h+.54,z+d*.1);
    box(w*.18,.25,d*.25,0x54746f,x+w*.22,base+h+.39,z-d*.2);
    if(index%3===0){part(new THREE.CylinderGeometry(.95,.95,1.6,10),0x9e7960,x+w*.26,base+h+1.4,z+d*.24);part(new THREE.ConeGeometry(1.12,.65,10),0x546964,x+w*.26,base+h+2.48,z+d*.24);}
    // Fire-escape stripe reads at game camera scale without stealing road attention.
    if(index%2===0)for(let k=0;k<3;k++)box(1.7,.11,.53,0x50635d,x-w*.22,base+3.4+k*2.5,z+d/2+.23);
  });
  function tree(x:number,z:number,palm=false){const y=groundHeight(x,z);box(1.65,.23,1.65,0x8a9976,x,y+.22,z);part(new THREE.CylinderGeometry(.16,.24,palm?5:2.3,7),0x917b52,x,y+(palm?2.6:1.3),z);if(palm){for(let i=0;i<7;i++){const g=new THREE.ConeGeometry(.7,3.2,4);g.rotateZ(.98);g.rotateY(i*Math.PI*2/7);part(g,0x498c6c,x,y+5,z);}}else{part(new THREE.IcosahedronGeometry(1.7,1),0x6f9b6a,x,y+3.5,z);part(new THREE.IcosahedronGeometry(1.3,0),0x8aad75,x-.5,y+4.45,z);}}
  for(const x of [-12.25,12.25])for(const z of [-43,-15.2,15.4,41])tree(x,z,z>10);
  for(const z of [-11.35,11.35])for(const x of [-57,-38,37,58])tree(x,z,true);
  // Colour-coded hydrants, traffic signal poles, benches and drainage details.
  for(const [x,z] of [[-11.6,-10.6],[11.7,-10.7],[-11.5,10.7],[11.5,10.7]]){
    const y=groundHeight(x,z);part(new THREE.CylinderGeometry(.09,.13,4.8,7),0x405c5c,x,y+2.4,z);box(.48,1.2,.42,0x2e4145,x,y+4.45,z);for(let i=0;i<3;i++)part(new THREE.SphereGeometry(.13,6,4),i===0?0xee865f:i===2?0x7ed7b1:0x8e8c58,x,y+4.78-i*.33,z+.225);
  }
  for(let i=0;i<12;i++){const z=-56+i*10.4,x=i%2?-9.2:9.2;surface(x-.32,x+.32,z,z+.65,0x283f43,.073);}
  for(const x of [-38,37])for(const z of [-11.5,11.5]){box(2.3,.13,.68,0x785e40,x,.69,z);box(2.3,.7,.13,0x96734c,x,1,z+.33);}
  // A sunny bay and seawall frame the miniature city to the east.
  box(180,.6,240,0x3caaa4,144,-7.6,5);
  box(5,9,137,0xb1b596,68,-4,-1);
  box(5,.38,136,0xe2c89d,66.8,.1,-1);
  for(let z=-65;z<68;z+=4)box(.2,1.1,.2,0xc2d0ae,66.5,.78,z);
  box(.13,.12,134,0xc2d0ae,66.5,1.13,0);
  for(let i=0;i<50;i++){const x=75+random()*58,z=-72+random()*147;box(1+random()*3,.025,.11,0x7bd1bb,x,-7.27,z);}
  box(13,.85,4.6,0xe2b37d,78,-6.3,31);box(8.3,1.35,3.2,0xf5e4b4,78,-5.4,31);box(3.5,1.1,2.4,0x457e80,77,-4.3,31);
  // Bridge towers on the far horizon are scenery, outside the playable collision zone.
  for(const z of [-53,42]){for(const x of [96,104])box(1.7,26,1.5,0xc8734e,x,5,z);for(const y of [0,9,16])box(9.5,1.1,1.4,0xc8734e,100,y,z);}
  box(9,.8,146,0xc77c50,100,-1.8,-5);
  for(let z=-72;z<68;z+=5){const height=1+15*Math.pow(Math.abs((z+5)/73),1.8);for(const x of [96,104])box(.09,height,.1,0xcb966c,x,-1+height/2,z);}
  // Distant silhouette makes the uphill approach feel like a neighbourhood, not a tabletop.
  for(let i=0;i<16;i++){const x=-76+i*9,h=8+random()*20;box(5+random()*4,h,5,0x84b6a7,x,7+h/2,-86-random()*9);}
  const geometry=mergeGeometries(geometries,false)!;geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}));mesh.name='batched-city';mesh.receiveShadow=true;mesh.castShadow=true;world.add(mesh);geometries.forEach(g=>g.dispose());
  return world;
}

export function roadLabel(text:string,x:number,z:number,size:number,angle=0):THREE.Mesh {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
  const ctx=canvas.getContext('2d')!;ctx.font='600 64px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#bcd0c0';ctx.fillText(text,512,64);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size/8),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));
  mesh.rotation.set(-Math.PI/2,0,angle);mesh.position.set(x,groundHeight(x,z)+.11,z);return mesh;
}
