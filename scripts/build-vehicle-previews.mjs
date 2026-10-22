import assert from 'node:assert/strict';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// A single browser, page and WebGL context render the exact procedural game models.
// No substitute artwork, model rescaling, or game UI dependencies enter the previews.
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'public/models/previews');
const review=path.join(root,'artifacts/vehicle-v04');
const width=640,height=400,entry='virtual:vehicle-preview';
await mkdir(output,{recursive:true});await mkdir(review,{recursive:true});
const rendererSource=String.raw`
import * as THREE from 'three';
import {createModel} from '/src/render/models.ts';
import {VEHICLES} from '/src/shared.ts';
const width=640,height=400;
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(width,height);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xf1f6e9,0x537879,2.05));
const sun=new THREE.DirectionalLight(0xffefd3,3.65);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xb9e7ff,1.35);fill.position.set(8,4,-7);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.23}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,300);
const pixelCanvas=document.createElement('canvas');pixelCanvas.width=width;pixelCanvas.height=height;const pixels=pixelCanvas.getContext('2d',{willReadFrequently:true});
let previous;
function disposeModel(model){model.traverse(object=>{if(object.isMesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});}
function render(kind){
 if(previous){scene.remove(previous);disposeModel(previous);}
 const model=createModel(kind);previous=model;scene.add(model);
 const bounds=new THREE.Box3().setFromObject(model),centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 floor.position.y=bounds.min.y-.035;
 camera.position.copy(centre).add(new THREE.Vector3(8,6.1,10));camera.lookAt(centre);camera.updateMatrixWorld(true);
 const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
 const span=Math.max((projected.max.y-projected.min.y)/.88,(projected.max.x-projected.min.x)/(width/height)/.91),aspect=width/height;
 camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span*.5;camera.bottom=-span*.5;camera.updateProjectionMatrix();
 const extent=Math.max(size.length(),6);sun.position.copy(centre).add(new THREE.Vector3(-.8,1.6,1.1).multiplyScalar(extent));sun.target.position.copy(centre);
 Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:extent*5});sun.shadow.camera.updateProjectionMatrix();
 renderer.render(scene,camera);
 let meshes=0,triangles=0;model.traverse(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});
 pixels.clearRect(0,0,width,height);pixels.drawImage(renderer.domElement,0,0);const rgba=pixels.getImageData(0,0,width,height).data;let occupied=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>10)occupied++;
 return {id:kind,meshes,triangles,width,height,occupiedPixels:occupied,transparentRatio:1-occupied/(width*height),png:renderer.domElement.toDataURL('image/png')};
}
window.__vehiclePreview={catalog:Object.values(VEHICLES).map(({id,name,tag})=>({id,name,tag})),render,dispose(){if(previous)disposeModel(previous);floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
`;
const server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:5189,strictPort:false,hmr:false},plugins:[{
 name:'exact-game-vehicle-previews',
 resolveId(id){if(id===entry)return '\0'+entry;},
 load(id){if(id==='\0'+entry)return rendererSource;},
 configureServer(server){server.middlewares.use('/__vehicle-preview.html',(_request,response)=>{response.setHeader('content-type','text/html');response.end(`<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:transparent}canvas{display:block}</style><script type="module" src="/@id/${entry}"></script></html>`);});}
}]});
let browser;
try{
 await server.listen();const address=server.httpServer.address();const origin=`http://127.0.0.1:${address.port}`;
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/__vehicle-preview.html');await page.waitForFunction(()=>window.__vehiclePreview,undefined,{timeout:20000});
 const catalog=await page.evaluate(()=>window.__vehiclePreview.catalog);assert.equal(catalog.length,23,'The gallery needs one real preview for each of the 23 vehicle kinds.');
 const manifest={source:'src/render/models.ts:createModel',width,height,background:'transparent',view:'orthographic front three-quarter',webglContexts:1,previews:[]};const rendered=[];
 for(const {id} of catalog){
  const result=await page.evaluate(kind=>window.__vehiclePreview.render(kind),id);assert.equal(result.meshes,1,`${id} stays merged`);assert(result.occupiedPixels>12000,`${id} preview is visible`);assert(result.transparentRatio>.12,`${id} fits inside the frame`);
  const file=`${id}.png`;await writeFile(path.join(output,file),Buffer.from(result.png.split(',')[1],'base64'));const {png,...metadata}=result;manifest.previews.push({...metadata,file,bytes:(await stat(path.join(output,file))).size});rendered.push({...catalog.find(vehicle=>vehicle.id===id),preview:png});
 }
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await page.evaluate(()=>window.__vehiclePreview.dispose());
 await page.setViewportSize({width:1600,height:1260});
 await page.evaluate(catalog=>{
  document.body.innerHTML='';document.body.style.cssText='margin:0;background:#0c171d;color:#f1e9d3;font-family:system-ui,sans-serif';
  const style=document.createElement('style');style.textContent='header{padding:20px 24px}h1{font-size:24px;margin:0 0 4px}header p{margin:0;font-size:13px;color:#85a4a9}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;background:#31474d}.card{height:230px;background:linear-gradient(140deg,#22343c,#15252c);padding:9px 14px;box-sizing:border-box}.card img{display:block;width:100%;height:179px;object-fit:contain}.card strong{font-size:15px}.card small{display:block;font-size:10px;letter-spacing:.5px;color:#83aaa8;margin-top:2px}';document.head.append(style);
  const header=document.createElement('header');header.innerHTML='<h1>CRASH · v0.4 真实车辆图鉴预览</h1><p>23 个游戏模型 · 统一 3/4 视角 · 透明 640×400 PNG · 同一 WebGL 渲染器逐车生成</p>';document.body.append(header);
  const grid=document.createElement('main');grid.className='grid';document.body.append(grid);
  for(const {id,name,tag,preview} of catalog){const card=document.createElement('section');card.className='card';const image=document.createElement('img');image.src=preview;image.alt=name;const title=document.createElement('strong');title.textContent=name;const subtitle=document.createElement('small');subtitle.textContent=id.toUpperCase()+' / '+tag;card.append(image,title,subtitle);grid.append(card);}
 },rendered);
 await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));await page.screenshot({path:path.join(review,'01-model-previews.png'),fullPage:true});
 assert.deepEqual(errors,[],'Preview rendering produced no browser errors');
 console.log(`Built ${manifest.previews.length} actual-model previews at ${width}×${height}; ${manifest.previews.reduce((sum,item)=>sum+item.bytes,0).toLocaleString()} bytes; 1 WebGL context.`);
 console.log('Review: artifacts/vehicle-v04/01-model-previews.png');
}finally{await browser?.close();await server.close();}
