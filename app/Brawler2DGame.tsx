"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Props={onClear:()=>void};
type Direction="left"|"right";
type EnemyRuntime={id:number;x:number;health:number;maxHealth:number;active:boolean;cooldown:number;hitUntil:number;attackingUntil:number};
type EnemyView={id:number;x:number;health:number;maxHealth:number;active:boolean;hit:boolean;attacking:boolean;facingLeft:boolean};
type ViewState={playerX:number;cameraX:number;health:number;score:number;combo:number;frame:number;facing:Direction;hit:boolean;moving:boolean;enemies:EnemyView[];gateOpen:boolean;complete:boolean;defeated:boolean};

const WORLD_WIDTH=2600;
const enemySeeds=[{id:0,x:520,health:90},{id:1,x:1040,health:105},{id:2,x:1580,health:130},{id:3,x:2150,health:175}];
const freshEnemies=():EnemyRuntime[]=>enemySeeds.map(item=>({...item,maxHealth:item.health,active:true,cooldown:0,hitUntil:0,attackingUntil:0}));
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const minaFramePosition=(frame:number)=>`${frame*20}% center`;
const guardianPosition=(id:number)=>`${id*(100/3)}% center`;

export default function Brawler2DGame({onClear}:Props){
  const stageRef=useRef<HTMLDivElement>(null),onClearRef=useRef(onClear),resetScene=useRef<()=>void>(()=>undefined),attackRequest=useRef(false),input=useRef({left:false,right:false});
  const [message,setMessage]=useState("夜の研究路を右へ進み、四人の番人と向き合います。");
  const [view,setView]=useState<ViewState>({playerX:90,cameraX:0,health:100,score:0,combo:0,frame:0,facing:"right",hit:false,moving:false,enemies:freshEnemies().map(item=>({...item,hit:false,attacking:false,facingLeft:true})),gateOpen:false,complete:false,defeated:false});
  useEffect(()=>{onClearRef.current=onClear;},[onClear]);
  const attack=useCallback(()=>{attackRequest.current=true;},[]);
  const reset=useCallback(()=>{input.current={left:false,right:false};attackRequest.current=false;setMessage("夜の研究路を右へ進み、四人の番人と向き合います。");resetScene.current();},[]);
  useEffect(()=>{const stage=stageRef.current;if(!stage)return;let playerX=90,health=100,score=0,combo=0,facing:Direction="right",attackUntil=0,attackCooldown=0,comboUntil=0,hitUntil=0,last=performance.now(),lastPaint=0,raf=0,complete=false,rewarded=false;let enemies=freshEnemies();
    const paint=(now:number,moving=false)=>{const viewport=Math.max(320,stage.clientWidth),cameraX=clamp(playerX-viewport*.34,0,WORLD_WIDTH-viewport),gateOpen=enemies.every(enemy=>!enemy.active);let frame=0;if(complete)frame=5;else if(now<attackUntil)frame=combo===3?4:3;else if(moving)frame=Math.floor(now/170)%2?1:2;setView({playerX,cameraX,health,score,combo:now<comboUntil?combo:0,frame,facing,hit:now<hitUntil,moving,enemies:enemies.map(enemy=>({id:enemy.id,x:enemy.x,health:enemy.health,maxHealth:enemy.maxHealth,active:enemy.active,hit:now<enemy.hitUntil,attacking:now<enemy.attackingUntil,facingLeft:enemy.x>playerX})),gateOpen,complete,defeated:health<=0});};
    const restore=()=>{playerX=90;health=100;score=0;combo=0;facing="right";attackUntil=0;attackCooldown=0;comboUntil=0;hitUntil=0;complete=false;rewarded=false;enemies=freshEnemies();paint(performance.now());};resetScene.current=restore;
    const down=(event:KeyboardEvent)=>{const key=event.key.toLowerCase();if(["arrowleft","arrowright","a","d","j"," "].includes(key))event.preventDefault();if(key==="arrowleft"||key==="a")input.current.left=true;if(key==="arrowright"||key==="d")input.current.right=true;if(key==="j"||key===" ")attackRequest.current=true;};
    const up=(event:KeyboardEvent)=>{const key=event.key.toLowerCase();if(key==="arrowleft"||key==="a")input.current.left=false;if(key==="arrowright"||key==="d")input.current.right=false;};window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    const loop=(now:number)=>{raf=requestAnimationFrame(loop);const delta=Math.min((now-last)/1000,.04);last=now;let moving=false;if(!complete&&health>0){const direction=(input.current.right?1:0)-(input.current.left?1:0);if(direction!==0&&now>=attackUntil){moving=true;facing=direction>0?"right":"left";playerX=clamp(playerX+direction*delta*245,45,WORLD_WIDTH-90);}
        if(attackRequest.current&&now>=attackCooldown){attackRequest.current=false;combo=now<comboUntil?combo%3+1:1;comboUntil=now+760;attackUntil=now+300;attackCooldown=now+330;const reach=combo===3?145:112,damage=combo===3?58:34;let hitCount=0;enemies.forEach(enemy=>{if(!enemy.active)return;const distance=enemy.x-playerX;const inFront=facing==="right"?distance>-.25:distance<.25;if(inFront&&Math.abs(distance)<reach){enemy.health-=damage;enemy.hitUntil=now+210;enemy.x=clamp(enemy.x+(facing==="right"?1:-1)*(combo===3?55:24),80,WORLD_WIDTH-70);score+=combo===3?420:190;hitCount+=1;if(enemy.health<=0){enemy.active=false;score+=500;}}});const left=enemies.filter(enemy=>enemy.active).length;if(hitCount)setMessage(left?combo===3?`三段目が決まりました。残りの番人は${left}人です。`:`攻撃が届きました。続けて押すと三段攻撃になります。`:"少し離れています。相手へ近づいて攻撃します。");if(left===0)setMessage("四人の番人が道を開けました。右端の森研究所の門へ進みます。");}
        enemies.forEach(enemy=>{if(!enemy.active)return;const distance=playerX-enemy.x,absolute=Math.abs(distance);if(absolute<430&&absolute>73&&now>=enemy.hitUntil)enemy.x+=Math.sign(distance)*delta*(enemy.id===3?82:94);if(absolute<78&&now>=enemy.cooldown&&now>=enemy.hitUntil&&now>=hitUntil){enemy.cooldown=now+1150-enemy.id*45;enemy.attackingUntil=now+240;hitUntil=now+620;health=clamp(health-(enemy.id===3?18:10+enemy.id*2),0,100);playerX=clamp(playerX-Math.sign(distance)*30,45,WORLD_WIDTH-90);setMessage(health>0?"番人の反撃です。いったん離れて間合いを取り直します。":"ミナは研究路の入口へ戻ります。『最初から』で再挑戦できます。");}});
        const gateOpen=enemies.every(enemy=>!enemy.active);if(gateOpen&&playerX>2420){complete=true;setMessage("森研究所の門へ到着しました。ミナが両手を上げて喜んでいます！");if(!rewarded){rewarded=true;onClearRef.current();}}}
      if(now-lastPaint>32){lastPaint=now;paint(now,moving);}};paint(last);raf=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);resetScene.current=()=>undefined;};
  },[]);
  const setDirection=useCallback((key:"left"|"right",value:boolean,event:ReactPointerEvent<HTMLButtonElement>)=>{if(value)event.currentTarget.setPointerCapture(event.pointerId);else if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);input.current[key]=value;},[]);
  const progress=Math.round(view.playerX/(WORLD_WIDTH-90)*100);
  return <div className="side-brawler"><div className="side-stage" ref={stageRef}>
    <div className="side-sky"><i/><i/><i/></div><div className="side-moon"/>
    <div className="side-hills far" style={{transform:`translateX(${-view.cameraX*.12}px)`}}/><div className="side-hills near" style={{transform:`translateX(${-view.cameraX*.28}px)`}}/>
    <div className="side-world" style={{width:`${WORLD_WIDTH}px`,transform:`translateX(${-view.cameraX}px)`}}><div className="side-road"/>{Array.from({length:18},(_,i)=><div className="side-tree" key={i} style={{left:`${i*155-20}px`,transform:`scale(${.78+(i%4)*.07})`}}><i/><b/></div>)}{Array.from({length:9},(_,i)=><div className="side-lantern" key={`l${i}`} style={{left:`${230+i*285}px`}}><i/></div>)}<div className={view.gateOpen?"side-gate open":"side-gate"}><i/><b/><span>森研究所</span></div>
      {view.enemies.map(enemy=>enemy.active&&<div className={`guardian-sprite ${enemy.hit?"hit ":""}${enemy.attacking?"attacking ":""}${enemy.facingLeft?"face-left":"face-right"}`} key={enemy.id} style={{left:`${enemy.x}px`,backgroundPosition:guardianPosition(enemy.id)}}><div className="guardian-health"><i style={{width:`${Math.max(0,enemy.health/enemy.maxHealth*100)}%`}}/></div></div>)}
      <div className={`mina-2d-sprite ${view.facing==="left"?"face-left":"face-right"} ${view.hit?"hit":""}`} style={{left:`${view.playerX}px`,backgroundPosition:minaFramePosition(view.frame)}}/>
      <div className="side-finish"/>
    </div>
    <div className="side-hud"><div><small>MINA</small><div className="side-health"><i style={{width:`${view.health}%`}}/></div><strong>{view.health}</strong></div><div><small>ROAD</small><strong>{progress}<i>%</i></strong></div><div><small>GUARDIANS</small><strong>{view.enemies.filter(enemy=>enemy.active).length}<i> / 4</i></strong></div><div><small>SCORE</small><strong>{view.score}</strong></div></div>
    {view.combo>1&&<div className="side-combo">{view.combo} HIT</div>}<div className="side-mission"><span>MISSION 02 · 2D SIDE-SCROLL</span><strong>右へ進み、森研究所の門へ</strong></div>
  </div><div className="side-console"><p aria-live="polite">{message}</p><div className="side-controls"><button aria-label="左へ進む" onPointerDown={e=>setDirection("left",true,e)} onPointerUp={e=>setDirection("left",false,e)} onPointerCancel={e=>setDirection("left",false,e)}>← 左へ</button><button className="side-attack" onPointerDown={attack} disabled={view.complete||view.defeated}>攻撃</button><button aria-label="右へ進む" onPointerDown={e=>setDirection("right",true,e)} onPointerUp={e=>setDirection("right",false,e)} onPointerCancel={e=>setDirection("right",false,e)}>右へ →</button><button className="side-reset" onClick={reset}>最初から</button></div><div className="side-note"><span>完全横スクロール：相手へ近づき、攻撃を続けて三段コンボ</span><span>← → / A D / J・Space</span></div></div>{view.complete&&<div className="side-result"><strong>夜の研究路を通過しました</strong><p>スコア {view.score}　ミナの体力 {view.health}</p><button onClick={reset}>もう一度、右へ進む</button></div>}</div>;
}
