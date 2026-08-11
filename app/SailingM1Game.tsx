"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

type Props = { onClear: () => void };
type CameraMode = "CHASE" | "PORT" | "DECK";

const FRAGMENTS = [{ x: -6, z: -24 }, { x: 7, z: -55 }, { x: -8, z: -84 }];
const ROCKS = [{ x: 1, z: -39 }, { x: 11, z: -70 }, { x: -12, z: -101 }, { x: 1, z: -99 }];
const DOCK = { x: 6.8, z: -109.2 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mat = (color: number, roughness = .62, metalness = .04) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: .2, clearcoatRoughness: .35 });
const shadow = <T extends THREE.Mesh>(mesh: T) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };

function createClearSky(sunDirection: THREE.Vector3) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: sunDirection.clone().normalize() } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y, 0.0, 1.0);
        vec3 horizon = vec3(0.34, 0.70, 0.84);
        vec3 zenith = vec3(0.055, 0.34, 0.66);
        vec3 color = mix(horizon, zenith, pow(height, 0.58));
        float sunDot = max(dot(direction, uSun), 0.0);
        float glow = smoothstep(0.965, 0.999, sunDot);
        float disc = smoothstep(0.9992, 0.99975, sunDot);
        color += glow * vec3(0.20, 0.15, 0.055);
        color = mix(color, vec3(1.0, 0.78, 0.32), disc * 0.82);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(360, 48, 28), material);
}

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
  island.position.set(-1, -.35, -118);
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

function createShallowGuide() {
  const guide=new THREE.Group();guide.position.set(-1,0,-118);
  const shallowMaterial=new THREE.MeshBasicMaterial({color:0xd8bd72,transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide});
  const shallow=new THREE.Mesh(new THREE.CircleGeometry(1,96),shallowMaterial);shallow.rotation.x=-Math.PI/2;shallow.scale.set(16.2,10.6,1);shallow.position.y=.16;guide.add(shallow);
  const ringMaterial=new THREE.MeshBasicMaterial({color:0xf2d27b,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const ring=new THREE.Mesh(new THREE.RingGeometry(.965,1.025,96),ringMaterial);ring.rotation.x=-Math.PI/2;ring.scale.set(16.2,10.6,1);ring.position.y=.27;guide.add(ring);
  for(let i=0;i<18;i+=1){const angle=i/18*Math.PI*2,localX=Math.cos(angle)*16.2,localZ=Math.sin(angle)*10.6;if(localX>4&&localZ>3.5)continue;const buoy=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.72,10),mat(i%2?0xf0e4b2:0xe76a43,.55));buoy.position.set(localX,.65,localZ);guide.add(buoy);}
  const channelMaterial=new THREE.MeshBasicMaterial({color:0x67dfcf,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const channel=new THREE.Mesh(new THREE.PlaneGeometry(5.8,13),channelMaterial);channel.rotation.x=-Math.PI/2;channel.position.set(7.8,.3,7.1);guide.add(channel);
  [-2.55,2.55].forEach(x=>{for(let z=2;z<=12;z+=2){const marker=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.48,8),mat(0x72e0d0,.42));marker.position.set(7.8+x,.55,z);guide.add(marker);}});
  return {guide,ringMaterial};
}

