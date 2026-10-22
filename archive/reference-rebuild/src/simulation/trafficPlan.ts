import { seeded, type VehicleKind } from '../shared';

export interface TrafficCandidate {
  sequence: number;
  lane: number;
  kind: VehicleKind;
  interval: number;
}

/** Scheduled arrivals are independent of explosions, cargo scatter, and blocked entrances. */
export class TrafficPlan {
  private trafficRand: () => number;
  private sequence = 0;

  constructor(seed: number) { this.trafficRand = seeded(seed); }

  next(laneOverride?: number): TrafficCandidate {
    const plannedLane = Math.floor(this.trafficRand() * 4);
    const lane = laneOverride ?? plannedLane;
    const kinds: VehicleKind[] = ['compact', 'taxi', 'pickup', 'bus', 'van', 'sport', 'semi', 'tanker', 'carrier'];
    let kind = kinds[Math.floor(this.trafficRand() * kinds.length)];
    const interval = 1 + this.trafficRand() * 0.55;
    const sequence = ++this.sequence;
    if (sequence % 19 === 0) kind = 'magnet';
    else if (sequence % 13 === 0) kind = 'booster';
    else if (lane === 2 && sequence % 7 === 0) kind = 'tram';
    return { sequence, lane, kind, interval };
  }
}
