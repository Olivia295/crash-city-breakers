import {BUILDINGS,ROUTES,groundHeight,roadSlope,type CityId,type RouteId,type Vec3,type VehicleKind} from './shared';
export interface BuildingDef {x:number;z:number;w:number;d:number;h:number;landmark?:'opera'|'clock'}
export interface CityRoute {id:RouteId;name:string;short:string;x:number;z:number;dx:number;dz:number;color:string}
export interface CityEventTarget {id:string;name:string;description:string;x:number;z:number;radius:number;kind:'derail'|'harbour'|'roundabout'}
export interface CityDef {id:CityId;name:string;englishName:string;color:string;specialTraffic:VehicleKind[];buildings:BuildingDef[];lanes:Vec3[][];roads:{points:Vec3[];width:number}[];routes:CityRoute[];eventTargets:CityEventTarget[];center:{x:number;z:number};sky:number;ground:number}
const points=(pairs:number[][]):Vec3[]=>pairs.map(([x,z])=>({x,y:0,z}));
export const CITIES:Record<CityId,CityDef>={
 sf:{id:'sf',name:'旧金山',englishName:'SAN FRANCISCO',color:'#f6ae64',specialTraffic:['tram','bank','tanker'],buildings:BUILDINGS,
 lanes:[points([[-72,-3],[72,-3]]),points([[72,3],[-72,3]]),points([[3,-72],[3,72]]),points([[-3,72],[-3,-72]])],roads:[{points:points([[-78,0],[78,0]]),width:18},{points:points([[0,-78],[0,78]]),width:20}],routes:ROUTES,
 eventTargets:[{id:'cable-release',name:'缆车暴走',description:'在金色轨道区域制造三次爆破或连续撞击，释放一列失控缆车。',x:-4.25,z:-18,radius:19,kind:'derail'}],center:{x:0,z:0},sky:0x8ebbc5,ground:0x64854c},
 sydney:{id:'sydney',name:'悉尼',englishName:'SYDNEY',color:'#61d5e6',specialTraffic:['ute','roadtrain','van'],
 buildings:[{x:-38,z:-24,w:18,d:20,h:8},{x:-38,z:-49,w:18,d:18,h:6},{x:0,z:-25,w:14,d:19,h:6.2},{x:1,z:-50,w:16,d:18,h:8},{x:-40,z:29,w:22,d:20,h:6},{x:-41,z:53,w:17,d:21,h:7},{x:-3,z:35,w:19,d:21,h:5.8},{x:-3,z:61,w:19,d:18,h:8},{x:44,z:35,w:31,d:30,h:12,landmark:'opera'},{x:39,z:64,w:20,d:16,h:7},{x:39,z:-17.5,w:25,d:29,h:6}],
 lanes:[points([[-72,5],[72,5]]),points([[72,11],[-72,11]]),points([[-15,-72],[-15,-10],[-12,0],[-4,8],[5,8],[15,20],[15,72]]),points([[21,72],[21,24],[17,16],[6,8],[-6,8],[-21,-6],[-21,-72]])],
 roads:[{points:points([[-78,8],[78,8]]),width:18},{points:points([[-18,-78],[-18,8]]),width:18},{points:points([[18,8],[18,78]]),width:18}],
 routes:[{id:'hill',name:'01 / 海港大桥引道',short:'桥头俯冲',x:-55,z:5,dx:1,dz:0,color:'#60dbea'},{id:'market',name:'02 / 岩石区货道',short:'港口拆箱',x:-15,z:-52,dx:0,dz:1,color:'#efbd63'},{id:'pier',name:'03 / 环形码头南路',short:'海湾切入',x:21,z:52,dx:0,dz:-1,color:'#ff8f76'}],
 eventTargets:[{id:'crane-collapse',name:'货港倾落',description:'在蓝色吊货区域制造三次爆破或连续撞击，让悬挂货箱砸入主路。',x:2,z:8,radius:20,kind:'harbour'}],center:{x:0,z:8},sky:0x8fd4e0,ground:0xbbb7a0},
 london:{id:'london',name:'伦敦',englishName:'LONDON',color:'#e86e80',specialTraffic:['doubledecker','blackcab','bank'],
 buildings:[{x:-33,z:-33,w:19,d:19,h:7.5},{x:-57,z:-20,w:17,d:18,h:6.2},{x:33,z:-33,w:18,d:19,h:8},{x:56,z:-20,w:18,d:18,h:6},{x:-33,z:33,w:19,d:20,h:7},{x:-57,z:20,w:18,d:18,h:6.5},{x:31,z:31,w:13,d:15,h:23,landmark:'clock'},{x:56,z:20,w:18,d:18,h:6.4},{x:-21,z:-59,w:18,d:18,h:6},{x:21,z:-59,w:18,d:18,h:7},{x:-21,z:59,w:18,d:18,h:6},{x:21,z:59,w:18,d:18,h:7}],
 lanes:[points([[-72,-3],[-32,-3],[-23,3],[-20,14],[-8,22],[8,22],[19,14],[24,3],[72,3]]),points([[72,3],[32,3],[23,-3],[20,-14],[8,-22],[-8,-22],[-19,-14],[-24,-3],[-72,-3]]),points([[-3,-72],[-3,-32],[-12,-24],[-22,-12],[-22,8],[-14,20],[-3,26],[-3,72]]),points([[3,72],[3,32],[14,24],[22,12],[22,-8],[14,-20],[3,-26],[3,-72]])],
 roads:[{points:points([[-78,0],[-22,0]]),width:18},{points:points([[22,0],[78,0]]),width:18},{points:points([[0,-78],[0,-22]]),width:18},{points:points([[0,22],[0,78]]),width:18}],
 routes:[{id:'hill',name:'01 / 西敏桥入口',short:'钟楼入场',x:-3,z:-53,dx:0,dz:1,color:'#f0be72'},{id:'market',name:'02 / 白厅西路',short:'双层横封',x:-53,z:-3,dx:1,dz:0,color:'#e47984'},{id:'pier',name:'03 / 泰晤士河岸',short:'出租围堵',x:3,z:53,dx:0,dz:-1,color:'#9eaddc'}],
 eventTargets:[{id:'bus-blockade',name:'红色封锁',description:'在红色环岛区域制造三次爆破或连续撞击，召来双层巴士群形成连撞。',x:0,z:18,radius:23,kind:'roundabout'}],center:{x:0,z:0},sky:0x8997aa,ground:0x777e76}
};
export function getCity(id:CityId='sf'){return CITIES[id]??CITIES.sf;}
export function cityRoutes(id:CityId='sf'){return getCity(id).routes;}
export function cityGroundHeight(id:CityId|undefined,x:number,z:number){return !id||id==='sf'?groundHeight(x,z):0;}
export function cityRoadSlope(id:CityId|undefined,z:number){return !id||id==='sf'?roadSlope(z):0;}
