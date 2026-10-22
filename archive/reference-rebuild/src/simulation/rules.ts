import {RULE_VERSION,type RunConfig,type RunResult} from '../shared';
export class ScoreKeeper {
 score=0;combo=0;bestCombo=0;comboTime=0;crashes=0;destroyed=0;
 private rewarded=new Set<string>();private reached=new Set<number>();private kinds=new Set<string>();
 update(dt:number){this.comboTime=Math.max(0,this.comboTime-dt);if(!this.comboTime){this.combo=0;this.kinds.clear();}}
 reward(id:number,stage:'hit'|'destroy',value:number,kind:string):number {
  const key=`${id}:${stage}`;if(this.rewarded.has(key))return 0;
  this.rewarded.add(key);
  const newTarget=!this.reached.has(id);
  const diverse=newTarget&&!this.kinds.has(kind);
  if(newTarget){this.reached.add(id);this.combo++;this.comboTime=5;this.bestCombo=Math.max(this.bestCombo,this.combo);this.kinds.add(kind);}
  if(stage==='hit')this.crashes++;else this.destroyed++;
  const multiplier=Math.min(8,1+Math.floor(this.combo/4)*0.5);
  const points=Math.round(value*(stage==='hit'?0.35:0.65)*multiplier*(diverse?1.2:1));this.score+=points;return points;
 }
}
export function medalFor(score:number):RunResult['medal'] {return score>=650000?'gold':score>=250000?'silver':'bronze';}
export function recordKey(config:RunConfig){return `${RULE_VERSION}:${config.car}:${config.blast}:${config.passive}`;}
export function challengeFlags(crashes:number,bestCombo:number,mechanisms:number){return [crashes>=30,bestCombo>=12,mechanisms>=3];}
export function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}
