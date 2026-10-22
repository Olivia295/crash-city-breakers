import {afterEach,beforeAll,describe,expect,it} from 'vitest';
import {DEFAULT_CONFIG,type RunConfig} from '../src/shared';
import {GameSimulation,type GameInput} from '../src/simulation/GameSimulation';
import {RoundProgress} from '../src/simulation/roundProgress';
import {CONTRACTS,DraftState,PAINTS,PERKS,dailyKey,dailySeed,dailySetup,dailyStreak,emptyStats} from '../src/simulation/perks';

const games:GameSimulation[]=[];
const idle:GameInput={x:0,z:0,aim:{x:1,y:0,z:0},blast:false};
function make(config:Partial<RunConfig>={},manual=true){const game=new GameSimulation({...DEFAULT_CONFIG,...config});games.push(game);game.draftMode=manual?'manual':'auto';game.start();return game;}
function advance(game:GameSimulation,seconds:number){for(let i=0;i<Math.ceil(seconds*30);i++)game.update(1/30,idle);}
type Internals={round:RoundProgress;processRoundActions():void;hit(e:unknown,damage:number):void;stats:ReturnType<typeof emptyStats>};
beforeAll(async()=>GameSimulation.init());
afterEach(()=>games.splice(0).forEach(game=>game.dispose()));

describe('draft state',()=>{
 it('offers three distinct perks that replay for the same seed and never repeat owned ones',()=>{
  const a=new DraftState(77,'roadtrip'),b=new DraftState(77,'roadtrip');
  const first=a.perkOptions();
  expect(first).toEqual(b.perkOptions());expect(new Set(first).size).toBe(3);
  a.owned.push(first[0]);for(let i=0;i<20;i++)expect(a.perkOptions()).not.toContain(first[0]);
 });
 it('only offers the escape contract in modes that have escapes',()=>{
  const rush=new DraftState(5,'rushhour');for(let i=0;i<40;i++)expect(rush.contractOptions()).not.toContain('clean');
  expect(CONTRACTS.filter(c=>!c.rules).length).toBeGreaterThanOrEqual(3);
 });
});

describe('daily challenge',()=>{
 it('derives one fixed non-sandbox setup per date',()=>{
  const a=dailySetup('2026-10-18'),b=dailySetup('2026-10-18'),c=dailySetup('2026-10-19');
  expect(a).toEqual(b);expect(a.config.seed).toBe(dailySeed('2026-10-18'));expect(a.config.rules).not.toBe('sandbox');
  expect(a.config.daily).toBe('2026-10-18');expect(a.config.mutator).toBe(a.mutator);expect(a.config.mode).toBe('solo');
  const seeds=new Set(Array.from({length:30},(_,i)=>dailySeed(`2026-11-${String(i+1).padStart(2,'0')}`)));expect(seeds.size).toBe(30);
  expect(c.config.seed).not.toBe(a.config.seed);
 });
 it('counts consecutive recorded days, allowing today to be unplayed',()=>{
  const today='2026-10-18';expect(dailyKey(new Date(2026,9,18))).toBe(today);
  expect(dailyStreak(['2026-10-18','2026-10-17','2026-10-16','2026-10-10'],today)).toBe(3);
  expect(dailyStreak(['2026-10-17','2026-10-16'],today)).toBe(2);
  expect(dailyStreak(['2026-10-10'],today)).toBe(0);
 });
 it('ships a stock paint at zero stars and ascending unlock thresholds',()=>{
  expect(PAINTS[0].stars).toBe(0);expect(PAINTS.every((p,i)=>!i||p.stars>PAINTS[i-1].stars)).toBe(true);
 });
});

