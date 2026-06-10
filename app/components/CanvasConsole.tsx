'use client';
import { useRef, useEffect, useCallback } from 'react';
import type { WsEvent } from '../lib/types';

interface Zone {
  key: string; label: string;
  xFrac: number; yFrac: number;
  wAbs: number; hAbs: number;
  color: string; isProtected?: boolean; isDashed?: boolean;
}
const ZONES: Zone[] = [
  { key:'mempool',    label:'MEMPOOL',     xFrac:0.09, yFrac:0.50, wAbs:115, hAbs:80, color:'#2DD4BF' },
  { key:'detection',  label:'DETECTION',   xFrac:0.33, yFrac:0.50, wAbs:115, hAbs:80, color:'#3B82F6' },
  { key:'public',     label:'PUBLIC LANE', xFrac:0.62, yFrac:0.27, wAbs:110, hAbs:68, color:'#9CA3AF', isDashed:true },
  { key:'protected',  label:'PROTECTED',   xFrac:0.62, yFrac:0.73, wAbs:110, hAbs:68, color:'#10B981', isProtected:true },
  { key:'settlement', label:'SETTLEMENT',  xFrac:0.88, yFrac:0.50, wAbs:100, hAbs:68, color:'#2DD4BF' },
];
const PATHS = {
  normal: ['mempool','detection','public','settlement'],
  attack: ['mempool','detection','protected','settlement'],
};
const CONNECTIONS = [
  ['mempool','detection'],['detection','public'],
  ['detection','protected'],['public','settlement'],['protected','settlement'],
];

interface Node {
  id: string; txHash: string;
  nodeType: 'normal'|'suspicious'|'attack';
  path: string[]; pathIdx: number;
  x: number; y: number;
  opacity: number; pulsePhase: number;
  trail: {x:number;y:number}[];
  alive: boolean; speed: number;
}

interface Props {
  wsUrl:         string;
  replayEvents?: WsEvent[];
  isReplay?:     boolean;
  onEventLog?:   (msg: string, type: string) => void;
}

