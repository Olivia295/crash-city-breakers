import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VEHICLES, type ModelKind, type VehicleKind } from '../shared.ts';

/** Original arcade vehicle kit. Metres, +Z forward, collider-centred origin. One indexed mesh per model. */
export function createModel(kind: ModelKind): THREE.Group { return buildModel(kind); }

function buildModel(kind:ModelKind,cabOnly=false):THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  function add(g: THREE.BufferGeometry, tint: number, x=0,y=0,z=0, rx=0,ry=0,rz=0) {
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const geometry=g.index ? g.toNonIndexed() : g;geometry.deleteAttribute('uv');
    color.set(tint);const values=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(values,3));parts.push(geometry);
  }
  function box(w:number,h:number,l:number,tint:number,x=0,y=0,z=0){add(new THREE.BoxGeometry(w,h,l),tint,x,y,z);}
  function rounded(w:number,h:number,l:number,tint:number,x=0,y=0,z=0,r=.065){add(new RoundedBoxGeometry(w,h,l,1,r),tint,x,y,z);}
  function cylinder(r:number,len:number,tint:number,x:number,y:number,z:number,axis:'x'|'z'|'y'='x',segments=10){add(new THREE.CylinderGeometry(r,r,len,segments),tint,x,y,z,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);}
  type Point=[number,number,number];
  function panel(points:Point[],tint:number){
    const data:number[]=[];for(let i=1;i<points.length-1;i++)data.push(...points[0],...points[i],...points[i+1]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();add(g,tint);
  }
  function cabin(w:number,h:number,l:number,tint:number,y:number,z:number,profile:'sedan'|'hatch'|'sport'|'truck'|'classic'='sedan'){
    const roofW=w*(profile==='classic'?.87:.8),front=l*.5,rear=-l*.5;
    const rf=l*(profile==='truck'?.36:profile==='sport'?.09:.23),rr=-l*(profile==='hatch'?.39:profile==='classic'?.34:.27);
    const a:Point=[-w/2,y,z+front],b:Point=[w/2,y,z+front],c:Point=[w/2,y,z+rear],d:Point=[-w/2,y,z+rear];
    const e:Point=[-roofW/2,y+h,z+rf],f:Point=[roofW/2,y+h,z+rf],g:Point=[roofW/2,y+h,z+rr],j:Point=[-roofW/2,y+h,z+rr];
    panel([a,b,f,e],tint);panel([b,c,g,f],tint);panel([c,d,j,g],tint);panel([d,a,e,j],tint);panel([e,f,g,j],tint);
    // Four true sloping curved glass strips catch different highlights across the windscreen.
    for(let i=0;i<4;i++){
      const u0=-.91+i*.455,u1=u0+.455,bend0=(1-u0*u0)*.035,bend1=(1-u1*u1)*.035;
      panel([[u0*w/2,y+h*.1,z+front-(front-rf)*.1+bend0+.014],[u1*w/2,y+h*.1,z+front-(front-rf)*.1+bend1+.014],[u1*roofW/2,y+h*.88,z+rf+(front-rf)*.12+bend1+.014],[u0*roofW/2,y+h*.88,z+rf+(front-rf)*.12+bend0+.014]],i===0?0x437a87:i===3?0x2f5663:0x254c5b);
    }
    const hv=.73,hl=.055;
    panel([[-roofW*.43,y+h*hv,z+front-(front-rf)*hv+.04],[roofW*.43,y+h*hv,z+front-(front-rf)*hv+.04],[roofW*.41,y+h*(hv+hl),z+front-(front-rf)*(hv+hl)+.04],[-roofW*.41,y+h*(hv+hl),z+front-(front-rf)*(hv+hl)+.04]],0x83a9ad);
    panel([[w*.43,y+h*.11,z+rear+(rr-rear)*.11-.014],[-w*.43,y+h*.11,z+rear+(rr-rear)*.11-.014],[-roofW*.44,y+h*.85,z+rr+(rear-rr)*.15-.014],[roofW*.44,y+h*.85,z+rr+(rear-rr)*.15-.014]],0x284d59);
    for(const side of [-1,1]){
      const bottomX=side*((w*.5)*.87+(roofW*.5)*.13+.014),topX=side*((w*.5)*.15+(roofW*.5)*.85+.014),mid=profile==='truck'?l*.03:-l*.015;
      const windows:Point[][]=[[[bottomX,y+h*.13,z+mid+.06],[bottomX,y+h*.13,z+front-l*.085],[topX,y+h*.85,z+rf-l*.035],[topX,y+h*.85,z+mid+.06]],[[bottomX,y+h*.13,z+rear+l*.075],[bottomX,y+h*.13,z+mid-.035],[topX,y+h*.85,z+mid-.035],[topX,y+h*.85,z+rr+l*.05]]];
      for(const points of windows)panel(side<0?points:[...points].reverse(),0x214655);
      box(.035,.045,l*.25,0x82a7ac,bottomX,y+h*.17,z+front-l*.2);
      box(.075,.055,.23,0xc3cac3,side*w*.51,y+h*.01,z-l*.12);
    }
    rounded(roofW+.06,.075,(rf-rr)+.1,tint,0,y+h+.018,z+(rf+rr)/2,.035);
    box(roofW*.68,.023,.028,0x1b303a,0,y+h*.1,z+front-(front-rf)*.1+.053);
  }
  function wheel(x:number,y:number,z:number,r:number,bodyColor:number,arch=true){
    add(new THREE.TorusGeometry(r*.77,r*.235,5,14),0x242a2c,x,y,z,0,Math.PI/2,0);
    cylinder(r*.68,.17,0x303a3c,x,y,z,'x',12);
    const side=Math.sign(x),face=x+side*r*.255;
    add(new THREE.RingGeometry(r*.52,r*.71,14),0x707b7a,face,y,z,0,side*Math.PI/2,0);
    cylinder(r*.42,.032,0x9ba8a6,face+side*.013,y,z,'x',10);
    for(let i=0;i<4;i++){const angle=i*Math.PI/2+.3;add(new THREE.BoxGeometry(.025,r*.12,r*.89),0xd8ddcc,face+side*.034,y,z,angle,0,0);}
    cylinder(r*.17,.042,0x3d4b4e,face+side*.046,y,z,'x',8);
    if(arch)add(new THREE.TorusGeometry(r*1.13,r*.11,4,10,Math.PI),bodyColor,x-side*.015,y,z,0,Math.PI/2,0);
  }
  const defs=VEHICLES as Partial<Record<ModelKind,(typeof VEHICLES)[VehicleKind]>>;
  const source=defs[kind],def=source&&cabOnly?{...source,length:5.2}:source;
  if(def){
    const {width:w,height:h,length:l}=def,c=def.color;
    const big=['bus','semi','tanker','carrier','tram','magnet','van','ambulance','bank','pizza','bulldozer','missile','icecream','doubledecker','roadtrain'].includes(kind);
    const tire=kind==='pickup'||kind==='ute'?.36:kind==='blackcab'?.31:big?.39:kind==='sport'||kind==='booster'?.285:.27,base=-h/2+tire;
    const articulated=['semi','tanker','carrier','roadtrain','magnet','missile'].includes(kind);
    box(w*.74,.16,l*.86,0x26373c,0,base-.035,0);
    const axles=cabOnly?[-l*.31,-l*.15,l*.34]:kind==='roadtrain'?[-l*.425,-l*.33,-l*.12,-l*.01,l*.23,l*.39]:kind==='semi'||kind==='carrier'?[-l*.37,-l*.26,l*.12,l*.37]:kind==='bus'||kind==='doubledecker'?[-l*.34,l*.32]:kind==='tanker'?[-l*.35,-l*.23,l*.34]:[-l*.31,l*.3];
    if(kind!=='bulldozer')for(const z of axles)for(const sign of [-1,1])wheel(sign*w*.458,base,z,tire,c,!articulated&&kind!=='tram');
    const bodyY=-h/2+tire+.19,bodyH=big?.4:kind==='pickup'||kind==='ute'?.43:.35,bodyTop=bodyY+bodyH/2,nose=l*.475,tail=-l*.475;
    if(articulated){
      rounded(w*.93,bodyH,l*(cabOnly?.42:.225),c,0,bodyY,l*(cabOnly?.26:.36),.06);
      box(w*.77,.14,l*.68,0x344246,0,bodyY-.11,-l*.11);
    }else rounded(w*.94,bodyH,l*.95,c,0,bodyY,0,kind==='sport'?.1:.075);
    rounded(w*.91,.14,.18,kind==='sport'?0x263237:0xc6cfc9,0,bodyY-.07,nose+.035,.045);
    rounded(w*.89,.12,.15,0x45545a,0,bodyY-.07,tail-.035,.035);
    box(w*.39,.16,.026,0x203237,0,bodyY+.052,nose+.01);
    for(let i=0;i<3;i++)box(w*.36,.019,.037,0xa1b0ad,0,bodyY+.005+i*.048,nose+.032);
    box(w*.19,.07,.028,0xe6e4cc,0,bodyY-.104,nose+.139);
    box(w*.18,.07,.028,0xe6e4cc,0,bodyY-.088,tail-.125);
    for(const sign of [-1,1]){
      rounded(w*.23,.145,.045,0x314348,sign*w*.327,bodyY+.083,nose+.01,.03);
      rounded(w*.155,.089,.029,0xfff0ce,sign*w*.325,bodyY+.095,nose+.041,.025);
      box(.045,.065,.032,0xf3a531,sign*w*.43,bodyY+.064,nose+.044);
      box(w*.14,.125,.042,0xcd3932,sign*w*.35,bodyY+.075,tail-.012);
      box(w*.13,.025,.045,0xf9b57e,sign*w*.35,bodyY+.094,tail-.038);
      if(!articulated){box(.04,.053,l*.56,0x9baaa0,sign*w*.474,bodyY-.09,0);}
    }
    if(['compact','sport','taxi','booster','police','blackcab'].includes(kind)){
      const sport=kind==='sport'||kind==='booster',cab=kind==='blackcab';
      const canopyL=l*(kind==='compact'?.58:cab?.6:sport?.49:.55),canopyZ=sport?-l*.065:cab?-l*.025:0;
      cabin(w*(cab?.83:.84),h/2-.045-bodyTop,canopyL,c,bodyTop,canopyZ,kind==='compact'?'hatch':sport?'sport':cab?'classic':'sedan');
      for(const sign of [-1,1]){
        box(.1,.065,.21,0x253a40,sign*w*.48,bodyTop+.09,l*.18);
        rounded(.21,.105,.2,c,sign*w*.52,bodyTop+.1,l*.18,.035);
        // Dark panel gaps run on the flank; a separate sill catches the light beneath them.
        for(const z of [-l*.18,l*.11])box(.019,bodyH*.77,.023,0x375152,sign*w*.477,bodyY+.012,z);
        box(.075,.05,.18,0xced8cd,sign*w*.484,bodyTop-.06,-l*.025);
      }
      if(kind==='compact'){
        rounded(w*.7,.045,l*.24,0xe7eee0,0,h*.5,l*.01,.04);
        box(w*.64,.025,.12,0x3c8079,0,bodyTop+.012,l*.34);
        for(const sign of [-1,1])cylinder(.085,.033,0xfff0c7,sign*w*.315,bodyY+.085,nose+.057,'z',12);
      }
      if(sport){
        // Two cream racing stripes stop at the glass, leaving a long, low nose.
        for(const x of [-w*.135,w*.135]){box(w*.09,.018,l*.24,0xffe7bb,x,bodyTop+.01,l*.35);box(w*.09,.018,l*.14,0xffe7bb,x,bodyTop+.01,-l*.39);}
        for(const x of [-w*.32,w*.32])for(let i=0;i<3;i++)box(w*.17,.024,.047,0x303d40,x,bodyTop+.022,l*.26+i*.08);
        box(w*.99,.055,.25,0x243339,0,bodyY-.14,l*.487);
        for(const x of [-w*.28,w*.28])box(.045,.2,.14,0x27343a,x,bodyTop+.09,-l*.39);
        rounded(w*1.02,.08,.24,0x25383d,0,bodyTop+.225,-l*.39,.028);
        for(const x of [-w*.3,w*.3]){cylinder(.075,.16,0xc0c5bf,x,bodyY-.075,-l*.5,'z',8);}
      }
      if(kind==='taxi'||cab){
        rounded(.58,.15,.3,0xf7cf61,0,h/2+.055,0,.035);box(.4,.07,.018,0x32454a,0,h/2+.058,.157);
        for(const x of [-.12,0,.12])box(.022,.048,.022,0xf8e5a7,x,h/2+.058,.171);
        if(kind==='taxi')for(const side of [-1,1])for(let i=0;i<11;i++)box(.021,.075,.16,i%2?0xf8df77:0x293a3c,side*w*.479,bodyY+.07,-l*.23+i*.19);
      }
      if(cab){
        rounded(w*.48,.22,.04,0xc1c6bd,0,bodyY+.085,nose+.042,.035);box(w*.39,.16,.055,0x233037,0,bodyY+.09,nose+.073);
        for(let i=0;i<7;i++)box(.029,.17,.02,0xb4c1ba,-w*.18+i*w*.06,bodyY+.09,nose+.113);
        for(const sign of [-1,1]){cylinder(.155,.055,0xb9c8bf,sign*w*.34,bodyY+.09,nose+.059,'z',14);cylinder(.114,.018,0xffedba,sign*w*.34,bodyY+.09,nose+.092,'z',12);}
        rounded(w*.76,.19,l*.235,c,0,bodyTop+.015,l*.342,.09);
        for(const side of [-1,1])for(const z of [-l*.31,l*.3])rounded(w*.21,.18,l*.235,c,side*w*.368,bodyTop-.09,z,.085);
      }
      if(kind==='police'){
        for(const x of [-w*.479,w*.479]){box(.03,.29,l*.41,0xf0f1e4,x,bodyY+.045,0);cylinder(.12,.035,0xdfca58,x,bodyY+.066,0,'x',5);}
        rounded(w*.72,.036,l*.245,0xeeefe2,0,h/2+.012,-l*.015,.018);
        box(w*.7,.025,l*.19,0xeeefe2,0,bodyTop+.013,l*.365);cylinder(.13,.024,0xd9c779,0,bodyTop+.04,l*.355,'y',5);
        box(w*.68,.1,.26,0x1a252c,0,h/2+.035,0);box(w*.29,.13,.27,0xe73531,-w*.18,h/2+.12,0);box(w*.29,.13,.27,0x447bea,w*.18,h/2+.12,0);
        box(w*.85,.2,.08,0x2a3c43,0,bodyY,nose+.13);
        for(const x of [-w*.33,w*.33])box(.09,.09,.18,0x2a3c43,x,bodyY,nose+.045);
      }
      if(kind==='booster')for(const x of [-w*.31,w*.31]){cylinder(.19,.4,0x343f52,x,bodyY,-l*.48,'z');cylinder(.13,.04,0x97e9ed,x,bodyY,tail-.228,'z');}
    }else if(kind==='pickup'||kind==='ute'){
      const utility=kind==='ute',bedColor=utility?0xa8b3b1:c;
      cabin(w*.87,h/2-.06-bodyTop,l*.34,c,bodyTop,l*.16,'truck');
      rounded(w*.85,.075,l*.18,c,0,bodyTop+.035,l*.375,.04);
      // Open bed: floor and raised edges, never a solid filled-in cargo block.
      box(w*.77,.065,l*.38,0x425054,0,bodyTop+.012,-l*.26);
      for(let i=0;i<7;i++)box(.027,.025,l*.34,utility?0xa8b6ae:0x626e60,-w*.31+i*w*.105,bodyTop+.055,-l*.26);
      for(const x of [-w*.435,w*.435]){
        rounded(.14,.34,l*.42,bedColor,x,bodyTop+.09,-l*.25,.04);
        box(.165,.035,l*.43,utility?0xd2d8cc:0xf9d386,x,bodyTop+.27,-l*.25);
        box(.18,.1,l*.37,0x34494b,x,-h*.25,l*.13);
        rounded(.21,.11,.2,c,x*1.22,bodyTop+.15,l*.29,.025);
        box(.02,.3,.025,0x546c65,x*1.09,bodyY+.02,l*.03);
      }
      rounded(w*.85,.32,.13,bedColor,0,bodyTop+.08,-l*.455,.03);
      box(.29,.055,.028,0x263d42,0,bodyTop+.16,-l*.455-.083);
      if(utility){
        box(w*.72,.32,l*.11,0xa8b8b9,0,bodyTop+.13,-l*.095);
        for(const x of [-w*.35,w*.35]){box(.065,h*.5,.065,0x647b7d,x,bodyTop+h*.23,-l*.05);box(.065,h*.42,.065,0x647b7d,x,bodyTop+h*.19,-l*.43);box(.075,.075,l*.5,0x647b7d,x,h/2+.09,-l*.2);}
        for(const z of [-l*.05,-l*.43])box(w*.76,.075,.075,0x647b7d,0,h/2+.09,z);
        for(const x of [-w*.18,w*.18])box(.07,.075,l*.63,0xd1d8c6,x,h/2+.175,-l*.08);
        for(let i=0;i<8;i++)box(w*.39,.065,.045,0xbbc4b6,0,h/2+.17,-l*.33+i*l*.067);
        cylinder(.105,.15,0xffbd35,w*.3,h/2+.13,l*.16,'y',12);
        box(w*.29,.19,l*.15,0xd85a36,w*.2,bodyTop+.05,-l*.29);
      }else{
        for(const x of [-w*.35,w*.35])cylinder(.053,h*.44,0x394b49,x,bodyTop+h*.2,-l*.065,'y',8);
        box(w*.74,.07,.075,0x394b49,0,h/2+.02,-l*.065);
        for(const x of [-w*.24,0,w*.24])cylinder(.084,.09,0xffedbc,x,h/2+.1,-l*.065,'z',10);
        add(new THREE.TorusGeometry(.275,.09,5,12),0x293333,0,bodyTop+.09,-l*.29,Math.PI/2,0,0);
      }
    }else if(kind==='bus'||kind==='doubledecker'){
      const double=kind==='doubledecker',shellBottom=bodyTop-.1,shellTop=h/2-.06,shellH=shellTop-shellBottom;
      rounded(w*.93,shellH,l*.92,c,0,shellBottom+shellH/2,0,.14);
      const rows=double?[shellBottom+shellH*.27,shellBottom+shellH*.77]:[shellBottom+shellH*.57],glassH=double?shellH*.31:shellH*.57;
      for(const y of rows){
        for(const side of [-1,1])for(let i=0;i<7;i++)box(.027,glassH,l*.099,0x24414b,side*w*.47,y,-l*.35+i*l*.112);
        for(const sign of [-1,1])box(w*.83,glassH,.028,0x294c59,0,y,sign*l*.466);
        for(const side of [-1,1])box(.032,.045,l*.73,0x79959b,side*w*.477,y+glassH*.26,-l*.015);
      }
      box(w*.86,.19,.03,0x203539,0,shellTop-.17,l*.471);
      for(const x of [-.29,-.14,0,.14,.29])box(.065,.075,.031,0xf4dc9e,x,shellTop-.17,l*.491);
      if(double){
        // Cream advert band, front destination display, rear stair-window and distinctive two decks.
        for(const side of [-1,1])box(.028,.23,l*.65,0xf2dbaa,side*w*.477,shellBottom+shellH*.5,-l*.035);
        box(.026,shellH*.48,l*.13,0x23434b,w*.483,shellBottom+shellH*.24,l*.295);
        for(let i=0;i<4;i++)box(.028,.04,l*.1,0xa6aea1,w*.5,shellBottom+.12+i*.13,l*.295);
        box(w*.81,.06,.035,0xebc48e,0,shellBottom+shellH*.51,l*.478);
        box(.14,glassH,.034,c,0,rows[1],l*.481);
        rounded(w*.55,.075,l*.145,0xd1d2bd,0,shellTop+.02,-l*.195,.035);
        for(let i=0;i<6;i++)box(w*.43,.015,.035,0x4c656b,0,shellTop+.065,-l*.24+i*.12);
        rounded(w*.4,.035,l*.105,0xc6453d,0,shellTop+.016,l*.21,.025);
        for(const x of [-w*.39,w*.39])box(.055,.02,l*.82,0xe3564d,x,shellTop+.012,0);
      }else{
        for(const z of [-l*.25,l*.29]){box(.032,shellH*.78,l*.13,0x213b43,w*.485,shellBottom+shellH*.4,z);box(.037,.025,l*.13,0xc5cfbb,w*.49,shellBottom+.07,z);}
        box(w*.94,.13,l*.84,0xf0dfaf,0,shellBottom+shellH*.13,-l*.015);
        for(const z of [-l*.2,l*.2])rounded(w*.5,.11,l*.13,0xc6cbbd,0,h/2+.013,z,.055);
      }
      for(const x of [-w*.55,w*.55]){box(.08,.4,.065,0x384b4f,x,shellBottom+shellH*.4,l*.44);box(.17,.19,.13,0x233a42,x,shellBottom+shellH*.51,l*.44);}
    }else if(kind==='tram'){
      box(w*.93,h*.19,l*.92,0xb75e46,0,-h*.13,0);
      box(w*.89,.13,l*.88,0xf7d9a2,0,h*.02,0);
      box(w*1.04,.17,l*.98,0x553f35,0,h*.47,0);
      box(w*.8,.13,l*.84,0xcbaf6e,0,h*.54,0);
      for(let i=0;i<6;i++)box(.028,.018,l*.79,0xe1c990,(-.33+i*.132)*w,h*.54+.073,0);
      cylinder(.12,.085,0xd9b45e,0,h*.59+.08,l*.34,'y',12);
      for(const side of [-1,1])box(.1,.04,l*.87,0xe5c88e,side*w*.43,h*.06,0);
      for(const sx of [-1,1])for(let i=0;i<6;i++){box(.075,h*.4,.09,0xf2d69e,sx*w*.44,h*.24,-l*.35+i*l*.14);box(.025,h*.32,l*.095,0x335a5d,sx*w*.443,h*.24,-l*.29+i*l*.14);}
      for(const z of [-l*.43,l*.43]){box(w*.83,h*.3,.03,0x31565c,0,h*.24,z);box(w*.93,.08,.26,0x8b754d,0,-h*.29,z);}
    }else if(['van','ambulance','bank','pizza','icecream'].includes(kind)){
      rounded(w*.9,h*.77,l*.58,kind==='van'||kind==='ambulance'||kind==='pizza'?0xf1f0e5:c,0,h*.105,-l*.17,.1);
      cabin(w*.89,h/2-.08-bodyTop,l*.31,c,bodyTop,l*.3,'truck');
      rounded(w*.79,.085,l*.1,c,0,bodyTop+.025,l*.422,.025);
      for(const side of [-1,1]){box(.032,h*.6,.027,0x748a83,side*w*.455,h*.08,-l*.435);box(.05,.055,.22,0xc6d2c5,side*w*.459,bodyTop-.055,l*.25);rounded(.18,.18,.16,0x41565c,side*w*.526,bodyTop+.26,l*.352,.03);}
      for(const x of [-w*.21,w*.21]){box(w*.385,h*.59,.035,0xd4d9c6,x,h*.075,-l*.469);box(.035,h*.28,.03,0x586f6c,x*.16,h*.02,-l*.493);}
      for(const y of [-h*.09,h*.26])for(const x of [-w*.38,w*.38])box(.07,.08,.056,0x566e6c,x,y,-l*.493);
      if(kind==='van')for(const x of [-w*.455,w*.455]){box(.018,h*.2,l*.47,c,x,h*.16,-l*.17);box(.025,.22,.62,0xf9e4a9,x,h*.16,-l*.17);}
      if(kind==='ambulance'){
        for(const side of [-1,1]){
          const x=side*w*.463;
          box(.034,.22,l*.78,0xdd332b,x,-h*.025,-l*.07);
          box(.036,h*.42,.28,0xdd332b,x,h*.19,-l*.21);box(.038,.27,l*.205,0xdd332b,x,h*.19,-l*.21);
          box(.047,.075,.27,0xf8c448,x,-h*.023,-l*.36);box(.047,.075,.27,0xf8c448,x,-h*.023,-l*.06);
        }
        box(.36,.026,1.36,0xe33229,0,h*.501,-l*.2);box(1.24,.028,.36,0xe33229,0,h*.501,-l*.2);
        box(w*.71,.025,l*.057,0xdc342b,0,bodyTop+.073,l*.424);
        rounded(w*.82,.12,.35,0xf1f1df,0,h*.53,l*.14,.035);
        rounded(w*.32,.19,.29,0xef352a,-w*.23,h*.595,l*.14,.05);rounded(w*.32,.19,.29,0x357ae8,w*.23,h*.595,l*.14,.05);
        for(const x of [-w*.23,w*.23])box(w*.22,.025,.18,0xffdcb0,x,h*.7,l*.14);
        for(const x of [-w*.35,w*.35])box(.15,.06,.22,0xd9332c,x,h*.52,-l*.398);
      }else if(kind==='bank'){
        // The visible side vault, steel ribs and roof bullion distinguish the armoured van from delivery traffic.
        for(const side of [-1,1]){
          const x=side*w*.468;
          rounded(.055,h*.63,l*.51,0x5c706c,x,h*.105,-l*.174,.026);
          cylinder(.47,.075,0xc4cbb9,x+side*.03,h*.12,-l*.2,'x',18);
          cylinder(.37,.084,0x3d5659,x+side*.075,h*.12,-l*.2,'x',16);
          cylinder(.105,.095,0xd9bf6b,x+side*.12,h*.12,-l*.2,'x',10);
          for(let i=0;i<4;i++)add(new THREE.BoxGeometry(.055,.08,.59),0xcad2c0,x+side*.142,h*.12,-l*.2,i*Math.PI/2+.45,0,0);
          for(const dz of [-l*.397,l*.047])for(const y of [-h*.14,h*.35])cylinder(.044,.055,0xc9d1be,x+side*.045,y,dz,'x',8);
          for(const z of [-l*.408,l*.063])box(.09,h*.68,.095,0xa5b4a4,x,h*.105,z);
        }
        box(w*.74,h*.65,.07,0x4a5753,0,h*.12,-l*.465);cylinder(.38,.08,0xcbd1bf,0,h*.12,-l*.46-.1,'z');
        box(.075,.55,.1,0x4c5c58,0,h*.12,-l*.46-.155);box(.55,.075,.1,0x4c5c58,0,h*.12,-l*.46-.155);
        box(w*.68,.06,l*.27,0x354e51,0,h*.508,-l*.2);
        for(const x of [-.45,0,.45])rounded(.35,.17,1.08,0xf5c347,x,h*.557,-l*.2,.035);
        box(w*.67,.04,l*.08,0x728985,0,bodyTop+.076,l*.41);
      }else if(kind==='pizza'){
        // A large raised pizza and red-white livery remain readable at game-camera scale.
        box(w*.98,.095,l*.61,0xd83424,0,h*.505,-l*.17);box(w*.81,.105,l*.43,0xf3e9cb,0,h*.567,-l*.17);
        cylinder(w*.369,.052,0xb64024,0,h*.62,-l*.17,'y',24);
        cylinder(w*.341,.052,0xeab440,0,h*.658,-l*.17,'y',24);
        add(new THREE.TorusGeometry(w*.343,.047,5,24),0xd98d2f,0,h*.673,-l*.17,Math.PI/2,0,0);
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;cylinder(.108,.027,0xbe3221,Math.cos(a)*w*.225,h*.696,-l*.17+Math.sin(a)*w*.225,'y',10);}
        cylinder(.11,.03,0xbe3221,0,h*.696,-l*.17,'y',10);
        for(const side of [-1,1]){
          const x=side*w*.465;
          box(.032,.1,l*.565,0xd53929,x,h*.32,-l*.17);box(.032,.14,l*.565,0xd53929,x,-h*.125,-l*.17);
          for(let i=0;i<10;i++)box(.042,.145,l*.055,i%2?0xf4eedd:0xcc3225,x,-h*.05,-l*.417+i*l*.055);
          cylinder(.32,.036,0xe9ad39,x+side*.014,h*.15,-l*.19,'x',16);
          for(const [dy,dz] of [[.13,0],[-.08,-.13],[-.08,.13]])cylinder(.066,.027,0xbe3221,x+side*.04,h*.15+dy,-l*.19+dz,'x',8);
        }
      }else if(kind==='icecream'){
        for(const side of [-1,1]){
          const x=side*w*.463;
          box(.035,h*.37,l*.4,0xeae9d3,x,h*.16,-l*.2);box(.048,h*.235,l*.305,0x315b64,x+side*.019,h*.18,-l*.2);
          box(.16,.075,l*.37,0xe9f0dd,x+side*.075,h*.047,-l*.2);
          for(let i=0;i<8;i++)box(.27,.065,l*.055,i%2?0xf2e6d2:0xcf5274,x+side*.075,h*.345,-l*.39+i*l*.055);
          box(.044,.16,l*.61,0x77b9c4,x,-h*.095,-l*.17);
          for(let i=0;i<5;i++)cylinder(.06,.025,0xf7e6be,x+side*.03,-h*.09,-l*.38+i*l*.1,'x',8);
        }
        cylinder(.06,.18,0xf0d0a1,0,h*.52,-l*.17,'y',8);
        add(new THREE.ConeGeometry(.34,.7,10),0xd5a16a,0,h*.69,-l*.17,Math.PI,0,0);
        add(new THREE.IcosahedronGeometry(.4,2),0xffeee0,0,h*.97,-l*.17);
        cylinder(.379,.086,0xed8fa8,0,h*.964,-l*.17,'y',18);
      }
    }else if(kind==='bulldozer'){
      rounded(w*.72,.57,l*.72,c,0,-h*.11,-l*.05,.09);cabin(w*.66,h*.47,l*.35,0xddd38d,-h*.02,-l*.07,'truck');
      for(const side of [-1,1])for(let i=0;i<5;i++)cylinder(.22,.09,0x9c9265,side*w*.531,-h*.3,-l*.27+i*l*.135,'x',10);
      cylinder(.062,h*.39,0x3a443d,w*.23,h*.35,l*.13,'y',8);
      for(let i=0;i<6;i++)box(w*.49,.023,.035,0x596146,0,h*.035,l*.1+i*.09);
      for(const x of [-w*.43,w*.43]){box(.48,.63,l*.81,0x30352f,x,-h*.34,0);for(let i=0;i<9;i++)box(.51,.12,.12,0x797965,x,-h*.015,-l*.34+i*l*.085);}
      box(w*1.03,h*.47,.32,c,0,-h*.16,l*.48);box(w*1.06,.13,.51,0xb8b7a0,0,-h*.38,l*.5);
      for(const x of [-w*.31,w*.31])box(.2,.2,l*.47,0xb7973d,x,-h*.03,l*.23);
    }else{
      const roadtrain=kind==='roadtrain',front=l*(cabOnly?.22:roadtrain?.382:.355),cabLength=l*(cabOnly?.44:roadtrain?.175:.22);
      cabin(w*.88,h/2-.13-bodyTop,cabLength,c,bodyTop,front,'truck');
      // Mirrors, side steps, air horns, tanks and exhaust distinguish a working truck chassis.
      for(const side of [-1,1]){
        rounded(.25,.31,.19,0x354e55,side*w*.54,bodyTop+h*.25,front+cabLength*.36,.04);
        box(.18,.11,cabLength*.72,0xadb9b4,side*w*.46,bodyY-.14,front);
        cylinder(.12,h*.53,0x9baba7,side*w*.41,bodyTop+h*.23,front-cabLength*.58,'y',10);
        cylinder(.13,cabLength*.54,0x899f9f,side*w*.41,bodyY-.07,front-cabLength*.69,'z',10);
        cylinder(.075,.34,0xced4c7,side*w*.27,h/2+.015,front,'z',8);
        box(.035,.05,.23,0xd1d9c9,side*w*.45,bodyTop-.04,front-cabLength*.15);
      }
      box(w*.62,.31,.035,0x294148,0,bodyTop-.13,nose+.019);
      for(let i=0;i<5;i++)box(w*.57,.021,.045,0xb7c6bc,0,bodyTop-.25+i*.058,nose+.047);
      if(cabOnly){
        rounded(w*.66,.1,l*.25,0x35454a,0,bodyTop+.025,-l*.225,.05);
        cylinder(.43,.09,0x202e35,0,bodyTop+.095,-l*.21,'y',16);
        box(.1,.095,.46,0x72877d,0,bodyTop+.12,-l*.235);
        for(const side of [-1,1]){
          cylinder(.23,l*.23,0x9bafaa,side*w*.355,bodyY+.025,-l*.14,'z',12);
          box(.065,.055,l*.28,0x465e62,side*w*.448,bodyTop+.05,-l*.22);
          box(.27,.095,.05,0xd44435,side*w*.33,bodyY+.075,tail-.032);
        }
        for(const x of [-.2,.2])add(new THREE.TorusGeometry(.17,.028,5,12,Math.PI*1.5),x<0?0xc06840:0x567a89,x,bodyTop+.31,-l*.035,0,Math.PI/2,0);
      }else if(kind==='semi'||roadtrain){
        const trailers=roadtrain?[{z:-l*.304,len:l*.355,tint:0xe5dfc7},{z:l*.084,len:l*.342,tint:0x2d84a9}]:[{z:-l*.2,len:l*.56,tint:0xe7dfce}];
        for(const trailer of trailers){
          const trailerBottom=bodyTop+.035,trailerH=h/2-trailerBottom-.03;
          rounded(w*.94,trailerH,trailer.len,trailer.tint,0,trailerBottom+trailerH/2,trailer.z,.06);
          box(w*.98,.12,trailer.len+.08,0x536c71,0,trailerBottom-.075,trailer.z);
          for(let i=0;i<7;i++)box(.032,.025,trailer.len*.91,trailer.tint,(-.37+i*.1233)*w,h/2-.019,trailer.z);
          for(const side of [-1,1]){
            box(.027,trailerH*.16,trailer.len*.91,c,side*w*.478,trailerBottom+trailerH*.33,trailer.z);
            for(let i=0;i<9;i++)box(.036,trailerH*.91,.037,0xb8c4b7,side*w*.478,trailerBottom+trailerH/2,trailer.z-trailer.len*.43+i*trailer.len*.1075);
            for(let i=0;i<5;i++)box(.032,.056,.11,0xf9c66c,side*w*.487,trailerBottom-.035,trailer.z-trailer.len*.39+i*trailer.len*.195);
          }
          for(const x of [-w*.23,w*.23]){
            box(w*.426,trailerH*.89,.037,0xc5cdbd,x,trailerBottom+trailerH*.5,trailer.z-trailer.len/2-.03);
            box(.035,trailerH*.7,.05,0x637d7b,x*.34,trailerBottom+trailerH*.5,trailer.z-trailer.len/2-.055);
          }
          for(const x of [-w*.32,w*.32])box(.25,.11,.06,0xdc4734,x,trailerBottom-.07,trailer.z-trailer.len/2-.066);
        }
        if(roadtrain){
          box(w*.48,.13,l*.073,0x354b51,0,bodyY,-l*.103);
          for(const x of [-w*.26,w*.26])cylinder(.11,.57,0xc2bda2,x,bodyY+.1,-l*.1,'z',8);
          rounded(w*.66,.095,cabLength*.5,c,0,h/2-.035,front+.03,.03);
        }else{
          cylinder(.23,.075,0x20343b,0,bodyTop-.025,l*.17,'y',12);
          for(const x of [-w*.21,w*.21])cylinder(.045,.52,0x352d2a,x,bodyTop+.14,l*.122,'y',8);
        }
      }else if(kind==='tanker'){
        cylinder(w*.42,l*.54,0xced9d3,0,h*.085,-l*.18,'z',18);
        for(const z of [-l*.45,l*.09])add(new THREE.SphereGeometry(w*.42,16,8).scale(1,1,.24),0xd9dfd5,0,h*.085,z);
        // End caps are visibly domed; narrow circumferential bands and a top walkway break up the cylinder.
        for(const z of [-l*.36,-l*.18,0])add(new THREE.TorusGeometry(w*.425,.034,5,18),0xe05c32,0,h*.085,z);
        box(.47,.09,l*.48,0xd76032,0,h*.52,-l*.17);
        for(let i=0;i<9;i++)box(.48,.017,.095,0x273c40,0,h*.542,-l*.37+i*l*.052);
        box(w*.66,.035,l*.087,0xe07b31,0,h/2+.035,l*.355);
        for(const x of [-w*.22,0,w*.22])add(new THREE.BoxGeometry(.075,.02,l*.075),0x23383e,x,h/2+.064,l*.355,0,-.4,0);
        for(const z of [-l*.29,-l*.03])cylinder(.2,.065,0x8fa6a3,0,h*.55,z,'y',12);
        for(const side of [-1,1]){
          add(new THREE.BoxGeometry(.034,.64,.64),0xe26930,side*w*.43,h*.085,-l*.23,Math.PI/4,0,0);
          box(.04,.28,.082,0x273c3d,side*w*.45,h*.106,-l*.23);cylinder(.053,.043,0x273c3d,side*w*.45,h*.025,-l*.23,'x',8);
        }
        for(const x of [-.24,.24])cylinder(.027,h*.81,0x597577,x,h*.08,-l*.49,'y',6);
        for(let i=0;i<6;i++)box(.49,.025,.035,0x96aaa1,0,-h*.26+i*h*.13,-l*.497);
      }else if(kind==='carrier'){
        for(const y of [-h*.14,h*.43]){
          for(const x of [-w*.28,w*.28])box(w*.27,.095,l*.66,c,x,y,-l*.16);
          for(let i=0;i<8;i++)box(w*.92,.055,.08,0x709b96,0,y+.025,-l*.43+i*l*.087);
        }
        for(const x of [-w*.445,w*.445])for(const z of [-l*.43,-l*.12,l*.14])box(.085,h*.92,.09,c,x,h*.15,z);
        for(const x of [-w*.46,w*.46]){box(.065,.065,l*.64,0xb5bca0,x,h*.61,-l*.15);add(new THREE.BoxGeometry(.065,h*.95,.07),c,x,h*.1,-l*.28,Math.PI/5,0,0);}
        for(const z of [-l*.33,-l*.01]){
          const cargoColor=z<-l*.2?0xf4db9c:0xe56344;
          rounded(w*.7,.23,l*.245,cargoColor,0,h*.49,z,.045);cabin(w*.53,.25,l*.133,cargoColor,h*.535,z-.02,'sport');
          for(const sx of [-1,1])for(const dz of [-l*.079,l*.079])cylinder(.135,.13,0x293939,sx*w*.327,h*.405,z+dz,'x',8);
        }
        for(const x of [-w*.29,w*.29])add(new THREE.BoxGeometry(w*.28,.065,l*.19),0x839c97,x,-h*.28,-l*.44,-.31,0,0);
      }else if(kind==='magnet'){
        box(w*.91,.2,l*.54,c,0,bodyTop-.035,-l*.18);
        cylinder(.38,.21,0x465e62,0,bodyTop+.15,-l*.29,'y',12);
        add(new THREE.BoxGeometry(.24,h*.7,.27),0xebcb67,0,h*.19,-l*.27,-.32,0,0);
        box(.23,.19,l*.32,0xecd074,0,h*.56,-l*.1);
        cylinder(.11,.33,0x9d773b,0,h*.54,-l*.26,'x',10);
        cylinder(.029,h*.34,0x34494b,0,h*.32,l*.02,'y',8);
        cylinder(.59,.21,0x364c54,0,h*.12,l*.02,'y',16);
        cylinder(.615,.065,0x81e5cf,0,h*.035,l*.02,'y',16);
        add(new THREE.TorusGeometry(.455,.073,5,18),0x68e2cd,0,h*.12+.117,l*.02,Math.PI/2,0,0);
        cylinder(.19,.03,0xe9c365,0,h*.12+.124,l*.02,'y',12);
        for(let i=0;i<5;i++)box(w*.65,.02,.04,0x93b6aa,0,bodyTop+.075,-l*.42+i*.23);
      }else if(kind==='missile'){
        box(w*.86,.2,l*.59,0x414c39,0,bodyTop-.06,-l*.16);
        for(const z of [-l*.3,-l*.075]){
          const foot=bodyTop+.04,beam=h*.28-.3;
          box(w*.8,.1,.19,0x4b5b45,0,beam,z);
          for(const x of [-w*.35,w*.35])box(.14,beam-foot,.15,0x657854,x,(foot+beam)/2,z);
          for(const x of [-w*.24,w*.24])add(new THREE.TorusGeometry(.282,.045,5,12,Math.PI),0x6c795a,x,h*.28,z,0,0,Math.PI);
        }
        for(const x of [-w*.24,w*.24]){
          cylinder(.27,l*.43,0xc8ceac,x,h*.28,-l*.18,'z',14);
          add(new THREE.ConeGeometry(.272,.65,12),0xa14130,x,h*.28,l*.084,Math.PI/2,0,0);
          for(const angle of [0,Math.PI/2])add(new THREE.BoxGeometry(.81,.05,.44),0x535f43,x,h*.28,-l*.365,0,0,angle);
          cylinder(.28,.08,0x6e8060,x,h*.28,-l*.28,'z',14);
          cylinder(.278,.14,0xbb4730,x,h*.28,-l*.025,'z',14);
        }
      }
    }
  }else if(kind==='trailer'){
    // Normalised below; collider-sized detaching road-train trailer with its own visible running gear.
    box(2.2,.18,4.5,0x314a54,0,-.78,0);rounded(2.36,1.63,4.45,0x4190b0,0,.15,0,.07);
    for(const side of [-1,1]){
      for(let i=0;i<10;i++)box(.042,1.5,.05,0x80a8b1,side*1.198,.15,-1.98+i*.44);
      box(.048,.18,4.34,0xe5cd88,side*1.205,-.41,0);
      for(const z of [-1.6,-.84])wheel(side*1.12,-.79,z,.34,0x4a6d76,false);
    }
    for(const x of [-.56,.56]){box(1.07,1.46,.045,0xb9c8bf,x,.15,-2.258);box(.05,1.16,.075,0x4a6870,x*.33,.15,-2.29);}
    box(.63,.14,.77,0x354951,0,-.82,2.36);cylinder(.13,.14,0x87978d,0,-.84,2.7,'y',8);
    for(const x of [-.89,.89])box(.24,.1,.05,0xd94935,x,-.66,-2.283);
  }else if(kind==='money'){
    add(new THREE.IcosahedronGeometry(.55,1),0xc4ac55,0,-.05,0);cylinder(.2,.2,0x806d31,0,.44,0,'y',8);
    box(.45,.045,.085,0xf8eab3,0,.44,0);box(.065,.03,.56,0x4f6b36,0,.48,0);box(.35,.03,.08,0x4f6b36,0,.49,-.16);box(.35,.03,.08,0x4f6b36,0,.49,.16);
  }else if(kind==='crate'){
    box(1.2,1.2,1.2,0xbe8e52);for(const y of [-.45,.45])box(1.25,.095,1.25,0xead19a,0,y,0);
    for(const x of [-.45,.45])box(.09,1.23,1.24,0xead19a,x,0,0);
  }else if(kind==='barrier'){
    box(3.2,.7,.8,0xe8e5d4,0,-.13,0);box(2.8,.38,.38,0xfbb441,0,.39,0);
    for(const x of [-1,-.3,.4,1.1])box(.22,.38,.4,0x414c4d,x,.4,0);
  }else if(kind==='sign'){
    box(.12,3.6,.12,0x647d7e,0,-.35,0);box(2.4,1.2,.14,0x136c69,0,1.05,0);
    box(1.65,.1,.03,0xf3e4be,0,1.24,.085);box(1.22,.09,.03,0xf3e4be,-.2,.86,.085);
  }else if(kind==='lamp'){
    cylinder(.09,5.2,0x546e70,0,-.4,0,'y',8);box(1.6,.13,.13,0x546e70,.7,2.17,0);box(.66,.13,.36,0xf4d492,1.3,2.08,0);
    cylinder(.22,.25,0x536367,0,-2.88,0,'y',8);
  }else{
    box(7,3.1,.65,0x197f79,0,.5,0);box(7.3,.18,.82,0xf4d591,0,2.1,0);
    for(const x of [-2.4,2.4])box(.28,2,.3,0x506267,x,-1.95,0);
    for(const x of [-2,-.7,.6,1.9])box(.65,1.25,.03,0xf0d7a0,x,.5,.34);
  }
  const raw=mergeGeometries(parts,false)!;
  const merged=mergeVertices(raw,1e-5);raw.dispose();
  if(!def){merged.computeBoundingBox();const bounds=merged.boundingBox!,size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());merged.translate(-centre.x,-centre.y,-centre.z);merged.scale(1/size.x,1/size.y,1/size.z);}
  merged.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.46,metalness:.13});
  const mesh=new THREE.Mesh(merged,material);mesh.name=`${kind}_body`;mesh.castShadow=true;mesh.receiveShadow=true;
  const group=new THREE.Group();group.name=kind;group.add(mesh);group.userData={original:true,units:'metres',forward:'+Z',pivot:'collider centre',revision:'v0.4 identifiable specials'};
  parts.forEach(p=>p.dispose());return group;
}

