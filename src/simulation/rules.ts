import {RULE_VERSION,VEHICLES,type GameRules,type RunConfig,type RunResult,type ScoreBreakdown} from '../shared';
export const STAR_THRESHOLDS:Record<GameRules,readonly number[]>={
 roadtrip:[450000,1400000,4000000],rushhour:[350000,1200000,3800000],
 pileup:[250000,900000,3000000],sandbox:[150000,350000,650000],
}; // Prototype balancing values, not claimed to be original-game thresholds.
export function runChallenges(score:number,rules:GameRules='roadtrip',superTriggered=false,localChallenge=false){return [...STAR_THRESHOLDS[rules].map(value=>score>=value),superTriggered,localChallenge];}
export function starsFor(score:number,rules:GameRules='roadtrip',superTriggered=false,localChallenge=false){return runChallenges(score,rules,superTriggered,localChallenge).filter(Boolean).length;}
export function starProgressFor(score:number,rules:GameRules='roadtrip'){const thresholds=STAR_THRESHOLDS[rules],stars=thresholds.filter(value=>score>=value).length;return stars>=3?1:clamp((score-(thresholds[stars-1]||0))/(thresholds[stars]-(thresholds[stars-1]||0)),0,1);}
export function challengeLabels(config:RunConfig){return [...STAR_THRESHOLDS[config.rules||'roadtrip'].map(value=>`达到 $${value.toLocaleString()}`),config.rules==='sandbox'?'完整完成一局':'触发终局事件','本地挑战：建筑坍塌或收集钱袋'];}
export class ScoreKeeper {
 score=0;combo=0;bestCombo=0;comboTime=0;crashes=0;destroyed=0;multiplier=1;
 breakdown:ScoreBreakdown={traffic:0,property:0,bonus:0};
 private rewarded=new Set<string>();private reached=new Set<number>();private kinds=new Set<string>();
 update(dt:number){this.comboTime=Math.max(0,this.comboTime-dt);if(!this.comboTime){this.combo=0;this.kinds.clear();}}
 get chain(){return Math.min(8,1+Math.floor(this.combo/4)*.5);}
 hasReached(id:number){return this.reached.has(id);}
 reward(id:number,stage:'hit'|'damage1'|'damage2'|'destroy',value:number,kind:string):number {
  const key=`${id}:${stage}`;if(this.rewarded.has(key))return 0;
  this.rewarded.add(key);const newTarget=!this.reached.has(id),diverse=newTarget&&!this.kinds.has(kind);
  if(newTarget){this.reached.add(id);this.combo++;this.comboTime=5;this.bestCombo=Math.max(this.bestCombo,this.combo);this.kinds.add(kind);}
  if(stage==='hit')this.crashes++;else if(stage==='destroy')this.destroyed++;
  const chain=this.chain;
  const share=kind==='building'?{hit:.1,damage1:.15,damage2:.25,destroy:.5}[stage]:stage==='hit'?.35:stage==='destroy'?.65:0;
  const points=Math.round(value*share*chain*(diverse?1.2:1)*this.multiplier);
  this.score+=points;this.breakdown[kind in VEHICLES?'traffic':'property']+=points;return points;
 }
 bonus(key:string,value:number){if(this.rewarded.has(`bonus:${key}`))return 0;this.rewarded.add(`bonus:${key}`);const points=Math.max(0,Math.round(value));this.score+=points;this.breakdown.bonus+=points;return points;}
}
export function medalFor(score:number,rules?:GameRules):RunResult['medal']{if(rules){const stars=starsFor(score,rules);return stars>=3?'gold':stars>=2?'silver':'bronze';}return score>=650000?'gold':score>=250000?'silver':'bronze';}
export function recordKey(config:RunConfig,version=RULE_VERSION){return `${version}:${config.city||'sf'}:${config.route}:${config.rules||'roadtrip'}:${config.car}:${config.blast}:${config.passive}${config.daily?':daily-'+config.daily:''}`;}
export function challengeFlags(crashes:number,bestCombo:number,mechanisms:number){return [crashes>=30,bestCombo>=12,mechanisms>=3];}
export function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}
