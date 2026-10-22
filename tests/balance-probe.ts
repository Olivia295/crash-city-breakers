/** Manual calibration: node node_modules/vite-node/vite-node.mjs tests/balance-probe.ts [city]. */
import {GameSimulation} from '../src/simulation/GameSimulation';
import {DEFAULT_CONFIG,type CityId,type GameRules} from '../src/shared';
import {getCity} from '../src/cities';
import {STAR_THRESHOLDS} from '../src/simulation/rules';

await GameSimulation.init();
const requested=process.argv[2];
for(const city of (requested?[requested]:['sf','sydney','london']) as CityId[])for(const rules of ['roadtrip','rushhour','pileup'] as GameRules[])for(const strategy of ['junction','occasional'])for(const seed of [72191,19073]){
 const game=new GameSimulation({...DEFAULT_CONFIG,city,rules,seed});game.start();let target={...getCity(city).center},elapsed=0,blasts=0,draws=0;
 const events=new Set<number>();
 for(let frame=0;frame<185*30&&game.phase!=='ended';frame++){
  const p=game.entities.get(game.playerId)!.body.translation(),phase=frame%240;
  if(strategy==='occasional'&&phase===0){target={...getCity(city).center};let distance=32;
   for(const entity of game.entities.values()){if(entity.player||entity.wrecked||entity.scale)continue;const q=entity.body.translation(),d=Math.hypot(q.x-p.x,q.z-p.z);if(d<distance){distance=d;target={x:q.x,z:q.z};}}
  }
  if(strategy==='occasional'&&phase===60)target={...getCity(city).center};
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1,moving=strategy==='occasional'&&(phase<60||d>22);
  game.update(1/30,{x:moving?dx/d:0,z:moving?dz/d:0,aim:{x:dx/d,y:0,z:dz/d},blast:frame%75===0,ability:strategy==='occasional'&&frame%480===0});elapsed+=1/30;
  for(const event of game.snapshot().events){if(events.has(event.id))continue;events.add(event.id);if(event.text==='CRASHBREAKER!')blasts++;if(event.text==='PIZZA OF FORTUNE!')draws++;}
 }
 const result=game.result();console.log(JSON.stringify({city,rules,strategy,seed,score:result.score,scoreStars:STAR_THRESHOLDS[rules].filter(n=>result.score>=n).length,totalStars:result.stars,outcome:result.outcome,escaped:result.escaped,elapsed:Math.round(elapsed*10)/10,blasts,draws,traffic:game.round.resolved}));game.dispose();
}
