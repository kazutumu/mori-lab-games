"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { canWalk, places, screenMotion, stickVector } from "./world";
import "./plaza.css";

export default function MinaPlaza() {
  const mount=useRef<HTMLDivElement>(null),stick=useRef({x:0,y:0}),action=useRef(()=>{});
  const [knob,setKnob]=useState({x:0,y:0}),[near,setNear]=useState(-1),[step,setStep]=useState(0);
  const [message,setMessage]=useState(""),[help,setHelp]=useState(true),[error,setError]=useState(""),[fps,setFps]=useState(0);
  const progress=useRef(0),dialogue=useRef(false),pointer=useRef<number|null>(null);
  useEffect(()=>{
    const host=mount.current!;
    let renderer:THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"}); }
    catch { const timer=window.setTimeout(()=>setError("3D画面を開けませんでした。WebGL対応ブラウザで開き直してください。"),0);return()=>window.clearTimeout(timer); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xc6d8d6);scene.fog=new THREE.Fog(0xc6d8d6,35,80);
    const camera=new THREE.PerspectiveCamera(40,1,.1,100);
    scene.add(new THREE.HemisphereLight(0xfff4db,0x688378,2.4));
    const sun=new THREE.DirectionalLight(0xffe4b7,3.1);sun.position.set(-12,22,12);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;scene.add(sun);
    const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[],textures:THREE.Texture[]=[];
    const material=(color:number)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.88});materials.push(m);return m;};
    const cream=material(0xf6e8c7),blue=material(0x527da6),wood=material(0x81604a),dark=material(0x333c35),skin=material(0xe7b995),hair=material(0x47372d);
    const green=material(0x7eaa6e),leaf=material(0x65936a),stone=material(0xc6bda3),roof=material(0x8a6953),teal=material(0x477e79),pink=material(0xdca49a);
    const mesh=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=scene)=>{geometries.push(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
    const box=(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=scene)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
    const sphere=(r:number,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=scene)=>mesh(new THREE.SphereGeometry(r,12,8),mat,x,y,z,parent);
    const cyl=(a:number,b:number,h:number,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=scene)=>mesh(new THREE.CylinderGeometry(a,b,h,12),mat,x,y,z,parent);
    const ground=material(0xe4d9b6);
    const loader=new THREE.TextureLoader();let disposed=false;
    const paving=loader.load("/game-assets/diorama-rpg-ch1/texture-path-v1.jpg",t=>{if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,8);ground.map=t;ground.needsUpdate=true;});textures.push(paving);
    box(28,1,28,stone,0,-.6,0);box(26,.16,26,ground,0,-.04,0);
    box(200,.1,200,green,0,-1.3,0).castShadow=false;
    // The square is a real traversable scene; buildings share the collision footprints.
    const house=(x:number,z:number,w:number,d:number,color:THREE.Material)=>{
      box(w,4.3,d,color,x,2.1,z);box(w+.35,.25,d+.35,cream,x,4.3,z);
      const cap=mesh(new THREE.ConeGeometry(w*.77,1.8,4),roof,x,5.15,z);cap.rotation.y=Math.PI/4;cap.scale.z=d/w;
      box(1,2,.12,teal,x,1,z+d/2+.08);
      for(const dx of [-w*.31,w*.31]) {box(.9,1.25,.14,cream,x+dx,2.6,z+d/2+.06);box(.7,1.03,.16,teal,x+dx,2.6,z+d/2+.09);box(.06,1.1,.2,cream,x+dx,2.6,z+d/2+.12);}
      for(const dx of [-w/2,w/2])box(.12,4.2,.15,wood,x+dx,2.1,z+d/2+.07);
    };
    house(-7,-7,5.8,5.5,cream);house(7,-8,5.5,5,material(0xc5c8a0));
    for(let i=0;i<6;i++){const canopy=box(.85,.13,2,i%2?cream:teal,-9.12+i*.85,2.8,-3.7);canopy.rotation.x=.12;}
    for(const x of [-9.5,-4.5])cyl(.055,.055,2.8,wood,x,1.4,-2.8);
    box(3,.9,.75,wood,-7,.45,-3.4);for(let i=0;i<3;i++)cyl(.13,.1,.22,cream,-7.6+i*.6,1,-3.4);
    // Low fountain keeps the centre readable from every camera angle.
    cyl(1.45,1.55,.4,stone,0,.15,0);cyl(1.22,1.22,.1,teal,0,.38,0);cyl(.3,.44,1.2,stone,0,.7,0);sphere(.38,cream,0,1.4,0);
    const treeCrowns:THREE.Mesh[]=[];
    for(const [x,z] of [[-10,3],[-7,9],[9,2],[10,9],[-2,10]]){
      cyl(.18,.3,2.8,wood,x,1.4,z);
      for(let i=0;i<3;i++){const crown=sphere(1.45,i%2?green:leaf,x+Math.cos(i*2.1)*.5,3.35+i*.3,z+Math.sin(i*2.1)*.5);crown.scale.y=.8;treeCrowns.push(crown);}
      cyl(1.2,1.25,.2,stone,x,.12,z);
    }
    for(const x of [5.7,8.3]) {box(.12,.9,.65,dark,x,.5,5.7);box(.12,.8,.12,dark,x,1.15,6);}
    for(let i=0;i<4;i++)box(3.4,.09,.16,wood,7,.93,5.4+i*.19);
    for(let i=0;i<3;i++)box(3.4,.14,.1,wood,7,1.22+i*.2,6);
    for(const x of [-11,11])for(const z of [-9,-2,6]){cyl(.055,.08,2.5,dark,x,1.25,z);box(.35,.5,.35,cream,x,2.55,z);mesh(new THREE.ConeGeometry(.32,.25,4),dark,x,2.95,z);}
    for(const x of [-1.1,1.1])box(.13,2,.13,wood,x,1,-9.8);box(2.6,1.25,.15,wood,0,1.5,-9.8);box(2.3,1,.18,cream,0,1.5,-9.7);
    for(let i=0;i<18;i++){const x=-11+i*1.3;box(.09,.65,.09,cream,x,.4,12);}
    box(23,.08,.08,cream,0,.65,12);
    // Small repeated flowers are instanced, keeping vegetation inexpensive.
    const flowerGeo=new THREE.IcosahedronGeometry(.11,0);geometries.push(flowerGeo);
    const flowers=new THREE.InstancedMesh(flowerGeo,pink,90),dummy=new THREE.Object3D();
    for(let i=0;i<90;i++){const t=i*2.399,r=.65+(i%7)*.13;const origin=i<45?[-10,3]:[10,9];dummy.position.set(origin[0]+Math.cos(t)*r,.3,origin[1]+Math.sin(t)*r);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);}scene.add(flowers);
    function person(isMina:boolean,x:number,z:number){
      const group=new THREE.Group();scene.add(group);group.position.set(x,0,z);
      cyl(.24,.31,.62,isMina?cream:teal,0,1.3,0,group);
      const skirt=cyl(.25,.48,.92,isMina?blue:wood,0,.69,0,group);
      if(isMina)for(let i=0;i<12;i++){const a=i*Math.PI/6;const seam=box(.025,.72,.025,cream,Math.sin(a)*.35,.64,Math.cos(a)*.35,group);seam.material=blue;seam.rotation.z=Math.cos(a)*.12;}
      sphere(.3,skin,0,1.94,0,group);
      const cap=mesh(new THREE.SphereGeometry(.315,14,10,0,Math.PI*2,0,Math.PI*.59),hair,0,2.02,0,group);
      const pony=sphere(.22,hair,0,1.77,-.3,group);pony.scale.set(.75,1.5,.9);
      for(const x of [-.105,.105])sphere(.028,dark,x,1.97,.277,group);
      const arms=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*.3,1.52,0);group.add(pivot);cyl(.105,.08,.46,isMina?cream:teal,0,-.22,0,pivot);sphere(.075,skin,0,-.5,0,pivot);return pivot;});
      const feet=[-1,1].map(side=>{const foot=box(.2,.16,.35,wood,side*.18,.12,.06,group);return foot;});
      return{group,arms,feet,skirt,cap,pony};
    }
    const mina=person(true,0,5),reader=person(false,6,4.8);reader.group.rotation.y=Math.PI;
    const tray=box(.65,.05,.42,wood,0,1.08,.43,mina.group);cyl(.1,.08,.17,cream,0,.11,0,tray);tray.visible=false;
    let yaw=.35,zoom=15,nearIndex=-1,last=performance.now(),frames=0,sample=last,animation=0;
    const keys=new Set<string>(),target=new THREE.Vector3(0,1,5),offset=new THREE.Vector3(),pointers=new Map<number,{x:number;y:number}>();
    let pinchDistance=0;
    const clearInput=()=>{keys.clear();stick.current={x:0,y:0};pointers.clear();pinchDistance=0;pointer.current=null;setKnob({x:0,y:0});};
    action.current=()=>{if(dialogue.current){dialogue.current=false;setMessage("");return;}if(nearIndex<0)return;
      const place=places[nearIndex];let text:string=place.text;
      if(nearIndex===0){if(progress.current===0){progress.current=1;tray.visible=true;}else text=progress.current===1?"お茶が冷めないうちに、広場の右手の木陰へどうぞ。":"届けてくれてありがとう。今度はミナも、ひと休みしていってね。";}
      if(nearIndex===1){if(progress.current===1){progress.current=2;tray.visible=false;}else text=progress.current===0?"こんにちは。茶房から、いい香りがするね。":"お茶はまだ温かい。もう少し、ここで読んでいこう。";}
      setStep(progress.current);setMessage(text);dialogue.current=true;clearInput();
    };
    const down=(e:KeyboardEvent)=>{if(["INPUT","TEXTAREA","BUTTON"].includes((e.target as HTMLElement)?.tagName))return;const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"," ","enter","e"].includes(k)){e.preventDefault();keys.add(k);if(!e.repeat&&[" ","enter","e"].includes(k))action.current();}};
    const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
    const pointerDown=(e:PointerEvent)=>{renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinchDistance=0;};
    const pointerMove=(e:PointerEvent)=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)yaw-=(e.clientX-prev.x)*.006;else{const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance)zoom=THREE.MathUtils.clamp(zoom+(pinchDistance-d)*.035,9,22);pinchDistance=d;}};
    const pointerUp=(e:PointerEvent)=>{pointers.delete(e.pointerId);pinchDistance=0;};
    const wheel=(e:WheelEvent)=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom+e.deltaY*.012,9,22);};
    const lost=(e:Event)=>{e.preventDefault();clearInput();setError("3D画面が中断されました。ページを再読み込みしてください。");};
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",clearInput);document.addEventListener("visibilitychange",clearInput);
    const canvas=renderer.domElement;canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointermove",pointerMove);canvas.addEventListener("pointerup",pointerUp);canvas.addEventListener("pointercancel",pointerUp);canvas.addEventListener("lostpointercapture",pointerUp);canvas.addEventListener("wheel",wheel,{passive:false});canvas.addEventListener("webglcontextlost",lost);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function tick(now:number){animation=requestAnimationFrame(tick);const dt=Math.min(.04,(now-last)/1000);last=now;if(document.hidden)return;
      let x=stick.current.x+(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0),y=stick.current.y+(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0);
      if(dialogue.current){x=0;y=0;}const motion=screenMotion(x,y,yaw),moving=Math.hypot(motion.x,motion.z)>.01;
      const p=mina.group.position,nx=p.x+motion.x*3.3*dt,nz=p.z+motion.z*3.3*dt;
      if(canWalk(nx,p.z))p.x=nx;if(canWalk(p.x,nz))p.z=nz;
      if(moving){const facing=Math.atan2(motion.x,motion.z);mina.group.rotation.y+=Math.atan2(Math.sin(facing-mina.group.rotation.y),Math.cos(facing-mina.group.rotation.y))*Math.min(1,dt*14);}
      const walk=moving?Math.sin(now*.012):0;mina.arms.forEach((a,i)=>a.rotation.x=tray.visible?-.65:walk*.45*(i?1:-1));mina.feet.forEach((f,i)=>{f.position.z=.06+walk*.13*(i?1:-1);f.position.y=.12+Math.max(0,walk*(i?1:-1))*.06;});mina.skirt.rotation.z=walk*.025;
      target.lerp(new THREE.Vector3(p.x,1,p.z),1-Math.exp(-dt*7));const distance=zoom*(camera.aspect<.8?1.22:1);offset.set(Math.sin(yaw)*distance,distance*.83,Math.cos(yaw)*distance);camera.position.copy(target).add(offset);camera.lookAt(target);
      if(!reduced)treeCrowns.forEach((c,i)=>c.rotation.z=Math.sin(now*.0007+i)*.012);
      const next=places.findIndex(place=>Math.hypot(place.x-p.x,place.z-p.z)<2);if(next!==nearIndex){nearIndex=next;setNear(next);}
      renderer.render(scene,camera);frames++;if(now-sample>1500){const value=Math.round(frames*1000/(now-sample));setFps(value);if(value<28&&renderer.getPixelRatio()>1){renderer.setPixelRatio(1);resize();}sample=now;frames=0;}
    }
    animation=requestAnimationFrame(tick);
    return()=>{disposed=true;cancelAnimationFrame(animation);observer.disconnect();clearInput();action.current=()=>{};window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",clearInput);document.removeEventListener("visibilitychange",clearInput);canvas.removeEventListener("pointerdown",pointerDown);canvas.removeEventListener("pointermove",pointerMove);canvas.removeEventListener("pointerup",pointerUp);canvas.removeEventListener("pointercancel",pointerUp);canvas.removeEventListener("lostpointercapture",pointerUp);canvas.removeEventListener("wheel",wheel);canvas.removeEventListener("webglcontextlost",lost);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();canvas.remove();};
  },[]);
  function updateStick(e:React.PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;stick.current=stickVector(x,y);const n=Math.max(1,Math.hypot(x,y)/46);setKnob({x:x/n,y:y/n});}
  function release(){pointer.current=null;stick.current={x:0,y:0};setKnob({x:0,y:0});}
  return <main className="mina-plaza">
    <div ref={mount} className="plaza-world" aria-label="ミナが歩く木陰の広場。左のスティックか矢印キーで移動" />
    <header className="plaza-heading"><span>森研究所 · 操作試作</span><h1>ミナと木陰の広場</h1><p>ひと歩き、お茶を届けに。</p></header>
    <aside className="plaza-goal"><small>小さなおつかい　{step}/2</small><strong>{step===0?"茶房でお茶を受け取る":step===1?"木陰の読書家へ届ける":"お届け完了。広場でひと休み"}</strong><span>{step===0?"緑と白のひさしが目印":step===1?"ベンチのそばで待っています":"自由に歩いてみてください"}</span></aside>
    {near>=0&&!message&&<div className="plaza-near">{places[near].name}</div>}
    {message&&<button className="plaza-dialogue" onClick={()=>action.current()}><small>{near>=0?places[near].name:"広場"}</small><span>{message}</span><b>タップで閉じる ›</b></button>}
    {help&&<section className="plaza-help"><button aria-label="操作案内を閉じる" onClick={()=>setHelp(false)}>×</button><strong>ミナと、ひと歩き。</strong><p>左の丸を倒して移動。近づいたら右のボタンで話しかけます。</p><small>景色をドラッグ：視点を回す<br/>ピンチ：拡大・縮小　／　PC：WASD・E</small></section>}
    <div className="plaza-stick-area"><div className="plaza-stick" role="group" aria-label="移動スティック" onPointerDown={e=>{if(pointer.current!==null)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);updateStick(e);}} onPointerMove={e=>{if(pointer.current===e.pointerId)updateStick(e);}} onPointerUp={e=>{if(pointer.current===e.pointerId)release();}} onPointerCancel={release} onLostPointerCapture={release}><i style={{transform:`translate(${knob.x}px,${knob.y}px)`}} /></div><span>動かして歩く</span></div>
    <button className="plaza-action" disabled={near<0&&!message} onClick={()=>action.current()}>{message?"閉じる":near>=0?places[near].action:"近づいて話す"}<small>E / Enter</small></button>
    <footer className="plaza-tools"><span>{fps?`${fps} fps`:"描画を準備中"}</span><button onClick={()=>setHelp(v=>!v)}>操作案内</button><Link href="/">ゲーム集へ</Link></footer>
    {error&&<div className="plaza-error" role="alert">{error}<button onClick={()=>window.location.reload()}>再読み込み</button></div>}
  </main>;
}