function createWindFragment(index: number, x: number, z: number) {
  const fragment = new THREE.Group();
  fragment.position.set(x,1.8,z);
  const colors=[0x70e3d2,0xf3d775,0x87b9ff];
  const crystalMaterial=new THREE.MeshPhysicalMaterial({color:colors[index],emissive:colors[index],emissiveIntensity:1.4,roughness:.18,metalness:.08,transmission:.12});
  const crystal=shadow(new THREE.Mesh(new THREE.OctahedronGeometry(.72,1),crystalMaterial));
  crystal.name="wind-fragment-core";fragment.add(crystal);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35,.055,12,48),new THREE.MeshBasicMaterial({color:colors[index],transparent:true,opacity:.8,toneMapped:false}));
  ring.name="wind-fragment-ring";ring.rotation.x=Math.PI/2;fragment.add(ring);
  const light=new THREE.PointLight(colors[index],10,13,2);fragment.add(light);
  return fragment;
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
  const letter=shadow(new THREE.Mesh(new THREE.BoxGeometry(.42,.28,.045),mat(0xf5edd8,.82)));
  letter.name="morning-letter";letter.position.set(0,2.48,.52);letter.rotation.z=-.08;mina.add(letter);
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
  const trimRef=useRef(0);
  const stabilityRef=useRef(100);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [sailing,setSailing]=useState(false);
  const [passed,setPassed]=useState(0);
  const [speed,setSpeed]=useState(0);
  const [cameraMode,setCameraMode]=useState<CameraMode>("CHASE");
  const [trim,setTrim]=useState(0);
  const [wind,setWind]=useState(0);
  const [stability,setStability]=useState(100);
  const [finalTime,setFinalTime]=useState(0);
  const [rating,setRating]=useState("");
  const [shoreWarning,setShoreWarning]=useState("");
  const [message,setMessage]=useState("朝の手紙を島へ届けます。帆を開き、三つの風のかけらを集めましょう。");
  const [finished,setFinished]=useState(false);
  const [complete,setComplete]=useState(false);
  useEffect(()=>{onClearRef.current=onClear;},[onClear]);

  const toggleSail=useCallback(()=>{
    if(finishedRef.current||errorRef.current)return;
    sailingRef.current=!sailingRef.current; setSailing(sailingRef.current);
    setMessage(sailingRef.current?"出航しました。風向きに帆を合わせ、三つの光を集めます。":"帆をゆるめました。接岸するときは3ノット以下まで減速します。");
  },[]);
  const cycleCamera=useCallback(()=>{
    const next:CameraMode=cameraRef.current==="CHASE"?"PORT":cameraRef.current==="PORT"?"DECK":"CHASE";
    cameraRef.current=next; setCameraMode(next);
  },[]);
  const reset=useCallback(()=>{
    steering.current=0;sailingRef.current=false;finishedRef.current=false;rewarded.current=false;trimRef.current=0;stabilityRef.current=100;
    setSailing(false);setPassed(0);setSpeed(0);setTrim(0);setWind(0);setStability(100);setFinalTime(0);setRating("");setShoreWarning("");setFinished(false);setComplete(false);setMessage("朝の手紙を積み直しました。三つの風のかけらを集めて島へ向かいます。");resetScene.current();
  },[]);

  useEffect(()=>{
    const host=mountRef.current;if(!host)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false,stencil:false});}
    catch{errorRef.current=true;const timer=window.setTimeout(()=>{setError("この高品質版はM1以降のiPad向けです。通常の3D版はそのまま遊べます。");setLoading(false);},0);return()=>window.clearTimeout(timer);}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.25));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
    renderer.domElement.setAttribute("aria-label","M1向け高品質な海をミナの船で進む3Dゲーム画面");host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x4faacc);
    const camera=new THREE.PerspectiveCamera(55,1,.1,420);camera.position.set(8,7.5,18);
    const sunVector=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(42),THREE.MathUtils.degToRad(208));
    scene.add(createClearSky(sunVector));
    scene.add(new THREE.HemisphereLight(0xdff7ff,0x173d3b,1.9));
    const sun=new THREE.DirectionalLight(0xffe1a0,4.4);sun.position.copy(sunVector).multiplyScalar(90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;sun.shadow.camera.far=190;sun.shadow.bias=-.00025;scene.add(sun);
    const {ocean,material:oceanMaterial}=createOcean();scene.add(ocean);
    const island=createHeroIsland();scene.add(island);
    const {guide:shallowGuide,ringMaterial:shallowRingMaterial}=createShallowGuide();scene.add(shallowGuide);
    const fragments=FRAGMENTS.map((item,i)=>{const fragment=createWindFragment(i,item.x,item.z);scene.add(fragment);return fragment;});
    const rockMeshes=ROCKS.map((item,i)=>{const rock=shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(1.25+(i%2)*.35,1),mat(i%2?0x6c6559:0x81776a,.96)));rock.position.set(item.x,.35,item.z);rock.rotation.set(i*.31,i*.47,.1);scene.add(rock);return rock;});
    const {boat,sail,mina,wakeMaterial}=createM1Boat();boat.position.set(0,0,12);scene.add(boat);
    const spray=createSpray();boat.add(spray.points);
    const arms=[mina.getObjectByName("m1-arm-left"),mina.getObjectByName("m1-arm-right")] as THREE.Object3D[];
    const hands=[mina.getObjectByName("m1-hand-left"),mina.getObjectByName("m1-hand-right")] as THREE.Object3D[];
    const armRest=arms.map(o=>({p:o.position.clone(),r:o.rotation.clone()}));const handRest=hands.map(o=>o.position.clone());
    const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.12,.25,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
    const collected=new Set<number>();const hitRocks=new Set<number>();let currentSpeed=0;let heading=0;let islandHitCooldown=0;let elapsed=0;let missionTime=0;let missionStarted=false;let raf=0;let celebrating=false;let lastSpeed=-1;let lastWind=999;let lastStability=100;let lastShoreWarning="";
    resetScene.current=()=>{boat.position.set(0,0,12);boat.rotation.set(0,0,0);camera.position.set(8,7.5,18);collected.clear();hitRocks.clear();fragments.forEach(fragment=>{fragment.visible=true;fragment.scale.setScalar(1);});currentSpeed=0;heading=0;islandHitCooldown=0;missionTime=0;missionStarted=false;celebrating=false;lastShoreWarning="";shallowRingMaterial.color.setHex(0xf2d27b);shallowRingMaterial.opacity=.82;mina.position.y=.1;arms.forEach((o,i)=>{o.position.copy(armRest[i].p);o.rotation.copy(armRest[i].r);});hands.forEach((o,i)=>o.position.copy(handRest[i]));};
    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const down=(event:KeyboardEvent)=>{if(event.key==="ArrowLeft"){event.preventDefault();steering.current=-1;}if(event.key==="ArrowRight"){event.preventDefault();steering.current=1;}if(event.key===" "){event.preventDefault();toggleSail();}if(event.key.toLowerCase()==="c")cycleCamera();};
    const up=(event:KeyboardEvent)=>{if((event.key==="ArrowLeft"&&steering.current<0)||(event.key==="ArrowRight"&&steering.current>0))steering.current=0;};window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    const clock=new THREE.Clock();
    const animate=()=>{raf=window.requestAnimationFrame(animate);const delta=Math.min(clock.getDelta(),.04);elapsed+=delta;oceanMaterial.uniforms.uTime.value=elapsed;
      const windAngle=Math.round(Math.sin(elapsed*.22)*34+Math.sin(elapsed*.61)*9);if(windAngle!==lastWind){lastWind=windAngle;setWind(windAngle);}const windDifference=Math.abs(windAngle-trimRef.current);const windEfficiency=clamp(1-windDifference/78,.25,1);
      if(sailingRef.current&&!missionStarted)missionStarted=true;if(missionStarted&&!finishedRef.current)missionTime+=delta;
      let nextStability=stabilityRef.current;if(sailingRef.current){nextStability+=windDifference<24?delta*2.2:windDifference>48?-delta*4.5:0;}else{nextStability+=delta*5;}nextStability=clamp(nextStability,8,100);stabilityRef.current=nextStability;const stabilityInt=Math.round(nextStability);if(stabilityInt!==lastStability){lastStability=stabilityInt;setStability(stabilityInt);}if(nextStability<=10&&sailingRef.current){sailingRef.current=false;setSailing(false);setMessage("帆が不安定です。帆を休め、風向きへ合わせ直してください。");}
      const targetSpeed=sailingRef.current&&!finishedRef.current?(4.2+7.2*windEfficiency):0;currentSpeed+=(targetSpeed-currentSpeed)*Math.min(1,delta*1.25);
      const rudderAuthority=finishedRef.current?0:(sailingRef.current?clamp(.3+currentSpeed/16,.3,.92):.22);heading+=steering.current*delta*.78*rudderAuthority;const forwardX=Math.sin(heading),forwardZ=-Math.cos(heading);const nextX=clamp(boat.position.x+forwardX*currentSpeed*delta,-24,24);const nextZ=boat.position.z+forwardZ*currentSpeed*delta;const islandX=(nextX-island.position.x)/16.2,islandZ=(nextZ-island.position.z)/10.6;const islandLevel=Math.sqrt(islandX*islandX+islandZ*islandZ);const inDockChannel=Math.abs(nextX-DOCK.x)<3.3&&nextZ>island.position.z+3.2;const islandCollision=islandLevel<1&&!inDockChannel;const nearDockChannel=inDockChannel&&islandLevel<1.35;const nextShoreWarning=islandCollision?"浅瀬に接触":nearDockChannel?"桟橋進入路":islandLevel<1.25?"浅瀬接近":"";if(nextShoreWarning!==lastShoreWarning){lastShoreWarning=nextShoreWarning;setShoreWarning(nextShoreWarning);}shallowRingMaterial.color.setHex(islandCollision?0xff7048:nearDockChannel?0x62e0d0:islandLevel<1.25?0xf2c967:0xf2d27b);shallowRingMaterial.opacity=islandCollision?.98:islandLevel<1.25?.9:.82;islandHitCooldown=Math.max(0,islandHitCooldown-delta);if(!islandCollision){boat.position.x=nextX;boat.position.z=nextZ;}else{currentSpeed*=.58;if(islandHitCooldown<=0){islandHitCooldown=1.4;stabilityRef.current=clamp(stabilityRef.current-9,8,100);setStability(Math.round(stabilityRef.current));setMessage("島の浅瀬に船首が触れました。舵を切って海側へ旋回してください。");}}
      fragments.forEach((fragment,index)=>{fragment.rotation.y+=delta*(.8+index*.16);const core=fragment.getObjectByName("wind-fragment-core");const ring=fragment.getObjectByName("wind-fragment-ring");if(core)core.rotation.y-=delta*1.8;if(ring)ring.rotation.z+=delta*.7;if(collected.has(index))return;if(Math.hypot(boat.position.x-FRAGMENTS[index].x,boat.position.z-FRAGMENTS[index].z)<3.7){collected.add(index);fragment.visible=false;setPassed(collected.size);setMessage(collected.size===FRAGMENTS.length?"三つの風がそろいました。島の右手前にある桟橋へ向かいます。":`風のかけら ${collected.size} / ${FRAGMENTS.length}。手紙を守る風が増えました。`);}});
      rockMeshes.forEach((rock,index)=>{if(hitRocks.has(index))return;if(Math.hypot(boat.position.x-rock.position.x,boat.position.z-rock.position.z)<2.25){hitRocks.add(index);currentSpeed*=.42;stabilityRef.current=clamp(stabilityRef.current-22,8,100);setStability(Math.round(stabilityRef.current));setMessage("岩礁に船腹をこすりました。帆の安定度が下がっています。");}});
      const dockDistance=Math.hypot(boat.position.x-DOCK.x,boat.position.z-DOCK.z);if(!finishedRef.current&&collected.size===FRAGMENTS.length&&dockDistance<3.2){if(currentSpeed<=1.95){finishedRef.current=true;sailingRef.current=false;setSailing(false);setFinished(true);setComplete(true);celebrating=true;const seconds=Math.max(1,Math.round(missionTime));const grade=stabilityRef.current>=82&&seconds<=70?"星3・静かな名航海":stabilityRef.current>=58?"星2・安全航海":"星1・手紙を届けた航海";setFinalTime(seconds);setRating(grade);setMessage("桟橋へ接岸しました。ミナが朝の手紙を島へ届け、バンザイしています！");if(!rewarded.current){rewarded.current=true;onClearRef.current();}}else{setMessage("桟橋です。帆をゆるめ、3ノット以下まで減速して接岸します。");}}
      sail.scale.x+=(((sailingRef.current&&!finishedRef.current)?1:.06)-sail.scale.x)*Math.min(1,delta*3.6);sail.rotation.y+=(THREE.MathUtils.degToRad(trimRef.current*.45)-sail.rotation.y)*Math.min(1,delta*3);wakeMaterial.opacity+=(((currentSpeed>1)?clamp(currentSpeed/22,.08,.54):.05)-wakeMaterial.opacity)*Math.min(1,delta*5);spray.material.opacity=clamp((currentSpeed-3)/14,0,.66);
      for(let i=0;i<spray.positions.length;i+=3){spray.positions[i+2]+=delta*(1.6+(i%7)*.07);spray.positions[i+1]-=delta*.3;if(spray.positions[i+2]>8){spray.positions[i+2]=1.4;spray.positions[i+1]=Math.random()*.85;}}(spray.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;
      boat.position.y=.32+Math.sin(elapsed*2.15)*.2+Math.sin(elapsed*3.7)*.055;boat.rotation.z+=((-steering.current*.18+Math.sin(elapsed*1.4)*.018)-boat.rotation.z)*Math.min(1,delta*3.4);boat.rotation.y+=((-heading)-boat.rotation.y)*Math.min(1,delta*5.2);boat.rotation.x=Math.sin(elapsed*1.55)*.035;
      if(celebrating){const cheer=Math.abs(Math.sin(elapsed*5.7)),f=Math.min(1,delta*7);mina.position.y=.1+cheer*.28;arms.forEach((o,i)=>{const side=i?1:-1;o.position.x+=(side*.44-o.position.x)*f;o.position.y+=(3.55+cheer*.1-o.position.y)*f;o.position.z+=(.15-o.position.z)*f;o.rotation.z+=(side*-.1-o.rotation.z)*f;});hands.forEach((o,i)=>{const side=i?1:-1;o.position.x+=(side*.46-o.position.x)*f;o.position.y+=(4.32+cheer*.14-o.position.y)*f;o.position.z+=(.13-o.position.z)*f;});}
      const mode=cameraRef.current;const rightX=Math.cos(heading),rightZ=Math.sin(heading);let tx=boat.position.x-forwardX*18+rightX*7,ty=boat.position.y+7.4,tz=boat.position.z-forwardZ*18+rightZ*7,ly=2.2;let lx=boat.position.x+forwardX*8,lz=boat.position.z+forwardZ*8;if(mode==="PORT"){tx=boat.position.x-rightX*15-forwardX*4;ty=boat.position.y+5.8;tz=boat.position.z-rightZ*15-forwardZ*4;lx=boat.position.x+forwardX*3;lz=boat.position.z+forwardZ*3;}if(mode==="DECK"){tx=boat.position.x-forwardX*1.2;ty=boat.position.y+4.1;tz=boat.position.z-forwardZ*1.2;ly=3.1;lx=boat.position.x+forwardX*20;lz=boat.position.z+forwardZ*20;}const cf=Math.min(1,delta*(mode==="DECK"?5:2.2));camera.position.x+=(tx-camera.position.x)*cf;camera.position.y+=(ty-camera.position.y)*cf;camera.position.z+=(tz-camera.position.z)*cf;camera.lookAt(lx,ly,lz);
      const speedKnots=Math.round(currentSpeed*1.55);if(speedKnots!==lastSpeed){lastSpeed=speedKnots;setSpeed(speedKnots);}
      composer.render();};
    const ready=window.setTimeout(()=>setLoading(false),0);animate();
    return()=>{window.clearTimeout(ready);window.cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);scene.traverse(object=>{if(!(object instanceof THREE.Mesh||object instanceof THREE.Points))return;object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());});composer.dispose();renderer.dispose();renderer.domElement.remove();resetScene.current=()=>undefined;};
  },[cycleCamera,toggleSail]);

  const press=(button:HTMLButtonElement,pointerId:number,direction:number)=>{button.setPointerCapture(pointerId);steering.current=direction;};const release=()=>{steering.current=0;};
  return <div className="m1-game">
    <div className="m1-stage" ref={mountRef}>
      {loading&&<div className="m1-loading"><span>M1 OCEAN ENGINE</span><strong>海と光を構築しています…</strong></div>}
      {error&&<div className="m1-loading"><span>DEVICE NOTICE</span><strong>{error}</strong></div>}
      <div className="m1-hud"><div><small>WIND FRAGMENTS</small><strong>{passed}<i> / {FRAGMENTS.length}</i></strong></div><div><small>SPEED</small><strong>{speed}<i> kn</i></strong></div><div><small>SAIL</small><strong>{stability}<i> %</i></strong></div><div><small>WIND</small><strong>{wind > 0 ? "+" : ""}{wind}<i>°</i></strong></div><div className="m1-quality">CAMERA<br/>{cameraMode}</div></div>
      <div className="m1-caption"><span>MISSION 01 · MORNING LETTER</span><strong>三つの風を集め、島の桟橋へ手紙を届ける</strong></div>
      {shoreWarning&&<div className={`m1-shore-alert ${shoreWarning==="浅瀬に接触"?"contact":shoreWarning==="桟橋進入路"?"channel":""}`}>{shoreWarning}</div>}
    </div>
    <div className="m1-console"><p aria-live="polite">{message}</p><div className="m1-controls">
      <button onPointerDown={e=>press(e.currentTarget,e.pointerId,-1)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>← 左舵</button>
      <button className={sailing?"m1-sail active":"m1-sail"} onClick={toggleSail} disabled={finished||Boolean(error)}>{sailing?"帆をゆるめる":"帆を開く"}</button>
      <button onPointerDown={e=>press(e.currentTarget,e.pointerId,1)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>右舵 →</button>
      <button onClick={cycleCamera}>視点切替</button><button onClick={reset}>最初から</button>
    </div><div className="m1-trim"><label htmlFor="m1-trim-range">帆の向き <strong>{trim > 0 ? "+" : ""}{trim}°</strong></label><input id="m1-trim-range" type="range" min="-45" max="45" step="5" value={trim} onChange={event=>{const value=Number(event.target.value);trimRef.current=value;setTrim(value);}}/><span>風向き {wind > 0 ? "+" : ""}{wind}°へ近づけると速く、安定します</span></div><div className="m1-note"><span>目的：風のかけら3つ → 3ノット以下で桟橋へ接岸</span><span>← → / Space / C</span></div></div>
    {finished&&<div className="m1-result"><strong>{complete?"朝の手紙を届けました":"風を読み直します"}</strong><p>{complete?`${rating}　航海時間 ${finalTime}秒　帆の安定度 ${stability}%`:`三つの風を集め、桟橋へ静かに接岸します。`}</p><button onClick={reset}>朝の手紙をもう一度届ける</button></div>}
  </div>;
}
