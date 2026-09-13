export const places = [
  { x: -7, z: -3, name: "小さな茶房", action: "お茶を受け取る", text: "ちょうどよかった。木陰で本を読んでいる人へ、このお茶を届けてくれる？" },
  { x: 6, z: 4, name: "木陰の読書家", action: "お茶を渡す", text: "ありがとう。ページをめくる音と、葉っぱの音って、少し似ているね。" },
  { x: 0, z: -9, name: "研究所の掲示板", action: "読む", text: "本日の観測：急がず歩くこと。広場のどこかに、気持ちのいい木陰があります。" },
] as const;
export const obstacles = [
  { x: -7, z: -7, w: 5.8, d: 5.5 }, { x: 7, z: -8, w: 5.5, d: 5 },
  { x: 0, z: -12, w: 4.8, d: 2 }, { x: 0, z: 0, w: 2.9, d: 2.9 },
  { x: 7, z: 5.7, w: 3.6, d: 1 },
  ...[[-10,3],[-7,9],[9,2],[10,9],[-2,10]].map(([x,z])=>({x,z,w:1,d:1})),
];
export function canWalk(x:number,z:number) {
  return Math.abs(x)<12 && z>-10.5 && z<12 && !obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.32&&Math.abs(z-o.z)<o.d/2+.32);
}
export function stickVector(x:number,y:number,radius=46) {
  const length=Math.hypot(x,y); if(length<radius*.12)return{x:0,y:0};
  const strength=Math.min(1,(length/radius-.12)/.88);
  return {x:x/length*strength,y:y/length*strength};
}
export function screenMotion(x:number,y:number,yaw:number) {
  const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;
  return {x:Math.cos(yaw)*x+Math.sin(yaw)*y,z:-Math.sin(yaw)*x+Math.cos(yaw)*y};
}
