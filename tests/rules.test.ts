import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, RULE_VERSION, seeded } from '../src/shared';
import { challengeFlags, medalFor, recordKey, ScoreKeeper,starsFor,runChallenges,challengeLabels,STAR_THRESHOLDS } from '../src/simulation/rules';

describe('score accounting', () => {
  it('cannot farm points or extend a chain by repeatedly hitting the same wreck', () => {
    const score = new ScoreKeeper();
    const first = score.reward(7, 'hit', 1000, 'compact');
    score.update(3);
    const before = { score: score.score, combo: score.combo, remaining: score.comboTime };

    expect(score.reward(7, 'hit', 1000, 'compact')).toBe(0);
    expect(first).toBeGreaterThan(0);
    expect(score.score).toBe(before.score);
    expect(score.combo).toBe(before.combo);
    expect(score.comboTime).toBe(before.remaining);
    expect(score.crashes).toBe(1);

    score.update(10);
    expect(score.reward(7, 'hit', 1000, 'compact')).toBe(0);
    expect(score.combo).toBe(0);
  });

  it('rewards initial damage and destruction once each, with separate counters', () => {
    const score = new ScoreKeeper();
    const hit = score.reward(42, 'hit', 2000, 'bus');
    const destroyed = score.reward(42, 'destroy', 2000, 'bus');
    expect(destroyed).toBeGreaterThan(hit);
    expect(score.reward(42, 'destroy', 2000, 'bus')).toBe(0);
    expect(score.reward(42, 'hit', 2000, 'bus')).toBe(0);
    expect(score.score).toBe(hit + destroyed);
    expect(score.crashes).toBe(1);
    expect(score.destroyed).toBe(1);
  });

  it('lets a newly reached target keep the chain alive, then expires after inactivity', () => {
    const score = new ScoreKeeper();
    score.reward(1, 'hit', 1000, 'compact');
    score.update(4.9);
    expect(score.combo).toBe(1);
    score.reward(2, 'hit', 1000, 'van');
    expect(score.combo).toBe(2);
    expect(score.comboTime).toBe(5);
    score.update(5.1);
    expect(score.combo).toBe(0);
    expect(score.comboTime).toBe(0);
    expect(score.bestCombo).toBe(2);
    expect(score.score).toBeGreaterThan(0);
  });

  it('pays for destroying an already reached target without extending the chain', () => {
    const score = new ScoreKeeper();
    score.reward(1, 'hit', 1000, 'compact');
    score.update(3);
    expect(score.reward(1, 'destroy', 1000, 'compact')).toBeGreaterThan(0);
    expect(score.combo).toBe(1);
    expect(score.comboTime).toBe(2);

    score.reward(2, 'hit', 1000, 'tanker');
    score.update(6);
    expect(score.reward(2, 'destroy', 1000, 'tanker')).toBeGreaterThan(0);
    expect(score.combo).toBe(0);
    expect(score.comboTime).toBe(0);
    expect(score.bestCombo).toBe(2);
  });

  it('treats immediate destruction as reaching a new target only once', () => {
    const score = new ScoreKeeper();
    score.reward(9, 'destroy', 1000, 'crate');
    expect(score.combo).toBe(1);
    score.update(2);
    score.reward(9, 'hit', 1000, 'crate');
    expect(score.combo).toBe(1);
    expect(score.comboTime).toBe(3);
  });

  it('rewards reaching a different vehicle type during a chain', () => {
    const repeated = new ScoreKeeper();
    const varied = new ScoreKeeper();
    repeated.reward(1, 'hit', 1000, 'compact');
    varied.reward(1, 'hit', 1000, 'compact');
    const sameKind = repeated.reward(2, 'hit', 1000, 'compact');
    const newKind = varied.reward(2, 'hit', 1000, 'tanker');
    expect(newKind).toBeGreaterThan(sameKind);
  });

  it('caps the chain multiplier at eight even for extremely long chains', () => {
    const score = new ScoreKeeper();
    for (let id = 0; id < 100; id++) score.reward(id, 'hit', 1000, 'compact');
    const atOneHundred = score.reward(100, 'hit', 1000, 'compact');
    for (let id = 101; id < 200; id++) score.reward(id, 'hit', 1000, 'compact');
    const atTwoHundred = score.reward(200, 'hit', 1000, 'compact');
    expect(atOneHundred).toBe(1000 * 0.35 * 8);
    expect(atTwoHundred).toBe(atOneHundred);
    expect(score.bestCombo).toBe(201);
  });
});

