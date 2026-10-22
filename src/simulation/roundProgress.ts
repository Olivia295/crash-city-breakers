import type {Feature,GameRules,RoundStage} from '../shared';
export type RoundAction={kind:'draft'}|{kind:'feature'}|{kind:'pizza'}|{kind:'finale';power:number}|{kind:'inferno'}|{kind:'finish';outcome:'complete'|'escaped'|'timeout'};
/** Counts actual traffic entrants and their first outcome, never rendered debris. */
export class RoundProgress {
 readonly total:number;readonly escapeLimit:number;
 time:number;elapsed=0;spawned=0;resolved=0;escaped=0;crashed=0;wave=1;
 stage:RoundStage='approach';finalePower=1;infernoTime=0;infernoMultiplier=5;
 feature:Feature='none';featureTime=0;outcome:'complete'|'escaped'|'timeout'='complete';
 private ledger=new Map<number,'pending'|'crash'|'escape'|'rescue'>();
 private actions:RoundAction[]=[];private draftMarks=[60,30];private pileDraft=false;private nextWave=20;private nextPizza=10;private finishTimer=0;private infernoAge=0;
 constructor(readonly rules:GameRules){
  // Tuning: Road Trip has 3 x 20 arrivals; Pile Up has 30. Rush Hour's 90s is reference-backed.
  this.total=rules==='roadtrip'?60:rules==='pileup'?30:0;
  this.escapeLimit=rules==='roadtrip'?5:0;
  this.time=rules==='rushhour'?90:rules==='sandbox'?120:180;
 }
 get remaining(){return this.total?Math.max(0,this.total-this.resolved):0;}
 get canSpawn(){return this.stage!=='finale'&&this.stage!=='inferno'&&this.stage!=='complete'&&(!this.total||this.spawned<Math.min(this.total,this.rules==='roadtrip'?this.wave*20:this.total));}
 get featureProgress(){return this.rules==='rushhour'?Math.min(1,(this.crashed%10)/10):Math.min(1,(this.resolved%20)/20);}
 register(id:number){if(this.ledger.has(id)||!this.canSpawn)return false;this.ledger.set(id,'pending');this.spawned++;return true;}
 isPending(id:number){return this.ledger.get(id)==='pending';}
 resolve(id:number,outcome:'crash'|'escape'|'rescue'){
  if(!this.isPending(id))return false;
  this.ledger.set(id,outcome);this.resolved++;
  if(outcome==='crash')this.crashed++;
  if(outcome==='escape')this.escaped++;
  if(outcome==='rescue')this.escaped=Math.max(0,this.escaped-1);
  this.infernoMultiplier=Math.max(1,5-this.escaped);
  if(this.escapeLimit&&this.escaped>=this.escapeLimit){this.finish('escaped');return true;}
  if(this.rules==='rushhour'&&this.crashed>=this.nextPizza){this.nextPizza+=10;this.actions.push({kind:'pizza'});}
  if(this.rules==='roadtrip'&&this.resolved>=this.nextWave&&this.resolved<this.total){this.nextWave+=20;this.wave=Math.min(3,Math.floor(this.resolved/20)+1);this.actions.push({kind:'feature'},{kind:'draft'});}
  if(this.rules==='pileup'&&!this.pileDraft&&this.resolved>=15&&this.resolved<this.total){this.pileDraft=true;this.actions.push({kind:'draft'});}
  if(this.total&&this.resolved>=this.total&&this.spawned>=this.total){
   if(this.rules==='roadtrip')this.beginFinale();
   else if(this.rules==='pileup'){this.stage='inferno';this.infernoTime=10;this.infernoAge=0;this.actions.push({kind:'inferno'});}
  }
  return true;
 }
 start(){if(this.stage==='approach')this.stage='traffic';}
 beginFinale(){if(this.stage==='finale'||this.stage==='complete')return;this.stage='finale';this.finalePower=this.rules==='roadtrip'?Math.max(.8,4*(1-this.escaped/5)):Math.min(4,1+this.crashed/20);this.finishTimer=this.rules==='rushhour'?4.5:8;this.actions.push({kind:'finale',power:this.finalePower});}
 ignite(){if(this.stage==='inferno')this.infernoTime=Math.min(18,this.infernoTime+.65);}
 tick(dt:number,burning:number){
  if(this.stage==='complete')return;this.elapsed+=dt;
  if(this.featureTime>0){this.featureTime=Math.max(0,this.featureTime-dt);if(!this.featureTime&&this.stage!=='finale'){this.feature='none';if(this.stage==='feature')this.stage='traffic';}}
  if(this.stage==='finale'){this.finishTimer-=dt;if(this.finishTimer<=0)this.finish('complete');return;}
  if(this.stage==='inferno'){
   this.infernoAge+=dt;this.infernoTime=Math.max(0,this.infernoTime-dt*(burning>0?.32:1));
   if(!this.infernoTime||this.infernoAge>=40)this.finish('complete');return;
  }
  this.time=Math.max(0,this.time-dt);
  if(this.rules==='rushhour'&&this.draftMarks.length&&this.time<=this.draftMarks[0]){this.draftMarks.shift();this.actions.push({kind:'draft'});}
  if(this.rules==='rushhour'&&this.time<=0)this.beginFinale();
  else if(this.rules==='sandbox'&&this.time<=0)this.finish('complete');
  else if(this.total&&this.time<=0)this.finish('timeout');
 }
 finish(outcome:'complete'|'escaped'|'timeout'){if(this.stage==='complete')return;this.stage='complete';this.outcome=outcome;this.actions.push({kind:'finish',outcome});}
 drain(){return this.actions.splice(0);}
}
