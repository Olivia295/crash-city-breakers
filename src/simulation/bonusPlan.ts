import {seeded,type Feature} from '../shared';

/** Positive rewards use their own shuffled bag, independent of traffic and physics randomness. */
export class BonusPlan {
 private random:()=>number;private bag:Feature[]=[];private previous:Feature='none';
 constructor(seed:number){this.random=seeded(seed^0x24f3a719);}
 nextFeature():Feature{
  if(!this.bag.length){
   this.bag=['goodcop','magnet','double','freeze'];
   for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
   if(this.bag[this.bag.length-1]===this.previous)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag[this.bag.length-1],this.bag[0]];
  }
  this.previous=this.bag.pop()!;return this.previous;
 }
}
