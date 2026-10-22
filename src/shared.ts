export type VehicleKind = 'compact'|'sport'|'pickup'|'bus'|'van'|'semi'|'tanker'|'carrier'|'tram'|'taxi'|'booster'|'magnet'|'ambulance'|'bank'|'pizza'|'bulldozer'|'police'|'missile'|'icecream'|'doubledecker'|'blackcab'|'ute'|'roadtrain';
export type PropKind = 'crate'|'barrier'|'sign'|'lamp'|'facade'|'building'|'money'|'trailer';
export type ModelKind = VehicleKind|PropKind;
export interface Vec3 {x:number;y:number;z:number}
export interface Quat {x:number;y:number;z:number;w:number}
export interface VehicleDef {id:VehicleKind;name:string;tag:string;description:string;color:number;width:number;height:number;length:number;mass:number;speed:number;value:number;health:number;special?:string}
export const VEHICLES: Record<VehicleKind,VehicleDef> = {
 compact:{id:'compact',name:'小旋风',tag:'轻盈 · 灵活',description:'轻巧的城市小车，爆破后容易飞跃，空中调整最灵活。',color:0x56c9b5,width:1.8,height:1.15,length:3.3,mass:850,speed:13,value:1200,health:42},
 sport:{id:'sport',name:'赤线 GT',tag:'高速 · 穿透',description:'最快的入场速度；用集中冲击切穿车流。',color:0xf45d41,width:1.95,height:1.05,length:4.2,mass:1150,speed:21,value:2400,health:55},
 pickup:{id:'pickup',name:'野牛皮卡',tag:'平衡 · 重击',description:'质量与机动兼顾，最适合把一堆残骸推入另一条街。',color:0xf0bc58,width:2.05,height:1.5,length:4.7,mass:1950,speed:14,value:1800,health:78},
 bus:{id:'bus',name:'城市巴士',tag:'长车身封路',description:'横过来就能堵住几条车道；急刹时形成后方追撞。',color:0xeab957,width:2.45,height:2.35,length:8,mass:4800,speed:10,value:4800,health:115},
 van:{id:'van',name:'鲜货配送车',tag:'散落货物',description:'撞开车厢后散落货箱，形成二次障碍。',color:0x80b1cf,width:2.2,height:2.15,length:5,mass:2350,speed:11,value:2500,health:70,special:'cargo'},
 semi:{id:'semi',name:'铁山重卡',tag:'超重 · 封锁',description:'沉重且不易转向，入场冲击与大范围堵路能力最强。',color:0xd46b46,width:2.55,height:2.4,length:9,mass:6600,speed:10,value:6200,health:150,special:'jackknife'},
 tanker:{id:'tanker',name:'燃料罐车',tag:'延迟爆炸',description:'受损后先闪烁预警，再引爆周围交通。',color:0xe4e7db,width:2.5,height:2.55,length:7.5,mass:5100,speed:10,value:7500,health:88,special:'fuel'},
 carrier:{id:'carrier',name:'车辆运输车',tag:'释放小车',description:'车架破坏后，所载小车滚落并参与碰撞。',color:0x3c8691,width:2.6,height:2.45,length:8.5,mass:5000,speed:9,value:6500,health:105,special:'carrier'},
 tram:{id:'tram',name:'山城缆车',tag:'轨道 · 大惯性',description:'旧金山专属。沿固定轨道穿行，重载车体不容易停下。',color:0xaf5441,width:2.45,height:2.6,length:7,mass:5500,speed:11,value:7000,health:125,special:'rail'},
 taxi:{id:'taxi',name:'海湾出租车',tag:'寻找空隙',description:'遇到堵路会尝试变道，从残骸间找出口。',color:0xf5d158,width:1.85,height:1.3,length:4.2,mass:1350,speed:16,value:2000,health:50,special:'dodge'},
 booster:{id:'booster',name:'脉冲改装车',tag:'特殊 · 二次推进',description:'首次重撞激活推进器，向前冲出并引发第二次碰撞。',color:0xa58bf0,width:2,height:1.1,length:4.4,mass:1350,speed:18,value:4200,health:68,special:'boost'},
 magnet:{id:'magnet',name:'磁力回收车',tag:'特殊 · 吸附残骸',description:'受撞激活磁场，将附近受损车辆拉到一起。',color:0x70bfc9,width:2.5,height:2.2,length:6,mass:3600,speed:10,value:5500,health:100,special:'magnet'},
 ambulance:{id:'ambulance',name:'救护车',tag:'放行 · 消除逃脱',description:'为它留出通道。安全驶离后抵消一次逃脱处罚。',color:0xf0eee5,width:2.1,height:2,length:5,mass:2500,speed:12,value:8000,health:80,special:'rescue'},
 bank:{id:'bank',name:'运钞车',tag:'金库 · 收集钱袋',description:'炸开装甲金库，控制残骸靠近散落的钱袋领取奖金。',color:0x7f8c79,width:2.3,height:2.3,length:5.8,mass:4300,speed:10,value:18000,health:125,special:'cash'},
 pizza:{id:'pizza',name:'披萨配送车',tag:'幸运轮盘',description:'摧毁后转动幸运披萨，获得一个临时事件。',color:0xe5bd53,width:2.1,height:2,length:4.6,mass:1900,speed:12,value:6500,health:58,special:'fortune'},
 bulldozer:{id:'bulldozer',name:'推土机',tag:'清障 · 冲散封锁',description:'铲开堵路的残骸，重新打通车流出口。',color:0xe8b63f,width:2.7,height:2.4,length:5.7,mass:8200,speed:8,value:14000,health:180,special:'clear'},
 police:{id:'police',name:'追击警车',tag:'坏警察 · 爆破干扰',description:'追击玩家残骸，接触后暂时干扰 Crashbreaker。',color:0x253944,width:2,height:1.4,length:4.6,mass:1800,speed:18,value:7000,health:70,special:'chase'},
 missile:{id:'missile',name:'导弹运输车',tag:'远端连锁',description:'被摧毁时发射导弹，轰炸场上的另一处目标。',color:0x728056,width:2.5,height:2.5,length:6.8,mass:4300,speed:9,value:15000,health:90,special:'missile'},
 icecream:{id:'icecream',name:'冰淇淋车',tag:'冰冻 · 暂停车流',description:'摧毁后让附近交通短暂冻结，为重新封路争取时间。',color:0xeb9cae,width:2.2,height:2.2,length:4.8,mass:2400,speed:10,value:8000,health:65,special:'freeze'},
 doubledecker:{id:'doubledecker',name:'伦敦双层巴士',tag:'侧翻 · 横封车道',description:'高重心红色双层巴士；首次重撞会倾倒，整段车身横封环岛。',color:0xcb242b,width:2.5,height:3.7,length:8.8,mass:6900,speed:10,value:11000,health:125,special:'topple'},
 blackcab:{id:'blackcab',name:'伦敦黑出租',tag:'钻缝 · 短距冲刺',description:'堵车时寻找侧面空隙，突然加速绕开残骸。先封缺口再引爆。',color:0x202630,width:2,height:1.7,length:4.5,mass:1900,speed:14,value:4200,health:66,special:'squeeze'},
 ute:{id:'ute',name:'悉尼工程皮卡',tag:'工具散落 · 二次推进',description:'撞落工具箱，把街口变成障碍场；被爆炸击中后向前猛冲。',color:0xf0f0df,width:2.15,height:1.7,length:5.2,mass:2500,speed:15,value:4500,health:72,special:'tools'},
 roadtrain:{id:'roadtrain',name:'港口双挂重卡',tag:'脱挂 · 连环路障',description:'拖着两节集装箱，撞击脱挂后留下两段独立重型路障。',color:0x267eb6,width:2.6,height:2.9,length:13,mass:8900,speed:9,value:13000,health:165,special:'detach'},

};
export const PLAYER_CARS: VehicleKind[]=['compact','sport','pickup','semi'];
export const PLAYER_STATS:Partial<Record<VehicleKind,{power:number;aftertouch:number}>>={compact:{power:3,aftertouch:7},sport:{power:4,aftertouch:5},pickup:{power:5,aftertouch:4},semi:{power:7,aftertouch:2}};
export type CityId='sf'|'sydney'|'london';
export const PLAYER_ABILITIES:Partial<Record<VehicleKind,{name:string;tag:string;description:string;cooldown:number;cost:number;color:string}>>={
 compact:{name:'磁吸弹跳',tag:'聚拢 → 腾空',description:'吸入附近车辆，再弹跳落位；把分散车流聚成下一次连爆。',cooldown:12,cost:.15,color:'#6de4d3'},
 sport:{name:'三连穿刺',tag:'瞄准 → 贯穿',description:'向鼠标方向连续三次冲刺，穿透堵塞，追击远处高价值车辆。',cooldown:10,cost:.2,color:'#ff7359'},
 pickup:{name:'废铁投手',tag:'收集 → 抛投',description:'将附近最多五件残骸投向瞄准方向，用旧事故引出新事故。',cooldown:11,cost:.1,color:'#ffd26b'},
 semi:{name:'重锤封街',tag:'震地 → 横封',description:'震开近处车辆并横摆车身，制造持续拦截后续车流的重型路障。',cooldown:15,cost:.25,color:'#c9a7ff'},
};
export type RouteId = 'hill'|'market'|'pier';
export const ROUTES = [
 {id:'hill' as const,name:'01 / 加州街下坡',short:'山顶俯冲',description:'利用坡道加速，迎击缆车，把重车横推到十字路口。',x:3,z:-52,dx:0,dz:1,color:'#ffc76b'},
 {id:'market' as const,name:'02 / 市场横街',short:'货运连锁',description:'先撞配送车和货箱，再把散落物推入主干道。',x:-51,z:3,dx:1,dz:0,color:'#78d3c5'},
 {id:'pier' as const,name:'03 / 海湾引道',short:'燃料引爆',description:'从海湾切入，利用罐车的延迟爆炸扩散事故。',x:51,z:-3,dx:-1,dz:0,color:'#ef9680'},
];
export type BlastMod = 'radial'|'focused'|'leap';
export type PassiveMod = 'balanced'|'heavy'|'elastic';
export const BLAST_MODS = [{id:'radial' as const,name:'环形冲击',description:'范围广，适合扩大连锁'},{id:'focused' as const,name:'定向破城',description:'向瞄准方向推得更远，范围较窄'},{id:'leap' as const,name:'跃迁爆破',description:'更高的腾空，跨越堵塞重新落位'}];
export const PASSIVE_MODS = [{id:'balanced' as const,name:'标准底盘',description:'均衡手感与恢复速度'},{id:'heavy' as const,name:'重型配重',description:'更强推动力，空中控制较弱'},{id:'elastic' as const,name:'弹性悬挂',description:'腾空更高，封路稳定性较低'}];
export type GameRules = 'roadtrip'|'rushhour'|'pileup'|'sandbox';
export type Feature = 'none'|'goodcop'|'badcop'|'magnet'|'double'|'freeze'|'tornado'|'airstrike'|'tidalwave'|'ufo'|'asteroid'|'monster';
export type RoundStage = 'approach'|'traffic'|'feature'|'finale'|'inferno'|'complete';
export interface ScoreBreakdown {traffic:number;property:number;bonus:number}
export type MutatorId='fuel'|'ice'|'rush'|'glass'|'lowgrav'|'gold';
export interface RunConfig {city?:CityId;car:VehicleKind;route:RouteId;blast:BlastMod;passive:PassiveMod;mode:'solo'|'versus';seed:number;rules?:GameRules;daily?:string;mutator?:MutatorId;paint?:string}
export interface RenderEntity {id:number;kind:ModelKind;p:Vec3;q:Quat;v:Vec3;damage:number;destroyed:boolean;player:boolean;active:boolean;scale?:Vec3;fuse?:number;buildingIndex?:number;stage?:0|1|2|3;burning?:number;frozen?:boolean}
export type EventKind='impact'|'explosion'|'score'|'special'|'mechanism'|'warning'|'launch'|'end';
export interface GameEvent {id:number;kind:EventKind;p:Vec3;power:number;text?:string;color?:string;effect?:Feature|'collapse'|'super'|'ambulance'|'bank'|'pizza'|'ability'|'city'|'mega'|'perk'|'contract';sourceId?:number}
export type MechanismId = 'signal'|'cargo'|'billboard';
export const MECHANISMS = [{id:'signal' as const,name:'绿灯浪潮',description:'放行加速车流，冲进堵塞路口',x:0,z:0},{id:'cargo' as const,name:'货架倾落',description:'让货物落入市场街，形成新障碍',x:-19,z:2},{id:'billboard' as const,name:'广告牌倒塌',description:'倒下的广告架横封海湾车道',x:18,z:-3}];
export interface DraftView {id:number;kind:'perk'|'contract';options:string[]}
export interface ContractView {id:string;progress:number;target:number;done:boolean;reward:number}
export interface GameSnapshot {draft:DraftView|null;perks:string[];contract:ContractView|null;abilityCost:number;chainMultiplier:number;bonusNextIn?:number;pizzaOnField?:boolean;bonusDraws?:number;abilityReady:boolean;abilityCooldown:number;abilityActive:number;cityEvent:{name:string;description:string;progress:number;triggered:boolean};phase:'ready'|'running'|'paused'|'ended';time:number;score:number;combo:number;comboTime:number;bestCombo:number;crashes:number;destroyed:number;blastCharge:number;interventions:number;slowMotion:boolean;aim:Vec3;playerId:number;entities:RenderEntity[];events:GameEvent[];config:RunConfig;notice:string;fps?:number;stars?:number;starProgress?:number;challengeProgress:number[];trafficTotal:number;trafficRemaining:number;escaped:number;escapeLimit:number;wave:number;featureProgress:number;feature:Feature;featureTime:number;roundStage:RoundStage;finalePower:number;infernoTime:number;infernoMultiplier:number;breakdown:ScoreBreakdown;}
export interface RunResult {score:number;bestCombo:number;crashes:number;destroyed:number;config:RunConfig;medal:'gold'|'silver'|'bronze';challenges:boolean[];perks?:string[];contract?:{id:string;done:boolean;reward:number};timestamp:number;ruleVersion?:string;outcome?:'complete'|'escaped'|'timeout';escaped?:number;stars?:number;breakdown?:ScoreBreakdown}
export type Language='zh'|'en';
export interface Settings {volume:number;music:number;shake:boolean;quality:'high'|'low';language:Language}
export interface Profile {stars:number;paint:string;best:Record<string,number>}
export const DEFAULT_CONFIG:RunConfig={city:'sf',car:'compact',route:'hill',blast:'radial',passive:'balanced',mode:'solo',seed:72191,rules:'roadtrip'};
export const DEFAULT_SETTINGS:Settings={volume:0.65,music:0.3,shake:true,quality:'high',language:'zh'};
export function groundHeight(_x:number,z:number):number {return z < -15 ? Math.min(9,(-z-15)*0.22) : z>15 ? -Math.min(5.6,(z-15)*0.14) : 0;}
export function roadSlope(z:number):number {return z < -15 && z>-56 ? -0.22 : z>15&&z<55 ? -0.14:0;}
export function seeded(seed:number):()=>number {let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const RULE_VERSION='CRASH-05.0';
export const BUILDINGS = [
 {x:-21,z:-20,w:17,d:16,h:5.5},{x:21.5,z:-21.5,w:17,d:19,h:7},
 {x:-42,z:-20,w:15,d:16,h:5},{x:43,z:-20.5,w:17,d:17,h:6.5},
 {x:-21,z:20,w:17,d:16,h:5.5},{x:22,z:21,w:19,d:18,h:6},
 {x:-41,z:21,w:16,d:18,h:5},{x:43,z:21.5,w:17,d:19,h:6},
 {x:-21,z:-45,w:16,d:16,h:5.5},{x:21.5,z:-46,w:16,d:15,h:7},
 {x:-21,z:46,w:16,d:15,h:5.5},{x:21.5,z:47,w:17,d:15,h:5},
];
