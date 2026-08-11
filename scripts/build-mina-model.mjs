import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

class NodeFileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((value) => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((value) => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`; this.onloadend?.(); }); }
}
globalThis.FileReader = NodeFileReader;

const root = new THREE.Group();
root.name = "Mina_Dedicated_Model_v1";
root.userData = { character: "Mina", reference: "mina-bunko-01-kaze-no-toru-kyoshitsu-cover", modelVersion: 1 };

const mat = (name, color, roughness = .72, metalness = .02) => {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  value.name = name;
  return value;
};
const skin = mat("Mina_Skin", 0xd9a77f, .78);
const blush = mat("Mina_Blush", 0xd98f79, .72);
const hair = mat("Mina_Hair", 0x251e1c, .84);
const blouse = mat("Mina_Ivory_Blouse", 0xe9dfc7, .9);
const blouseShadow = mat("Mina_Blouse_Embroidery", 0xcdbf9e, .82);
const skirt = mat("Mina_Blue_Floral_Skirt", 0x54789a, .88);
const flower = mat("Mina_Skirt_Flowers", 0xd9d6b5, .82);
const shoe = mat("Mina_Cream_Shoes", 0xb8a17e, .72);
const eyeWhite = mat("Mina_Eye_White", 0xf7f1df, .45);
const iris = mat("Mina_Dark_Iris", 0x3a2d27, .35);
const mouth = mat("Mina_Mouth", 0x984f48, .68);

const mesh = (name, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
  const value = new THREE.Mesh(geometry, material);
  value.name = name;
  value.position.set(...position);
  value.scale.set(...scale);
  value.rotation.set(...rotation);
  value.castShadow = true;
  value.receiveShadow = true;
  return value;
};
const capsule = (name, radius, length, material, position, scale = [1, 1, 1]) => mesh(name, new THREE.CapsuleGeometry(radius, length, 10, 24), material, position, scale);

const skirtShape = [new THREE.Vector2(.38, 0), new THREE.Vector2(.68, .15), new THREE.Vector2(.87, 1.25), new THREE.Vector2(.48, 1.72), new THREE.Vector2(.4, 1.78)];
const skirtMesh = mesh("Mina_Skirt", new THREE.LatheGeometry(skirtShape, 48), skirt, [0, .38, 0]);
root.add(skirtMesh);
for (let row = 0; row < 5; row += 1) {
  const y = .62 + row * .27;
  const radius = .78 - row * .065;
  for (let i = 0; i < 12; i += 1) {
    const angle = i / 12 * Math.PI * 2 + row * .24;
    const petal = mesh(`Mina_Skirt_Flower_${row}_${i}`, new THREE.CircleGeometry(.04, 8), flower, [Math.cos(angle) * radius, y, Math.sin(angle) * radius], [1, .62, 1], [0, angle + Math.PI / 2, 0]);
    root.add(petal);
  }
}

const torso = capsule("Mina_Torso", .39, .72, blouse, [0, 2.3, 0], [.86, 1, .66]);
root.add(torso);
for (let i = -2; i <= 2; i += 1) root.add(mesh(`Mina_Blouse_Pleat_${i}`, new THREE.BoxGeometry(.025, .65, .025), blouseShadow, [i * .1, 2.37, .29], [1, 1, 1], [0, 0, i * .018]));
root.add(mesh("Mina_Waistband", new THREE.CylinderGeometry(.43, .43, .15, 32), skirt, [0, 1.82, 0]));
root.add(mesh("Mina_Collar", new THREE.TorusGeometry(.19, .045, 10, 28), blouse, [0, 2.93, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
for (let i = 0; i < 10; i += 1) { const a = i / 10 * Math.PI * 2; root.add(mesh(`Mina_Collar_Ruffle_${i}`, new THREE.SphereGeometry(.045, 10, 8), blouse, [Math.cos(a) * .19, 2.94, Math.sin(a) * .19], [1.25, .75, 1])); }
root.add(mesh("Mina_Neck", new THREE.CylinderGeometry(.13, .16, .26, 20), skin, [0, 3.03, 0]));

const faceGeo = new THREE.SphereGeometry(.48, 48, 36);
const facePos = faceGeo.attributes.position;
for (let i = 0; i < facePos.count; i += 1) {
  const x = facePos.getX(i), y = facePos.getY(i), z = facePos.getZ(i);
  const cheek = z > 0 && y > -.15 && y < .12 ? 1.06 : 1;
  facePos.setXYZ(i, x * .82 * cheek, y * 1.06, z * .9);
}
faceGeo.computeVertexNormals();
root.add(mesh("Mina_Face", faceGeo, skin, [0, 3.5, 0]));
root.add(mesh("Mina_Nose", new THREE.SphereGeometry(.055, 18, 12), skin, [0, 3.45, .445], [.62, 1.12, .85]));
[-.15, .15].forEach((x, index) => {
  root.add(mesh(`Mina_Eye_White_${index}`, new THREE.SphereGeometry(.073, 20, 14), eyeWhite, [x, 3.57, .405], [1, .78, .42]));
  root.add(mesh(`Mina_Iris_${index}`, new THREE.SphereGeometry(.038, 16, 12), iris, [x, 3.57, .45], [1, 1.08, .58]));
  root.add(mesh(`Mina_Upper_Lid_${index}`, new THREE.TorusGeometry(.076, .012, 8, 18, Math.PI), hair, [x, 3.59, .433], [1, .78, 1], [0, 0, 0]));
  root.add(mesh(`Mina_Brow_${index}`, new THREE.BoxGeometry(.13, .018, .018), hair, [x, 3.7, .42], [1, 1, 1], [0, 0, index ? -.08 : .08]));
  root.add(mesh(`Mina_Blush_${index}`, new THREE.CircleGeometry(.055, 18), blush, [x * 1.6, 3.42, .414], [1.25, .5, 1]));
});
root.add(mesh("Mina_Mouth", new THREE.TorusGeometry(.09, .013, 8, 22, Math.PI), mouth, [0, 3.32, .424], [1, .7, 1], [0, 0, Math.PI]));

root.add(mesh("Mina_Hair_Cap", new THREE.SphereGeometry(.505, 44, 30, 0, Math.PI * 2, 0, Math.PI * .62), hair, [0, 3.68, -.015]));
for (let i = -3; i <= 3; i += 1) { const bang = capsule(`Mina_Bang_${i}`, .035, .28 + Math.abs(i) * .025, hair, [i * .075, 3.73, .34]); bang.rotation.z = i * .08; bang.rotation.x = -.18; root.add(bang); }
[-1, 1].forEach((side) => { const lock = capsule(`Mina_Face_Lock_${side}`, .045, .52, hair, [side * .34, 3.42, .08]); lock.rotation.z = side * .12; root.add(lock); });
const ponyBase = capsule("Mina_Ponytail_Base", .17, .45, hair, [0, 3.35, -.48], [.9, 1, .78]); ponyBase.rotation.x = -.46; root.add(ponyBase);
const ponyEnd = capsule("Mina_Ponytail_End", .15, .62, hair, [0, 3.08, -.66], [.85, 1, .72]); ponyEnd.rotation.x = -.23; root.add(ponyEnd);
root.add(mesh("Mina_Hair_Tie", new THREE.TorusGeometry(.13, .025, 10, 22), blouseShadow, [0, 3.38, -.39], [1, 1, 1], [Math.PI / 2, 0, 0]));

const makeArm = (side) => {
  const pivot = new THREE.Group(); pivot.name = side < 0 ? "Mina_LeftArm" : "Mina_RightArm"; pivot.position.set(side * .46, 2.72, 0);
  const sleeve = capsule(`${pivot.name}_Sleeve`, .145, .64, blouse, [0, -.34, 0], [1.2, 1, 1.05]); pivot.add(sleeve);
  const cuff = mesh(`${pivot.name}_Cuff`, new THREE.TorusGeometry(.13, .035, 9, 20), blouse, [0, -.7, 0], [1, 1, 1], [Math.PI / 2, 0, 0]); pivot.add(cuff);
  const hand = capsule(`${pivot.name}_Hand`, .105, .18, skin, [0, -.84, .02], [.8, 1, .62]); pivot.add(hand); root.add(pivot);
};
makeArm(-1); makeArm(1);
const makeLeg = (side) => {
  const pivot = new THREE.Group(); pivot.name = side < 0 ? "Mina_LeftLeg" : "Mina_RightLeg"; pivot.position.set(side * .2, .56, 0);
  pivot.add(capsule(`${pivot.name}_Calf`, .12, .45, skin, [0, -.18, 0], [.9, 1, .82]));
  const foot = capsule(`${pivot.name}_Shoe`, .15, .27, shoe, [0, -.53, .1], [1, 1, .8]); foot.rotation.x = Math.PI / 2; pivot.add(foot); root.add(pivot);
};
makeLeg(-1); makeLeg(1);

root.scale.setScalar(1.06);
root.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(root, { binary: true, onlyVisible: true, trs: true });
await writeFile(new URL("../design/mina-model/archive/mina-game-model-v1.glb", import.meta.url), Buffer.from(glb));
console.log(`mina-game-model-v1.glb ${glb.byteLength} bytes`);
