import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const vite=await createServer({configFile:false,root:fileURLToPath(new URL("..",import.meta.url)),appType:"custom",logLevel:"silent",server:{middlewareMode:true}});
const world=await vite.ssrLoadModule("/app/mina-plaza/world.ts");
after(()=>vite.close());
test("plaza stick has a dead zone and bounded analog strength",()=>{
  assert.deepEqual(world.stickVector(2,2),{x:0,y:0});
  assert.deepEqual(world.stickVector(100,0),{x:1,y:0});
  const v=world.stickVector(20,20);assert.ok(Math.hypot(v.x,v.y)>0&&Math.hypot(v.x,v.y)<1);
});
test("plaza movement follows the camera and cannot accelerate diagonally",()=>{
  const v=world.screenMotion(1,1,1.2);assert.ok(Math.abs(Math.hypot(v.x,v.z)-1)<1e-9);
  const right=world.screenMotion(1,0,Math.PI/2);assert.ok(Math.abs(right.x)<1e-9);assert.equal(right.z,-1);
});
test("plaza landmarks are reachable around fountain and building collisions",()=>{
  assert.equal(world.canWalk(0,0),false);assert.equal(world.canWalk(-7,-7),false);assert.equal(world.canWalk(13,0),false);
  const queue=[{x:0,z:5}],seen=new Set(["0,5"]);
  for(let i=0;i<queue.length;i++)for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const x=queue[i].x+dx,z=queue[i].z+dz,k=`${x},${z}`;if(!seen.has(k)&&world.canWalk(x,z)){seen.add(k);queue.push({x,z});}}
  for(const place of world.places)assert.ok(queue.some(p=>Math.hypot(p.x-place.x,p.z-place.z)<1.5),place.name);
});