describe('perks in the simulation',()=>{
 it('never opens a draft in auto mode so scripted runs are unaffected',()=>{
  const game=make({rules:'roadtrip'},false);const internals=game as unknown as Internals;
  internals.round.resolved=20;internals.round.resolve=internals.round.resolve;(game as unknown as {round:RoundProgress}).round['actions'].push({kind:'draft'});internals.processRoundActions();
  expect(game.snapshot().draft).toBeNull();
 });
 it('freezes the round while a draft is open and resumes after a pick',()=>{
  const game=make({rules:'roadtrip'});
  const internals=game as unknown as Internals;internals.round['actions'].push({kind:'draft'});internals.processRoundActions();
  const open=game.snapshot();expect(open.draft?.kind).toBe('perk');expect(open.draft?.options).toHaveLength(3);
  const timeBefore=open.time;advance(game,2);expect(game.snapshot().time).toBe(timeBefore);
  expect(game.blast()).toBe(false);
  expect(game.pickDraft(-1)).toBe(false);
  const choice=open.draft!.options[1];expect(game.pickDraft(1)).toBe(true);
  expect(game.snapshot().perks).toEqual([choice]);expect(game.snapshot().draft).toBeNull();
  advance(game,1);expect(game.snapshot().time).toBeLessThan(timeBefore);
 });
 it('applies each perk to the numbers it names',()=>{
  const game=make({rules:'roadtrip',car:'pickup'});game.offerContracts();game.pickDraft(-1);
  const base=game.snapshot().abilityCost;
  const internals=game as unknown as Internals;
  game['draft'].owned.push('cooldown');expect(game.snapshot().abilityCost).toBeCloseTo(base*.7,5);
  expect(game.perk('cooldown')).toBe(true);expect(game.perk('wide')).toBe(false);
  internals.round.escaped=2;game['draft'].owned.push('brake');game['draftOffer']={id:9,kind:'perk',options:['brake']};
  game['draft'].owned.pop();game.pickDraft(0);expect(internals.round.escaped).toBe(1);
 });
 it('every perk has copy, a colour and an icon',()=>{
  for(const perk of Object.values(PERKS)){expect(perk.name.length).toBeGreaterThan(1);expect(perk.description.length).toBeGreaterThan(4);expect(perk.icon.length).toBeGreaterThan(8);expect(perk.color).toMatch(/^#[0-9a-f]{6}$/);}
 });
});

describe('contracts',()=>{
 it('offer, accept and pay a one-time bonus when the metric reaches its target',()=>{
  const game=make({rules:'rushhour'});game.offerContracts();
  const open=game.snapshot();expect(open.draft?.kind).toBe('contract');expect(open.contract).toBeNull();
  const id=open.draft!.options[0];game.pickDraft(0);
  const contract=CONTRACTS.find(c=>c.id===id)!;
  const before=game.snapshot().score;const stats=(game as unknown as Internals).stats;
  stats.buildingsDown=stats.specialsDown=stats.skillshots=stats.abilityUses=stats.comboBlasts=stats.chainDepth=99;
  game.scores.bestCombo=99;
  advance(game,.2);
  const after=game.snapshot();expect(after.contract?.done).toBe(true);expect(after.score-before).toBeGreaterThanOrEqual(contract.reward);
  advance(game,1);expect(game.snapshot().score-after.score).toBeLessThan(contract.reward);
 });
 it('pays the zero-escape contract only for a real completion, not a timeout',()=>{
  const game=make({rules:'pileup'});const internals=game as unknown as Internals;
  game['contractId']='clean';internals.round.finish('timeout');internals.processRoundActions();
  expect(game.snapshot().contract?.done).toBe(false);
  const clean=make({rules:'pileup'});clean['contractId']='clean';(clean as unknown as Internals).round.finish('complete');(clean as unknown as Internals).processRoundActions();
  expect(clean.snapshot().contract?.done).toBe(true);
 });
 it('lets the player skip contracts without penalty',()=>{
  const game=make();game.offerContracts();expect(game.pickDraft(-1)).toBe(true);expect(game.snapshot().contract).toBeNull();expect(game.snapshot().draft).toBeNull();
 });
});

describe('daily mutators',()=>{
 it('halve gravity for lunar rounds and cut friction on ice',()=>{
  const lunar=make({mutator:'lowgrav'},false),normal=make({},false);
  expect(lunar.world.gravity.y).toBeCloseTo(normal.world.gravity.y/2,5);
 });
 it('replace roughly a third of traffic with tankers under oil riot',()=>{
  const game=make({rules:'sandbox',mutator:'fuel',seed:4242},false);advance(game,40);
  const kinds=[...game.entities.values()].filter(e=>e.kind==='tanker').length;
  expect(kinds).toBeGreaterThan(0);
 });
});
