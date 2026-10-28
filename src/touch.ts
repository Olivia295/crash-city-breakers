/** Phone controls: one floating thumb-stick for steering and aftertouch. Blast and ability are HUD buttons. */
export const isTouchDevice=():boolean=>{
  try{
    if(new URLSearchParams(location.search).get('touch')==='1')return true;
    return window.matchMedia('(pointer: coarse)').matches&&navigator.maxTouchPoints>0;
  }catch{return false;}
};

export interface TouchStick {
  /** Unit-length direction while the stick is held, otherwise zero. */
  readonly axis:{x:number;z:number};
  readonly held:boolean;
  setVisible(visible:boolean):void;
}

const RADIUS=58;
const DEADZONE=.16;

export function createTouchStick(parent:HTMLElement):TouchStick {
  const root=document.createElement('div');
  root.className='touch-stick';root.hidden=true;root.setAttribute('aria-label','虚拟摇杆');
  root.innerHTML='<div class="touch-stick-base"><div class="touch-stick-knob"></div></div><span class="touch-stick-label">转向 / 空中调整</span>';
  parent.append(root);
  const base=root.querySelector<HTMLElement>('.touch-stick-base')!,knob=root.querySelector<HTMLElement>('.touch-stick-knob')!;
  const state={x:0,z:0,held:false};let pointerId=-1;

  const update=(event:PointerEvent)=>{
    const rect=base.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    let dx=event.clientX-cx,dy=event.clientY-cy;const length=Math.hypot(dx,dy)||1,clamped=Math.min(length,RADIUS);
    dx=dx/length*clamped;dy=dy/length*clamped;
    knob.style.transform=`translate(${dx}px,${dy}px)`;
    const magnitude=clamped/RADIUS;
    if(magnitude<DEADZONE){state.x=0;state.z=0;}else{state.x=dx/clamped;state.z=dy/clamped;}
  };
  const release=()=>{pointerId=-1;state.x=0;state.z=0;state.held=false;knob.style.transform='translate(0,0)';root.classList.remove('is-held');};

  root.addEventListener('pointerdown',event=>{
    if(pointerId!==-1)return;
    pointerId=event.pointerId;state.held=true;root.classList.add('is-held');
    root.setPointerCapture(event.pointerId);update(event);event.preventDefault();
  });
  root.addEventListener('pointermove',event=>{if(event.pointerId===pointerId){update(event);event.preventDefault();}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)root.addEventListener(type,event=>{if(event.pointerId===pointerId)release();});

  return {
    get axis(){return {x:state.x,z:state.z};},
    get held(){return state.held;},
    setVisible(visible){root.hidden=!visible;if(!visible)release();},
  };
}
