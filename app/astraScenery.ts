import * as THREE from "three";

/** Decorative layer only: no collision, story, or save data is modified. */
export function createAstraScenery(scene: THREE.Scene) {
  const world = new THREE.Group();
  scene.add(world);
  const time = { value: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seed = 1783;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true });
  const rock = mat(0x687d79);
  const grass = mat(0x66965c);
  const bark = mat(0x75523e);
  const leaves = mat(0x439478);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.receiveShadow = true;
    object.castShadow = true;
    world.add(object);
    return object;
  };

  // The playable rectangles sit inside an irregular, layered island rim.
  const outline = [[-13,-19],[-17,-9],[-15,13],[-19,23],[-18,35],[-13,43],[8,44],[18,40],[19,26],[16,17],[15,0],[16,-11],[11,-19]];
  const shape = new THREE.Shape();
  outline.forEach(([x,z], i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
  shape.closePath();
  const island = add(new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: true, bevelThickness: .7, bevelSize: .7, bevelSegments: 2, steps: 1 }), rock, 0, -4.2, 0);
  island.rotation.x = -Math.PI / 2;
  const top = add(new THREE.ShapeGeometry(shape), grass, 0, -.055, 0);
  top.rotation.x = -Math.PI / 2;
  // Small detached rocks tell the silhouette without adding inaccessible paths.
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -17 + random() * 60;
    const x = side * (17 + random() * 5);
    const boulder = add(new THREE.DodecahedronGeometry(.7 + random(), 0), rock, x, -2.6, z);
    boulder.scale.set(1.4, .7 + random(), 1.1);
    boulder.rotation.set(random(),random(),random());
  }

  // One water draw call. Screen derivatives soften the ripples at distance.
  const water = new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: `varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `precision highp float; uniform float uTime; varying vec3 vWorld;
      void main(){vec2 p=vWorld.xz;float a=sin(p.x*.68+p.y*.32-uTime*.7);float b=sin(p.y*1.1-p.x*.28+uTime*.42);
      float wave=a*b;float glint=pow(max(0.,wave),20.);vec3 c=mix(vec3(.045,.26,.32),vec3(.18,.52,.56),.5+wave*.22);
      c+=vec3(.55,.72,.66)*glint*.34;float haze=smoothstep(40.,145.,length(p-vec2(0.,14.)));c=mix(c,vec3(.55,.73,.74),haze);gl_FragColor=vec4(c,1.);}`,
  });
  const ocean = add(new THREE.PlaneGeometry(400,400), water, 0,-2.7,0);
  ocean.rotation.x = -Math.PI / 2;
  ocean.castShadow = false;

  // Side lanes meet the existing doors, while the main route remains walkable.
  const pathMaterial = mat(0xd2c29a);
  for (const z of [26.7,33.2,-8.7]) {
    const lane = add(new THREE.PlaneGeometry(z < 0 ? 14 : 18, 1.5),pathMaterial,0,.035,z);
    lane.rotation.x = -Math.PI/2;
    lane.castShadow = false;
  }

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const grassMaterial = mat(0x75a765);
  grassMaterial.side = THREE.DoubleSide;
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = time;
    shader.vertexShader = "uniform float uWindTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float phase=instanceMatrix[3].x*.48+instanceMatrix[3].z*.31;
      transformed.x+=sin(uWindTime*1.8+phase)*pow(max(position.y,0.),2.)*.38;
      transformed.z+=cos(uWindTime*1.2+phase)*max(position.y,0.)*.09;`);
  };
  const blade = new THREE.BufferGeometry();
  blade.setAttribute("position",new THREE.Float32BufferAttribute([-.075,0,0,.075,0,0,.012,.65,0],3));
  blade.computeVertexNormals();
  const blades = new THREE.InstancedMesh(blade,grassMaterial,2600);
  let count = 0;
  for (let attempt = 0; attempt < 7000 && count < 2600; attempt++) {
    const x = (random()-.5)*29;
    const z = -17+random()*58;
    if (Math.abs(x)<2.5 || (z<17&&Math.abs(x)>12.5)) continue;
    if ([26.7,33.2,-8.7].some(lane=>Math.abs(z-lane)<1.15)) continue;
    if (Math.hypot(x+7.5,z-19.8)<3.6) continue;
    if ([[-8,30],[8,30],[0,37],[-6,-12],[6,-12]].some(([hx,hz])=>Math.hypot(x-hx,z-hz)<3.3)) continue;
    const height = .5+random()*.65;
    position.set(x, .025, z);
    quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),random()*6.28);
    scale.set(1,height,1);
    matrix.compose(position,quaternion,scale);
    blades.setMatrixAt(count,matrix);
    blades.setColorAt(count,new THREE.Color().setHSL(.22+random()*.06,.31,.33+random()*.17));
    count++;
  }
  blades.count=count;
  blades.receiveShadow=true;
  world.add(blades);

  // Flowers share one mesh; their spacing leaves the doors and paths legible.
  const flowerMaterial = mat(0xffffff);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.1,0),flowerMaterial,200);
  for (let i=0;i<200;i++) {
    const side=i%2?1:-1;
    position.set(side*(3.3+random()*3.3),.3,-6+random()*31);
    scale.set(1,.6,1);
    matrix.compose(position,new THREE.Quaternion(),scale);
    flowers.setMatrixAt(i,matrix);
    flowers.setColorAt(i,new THREE.Color([0xffdeb0,0xf0d371,0xb4cbf1,0xf7f2d0][i%4]));
  }
  world.add(flowers);

  const treetops: THREE.Mesh[]=[];
  for (let i=0;i<18;i++) {
    const side=i%2?1:-1;
    const x=side*(12.5+random()*1.9);
    const z=-11+Math.floor(i/2)*5.4;
    const h=2.5+random()*1.2;
    add(new THREE.CylinderGeometry(.17,.34,h,7),bark,x,h/2,z);
    const crown=add(new THREE.IcosahedronGeometry(1.9,1),leaves,x,h+.55,z);
    crown.scale.set(1.1,.9,1);
    crown.rotation.y=random()*6;
    treetops.push(crown);
  }

  // Village details use the same geometry and palette as the original models.
  const brass = mat(0xb29255);
  const lamp = new THREE.MeshStandardMaterial({color:0xffdf8d,emissive:0xffb347,emissiveIntensity:1.4});
  for(const z of [20,26,34]) for(const side of [-1,1]) {
    add(new THREE.CylinderGeometry(.05,.08,1.8,6),bark,side*2.4,.9,z);
    add(new THREE.BoxGeometry(.28,.42,.28),lamp,side*2.4,1.85,z);
    add(new THREE.ConeGeometry(.3,.24,4),brass,side*2.4,2.16,z);
  }
  const cloths:THREE.Mesh[]=[];
  for(const side of [-1,1]) {
    const pole=add(new THREE.CylinderGeometry(.045,.065,3.5,6),bark,side*3.8,1.75,17);
    pole.castShadow=true;
    const cloth=add(new THREE.PlaneGeometry(.75,1.65,4,8),new THREE.MeshStandardMaterial({color:side<0?0xd5ae60:0x79b5b2,side:THREE.DoubleSide,roughness:.9}),side*3.8,2.25,17);
    cloth.rotation.y=.3;
    cloths.push(cloth);
  }
  // Wind tracers make wind direction readable, not a full-screen particle storm.
  const windPositions = new Float32Array(96*3);
  const windSeeds = Array.from({length:96},()=>({x:(random()-.5)*32,z:-18+random()*62,y:1+random()*6}));
  const windGeometry = new THREE.BufferGeometry();
  windGeometry.setAttribute("position",new THREE.BufferAttribute(windPositions,3));
  const motes = new THREE.Points(windGeometry,new THREE.PointsMaterial({color:0xffe6a9,size:.06,transparent:true,opacity:.6,depthWrite:false}));
  world.add(motes);

  const destination = new THREE.Group();
  const ring=add(new THREE.RingGeometry(.7,.79,48),new THREE.MeshBasicMaterial({color:0xffda83,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}),0,0,0);
  world.remove(ring);
  ring.rotation.x=-Math.PI/2;
  destination.add(ring);
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.19),new THREE.MeshBasicMaterial({color:0xffd37e}));
  marker.position.y=2.85;
  destination.add(marker);
  world.add(destination);

  return {
    update(seconds:number, target:{x:number;z:number}, outdoor:boolean) {
      const t=reducedMotion?0:seconds;
      time.value=t;
      world.visible=outdoor;
      destination.position.set(target.x,.09,target.z);
      marker.position.y=2.85+Math.sin(t*2)*.16;
      marker.rotation.y=t*.6;
      treetops.forEach((tree,i)=>{tree.rotation.z=Math.sin(t*.85+i)*.026;});
      cloths.forEach((cloth,i)=>{cloth.rotation.y=.3+Math.sin(t*1.6+i)*.18;});
      windSeeds.forEach((p,i)=>{
        windPositions[i*3]=((p.x+t*.7+16)%32+32)%32-16;
        windPositions[i*3+1]=p.y+Math.sin(t+i)*.16;
        windPositions[i*3+2]=p.z+Math.sin(t*.2+i)*.5;
      });
      windGeometry.attributes.position.needsUpdate=true;
    },
  };
}
