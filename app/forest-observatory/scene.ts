import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createForest(host: HTMLDivElement, report: (s: string) => void) {
  let seed = 81;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const scene = new T.Scene(); scene.background = new T.Color('#d6decd'); scene.fog = new T.Fog('#d6decd', 28, 65);
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; host.appendChild(renderer.domElement);
  const camera = new T.PerspectiveCamera(42, 1, .1, 100);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 13; controls.maxDistance = 33; controls.minPolarAngle = .35; controls.maxPolarAngle = 1.43;
  const reset = () => { const factor=Math.max(1,Math.min(1.8, .85/(host.clientWidth/host.clientHeight))); camera.position.set(17*factor, 13*factor, 21*factor); controls.maxDistance=55; controls.target.set(0, 2.4, 0); controls.update(); }; reset();
  const hemi = new T.HemisphereLight('#e8f2df', '#66583c', 2.3); scene.add(hemi);
  const sun = new T.DirectionalLight('#fff1c4', 3.5); sun.position.set(-8, 17, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); sun.shadow.bias = -.001; scene.add(sun);
  const materials: T.Material[] = [];
  const mat = (color: string, roughness = .9) => { const m = new T.MeshStandardMaterial({ color, roughness }); materials.push(m); return m; };
  const bark = mat('#695140'), dirt = mat('#89745a'), grass = mat('#879966'), stone = mat('#a6ac91');
  const leafMats = ['#647c3e','#78954a','#92a85b','#4c6c3d'].map(c => mat(c));
  const sphere = new T.IcosahedronGeometry(1, 1), cylinder = new T.CylinderGeometry(1, 1, 1, 7);
  const mesh = (g: T.BufferGeometry, m: T.Material, parent: T.Object3D, x=0,y=0,z=0, sx=1,sy=sx,sz=sx) => { const o = new T.Mesh(g,m); o.position.set(x,y,z); o.scale.set(sx,sy,sz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const branch = (a: T.Vector3, b: T.Vector3, radius: number, parent: T.Object3D) => { const o=mesh(cylinder,bark,parent); o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(radius,a.distanceTo(b),radius*.85); o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()); return o; };
  mesh(new T.CylinderGeometry(8.1,7.5,.85,64),dirt,scene,0,-.65,0);
  mesh(new T.CylinderGeometry(8.15,8.1,.2,64),grass,scene,0,-.15,0);
  // A quiet, irregular pond, kept below the mossy bank.
  const waterMat = mat('#769d95',.2); const pond=mesh(new T.CircleGeometry(1,60),waterMat,scene,1.2,-.035,1.3,2.9,1.7,1); pond.rotation.x=-Math.PI/2; pond.castShadow=false;
  for(let i=0;i<85;i++){ const a=random()*Math.PI*2,r=7.7+random()*.4; mesh(sphere,stone,scene,Math.cos(a)*r,-.02,Math.sin(a)*r,.15+random()*.3,.15+random()*.3,.15+random()*.3); }
  for(let i=0;i<46;i++){const a=random()*Math.PI*2;mesh(sphere,stone,scene,1.2+Math.cos(a)*2.95,.02,1.3+Math.sin(a)*1.75,.12+random()*.24,.1+random()*.2,.14+random()*.3);}
  const trees: { group:T.Group; perches:T.Vector3[]; shake:number; last:number }[]=[];
  const targets:T.Object3D[]=[pond];
  const locations=[[-4,-3],[-.6,-4.9],[3.2,-4.2],[5.7,-1.2],[-6,.1],[-4.5,3.4],[4.7,4],[-1.5,-1.7]];
  const dummy=new T.Object3D();
  locations.forEach(([x,z], index)=>{
    const group=new T.Group();group.position.set(x,0,z);scene.add(group);const h=4.3+random()*2;
    const top=new T.Vector3(.25,h,0);branch(new T.Vector3(),top,.19+random()*.1,group);
    const perches:T.Vector3[]=[];
    const leaves=new T.InstancedMesh(sphere,leafMats[index%4],240);leaves.castShadow=true;leaves.receiveShadow=true;group.add(leaves);
    let count=0;
    for(let j=0;j<8;j++){const a=j*2.4+index, y=h*(.45+j*.06); const end=new T.Vector3(Math.cos(a)*(1.25+random()*.65),y+.65,Math.sin(a)*(1.25+random()*.65));branch(new T.Vector3(.15,y-.7,0),end,.065,group);perches.push(end.clone().add(new T.Vector3(0,.12,0)).add(group.position));
      for(let k=0;k<30;k++){dummy.position.copy(end).add(new T.Vector3((random()-.5)*2.2,(random()-.5)*1.25,(random()-.5)*2.2));dummy.scale.set(.28+random()*.35,.12+random()*.18,.24+random()*.4);dummy.rotation.set(random(),random()*6,random());dummy.updateMatrix();leaves.setMatrixAt(count++,dummy.matrix);}
    }
    group.traverse(o=>{if(o instanceof T.Mesh){o.userData.tree=index;targets.push(o);}});trees.push({group,perches,shake:0,last:-10});
    for(let j=0;j<5;j++){const a=j*1.256;branch(new T.Vector3(0,.3,0),new T.Vector3(Math.cos(a)*.7,0,Math.sin(a)*.7),.08,group);}
  });
  // Ground cover is instanced: hundreds of blades, one draw call.
  const blades=new T.InstancedMesh(new T.ConeGeometry(.075,.42,3),leafMats[1],700);
  for(let i=0;i<700;i++){let x=(random()-.5)*15,z=(random()-.5)*15; if(x*x+z*z>57 || ((x-1.2)/3.2)**2+((z-1.3)/2)**2<1){x=-6+random();z=-2+random()*4;}dummy.position.set(x,.16,z);dummy.rotation.set((random()-.5)*.5,random()*6,(random()-.5)*.5);dummy.scale.setScalar(.5+random());dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix);}scene.add(blades);
  const flower=mat('#ead6a1');for(let i=0;i<60;i++){const x=-4+random()*2,z=1+random()*3;mesh(sphere,flower,scene,x,.28,z,.045,.045,.045);}
  const birdMats=['#527786','#b58a56','#78826a'].map(c=>mat(c)); const cream=mat('#e7dbb8'), dark=mat('#273a34');
  type Bird={group:T.Group;left:T.Group;right:T.Group;tree:number;path:T.CatmullRomCurve3|null;progress:number;delay:number;speed:number;phase:number};
  const birds:Bird[]=[];
  for(let i=0;i<16;i++){const group=new T.Group();const m=birdMats[i%3];mesh(sphere,m,group,0,0,0,.13,.12,.23);mesh(sphere,m,group,0,.12,.16,.105);mesh(sphere,cream,group,0,-.03,.09,.105,.09,.15);mesh(sphere,dark,group,-.084,.145,.20,.018);mesh(sphere,dark,group,.084,.145,.20,.018);mesh(sphere,cream,group,0,.105,.29,.035,.027,.075);mesh(sphere,m,group,0,-.01,-.27,.06,.035,.15);
    const left=new T.Group(),right=new T.Group();group.add(left,right);left.position.x=-.08;right.position.x=.08;mesh(sphere,m,left,-.17,0,-.03,.23,.035,.12);mesh(sphere,m,right,.17,0,-.03,.23,.035,.12);const tree=i%trees.length;group.position.copy(trees[tree].perches[i%8]);group.rotation.y=random()*6;scene.add(group);birds.push({group,left,right,tree,path:null,progress:0,delay:0,speed:.2+random()*.08,phase:random()*6});}
  const fish=new T.Group();scene.add(fish);fish.visible=false;
  const silver=mat('#edbf73');mesh(sphere,silver,fish,0,0,0,.15,.22,.42);mesh(sphere,silver,fish,0,0,-.46,.22,.04,.19);mesh(sphere,dark,fish,.12,.08,.24,.028);mesh(sphere,dark,fish,-.12,.08,.24,.028);
  const rippleMat=new T.MeshBasicMaterial({color:'#c8eee1',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false});materials.push(rippleMat);
  const ripple=mesh(new T.RingGeometry(.92,1,48),rippleMat,scene);ripple.rotation.x=-Math.PI/2;ripple.castShadow=false;ripple.receiveShadow=false;ripple.visible=false;
  const glowMat=new T.MeshBasicMaterial({color:'#def69a'});materials.push(glowMat);
  const glows=new T.Group();scene.add(glows);glows.visible=false;
  for(let i=0;i<24;i++){const o=mesh(sphere,glowMat,glows,Math.sin(i*2.4)*5,.5+(i%5)*.35,Math.cos(i*2.4)*5,.027);o.castShadow=false;}
  let time=0, frame=0, previous=performance.now(), idle=8, touched=0, alive=true, night=false, jump=-1, rippleAge=10;
  const splash=()=>{if(jump>=0)return;jump=0;fish.visible=true;report('水面から、きらり。魚が跳ねました。');};
  const fly=(b:Bird, delay=0)=>{if(b.path)return;const dest=(b.tree+1+Math.floor(random()*(trees.length-1)))%trees.length;const start=b.group.position.clone(),end=trees[dest].perches[Math.floor(random()*8)].clone();b.path=new T.CatmullRomCurve3([start,start.clone().lerp(end,.25).add(new T.Vector3(0,2+random(),0)),start.clone().lerp(end,.7).add(new T.Vector3(0,1.8,0)),end]);b.tree=dest;b.progress=0;b.delay=delay;};
  const touch=(index?:number)=>{const n=index??(touched++%trees.length),tree=trees[n];if(time-tree.last<1.5)return;tree.last=time;tree.shake=1;let count=0;birds.forEach(b=>{if(b.tree===n&&!b.path){fly(b,count*.13);count++;}});report(count?`${count}羽が枝を離れました。行き先を追ってみましょう。`:'葉がさわさわと揺れました。鳥たちは森のどこかに。');};
  const ray=new T.Raycaster(),pointer=new T.Vector2();let down:{x:number;y:number;id:number;moved:boolean}|null=null;const pointers=new Set<number>();
  const start=(e:PointerEvent)=>{pointers.add(e.pointerId);if(pointers.size===1)down={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};else if(down)down.moved=true;};
  const move=(e:PointerEvent)=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)down.moved=true;};
  const end=(e:PointerEvent)=>{if(down&&down.id===e.pointerId&&!down.moved&&pointers.size===1){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(targets,false)[0];if(hit){if(hit.object===pond)splash();else touch(hit.object.userData.tree);}}pointers.delete(e.pointerId);if(!pointers.size)down=null;};
  const cancel=(e:PointerEvent)=>{pointers.delete(e.pointerId);down=null;};
  const canvas=renderer.domElement;canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',cancel);
  const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate=(now:number)=>{if(!alive)return;frame=requestAnimationFrame(animate);const dt=document.hidden?0:Math.min((now-previous)/1000,.05);previous=now;if(!dt)return;time+=dt;
    if(!reduced&&!night&&time>idle){fly(birds[Math.floor(random()*birds.length)]);idle=time+5+random()*6;}
    if(jump>=0){jump=Math.min(1,jump+dt/1.25);fish.position.set(.2+2*jump,-.035+Math.sin(Math.PI*jump)*1.6,1.3);fish.rotation.set(0,Math.PI/2,Math.atan2(Math.PI*1.6*Math.cos(Math.PI*jump),2));if(jump===1){jump=-1;fish.visible=false;rippleAge=0;ripple.position.set(2.2,-.025,1.3);report('ぽちゃん。波紋が静かに広がっていきます。');}}
    rippleAge+=dt;ripple.visible=rippleAge<1.8;ripple.scale.setScalar(.15+rippleAge*.45);rippleMat.opacity=Math.max(0,.7*(1-rippleAge/1.8));
    if(night&&!reduced)glows.children.forEach((o,i)=>{o.position.y=.8+(i%5)*.35+Math.sin(time*.7+i)*.25;o.scale.setScalar(.02+.012*(1+Math.sin(time*1.4+i)));});
    trees.forEach((tree,i)=>{tree.shake=Math.max(0,tree.shake-dt*.65);tree.group.rotation.z=Math.sin(time*12)*tree.shake*.025+(reduced?0:Math.sin(time*.7+i)*.006);});
    birds.forEach(b=>{if(b.path){b.delay-=dt;if(b.delay<=0){b.progress=Math.min(1,b.progress+dt*b.speed);b.group.position.copy(b.path.getPoint(b.progress));const tangent=b.path.getTangent(b.progress);b.group.rotation.y=Math.atan2(tangent.x,tangent.z);b.group.rotation.x=-Math.asin(Math.max(-1,Math.min(1,tangent.y)))*.4;b.left.rotation.z=Math.sin(time*24+b.phase)*.85;b.right.rotation.z=-b.left.rotation.z;if(b.progress===1){b.path=null;b.group.rotation.x=0;}}}else{b.left.rotation.z=-.95;b.right.rotation.z=.95;}});
    controls.update();if(scene.fog instanceof T.Fog){scene.fog.near=camera.position.distanceTo(controls.target)+8;scene.fog.far=scene.fog.near+35;}renderer.render(scene,camera);
  };frame=requestAnimationFrame(animate);
  const lost=(e:Event)=>{e.preventDefault();report('3D表示が中断されました。ページを再読み込みしてください。');};canvas.addEventListener('webglcontextlost',lost);
  return {touch:()=>touch(),splash,reset,light:(period:number)=>{night=period===2;glows.visible=night;sun.color.set(['#fff1c4','#ffbc79','#b9d6ff'][period]);sun.intensity=[3.5,2.5,1.1][period];hemi.intensity=[2.3,1.3,.55][period];hemi.color.set(night?'#668bc6':'#e8f2df');const color=['#d6decd','#c8bba3','#111f33'][period];scene.background=new T.Color(color);scene.fog=new T.Fog(color,28,65);report(['朝の光が、葉の間を通り抜けます。','森が、あたたかな夕色に変わりました。','月明かりの森。水辺に小さな蛍が灯ります。'][period]);},dispose:()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();canvas.removeEventListener('pointerdown',start);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('webglcontextlost',lost);const geometries=new Set<T.BufferGeometry>();scene.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();canvas.remove();}};
}