export default function CanvasConsole({ wsUrl, replayEvents, isReplay, onEventLog }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const nodesRef   = useRef<Map<string, Node>>(new Map());
  const animRef    = useRef<number>();
  const sonarRef   = useRef(0);
  const wsRef      = useRef<WebSocket|null>(null);

  const zoneCenter = useCallback((key: string, W: number, H: number) => {
    const z = ZONES.find(z => z.key === key);
    return z ? { x: z.xFrac * W, y: z.yFrac * H } : { x: 0, y: 0 };
  }, []);

  const spawnNode = useCallback((txHash: string, nodeType: 'normal'|'suspicious'|'attack') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const path = nodeType === 'attack' ? PATHS.attack : PATHS.normal;
    const { x, y } = zoneCenter('mempool', W, H);
    nodesRef.current.set(txHash, {
      id: txHash, txHash, nodeType, path, pathIdx: 0,
      x, y: y + (Math.random()-0.5)*40,
      opacity: 0, pulsePhase: Math.random()*Math.PI*2,
      trail: [], alive: true,
      speed: 1.3 + Math.random()*0.5,
    });
  }, [zoneCenter]);

  const handleEvent = useCallback((ev: WsEvent) => {
    if (ev.type === 'transaction_arrived') {
      const d = ev.data as Record<string,unknown>;
      const nt: 'normal'|'suspicious'|'attack' = d.is_bot ? 'suspicious' : 'normal';
      spawnNode(d.tx_hash as string, nt);
      onEventLog?.(`tx_arrived ${(d.tx_hash as string).slice(0,12)}... ${d.token_in}->${d.token_out}`, 'normal');
    } else if (ev.type === 'attack_detected') {
      const d = ev.data as Record<string,unknown>;
      const node = nodesRef.current.get(d.victim_tx_hash as string);
      if (node) node.nodeType = 'attack';
      // Also mark bot txs
      const buyHash = d.buy_tx_hash as string;
      if (buyHash) {
        const bn = nodesRef.current.get(buyHash);
        if (bn) bn.nodeType = 'attack';
      }
      onEventLog?.(`ATTACK_DETECTED ${d.attack_id} conf:${d.confidence}`, 'attack');
    } else if (ev.type === 'mitigation_applied') {
      const d = ev.data as Record<string,unknown>;
      const node = nodesRef.current.get(d.victim_tx_hash as string);
      if (node) {
        node.path = PATHS.attack;
        if (node.pathIdx >= 2) node.pathIdx = 1;
      }
      onEventLog?.(`MITIGATED ${d.bundle_id} -> protected lane`, 'mitigated');
    } else if (ev.type === 'settlement_confirmed') {
      const d = ev.data as Record<string,unknown>;
      onEventLog?.(`SETTLED ${d.bundle_id} status:${d.status}`, 'settled');
    }
  }, [spawnNode, onEventLog]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      if (W < 1 || H < 1) { animRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = '#0A0F1A';
      ctx.fillRect(0,0,W,H);

      // Grid
      ctx.strokeStyle = 'rgba(45,212,191,0.04)';
      ctx.lineWidth = 0.5;
      for (let x=0; x<W; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y=0; y<H; y+=50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      // Sonar
      sonarRef.current += 0.008;
      const cx = W/2, cy = H/2, maxR = Math.min(W,H)*0.42;
      [0.3,0.6,0.9].forEach((f,i) => {
        ctx.beginPath(); ctx.arc(cx,cy,maxR*f,0,Math.PI*2);
        ctx.strokeStyle = `rgba(45,212,191,${0.04+i*0.01})`; ctx.lineWidth=0.5; ctx.stroke();
      });
      const sweepLen = Math.PI*0.45;
      for (let i=0; i<20; i++) {
        const a = sonarRef.current - (i/20)*sweepLen;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,maxR,a,a+Math.PI/20); ctx.closePath();
        ctx.fillStyle = `rgba(45,212,191,${0.01*(1-i/20)})`; ctx.fill();
      }

      // Connections
      CONNECTIONS.forEach(([fk,tk]) => {
        const f = ZONES.find(z=>z.key===fk)!;
        const t2= ZONES.find(z=>z.key===tk)!;
        const fx=f.xFrac*W, fy=f.yFrac*H, tx2=t2.xFrac*W, ty=t2.yFrac*H;
        ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(tx2,ty);
        ctx.strokeStyle = tk==='protected' ? 'rgba(16,185,129,0.2)' : 'rgba(45,212,191,0.1)';
        ctx.lineWidth = 1;
        if (tk==='public') ctx.setLineDash([5,8]); else ctx.setLineDash([]);
        ctx.stroke(); ctx.setLineDash([]);
        // Moving particle
        const p = ((Date.now()/1100) % 1);
        const px=fx+(tx2-fx)*p, py=fy+(ty-fy)*p;
        ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
        ctx.fillStyle = tk==='protected' ? 'rgba(16,185,129,0.6)' : 'rgba(45,212,191,0.4)';
        ctx.fill();
      });

      // Zones
      ZONES.forEach(z => {
        const zx=z.xFrac*W-z.wAbs/2, zy=z.yFrac*H-z.hAbs/2;
        const pulse = Math.sin(Date.now()/800)*0.15;
        if (z.isProtected) {
          ctx.fillStyle='rgba(16,185,129,0.04)'; ctx.fillRect(zx,zy,z.wAbs,z.hAbs);
          ctx.strokeStyle=`rgba(16,185,129,${0.4+pulse})`;
        } else if (z.isDashed) {
          ctx.strokeStyle='rgba(156,163,175,0.2)';
        } else {
          ctx.strokeStyle='rgba(45,212,191,0.18)';
        }
        ctx.lineWidth = z.isProtected ? 1.5 : 1;
        if (z.isDashed) ctx.setLineDash([5,5]); else ctx.setLineDash([]);
        ctx.strokeRect(zx,zy,z.wAbs,z.hAbs); ctx.setLineDash([]);

        ctx.font='8px Space Mono,monospace'; ctx.textAlign='center';
        ctx.fillStyle = z.isProtected ? '#10B981' : '#9CA3AF';
        ctx.fillText(z.label, z.xFrac*W, zy-8);
      });

      // Nodes
      const dead: string[] = [];
      nodesRef.current.forEach((node, key) => {
        node.opacity = Math.min(1, node.opacity+0.05);
        node.pulsePhase += 0.09;

        const color = node.nodeType==='attack' ? '#EF4444'
          : node.nodeType==='suspicious' ? '#F97316'
          : '#2DD4BF';

        if (node.nodeType!=='normal') {
          node.trail.push({x:node.x, y:node.y});
          if (node.trail.length>10) node.trail.shift();
        }

        const tzk = node.path[node.pathIdx];
        if (!tzk) {
          node.opacity -= 0.03;
          if (node.opacity<=0) { node.alive=false; dead.push(key); }
        } else {
          const {x:tx3,y:ty2} = zoneCenter(tzk,W,H);
          const dx=tx3-node.x, dy=ty2-node.y;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if (dist<5) {
            if (node.pathIdx<node.path.length-1) node.pathIdx++;
          } else {
            node.x += (dx/dist)*node.speed;
            node.y += (dy/dist)*node.speed;
          }
        }

        ctx.save(); ctx.globalAlpha=node.opacity;

        node.trail.forEach((pt,i) => {
          ctx.beginPath(); ctx.arc(pt.x,pt.y,3,0,Math.PI*2);
          ctx.fillStyle=color+(Math.floor(i/node.trail.length*80).toString(16).padStart(2,'0'));
          ctx.fill();
        });

        if (node.nodeType==='attack') {
          const gr=ctx.createRadialGradient(node.x,node.y,0,node.x,node.y,16+Math.sin(node.pulsePhase)*4);
          gr.addColorStop(0,'rgba(239,68,68,0.4)'); gr.addColorStop(1,'rgba(239,68,68,0)');
          ctx.beginPath(); ctx.arc(node.x,node.y,16,0,Math.PI*2); ctx.fillStyle=gr; ctx.fill();
        }

        const r = node.nodeType==='attack' ? 8 : 6;
        ctx.beginPath(); ctx.arc(node.x,node.y,r,0,Math.PI*2);
        if (node.nodeType==='normal') { ctx.fillStyle='rgba(45,212,191,0.2)'; ctx.fill(); }
        ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke();

        if (node.nodeType==='attack') {
          const pr=r+4+Math.sin(node.pulsePhase*2)*4;
          ctx.beginPath(); ctx.arc(node.x,node.y,pr,0,Math.PI*2);
          ctx.strokeStyle=`rgba(239,68,68,${0.35+Math.sin(node.pulsePhase)*0.15})`;
          ctx.lineWidth=1; ctx.stroke();
        }

        ctx.restore();
      });
      dead.forEach(k => nodesRef.current.delete(k));

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { ro.disconnect(); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [zoneCenter]);

  // WebSocket
  useEffect(() => {
    if (isReplay || !wsUrl) return;
    let ws: WebSocket|null=null;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen  = () => ws!.send(JSON.stringify({type:'subscribe',streams:['all']}));
        ws.onmessage = (e) => { try { handleEvent(JSON.parse(e.data) as WsEvent); } catch {} };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch { setTimeout(connect, 3000); }
    };
    connect();
    return () => { ws?.close(); wsRef.current=null; };
  }, [wsUrl, isReplay, handleEvent]);

  // Replay
  useEffect(() => {
    if (!isReplay || !replayEvents?.length) return;
    replayEvents.forEach((ev, i) => {
      setTimeout(() => handleEvent(ev), i * 300);
    });
  }, [replayEvents, isReplay, handleEvent]);

  return (
    <canvas ref={canvasRef} style={{width:'100%', height:'100%', display:'block'}} />
  );
}
