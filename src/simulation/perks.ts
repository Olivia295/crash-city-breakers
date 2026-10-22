import {seeded,VEHICLES,PLAYER_CARS,type CityId,type GameRules,type MutatorId,type RouteId,type RunConfig,type VehicleKind} from '../shared';

/** Run-long boosts drafted between waves. Each is a one-time pick; effects are read by the simulation. */
export type PerkId='wide'|'chain'|'ember'|'brake'|'recharge'|'heavy'|'cooldown'|'loot'|'pizza';
export interface PerkDef {id:PerkId;name:string;description:string;color:string;icon:string}
export const PERKS:Record<PerkId,PerkDef>={
 wide:{id:'wide',name:'广域冲击',description:'Crashbreaker 爆破半径 +25%',color:'#ffb347',icon:'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3'},
 heavy:{id:'heavy',name:'重装弹头',description:'Crashbreaker 冲击力 +20%',color:'#ff7359',icon:'M5 18h14l-2-8H7zM9 10V6h6v4'},
 chain:{id:'chain',name:'连锁红利',description:'连环爆炸、爆破组合与砸毁连击奖金 +60%',color:'#ffd24a',icon:'M9 7a3 3 0 1 0 0 6h2M15 17a3 3 0 1 0 0-6h-2M9 12h6'},
 ember:{id:'ember',name:'余烬引信',description:'被摧毁的车更快殉爆，殉爆半径 +25%',color:'#ff8a3d',icon:'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3-4z'},
 recharge:{id:'recharge',name:'极速回充',description:'撞到新目标的能量回复 +50%，自然回充 +20%',color:'#6de4d3',icon:'M13 3L6 13h5l-1 8 8-11h-5z'},
 cooldown:{id:'cooldown',name:'技能涡轮',description:'Q 技能冷却 -35%，能量消耗 -30%',color:'#c9a7ff',icon:'M12 4a8 8 0 1 0 8 8M12 8v4l3 2M17 3l3 3-3 3'},
 loot:{id:'loot',name:'高价货柜',description:'所有破坏得分 +20%',color:'#a8e063',icon:'M5 9h14v10H5zM8 9V6h8v3M12 12v4'},
 brake:{id:'brake',name:'紧急路障',description:'立即抵消 1 次逃脱并回复 25% 能量',color:'#7fc4ff',icon:'M4 17h16M6 17V9l6-4 6 4v8M10 17v-5h4v5'},
 pizza:{id:'pizza',name:'披萨热线',description:'披萨车立即加急，奖励效果延长 4 秒',color:'#f7d265',icon:'M4 7a12 12 0 0 1 16 0l-8 14zM10 10h.01M14 11h.01M12 15h.01'},
};
export const PERK_ORDER=Object.keys(PERKS) as PerkId[];

/** Daily modifiers: one rule twist that changes how the same city plays. */
export interface MutatorDef {id:MutatorId;name:string;description:string;color:string;icon:string}
export const MUTATORS:Record<MutatorId,MutatorDef>={
 fuel:{id:'fuel',name:'油罐暴动',description:'约三成车流换成燃料罐车，小心连环殉爆',color:'#ff8a3d',icon:'M7 20V8a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v12M7 20h9M16 10h2a2 2 0 0 1 2 2v5'},
 ice:{id:'ice',name:'冰面路口',description:'路面几乎无摩擦，残骸会一路滑行',color:'#9fe8ff',icon:'M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9'},
 rush:{id:'rush',name:'超速车流',description:'所有车流速度 +25%，封路时间更紧',color:'#ff7359',icon:'M4 17l6-5-6-5M12 17l6-5-6-5'},
 glass:{id:'glass',name:'玻璃大炮',description:'爆破半径 +35%，自然回充速度降到 60%',color:'#c9a7ff',icon:'M12 3l7 6-7 12L5 9z'},
 lowgrav:{id:'lowgrav',name:'月面重力',description:'重力减半，残骸和玩家车飞得更高更远',color:'#8ab4ff',icon:'M12 5a7 7 0 1 0 0 14 4 4 0 0 1 0-14z'},
 gold:{id:'gold',name:'黄金车队',description:'车辆价值 +60%，车流速度 +15%',color:'#ffd24a',icon:'M12 4l2.4 5 5.6.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.6-.8z'},
};
export const MUTATOR_ORDER=Object.keys(MUTATORS) as MutatorId[];