describe('results and records', () => {
  it('awards medals at their exact score thresholds', () => {
    expect(medalFor(0)).toBe('bronze');
    expect(medalFor(249_999)).toBe('bronze');
    expect(medalFor(250_000)).toBe('silver');
    expect(medalFor(649_999)).toBe('silver');
    expect(medalFor(650_000)).toBe('gold');
  });

  it('keeps records separate for vehicle and build, without splitting equivalent attempts by seed', () => {
    const standard = recordKey(DEFAULT_CONFIG);
    expect(standard).toContain(RULE_VERSION);
    expect(recordKey({ ...DEFAULT_CONFIG, seed: 99999 })).toBe(standard);
    expect(recordKey({ ...DEFAULT_CONFIG, car: 'semi' })).not.toBe(standard);
    expect(recordKey({ ...DEFAULT_CONFIG, blast: 'focused' })).not.toBe(standard);
    expect(recordKey({ ...DEFAULT_CONFIG, passive: 'heavy' })).not.toBe(standard);
    expect(recordKey({ ...DEFAULT_CONFIG, city: 'sydney' })).not.toBe(standard);
    expect(recordKey({ ...DEFAULT_CONFIG, route: 'market' })).not.toBe(standard);
    expect(recordKey({ ...DEFAULT_CONFIG, city: undefined })).toBe(standard);
  });

  it('tracks the three challenges independently and includes exact boundaries', () => {
    expect(challengeFlags(29, 11, 2)).toEqual([false, false, false]);
    expect(challengeFlags(30, 11, 2)).toEqual([true, false, false]);
    expect(challengeFlags(29, 12, 2)).toEqual([false, true, false]);
    expect(challengeFlags(29, 11, 3)).toEqual([false, false, true]);
    expect(challengeFlags(45, 30, 3)).toEqual([true, true, true]);
  });
});

describe('fair local challenges', () => {
  it('gives both players identical random sequences when given the same seed', () => {
    const playerOne = seeded(72191);
    const playerTwo = seeded(72191);
    const differentSession = seeded(72192);
    const values = Array.from({ length: 100 }, () => playerOne());
    expect(Array.from({ length: 100 }, () => playerTwo())).toEqual(values);
    expect(Array.from({ length: 100 }, () => differentSession())).not.toEqual(values);
    expect(values.every(value => value >= 0 && value < 1)).toBe(true);
  });
});

describe('reference-based awards',()=>{
 it('makes early score goals more accessible without granting either achievement from score alone',()=>{
  for(const rules of ['roadtrip','rushhour','pileup','sandbox'] as const){
   const [first,second,third]=STAR_THRESHOLDS[rules];
   expect(first).toBeLessThan(second);expect(second).toBeLessThan(third);
   expect(starsFor(first-1,rules,true,true)).toBe(2);
   expect(starsFor(first,rules,true,true)).toBe(3);
   expect(starsFor(second,rules,true,false)).toBe(3);
   expect(starsFor(third*100,rules,false,false)).toBe(3);
  }
 });
 it('limits score awards to three stars and reserves two for distinct achievements',()=>{
  const score=STAR_THRESHOLDS.roadtrip[2];
  expect(starsFor(score,'roadtrip')).toBe(3);
  expect(starsFor(score,'roadtrip',true,false)).toBe(4);
  expect(starsFor(score,'roadtrip',true,true)).toBe(5);
  expect(runChallenges(0,'roadtrip',true,true)).toEqual([false,false,false,true,true]);
  expect(challengeLabels(DEFAULT_CONFIG)).toHaveLength(5);
  expect(challengeLabels(DEFAULT_CONFIG)[4]).toContain('建筑');
 });
 it('accounts for every building damage stage once without multiplying new-target combo',()=>{
  const score=new ScoreKeeper();score.reward(10,'hit',10000,'building');
  score.update(2);const remaining=score.comboTime;
  score.reward(10,'damage1',10000,'building');score.reward(10,'damage2',10000,'building');score.reward(10,'destroy',10000,'building');
  const total=score.score;expect(score.reward(10,'damage1',10000,'building')).toBe(0);
  expect(score.combo).toBe(1);expect(score.comboTime).toBe(remaining);
  expect(score.breakdown.property).toBe(total);expect(score.breakdown.traffic).toBe(0);
 });
 it('deduplicates skill bonuses and isolates rulesets in records',()=>{
  const score=new ScoreKeeper();expect(score.bonus('flight:1',5000)).toBe(5000);expect(score.bonus('flight:1',5000)).toBe(0);
  expect(score.breakdown).toEqual({traffic:0,property:0,bonus:5000});
  expect(recordKey({...DEFAULT_CONFIG,rules:'pileup'})).not.toBe(recordKey({...DEFAULT_CONFIG,rules:'roadtrip'}));
  expect(recordKey(DEFAULT_CONFIG,'OLD')).not.toBe(recordKey(DEFAULT_CONFIG));
 });
});
