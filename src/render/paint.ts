import * as THREE from 'three';
import {VEHICLES,type VehicleKind} from '../shared';

/** Recolours only the vertices that carry the vehicle's body colour, so glass, tyres and lamps keep their own. */
export function applyPaint(object:THREE.Object3D,kind:VehicleKind,paint:number):void {
  if(!paint)return;
  const base=new THREE.Color(VEHICLES[kind].color),target=new THREE.Color(paint),baseLength=Math.hypot(base.r,base.g,base.b)||1;
  object.traverse(child=>{
    if(!(child instanceof THREE.Mesh)||!child.geometry.getAttribute('color'))return;
    const geometry=child.geometry.clone(),colors=geometry.getAttribute('color');
    for(let i=0;i<colors.count;i++){
      const r=colors.getX(i),g=colors.getY(i),b=colors.getZ(i),length=Math.hypot(r,g,b)||1,ratio=length/baseLength;
      if((r*base.r+g*base.g+b*base.b)/(length*baseLength)>.985&&ratio>.45&&ratio<1.6)colors.setXYZ(i,target.r*ratio,target.g*ratio,target.b*ratio);
    }
    colors.needsUpdate=true;child.geometry=geometry;
  });
}
