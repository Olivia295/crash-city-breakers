import * as THREE from 'three';
import { createModel } from '../render/models';
import type { VehicleKind } from '../shared';
import { applyPaint } from '../render/paint';
import { paintById } from '../simulation/perks';

/** A still render of the exact vehicle geometry used in the game, with no animation loop. */
export class CarPreview {
  private readonly renderer:THREE.WebGLRenderer;
  private readonly scene=new THREE.Scene();
  private readonly camera=new THREE.OrthographicCamera(-5,5,3,-3,.1,80);
  private readonly floor:THREE.Mesh<THREE.PlaneGeometry,THREE.ShadowMaterial>;
  private readonly resizeObserver:ResizeObserver;
  private vehicle?:THREE.Group;
  private kind?:VehicleKind;
  private paint='stock';
  private host?:HTMLElement;
  private bounds=new THREE.Box3();

  constructor(){
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setClearColor(0x000000,0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.2;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden','true');
    this.renderer.domElement.className='vehicle-preview-canvas';
    this.camera.position.set(9,6.2,11);this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight(0xe6f4ff,0x324454,2.3));
    const key=new THREE.DirectionalLight(0xfff2dd,3.5);key.position.set(-5,8,7);key.castShadow=true;
    key.shadow.mapSize.set(512,512);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:30});
    key.shadow.normalBias=.035;key.shadow.bias=-.0004;key.shadow.radius=4;this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x8acbff,2);rim.position.set(5,3,-6);this.scene.add(rim);
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.25}));
    this.floor.rotation.x=-Math.PI/2;this.floor.receiveShadow=true;this.scene.add(this.floor);
    this.resizeObserver=new ResizeObserver(()=>this.render());
    this.renderer.domElement.addEventListener('webglcontextlost',event=>event.preventDefault());
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>this.render());
  }

  show(host:HTMLElement,kind:VehicleKind,paint='stock'):void {
    this.resizeObserver.disconnect();this.host=host;host.append(this.renderer.domElement);
    if(this.kind!==kind||!this.vehicle||this.paint!==paint){
      this.removeVehicle();this.kind=kind;this.paint=paint;this.vehicle=createModel(kind);applyPaint(this.vehicle,kind,paintById(paint).color);
      this.bounds.setFromObject(this.vehicle);
      const centre=this.bounds.getCenter(new THREE.Vector3());this.vehicle.position.sub(centre);
      this.scene.add(this.vehicle);this.bounds.setFromObject(this.vehicle);
      this.floor.position.y=this.bounds.min.y-.015;
    }
    this.resizeObserver.observe(host);this.render();
  }

  hide():void {
    this.resizeObserver.disconnect();this.renderer.domElement.remove();this.host=undefined;this.removeVehicle();
  }

  private render():void {
    if(!this.host?.isConnected||!this.vehicle)return;
    const {width,height}=this.host.getBoundingClientRect();if(width<1||height<1)return;
    this.renderer.setSize(Math.round(width),Math.round(height),false);
    this.camera.updateMatrixWorld();
    const projected=new THREE.Box3();
    for(const x of [this.bounds.min.x,this.bounds.max.x])for(const y of [this.bounds.min.y,this.bounds.max.y])for(const z of [this.bounds.min.z,this.bounds.max.z]){
      projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));
    }
    const size=projected.getSize(new THREE.Vector3()),aspect=width/height;
    const halfHeight=Math.max(size.y/2,size.x/(2*aspect))*1.09;
    this.camera.left=-halfHeight*aspect;this.camera.right=halfHeight*aspect;
    this.camera.top=halfHeight;this.camera.bottom=-halfHeight;this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene,this.camera);
  }

  private removeVehicle():void {
    if(!this.vehicle)return;
    this.scene.remove(this.vehicle);
    this.vehicle.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
    this.vehicle=undefined;this.kind=undefined;
  }
}
