import {BUILDINGS,ROUTES,groundHeight,roadSlope,type CityId,type RouteId,type Vec3,type VehicleKind} from './shared';
export interface BuildingDef {x:number;z:number;w:number;d:number;h:number;landmark?:'opera'|'clock'}
export interface CityRoute {id:RouteId;name:string;short:string;description:string;x:number;z:number;dx:number;dz:number;color:string}
export interface CityEventTarget {id:string;name:string;description:string;x:number;z:number;radius:number;kind:'derail'|'harbour'|'roundabout'}
export interface CityDef {id:CityId;code:string;name:string;englishName:string;district:string;tagline:string;description:string;color:string;landmark:string;traffic:string;specialTraffic:VehicleKind[];buildings:BuildingDef[];lanes:Vec3[][];roads:{points:Vec3[];width:number}[];routes:CityRoute[];eventTargets:CityEventTarget[];center:{x:number;z:number};sky:number;ground:number}
const points=(pairs:number[][]):Vec3[]=>pairs.map(([x,z])=>({x,y:0,z}));
export const CITIES:Record<CityId,CityDef>={
 sf:{id:'sf',code:'SF—01',name:'旧金山',englishName:'SAN FRANCISCO',district:'金门坡道',tagline:'坡道加速 · 缆车暴走',description:'把山城缆车变成失控重锤，沿坡道把事故带到另一条街。',color:'#f6ae64',landmark:'金门大桥 · 彩色维多利亚街屋',traffic:'山城缆车 / 运钞车 / 燃料车',specialTraffic:['tram','bank','tanker'],buildings:BUILDINGS,
 lanes:[points([[-72,-3],[72,-3]]),points([[72,3],[-72,3]]),points([[3,-72],[3,72]]),points([[-3,72],[-3,-72]])],roads:[{points:points([[-78,0],[78,0]]),width:18},{points:points([[0,-78],[0,78]]),width:20}],routes:ROUTES,
 eventTargets:[{id:'cable-release',name:'缆车暴走',description:'在金色轨道区域制造三次爆破或连续撞击，释放一列失控缆车。',x:-4.25,z:-18,radius:19,kind:'derail'}],center:{x:0,z:0},sky:0x8ebbc5,ground:0x64854c},
 sydney:{id:'sydney',code:'SYD—02',name:'悉尼',englishName:'SYDNEY',district:'歌剧院港湾',tagline:'错位路口 · 货港倾落',description:'在两个错位路口之间转移残骸，炸开港口吊货，把落货变成海湾连锁。',color:'#61d5e6',landmark:'悉尼歌剧院 · 海港大桥',traffic:'工程皮卡 / 双挂重卡 / 配送车',specialTraffic:['ute','roadtrain','van'],
 buildings:[{x:-38,z:-24,w:18,d:20,h:8},{x:-38,z:-49,w:18,d:18,h:6},{x:0,z:-25,w:14,d:19,h:6.2},{x:1,z:-50,w:16,d:18,h:8},{x:-40,z:29,w:22,d:20,h:6},{x:-41,z:53,w:17,d:21,h:7},{x:-3,z:35,w:19,d:21,h:5.8},{x:-3,z:61,w:19,d:18,h:8},{x:44,z:35,w:31,d:30,h:12,landmark:'opera'},{x:39,z:64,w:20,d:16,h:7},{x:39,z:-17.5,w:25,d:29,h:6}],
 lanes:[points([[-72,5],[72,5]]),points([[72,11],[-72,11]]),points([[-15,-72],[-15,-10],[-12,0],[-4,8],[5,8],[15,20],[15,72]]),points([[21,72],[21,24],[17,16],[6,8],[-6,8],[-21,-6],[-21,-72]])],
 roads:[{points:points([[-78,8],[78,8]]),width:18},{points:points([[-18,-78],[-18,8]]),width:18},{points:points([[18,8],[18,78]]),width:18}],
 routes:[{id:'hill',name:'01 / 海港大桥引道',short:'桥头俯冲',description:'沿西侧桥头冲进横向车流，先撞双挂重卡，制造两段封锁。',x:-55,z:5,dx:1,dz:0,color:'#60dbea'},{id:'market',name:'02 / 岩石区货道',short:'港口拆箱',description:'从北侧窄道切入，在吊货区引爆三次，触发货港倾落。',x:-15,z:-52,dx:0,dz:1,color:'#efbd63'},{id:'pier',name:'03 / 环形码头南路',short:'海湾切入',description:'从错位路口南侧入场，抛投残骸跨过两个路口。',x:21,z:52,dx:0,dz:-1,color:'#ff8f76'}],
 eventTargets:[{id:'crane-collapse',name:'货港倾落',description:'在蓝色吊货区域制造三次爆破或连续撞击，让悬挂货箱砸入主路。',x:2,z:8,radius:20,kind:'harbour'}],center:{x:0,z:8},sky:0x8fd4e0,ground:0xbbb7a0},
 london:{id:'london',code:'LDN—03',name:'伦敦',englishName:'LONDON',district:'西敏钟楼环岛',tagline:'环岛绕行 · 双层横封',description:'环岛让车流绕过中心；把双层巴士侧翻在弧线上，截断绕行出口。',color:'#e86e80',landmark:'大本钟 · 西敏宫 · 泰晤士河',traffic:'红色双层巴士 / 黑出租 / 运钞车',specialTraffic:['doubledecker','blackcab','bank'],
 buildings:[{x:-33,z:-33,w:19,d:19,h:7.5},{x:-57,z:-20,w:17,d:18,h:6.2},{x:33,z:-33,w:18,d:19,h:8},{x:56,z:-20,w:18,d:18,h:6},{x:-33,z:33,w:19,d:20,h:7},{x:-57,z:20,w:18,d:18,h:6.5},{x:31,z:31,w:13,d:15,h:23,landmark:'clock'},{x:56,z:20,w:18,d:18,h:6.4},{x:-21,z:-59,w:18,d:18,h:6},{x:21,z:-59,w:18,d:18,h:7},{x:-21,z:59,w:18,d:18,h:6},{x:21,z:59,w:18,d:18,h:7}],
 lanes:[points([[-72,-3],[-32,-3],[-23,3],[-20,14],[-8,22],[8,22],[19,14],[24,3],[72,3]]),points([[72,3],[32,3],[23,-3],[20,-14],[8,-22],[-8,-22],[-19,-14],[-24,-3],[-72,-3]]),points([[-3,-72],[-3,-32],[-12,-24],[-22,-12],[-22,8],[-14,20],[-3,26],[-3,72]]),points([[3,72],[3,32],[14,24],[22,12],[22,-8],[14,-20],[3,-26],[3,-72]])],
 roads:[{points:points([[-78,0],[-22,0]]),width:18},{points:points([[22,0],[78,0]]),width:18},{points:points([[0,-78],[0,-22]]),width:18},{points:points([[0,22],[0,78]]),width:18}],
 routes:[{id:'hill',name:'01 / 西敏桥入口',short:'钟楼入场',description:'瞄准环岛外侧巴士，侧翻后能同时截住绕行车流。',x:-3,z:-53,dx:0,dz:1,color:'#f0be72'},{id:'market',name:'02 / 白厅西路',short:'双层横封',description:'从西路贯穿巴士群，把长车身留在环岛弯道上。',x:-53,z:-3,dx:1,dz:0,color:'#e47984'},{id:'pier',name:'03 / 泰晤士河岸',short:'出租围堵',description:'从南入口拦截钻缝的黑出租，用重锤或磁吸封住空隙。',x:3,z:53,dx:0,dz:-1,color:'#9eaddc'}],
 eventTargets:[{id:'bus-blockade',name:'红色封锁',description:'在红色环岛区域制造三次爆破或连续撞击，召来双层巴士群形成连撞。',x:0,z:18,radius:23,kind:'roundabout'}],center:{x:0,z:0},sky:0x8997aa,ground:0x777e76}
};
export function getCity(id:CityId='sf'){return CITIES[id]??CITIES.sf;}
export function cityRoutes(id:CityId='sf'){return getCity(id).routes;}
export function cityGroundHeight(id:CityId|undefined,x:number,z:number){return !id||id==='sf'?groundHeight(x,z):0;}
export function cityRoadSlope(id:CityId|undefined,z:number){return !id||id==='sf'?roadSlope(z):0;}
