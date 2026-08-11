"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

type Props = { onClear: () => void };
type CameraMode = "CHASE" | "PORT" | "DECK";

const COURSE = [
  { x: -6, z: -22 }, { x: 7, z: -46 }, { x: 9, z: -73 },
  { x: -9, z: -103 }, { x: -5, z: -128 }, { x: 8, z: -151 }, { x: 0, z: -174 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mat = (color: number, roughness = .62, metalness = .04) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: .2, clearcoatRoughness: .35 });
const shadow = <T extends THREE.Mesh>(mesh: T) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };

function createOcean() {
  const geometry = new THREE.PlaneGeometry(100, 260, 170, 300);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(-.38, .82, .42).normalize() },
      uDeep: { value: new THREE.Color(0x063e60) },
      uShallow: { value: new THREE.Color(0x2ba4b8) },
      uFoam: { value: new THREE.Color(0xdffcff) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 p = position;
        float a = sin(p.x * .42 + uTime * 1.65) * .24;
        float b = sin(p.z * .19 - uTime * 1.15 + p.x * .12) * .31;
        float c = cos((p.x + p.z) * .14 + uTime * .82) * .15;
        float d = sin(p.x * .92 - p.z * .38 + uTime * 2.2) * .055;
        p.y += a + b + c + d;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vWave = a + b + c;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 dx = dFdx(vWorld);
        vec3 dy = dFdy(vWorld);
        vec3 normal = normalize(cross(dy, dx));
        if (normal.y < 0.0) normal *= -1.0;
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        float sunGlint = pow(max(dot(reflect(-uSun, normal), viewDir), 0.0), 92.0);
        float ripple = sin(vWorld.x * 1.7 + vWorld.z * 1.15) * .5 + .5;
        vec3 water = mix(uDeep, uShallow, clamp(.48 + vWave * .48, 0.0, 1.0));
        water += fresnel * vec3(.23, .42, .48);
        water += sunGlint * vec3(1.0, .85, .48) * 2.4;
        water = mix(water, uFoam, smoothstep(.47, .67, vWave) * ripple * .18);
        gl_FragColor = vec4(water, 1.0);
      }
    `,
  });
  const ocean = new THREE.Mesh(geometry, material);
  ocean.position.set(0, 0, -86);
  ocean.receiveShadow = true;
  return { ocean, material };
}

function createPalm(scale = 1) {
  const palm = new THREE.Group();
  const trunk = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.16, .38, 5.4, 10), mat(0x6d4931, .9)));
  trunk.position.y = 2.7;
  trunk.rotation.z = -.09;
  palm.add(trunk);
  for (let i = 0; i < 8; i += 1) {
    const leaf = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.16, 2.3, 5, 8), mat(i % 2 ? 0x2d7144 : 0x3d8550, .86)));
    leaf.scale.set(1, .19, 1);
    leaf.position.set(Math.cos(i * Math.PI / 4) * 1.25, 5.25, Math.sin(i * Math.PI / 4) * 1.25);
    leaf.rotation.z = Math.PI / 2.3;
    leaf.rotation.y = -i * Math.PI / 4;
    palm.add(leaf);
  }
  palm.scale.setScalar(scale);
  return palm;
}

function createHeroIsland() {
  const island = new THREE.Group();
  island.position.set(-1, -.35, -88);
  const sand = shadow(new THREE.Mesh(new THREE.SphereGeometry(11, 48, 22), mat(0xd2ad63, .94)));
  sand.scale.set(1.35, .25, .82);
  island.add(sand);
  const earth = shadow(new THREE.Mesh(new THREE.SphereGeometry(8.6, 42, 18), mat(0x527f49, .95)));
  earth.scale.set(1.18, .35, .72);
  earth.position.y = .72;
  island.add(earth);
  [[-4,-1,.9],[3,-2,1.1],[1,3,.72],[-2,3,.65]].forEach(([x,z,s]) => {
    const palm = createPalm(s);
    palm.position.set(x, .5, z);
    island.add(palm);
  });
  const house = new THREE.Group();
  const walls = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 3.2), mat(0xe7d7ab, .88)));
  walls.position.y = 1.8;
  house.add(walls);
  const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(3, 1.8, 4), mat(0x984a35, .78)));
  roof.position.y = 4;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);
  const windowGlow = new THREE.MeshBasicMaterial({ color: 0xffd477, toneMapped: false });
  [-.75,.75].forEach((x) => {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(.55,.7), windowGlow);
    window.position.set(x,2.05,1.61);
    house.add(window);
  });
  house.position.set(-.7,.7,.2);
  island.add(house);
  for (let i = 0; i < 16; i += 1) {
    const rock = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(.5 + (i % 3) * .2, 0), mat(i % 2 ? 0x756b58 : 0x8c806a, .98)));
    const angle = i / 16 * Math.PI * 2;
    rock.position.set(Math.cos(angle) * (9.2 + (i % 2)), .2, Math.sin(angle) * 6.2);
    rock.rotation.set(i*.2,i*.31,0);
    island.add(rock);
  }
  const dock = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const plank = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.1,.16,.62), mat(i % 2 ? 0x7e5235 : 0x94613c, .92)));
    plank.position.set(7.8,.35,2+i*.58);
    dock.add(plank);
  }
  island.add(dock);
  return island;
}

function createGate(index: number, x: number, z: number) {
  const gate = new THREE.Group();
  gate.position.set(x,0,z);
  [-3.5,3.5].forEach((offset) => {
    const buoy = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.5,.78,2,16), mat(index % 2 ? 0xf0a044 : 0xe86038, .42, .05)));
    buoy.position.set(offset,1,0);
    gate.add(buoy);
    const ring = shadow(new THREE.Mesh(new THREE.TorusGeometry(.72,.1,8,28), mat(0xf4e4b3,.5)));
    ring.rotation.x = Math.PI/2;
    ring.position.set(offset,1.25,0);
    gate.add(ring);
    const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,5.8,10), mat(0xe8ddb9,.72)));
    post.position.set(offset,3.8,0);
    gate.add(post);
  });
  const arch = shadow(new THREE.Mesh(new THREE.TorusGeometry(3.5,.11,8,32,Math.PI), mat(0xf1d36f,.38,.08)));
  arch.rotation.z = Math.PI;
  arch.position.y = 6.65;
  gate.add(arch);
  const light = new THREE.PointLight(0xf6d97a,8,13,2);
  light.position.set(0,5,0);
  gate.add(light);
  return gate;
}

function createMinaM1() {
  const mina = new THREE.Group();
  mina.name = "M1のミナ";
  const skin = mat(0xd6a476,.72);
  const hair = mat(0x2b2424,.82);
  const yellow = mat(0xe4bb48,.58);
  const dark = mat(0x27352f,.76);
  const torso = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.48,1.15,8,18),yellow));
  torso.position.y=2.35; mina.add(torso);
  const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.28,12),skin));
  neck.position.y=3.08; mina.add(neck);
  const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(.56,32,24),skin));
  head.scale.set(.88,1.08,.92); head.position.set(0,3.62,.03); mina.add(head);
  const hairCap = shadow(new THREE.Mesh(new THREE.SphereGeometry(.59,30,22,0,Math.PI*2,0,Math.PI*.62),hair));
  hairCap.position.set(0,3.77,-.01); mina.add(hairCap);
  const hairBack = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.42,.92,8,16),hair));
  hairBack.position.set(0,3.35,-.43); mina.add(hairBack);
  [-.18,.18].forEach((x) => {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(.068,12,8),mat(0xf5efe2,.55));
    eyeWhite.scale.set(1.1,.72,.45); eyeWhite.position.set(x,3.67,.51); mina.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.031,10,8),mat(0x202522,.48));
    pupil.position.set(x,3.67,.565); mina.add(pupil);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),skin);
  nose.scale.set(.7,1,.8); nose.position.set(0,3.53,.56); mina.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.12,.017,8,18,Math.PI),mat(0x98594e,.6));
  smile.position.set(0,3.4,.535); smile.rotation.z=Math.PI; mina.add(smile);
  [-1,1].forEach((side) => {
    const arm = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.13,.82,7,12),yellow));
    arm.name=side<0?"m1-arm-left":"m1-arm-right";
    arm.position.set(side*.54,2.55,.32); arm.rotation.z=side*-.42; arm.rotation.x=.28; mina.add(arm);
    const hand = shadow(new THREE.Mesh(new THREE.SphereGeometry(.145,16,12),skin));
    hand.name=side<0?"m1-hand-left":"m1-hand-right";
    hand.position.set(side*.78,2.18,.62); mina.add(hand);
    const leg = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.15,.72,7,12),dark));
    leg.position.set(side*.25,1.25,.52); leg.rotation.x=Math.PI/2.7; mina.add(leg);
    const shoe = shadow(new THREE.Mesh(new THREE.SphereGeometry(.2,14,10),mat(0x1f2925,.7)));
    shoe.scale.set(.8,.62,1.4); shoe.position.set(side*.25,1.02,.95); mina.add(shoe);
  });
  mina.position.set(0,.1,.72); mina.rotation.y=Math.PI;
  return mina;
}

function createM1Boat() {
  const boat = new THREE.Group();
  const hull = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(1.55,4.3,14,28),mat(0x8d3429,.32,.08)));
  hull.rotation.x=Math.PI/2; hull.scale.set(1,.58,1); hull.position.y=.95; boat.add(hull);
  const keel = shadow(new THREE.Mesh(new THREE.ConeGeometry(.58,2.8,18),mat(0x562720,.42,.08)));
  keel.rotation.x=-Math.PI/2; keel.position.set(0,.42,-2.45); boat.add(keel);
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.55,.24,4.6),mat(0xbd8248,.58)));
  deck.position.set(0,1.38,.3); boat.add(deck);
  for(let i=0;i<8;i+=1){
    const seam=new THREE.Mesh(new THREE.BoxGeometry(2.42,.016,.025),mat(0x70482f,.8));
    seam.position.set(0,1.51,-1.65+i*.54); boat.add(seam);
  }
  const cabin=shadow(new THREE.Mesh(new THREE.BoxGeometry(1.45,.82,1.25),mat(0xe5d5aa,.72)));
  cabin.position.set(0,1.82,1.35); boat.add(cabin);
  const glass=mat(0x64a8af,.12,.3); glass.transparent=true; glass.opacity=.72;
  const window=new THREE.Mesh(new THREE.BoxGeometry(.92,.37,.035),glass); window.position.set(0,1.95,.71); boat.add(window);
  const wood=mat(0x5f3d2b,.62);
  const mast=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.075,.105,8.1,14),wood));
  mast.position.set(0,5.18,-.7); boat.add(mast);
  const boom=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,3.7,12),wood));
  boom.rotation.z=Math.PI/2; boom.position.set(-1.55,3.12,-.64); boat.add(boom);
  const sailMat=new THREE.MeshPhysicalMaterial({color:0xf2ead4,roughness:.65,side:THREE.DoubleSide,transmission:.03});
  const sail=shadow(new THREE.Mesh(new THREE.PlaneGeometry(4.4,6.1,8,12),sailMat));
  sail.geometry.translate(2.2,0,0); sail.position.set(-2.2,5.85,-.68); sail.scale.x=.08; boat.add(sail);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.06,5.7,.035),mat(0xba4b37,.6));
  stripe.position.set(-.14,5.72,-.63); boat.add(stripe);
  [-1.14,1.14].forEach((x)=>{
    [-1.35,-.15,1.05].forEach((z)=>{const post=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.72,8),wood));post.position.set(x,1.82,z);boat.add(post);});
    const rail=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,3.2,8),wood));rail.rotation.x=Math.PI/2;rail.position.set(x,2.16,-.15);boat.add(rail);
  });
  const wheel=shadow(new THREE.Mesh(new THREE.TorusGeometry(.55,.055,10,36),wood)); wheel.position.set(0,2.42,-.08); boat.add(wheel);
  const mina=createMinaM1(); boat.add(mina);
  const wakeMaterial=new THREE.MeshBasicMaterial({color:0xe7fdff,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  [-.75,.75].forEach((x)=>{const wake=new THREE.Mesh(new THREE.PlaneGeometry(.5,8),wakeMaterial);wake.rotation.x=-Math.PI/2;wake.rotation.z=x<0?-.1:.1;wake.position.set(x,-.13,5);boat.add(wake);});
  return {boat,sail,mina,wakeMaterial};
}

function createSpray() {
  const count=320;
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(count*3);
  for(let i=0;i<count;i+=1){positions[i*3]=(Math.random()-.5)*3;positions[i*3+1]=Math.random()*.9;positions[i*3+2]=1.8+Math.random()*6;}
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:0xe8ffff,size:.075,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const points=new THREE.Points(geometry,material); points.position.y=.25;
  return {points,material,positions};
}

export default function SailingM1Game({onClear}:Props){
  const mountRef=useRef<HTMLDivElement>(null);
  const steering=useRef(0);
  const sailingRef=useRef(false);
  const resetScene=useRef<()=>void>(()=>undefined);
  const onClearRef=useRef(onClear);
  const rewarded=useRef(false);
  const finishedRef=useRef(false);
  const errorRef=useRef(false);
  const cameraRef=useRef<CameraMode>("CHASE");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [sailing,setSailing]=useState(false);
  const [passed,setPassed]=useState(0);
  const [speed,setSpeed]=useState(0);
  const [cameraMode,setCameraMode]=useState<CameraMode>("CHASE");
  const [message,setMessage]=useState("M1の海です。帆を開き、七つの光門へ向かいます。");
  const [finished,setFinished]=useState(false);
  const [complete,setComplete]=useState(false);
  useEffect(()=>{onClearRef.current=onClear;},[onClear]);

  const toggleSail=useCallback(()=>{
    if(finishedRef.current||errorRef.current)return;
    sailingRef.current=!sailingRef.current; setSailing(sailingRef.current);
    setMessage(sailingRef.current?"風が帆を満たしました。波と船首を見ながら進みます。":"帆をゆるめました。舵を合わせられます。");
  },[]);
  const cycleCamera=useCallback(()=>{
    const next:CameraMode=cameraRef.current==="CHASE"?"PORT":cameraRef.current==="PORT"?"DECK":"CHASE";
    cameraRef.current=next; setCameraMode(next);
  },[]);
  const reset=useCallback(()=>{
    steering.current=0;sailingRef.current=false;finishedRef.current=false;rewarded.current=false;
    setSailing(false);setPassed(0);setSpeed(0);setFinished(false);setComplete(false);setMessage("新しい風です。M1の海へ再出航できます。");resetScene.current();
  },[]);

  useEffect(()=>{
    const host=mountRef.current;if(!host)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false,stencil:false});}
    catch{errorRef.current=true;const timer=window.setTimeout(()=>{setError("この高品質版はM1以降のiPad向けです。通常の3D版はそのまま遊べます。");setLoading(false);},0);return()=>window.clearTimeout(timer);}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.25));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.domElement.setAttribute("aria-label","M1向け高品質な海をミナの船で進む3Dゲーム画面");host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x72b9c8,.0036);
    const camera=new THREE.PerspectiveCamera(55,1,.1,420);camera.position.set(8,7.5,18);
    const sky=new Sky();sky.scale.setScalar(380);scene.add(sky);
    const skyUniforms=(sky.material as THREE.ShaderMaterial).uniforms;
    skyUniforms.turbidity.value=7.5;skyUniforms.rayleigh.value=2.6;skyUniforms.mieCoefficient.value=.006;skyUniforms.mieDirectionalG.value=.82;
    const sunVector=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(58),THREE.MathUtils.degToRad(208));
    skyUniforms.sunPosition.value.copy(sunVector);
    scene.add(new THREE.HemisphereLight(0xdff7ff,0x173d3b,1.9));
    const sun=new THREE.DirectionalLight(0xffe1a0,4.4);sun.position.copy(sunVector).multiplyScalar(90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;sun.shadow.camera.far=190;sun.shadow.bias=-.00025;scene.add(sun);
    const {ocean,material:oceanMaterial}=createOcean();scene.add(ocean);
    const island=createHeroIsland();scene.add(island);
    const gates=COURSE.map((g,i)=>{const gate=createGate(i,g.x,g.z);scene.add(gate);return gate;});
    const {boat,sail,mina,wakeMaterial}=createM1Boat();boat.position.set(0,0,12);scene.add(boat);
    const spray=createSpray();boat.add(spray.points);
    const arms=[mina.getObjectByName("m1-arm-left"),mina.getObjectByName("m1-arm-right")] as THREE.Object3D[];
    const hands=[mina.getObjectByName("m1-hand-left"),mina.getObjectByName("m1-hand-right")] as THREE.Object3D[];
    const armRest=arms.map(o=>({p:o.position.clone(),r:o.rotation.clone()}));const handRest=hands.map(o=>o.position.clone());
    const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.22,.35,.84);composer.addPass(bloom);composer.addPass(new OutputPass());
    const passedSet=new Set<number>();const missedSet=new Set<number>();let currentSpeed=0;let lastZ=boat.position.z;let elapsed=0;let raf=0;let celebrating=false;let lastSpeed=-1;
    resetScene.current=()=>{boat.position.set(0,0,12);boat.rotation.set(0,0,0);camera.position.set(8,7.5,18);passedSet.clear();missedSet.clear();gates.forEach(g=>{g.visible=true;g.scale.setScalar(1);});currentSpeed=0;lastZ=12;celebrating=false;mina.position.y=.1;arms.forEach((o,i)=>{o.position.copy(armRest[i].p);o.rotation.copy(armRest[i].r);});hands.forEach((o,i)=>o.position.copy(handRest[i]));};
    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const down=(event:KeyboardEvent)=>{if(event.key==="ArrowLeft"){event.preventDefault();steering.current=-1;}if(event.key==="ArrowRight"){event.preventDefault();steering.current=1;}if(event.key===" "){event.preventDefault();toggleSail();}if(event.key.toLowerCase()==="c")cycleCamera();};
    const up=(event:KeyboardEvent)=>{if((event.key==="ArrowLeft"&&steering.current<0)||(event.key==="ArrowRight"&&steering.current>0))steering.current=0;};window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    const clock=new THREE.Clock();
    const animate=()=>{raf=window.requestAnimationFrame(animate);const delta=Math.min(clock.getDelta(),.04);elapsed+=delta;oceanMaterial.uniforms.uTime.value=elapsed;
      const targetSpeed=sailingRef.current&&!finishedRef.current?10.8:0;currentSpeed+=(targetSpeed-currentSpeed)*Math.min(1,delta*1.25);
      const sideSpeed=finishedRef.current?0:(sailingRef.current?9.4:5.2);const nextX=clamp(boat.position.x+steering.current*delta*sideSpeed,-16,16);const nextZ=boat.position.z-currentSpeed*delta;const islandDistance=Math.hypot(nextX-island.position.x,nextZ-island.position.z);boat.position.x=nextX;if(islandDistance>11.6)boat.position.z=nextZ;else if(sailingRef.current)setMessage(steering.current?"浅瀬を横へ抜けています。":"島の浅瀬です。左右へ舵を切ってください。");
      COURSE.forEach((gate,index)=>{if(passedSet.has(index)||missedSet.has(index))return;if(lastZ>gate.z&&boat.position.z<=gate.z){if(Math.abs(boat.position.x-gate.x)<3.5){passedSet.add(index);gates[index].scale.setScalar(1.25);setPassed(passedSet.size);setMessage(`光門 ${index+1} / ${COURSE.length}。波しぶきを越えました。`);}else{missedSet.add(index);setMessage(`光門${index+1}を外れました。次の光へ船首を合わせます。`);}}});lastZ=boat.position.z;
      sail.scale.x+=(((sailingRef.current&&!finishedRef.current)?1:.06)-sail.scale.x)*Math.min(1,delta*3.6);wakeMaterial.opacity+=(((currentSpeed>1)?clamp(currentSpeed/22,.08,.54):.05)-wakeMaterial.opacity)*Math.min(1,delta*5);spray.material.opacity=clamp((currentSpeed-3)/14,0,.66);
      for(let i=0;i<spray.positions.length;i+=3){spray.positions[i+2]+=delta*(1.6+(i%7)*.07);spray.positions[i+1]-=delta*.3;if(spray.positions[i+2]>8){spray.positions[i+2]=1.4;spray.positions[i+1]=Math.random()*.85;}}(spray.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;
      boat.position.y=.32+Math.sin(elapsed*2.15)*.2+Math.sin(elapsed*3.7)*.055;boat.rotation.z+=((-steering.current*.18+Math.sin(elapsed*1.4)*.018)-boat.rotation.z)*Math.min(1,delta*3.4);boat.rotation.y+=((-steering.current*.16)-boat.rotation.y)*Math.min(1,delta*3.2);boat.rotation.x=Math.sin(elapsed*1.55)*.035;
      if(celebrating){const cheer=Math.abs(Math.sin(elapsed*5.7)),f=Math.min(1,delta*7);mina.position.y=.1+cheer*.28;arms.forEach((o,i)=>{const side=i?1:-1;o.position.x+=(side*.44-o.position.x)*f;o.position.y+=(3.55+cheer*.1-o.position.y)*f;o.position.z+=(.15-o.position.z)*f;o.rotation.z+=(side*-.1-o.rotation.z)*f;});hands.forEach((o,i)=>{const side=i?1:-1;o.position.x+=(side*.46-o.position.x)*f;o.position.y+=(4.32+cheer*.14-o.position.y)*f;o.position.z+=(.13-o.position.z)*f;});}
      const mode=cameraRef.current;const lx=boat.position.x;let tx=boat.position.x+8,ty=boat.position.y+7.4,tz=boat.position.z+18,ly=2.2,lz=boat.position.z-8;if(mode==="PORT"){tx=boat.position.x-15;ty=boat.position.y+5.8;tz=boat.position.z+5;lz=boat.position.z-2;}if(mode==="DECK"){tx=boat.position.x+.15;ty=boat.position.y+4.1;tz=boat.position.z+1.25;ly=3.1;lz=boat.position.z-20;}const cf=Math.min(1,delta*(mode==="DECK"?5:2.2));camera.position.x+=(tx-camera.position.x)*cf;camera.position.y+=(ty-camera.position.y)*cf;camera.position.z+=(tz-camera.position.z)*cf;camera.lookAt(lx,ly,lz);
      const speedKnots=Math.round(currentSpeed*1.55);if(speedKnots!==lastSpeed){lastSpeed=speedKnots;setSpeed(speedKnots);}
      if(!finishedRef.current&&boat.position.z<=-184){finishedRef.current=true;sailingRef.current=false;setSailing(false);setFinished(true);const cleared=passedSet.size===COURSE.length;setComplete(cleared);celebrating=cleared;setMessage(cleared?"七つの光門を走破。ミナが朝の海へバンザイ！":"港へ到着。見失った光門へ、もう一度出航できます。");if(cleared&&!rewarded.current){rewarded.current=true;onClearRef.current();}}
      composer.render();};
    const ready=window.setTimeout(()=>setLoading(false),0);animate();
    return()=>{window.clearTimeout(ready);window.cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);scene.traverse(object=>{if(!(object instanceof THREE.Mesh||object instanceof THREE.Points))return;object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());});composer.dispose();renderer.dispose();renderer.domElement.remove();resetScene.current=()=>undefined;};
  },[cycleCamera,toggleSail]);

  const press=(button:HTMLButtonElement,pointerId:number,direction:number)=>{button.setPointerCapture(pointerId);steering.current=direction;};const release=()=>{steering.current=0;};
  return <div className="m1-game">
    <div className="m1-stage" ref={mountRef}>
      {loading&&<div className="m1-loading"><span>M1 OCEAN ENGINE</span><strong>海と光を構築しています…</strong></div>}
      {error&&<div className="m1-loading"><span>DEVICE NOTICE</span><strong>{error}</strong></div>}
      <div className="m1-hud"><div><small>WIND GATES</small><strong>{passed}<i> / {COURSE.length}</i></strong></div><div><small>SPEED</small><strong>{speed}<i> kn</i></strong></div><div><small>CAMERA</small><strong>{cameraMode}</strong></div><div className="m1-quality">M1 HIGH<br/>QUALITY</div></div>
      <div className="m1-caption"><span>MINA · WIND WAITING ISLAND</span><strong>光、水、風をリアルタイム描画</strong></div>
    </div>
    <div className="m1-console"><p aria-live="polite">{message}</p><div className="m1-controls">
      <button onPointerDown={e=>press(e.currentTarget,e.pointerId,-1)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>← 左舵</button>
      <button className={sailing?"m1-sail active":"m1-sail"} onClick={toggleSail} disabled={finished||Boolean(error)}>{sailing?"帆をゆるめる":"帆を開く"}</button>
      <button onPointerDown={e=>press(e.currentTarget,e.pointerId,1)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>右舵 →</button>
      <button onClick={cycleCamera}>視点切替</button><button onClick={reset}>最初から</button>
    </div><div className="m1-note"><span>M1以降のiPad Air / Pro向け</span><span>← → / Space / C</span></div></div>
    {finished&&<div className="m1-result"><strong>{complete?"M1航路を走破しました":"風を読み直します"}</strong><p>{complete?"ミナのバンザイと朝の海が、森の木へ8ポイントを届けました。":"七つの光門をすべて通ると特別な朝になります。"}</p><button onClick={reset}>もう一度、最高品質の海へ</button></div>}
  </div>;
}