export interface RunStats {buildingsDown:number;specialsDown:number;bestCombo:number;skillshots:number;comboBlasts:number;abilityUses:number;chainDepth:number;escaped:number;finished:boolean}
export const emptyStats=():RunStats=>({buildingsDown:0,specialsDown:0,bestCombo:0,skillshots:0,comboBlasts:0,abilityUses:0,chainDepth:0,escaped:0,finished:false});
/** Optional per-run goals chosen at launch. Completion pays a one-time cash bonus. */
export interface ContractDef {id:string;name:string;description:string;target:number;reward:number;metric:(stats:RunStats)=>number;rules?:GameRules[];color:string}
export const CONTRACTS:ContractDef[]=[
 {id:'demolish',name:'拆迁队',description:'让 3 座建筑完全坍塌',target:3,reward:300000,metric:s=>s.buildingsDown,color:'#e4b072'},
 {id:'carnage',name:'连环狂欢',description:'把连锁推到 ×18',target:18,reward:350000,metric:s=>s.bestCombo,color:'#ffd24a'},
 {id:'hunter',name:'特种猎手',description:'摧毁 5 辆特殊车辆',target:5,reward:300000,metric:s=>s.specialsDown,color:'#7fc4ff'},
 {id:'flyer',name:'空中飞人',description:'完成 3 次远距离落点',target:3,reward:250000,metric:s=>s.skillshots,color:'#a8e063'},
 {id:'skill',name:'技能大师',description:'释放 Q 技能 3 次',target:3,reward:250000,metric:s=>s.abilityUses,color:'#c9a7ff'},
 {id:'combo',name:'爆破组合',description:'两次一爆摧毁 3 辆以上',target:2,reward:300000,metric:s=>s.comboBlasts,color:'#ff7359'},
 {id:'depth',name:'殉爆接力',description:'爆炸连锁深度达到 4 层',target:4,reward:300000,metric:s=>s.chainDepth,color:'#ff8a3d'},
 {id:'clean',name:'零逃脱',description:'终局时没有任何车辆完整逃脱',target:1,reward:500000,metric:s=>s.finished&&s.escaped===0?1:0,rules:['roadtrip','pileup'],color:'#6de4d3'},
];
export const contractById=(id:string)=>CONTRACTS.find(c=>c.id===id);

/** Seeded draft state. `auto` runs never open a draft, which keeps scripted tests and benchmarks unchanged. */
export class DraftState {
 private rand:()=>number;owned:PerkId[]=[];offered:string[]=[];
 constructor(seed:number,private rules:GameRules){this.rand=seeded(seed^0x1d2c3b4a);}
 private pick<T>(pool:T[],count:number):T[]{
  const left=[...pool],out:T[]=[];
  while(out.length<count&&left.length)out.push(left.splice(Math.floor(this.rand()*left.length),1)[0]);
  return out;
 }
 perkOptions():PerkId[]{return this.pick(PERK_ORDER.filter(id=>!this.owned.includes(id)),3);}
 contractOptions():string[]{return this.pick(CONTRACTS.filter(c=>!c.rules||c.rules.includes(this.rules)).map(c=>c.id),3);}
 has(id:PerkId){return this.owned.includes(id);}
}

export interface DailySetup {date:string;config:RunConfig;mutator:MutatorId}
export function dailyKey(now=new Date()):string{
 return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function dailySeed(date:string):number{
 let h=2166136261;for(const ch of `crash-daily:${date}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;
}
/** A date fully determines the setup, so everyone playing the same day shares city, car, rules, traffic and twist. */
export function dailySetup(date=dailyKey()):DailySetup{
 const seed=dailySeed(date),rand=seeded(seed);
 const cities:CityId[]=['sf','sydney','london'];const city=cities[Math.floor(rand()*cities.length)];
 const routes:RouteId[]=['hill','market','pier'];
 const route=routes[Math.floor(rand()*routes.length)];
 const car=PLAYER_CARS[Math.floor(rand()*PLAYER_CARS.length)] as VehicleKind;
 const rules=(['roadtrip','rushhour','pileup'] as GameRules[])[Math.floor(rand()*3)];
 const mutator=MUTATOR_ORDER[Math.floor(rand()*MUTATOR_ORDER.length)];
 return {date,mutator,config:{city,car,route,blast:'radial',passive:'balanced',mode:'solo',seed,rules,daily:date,mutator}};
}
/** Consecutive days (ending today or yesterday) that have a recorded daily run. */
export function dailyStreak(dates:Iterable<string>,today=dailyKey()):number{
 const set=new Set(dates);const day=new Date(`${today}T12:00:00`);if(!set.has(dailyKey(day)))day.setDate(day.getDate()-1);
 let streak=0;while(set.has(dailyKey(day))){streak++;day.setDate(day.getDate()-1);}return streak;
}

/** Cosmetic body colours unlocked by lifetime stars. */
export interface PaintDef {id:string;name:string;color:number;stars:number}
export const PAINTS:PaintDef[]=[
 {id:'stock',name:'原厂涂装',color:0,stars:0},
 {id:'sunset',name:'落日橙',color:0xff7a45,stars:3},
 {id:'ice',name:'冰川蓝',color:0x8fdcff,stars:8},
 {id:'lime',name:'酸橙绿',color:0xa8e03a,stars:15},
 {id:'violet',name:'霓虹紫',color:0x8a5cff,stars:25},
 {id:'obsidian',name:'曜石黑',color:0x2b2f38,stars:40},
 {id:'gold',name:'冠军金',color:0xf2c14e,stars:60},
];
export const paintById=(id?:string)=>PAINTS.find(p=>p.id===id)||PAINTS[0];
export const vehicleBaseColor=(kind:VehicleKind)=>VEHICLES[kind].color;
