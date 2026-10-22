import { mkdir, writeFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createModel, createWreckModel, createRoadtrainCab } from '../src/render/models.ts';
import { VEHICLES } from '../src/shared.ts';

globalThis.FileReader=class {
  onloadend=null;result=null;
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();});}
};
const destination=new URL('../public/models/',import.meta.url);
await mkdir(new URL('wrecks/',destination),{recursive:true});
const manifest={author:'Crash City original parametric artwork',license:'Project original assets',revision:'v0.4 identifiable specials',units:'metres',forward:'+Z',pivot:'collider centre',textureCount:0,assets:[],wrecks:[],variants:[]};
async function exportModel(kind,wreck=false){
  const variant=kind==='roadtrain_cab';
  const model=variant?createRoadtrainCab(wreck):wreck?createWreckModel(kind):createModel(kind);
  const file=`${wreck?'wrecks/':''}${kind}.glb`;
  const data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  await writeFile(new URL(file,destination),new Uint8Array(data));
  let vertices=0,triangles=0,meshes=0;const materials=new Set();
  model.traverse(object=>{
    if(!object.isMesh)return;
    const geometry=object.geometry;vertices+=geometry.attributes.position.count;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;meshes++;
    for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  });
  const size=new Box3().setFromObject(model).getSize(new Vector3());
  const asset={id:kind,file,bytes:data.byteLength,triangles,vertices,meshes,materials:materials.size,bounds:[size.x,size.y,size.z].map(v=>Math.round(v*1000)/1000)};
  if(VEHICLES[kind])asset.collider=[VEHICLES[kind].width,VEHICLES[kind].height,VEHICLES[kind].length];
  else if(variant)asset.collider=[VEHICLES.roadtrain.width,VEHICLES.roadtrain.height,5.2];
  else asset.scale='unit xyz; entity.scale supplies dimensions';
  (variant?manifest.variants:wreck?manifest.wrecks:manifest.assets).push(asset);
  model.traverse(object=>{if(object.isMesh)object.geometry.dispose();});materials.forEach(material=>material.dispose());
}
for(const kind of [...Object.keys(VEHICLES),'crate','barrier','sign','lamp','facade','money','trailer'])await exportModel(kind);
for(const kind of Object.keys(VEHICLES))await exportModel(kind,true);
await exportModel('roadtrain_cab');await exportModel('roadtrain_cab',true);
await writeFile(new URL('manifest.json',destination),JSON.stringify(manifest,null,2)+'\n');
for(const [name,list] of [['runtime',manifest.assets],['wreck review',manifest.wrecks],['tractor variants',manifest.variants]])console.log(`${name}: ${list.length} GLBs · ${list.reduce((sum,x)=>sum+x.bytes,0).toLocaleString()} bytes · ${list.reduce((sum,x)=>sum+x.triangles,0).toLocaleString()} triangles · ${Math.max(...list.map(x=>x.triangles)).toLocaleString()} max/model`);
console.table(manifest.assets.filter(x=>['compact','sport','pickup','semi','doubledecker','blackcab','ute','roadtrain','trailer'].includes(x.id)).map(({id,bytes,triangles,meshes,materials,bounds})=>({id,KB:Math.round(bytes/102.4)/10,triangles,meshes,materials,bounds:bounds.join(' × ')})));
