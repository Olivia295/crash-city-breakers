import { seeded, type VehicleKind, type GameRules, type CityId } from '../shared';

export interface TrafficCandidate {
  sequence: number;
  lane: number;
  kind: VehicleKind;
  interval: number;
  mutated?: boolean;
}

/** Scheduled arrivals are independent of explosions, cargo scatter, and blocked entrances. */
export class TrafficPlan {
  private trafficRand: () => number;
  private sequence = 0;

  constructor(seed: number,private rules:GameRules='sandbox',private city:CityId='sf') { this.trafficRand = seeded(seed); }

  next(laneOverride?: number): TrafficCandidate {
    const plannedLane = Math.floor(this.trafficRand() * 4);
    const lane = laneOverride ?? plannedLane;
    const kinds: VehicleKind[] = ['compact', 'taxi', 'pickup', 'bus', 'van', 'sport', 'semi', 'tanker', 'carrier'];
    if(this.city==='sydney')kinds.splice(1,3,'ute','ute','roadtrain');
    if(this.city==='london')kinds.splice(1,3,'blackcab','doubledecker','doubledecker');
    let kind = kinds[Math.floor(this.trafficRand() * kinds.length)];
    const interval = 1 + this.trafficRand() * 0.55;
    const sequence = ++this.sequence;
    if (this.rules==='sandbox'&&sequence % 19 === 0) kind = 'magnet';
    else if (this.rules==='sandbox'&&sequence % 13 === 0) kind = 'booster';
    else if(this.rules!=='sandbox'&&sequence%23===0)kind='icecream';
    else if(this.rules!=='sandbox'&&sequence%19===0)kind='missile';
    else if(this.rules!=='sandbox'&&sequence%15===0)kind='bulldozer';
    else if(this.rules!=='sandbox'&&sequence%11===0)kind='bank';
    else if(this.rules!=='sandbox'&&sequence%8===0)kind='ambulance';
    else if (this.city==='sf'&&lane === 2 && sequence % 7 === 0) kind = 'tram';
    return { sequence, lane, kind, interval };
  }
}