/** One cached wreck mesh per model; deformation is asymmetric and preserves the vehicle's colour. */
export function createWreckModel(kind:VehicleKind):THREE.Group {
  return deformWreck(createModel(kind),VEHICLES[kind]);
}

/** Detached road-train tractor. Same centred origin; length matches the 5.2 m collider. */
export function createRoadtrainCab(wreck=false):THREE.Group {
  const group=buildModel('roadtrain',true);group.name='roadtrain_cab';group.userData.variant='detached tractor';
  return wreck?deformWreck(group,{...VEHICLES.roadtrain,length:5.2}):group;
}

function deformWreck(group:THREE.Group,def:(typeof VEHICLES)[VehicleKind]):THREE.Group {
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const geometry=object.geometry,position=geometry.getAttribute('position'),colors=geometry.getAttribute('color');
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),front=Math.max(0,z/def.length+.15),roof=Math.max(0,y/def.height+.05);
      position.setXYZ(i,x*(1+roof*.19)+Math.sin(z*2.4)*roof*.18,-def.height/2+(y+def.height/2)*(.55+.17*Math.cos(z*1.5)),z*(1-front*.28)+Math.sin(x*4)*roof*.15);
      const burnt=.28+.46*(.5+.5*Math.sin(x*5.1+z*3.4));colors.setXYZ(i,colors.getX(i)*burnt,colors.getY(i)*burnt*.92,colors.getZ(i)*burnt*.87);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=object.material as THREE.MeshStandardMaterial;material.roughness=.86;material.metalness=.16;
  });return group;
}
