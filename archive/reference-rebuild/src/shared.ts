export type VehicleKind = 'compact'|'sport'|'pickup'|'bus'|'van'|'semi'|'tanker'|'carrier'|'tram'|'taxi'|'booster'|'magnet';
export type PropKind = 'crate'|'barrier'|'sign'|'lamp'|'facade';
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
};
export const PLAYER_CARS: VehicleKind[]=['compact','sport','pickup','semi'];
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
export interface RunConfig {car:VehicleKind;route:RouteId;blast:BlastMod;passive:PassiveMod;mode:'solo'|'versus';seed:number}
export interface RenderEntity {id:number;kind:ModelKind;p:Vec3;q:Quat;v:Vec3;damage:number;destroyed:boolean;player:boolean;active:boolean;scale?:Vec3;fuse?:number}
export type EventKind='impact'|'explosion'|'score'|'special'|'mechanism'|'warning'|'launch'|'end';
export interface GameEvent {id:number;kind:EventKind;p:Vec3;power:number;text?:string;color?:string}
export type MechanismId = 'signal'|'cargo'|'billboard';
export const MECHANISMS = [{id:'signal' as const,name:'绿灯浪潮',description:'放行加速车流，冲进堵塞路口',x:0,z:0},{id:'cargo' as const,name:'货架倾落',description:'让货物落入市场街，形成新障碍',x:-19,z:2},{id:'billboard' as const,name:'广告牌倒塌',description:'倒下的广告架横封海湾车道',x:18,z:-3}];
export interface GameSnapshot {phase:'ready'|'running'|'paused'|'ended';time:number;score:number;combo:number;comboTime:number;bestCombo:number;crashes:number;destroyed:number;blastCharge:number;interventions:number;slowMotion:boolean;aim:Vec3;playerId:number;entities:RenderEntity[];events:GameEvent[];config:RunConfig;notice:string;fps?:number;challengeProgress:number[];}
export interface RunResult {score:number;bestCombo:number;crashes:number;destroyed:number;config:RunConfig;medal:'gold'|'silver'|'bronze';challenges:boolean[];timestamp:number}
export interface Settings {volume:number;music:number;shake:boolean;quality:'high'|'low'}
export const DEFAULT_CONFIG:RunConfig={car:'compact',route:'hill',blast:'radial',passive:'balanced',mode:'solo',seed:72191};
export const DEFAULT_SETTINGS:Settings={volume:0.65,music:0.3,shake:true,quality:'high'};
export function groundHeight(_x:number,z:number):number {return z < -15 ? Math.min(9,(-z-15)*0.22) : z>15 ? -Math.min(5.6,(z-15)*0.14) : 0;}
export function roadSlope(z:number):number {return z < -15 && z>-56 ? -0.22 : z>15&&z<55 ? -0.14:0;}
export function seeded(seed:number):()=>number {let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const RULE_VERSION='SF-01.1';
export const BUILDINGS = [
 {x:-23,z:-27,w:17,d:16,h:11},{x:24,z:-29,w:17,d:19,h:15},
 {x:-43,z:-27,w:15,d:16,h:9},{x:45,z:-31,w:17,d:17,h:12},
 {x:-24,z:27,w:17,d:16,h:10},{x:26,z:29,w:19,d:18,h:12},
 {x:-44,z:29,w:16,d:18,h:8},{x:48,z:30,w:17,d:19,h:10},
 {x:-24,z:-51,w:16,d:16,h:9},{x:23,z:-54,w:16,d:15,h:12},
 {x:-24,z:51,w:16,d:15,h:9},{x:26,z:52,w:17,d:15,h:8},
];
