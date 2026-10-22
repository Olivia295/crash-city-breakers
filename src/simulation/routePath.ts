import type {Vec3} from '../shared';

/** Arc-length placement keeps long and curved lanes from seeding cars inside the next block. */
export function sampleLane(path:Vec3[],distance:number){
 if(distance<0){const a=path[0],b=path[1],length=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:a.x+(b.x-a.x)*distance/length,z:a.z+(b.z-a.z)*distance/length,dx:(b.x-a.x)/length,dz:(b.z-a.z)/length,index:1};}
 let remaining=Math.max(0,distance);
 for(let index=1;index<path.length;index++){
  const a=path[index-1],b=path[index],length=Math.hypot(b.x-a.x,b.z-a.z)||1;
  if(remaining<=length||index===path.length-1){const t=Math.min(1,remaining/length);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,dx:(b.x-a.x)/length,dz:(b.z-a.z)/length,index};}
  remaining-=length;
 }
 throw new Error('Traffic lanes require at least two points');
}
