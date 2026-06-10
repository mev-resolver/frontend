'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AttackControls from '../components/AttackControls';
import DexUI from '../components/DexUI';
import StatsPanel from '../components/StatsPanel';
import TxHistory from '../components/TxHistory';
import ReplayPlayer from '../components/ReplayPlayer';
import type { WsEvent } from '../lib/types';

const CanvasConsole = dynamic(() => import('../components/CanvasConsole'), { ssr: false });

const TABS = ['CONSOLE','DEX','ATTACK','REPLAY','STATS','HISTORY'] as const;
type Tab = typeof TABS[number];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('CONSOLE');
  const [isReplay,  setIsReplay]  = useState(false);
  const [replayEvs, setReplayEvs] = useState<WsEvent[]>([]);
  const [logs,      setLogs]      = useState<{msg:string;type:string;ts:string}[]>([]);
  const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000/ws';

  const addLog = useCallback((msg: string, type: string) => {
    const ts = new Date().toLocaleTimeString('en', { hour12: false });
    setLogs(prev => [...prev.slice(-70), { msg, type, ts }]);
  }, []);

  const handleReplay = useCallback((evs: WsEvent[]) => {
    setIsReplay(true);
    setReplayEvs(prev => [...prev, ...evs]);
  }, []);

  const handleClear = useCallback(() => {
    setIsReplay(false);
    setReplayEvs([]);
  }, []);

  const logColor = (t: string) =>
    t==='attack' ? '#EF4444' : t==='mitigated' ? '#10B981' : t==='settled' ? '#3B82F6' : '#2DD4BF';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0A0F1A', overflow:'hidden' }}>

      {/* TOP BAR */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:52, flexShrink:0,
        background:'rgba(10,15,26,0.96)', borderBottom:'1px solid rgba(45,212,191,0.12)',
        backdropFilter:'blur(10px)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
            <div style={{ width:28,height:28,borderRadius:'50%',border:'1px solid #2DD4BF',
              display:'flex',alignItems:'center',justifyContent:'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="2" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
            <span style={{ fontFamily:'Space Mono,monospace', fontSize:13, color:'#F3F4F6', letterSpacing:'0.08em' }}>RESOLVER</span>
          </Link>
          <span style={{ color:'#374151' }}>|</span>
          <span style={{ fontFamily:'Space Mono,monospace', fontSize:11, color:'#2DD4BF', letterSpacing:'0.1em' }}>TACTICAL CONSOLE</span>
        </div>

        <div style={{ display:'flex', gap:2 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding:'6px 13px', borderRadius:6, cursor:'pointer',
              fontFamily:'Space Mono,monospace', fontSize:10, letterSpacing:'0.07em',
              background: activeTab===tab ? 'rgba(45,212,191,0.15)' : 'transparent',
              border:`1px solid ${activeTab===tab ? 'rgba(45,212,191,0.4)' : 'transparent'}`,
              color: activeTab===tab ? '#2DD4BF' : '#9CA3AF', transition:'all 0.15s',
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {isReplay && (
            <span style={{ fontFamily:'Space Mono,monospace', fontSize:10, color:'#F97316',
              padding:'3px 8px', borderRadius:4, border:'1px solid rgba(249,115,22,0.4)',
              background:'rgba(249,115,22,0.08)' }}>REPLAY</span>
          )}
          <div style={{ width:6,height:6,borderRadius:'50%',background:'#10B981',boxShadow:'0 0 6px #10B981' }} />
          <span style={{ fontFamily:'Space Mono,monospace', fontSize:10, color:'#10B981' }}>LIVE</span>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {activeTab === 'CONSOLE' && (
          <div style={{
            width:244, flexShrink:0, padding:12, overflowY:'auto',
            background:'rgba(10,15,26,0.9)', borderRight:'1px solid rgba(45,212,191,0.08)',
            display:'flex', flexDirection:'column', gap:10,
          }}>
            <div style={{ fontFamily:'Space Mono,monospace', fontSize:9, color:'#2DD4BF',
              letterSpacing:'0.15em', borderBottom:'1px solid rgba(45,212,191,0.1)', paddingBottom:4 }}>
              EVENT LOG
            </div>
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
              {logs.slice().reverse().map((l, i) => (
                <div key={i} style={{
                  fontFamily:'Space Mono,monospace', fontSize:9, lineHeight:1.5,
                  padding:'3px 6px', borderRadius:3, borderLeft:'2px solid',
                  borderColor: logColor(l.type),
                  background:`rgba(${l.type==='attack'?'239,68,68':l.type==='mitigated'?'16,185,129':'45,212,191'},0.04)`,
                  color: logColor(l.type),
                }}>
                  <span style={{color:'#4B5563'}}>[{l.ts}] </span>{l.msg}
                </div>
              ))}
              {logs.length===0 && (
                <div style={{color:'#4B5563',fontFamily:'Space Mono,monospace',fontSize:9}}>
                  Waiting for Sepolia events...
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'CONSOLE' && (
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            <CanvasConsole
              wsUrl={wsUrl}
              replayEvents={isReplay ? replayEvs : undefined}
              isReplay={isReplay}
              onEventLog={addLog}
            />
            <div style={{ position:'absolute', bottom:12, left:12, display:'flex', gap:12 }}>
              {[
                {color:'#2DD4BF',label:'Normal'},
                {color:'#F97316',label:'Bot TX'},
                {color:'#EF4444',label:'Attack'},
                {color:'#10B981',label:'Protected'},
              ].map(({color,label}) => (
                <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:color,boxShadow:`0 0 4px ${color}`}} />
                  <span style={{fontFamily:'Space Mono,monospace',fontSize:9,color:'#9CA3AF'}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CONSOLE' && (
          <div style={{
            width:262, flexShrink:0, padding:12, overflowY:'auto',
            background:'rgba(10,15,26,0.9)', borderLeft:'1px solid rgba(45,212,191,0.08)',
          }}>
            <AttackControls />
          </div>
        )}

        {activeTab !== 'CONSOLE' && (
          <div style={{ flex:1, overflowY:'auto', padding:24 }}>
            {activeTab==='DEX'     && <div style={{maxWidth:520,margin:'0 auto'}}><DexUI /></div>}
            {activeTab==='ATTACK'  && <div style={{maxWidth:520,margin:'0 auto'}}><AttackControls /></div>}
            {activeTab==='REPLAY'  && <div style={{maxWidth:580,margin:'0 auto'}}><ReplayPlayer onReplay={handleReplay} onClear={handleClear} /></div>}
            {activeTab==='STATS'   && <StatsPanel />}
            {activeTab==='HISTORY' && <TxHistory />}
          </div>
        )}
      </div>

      <div style={{
        height:34, flexShrink:0, display:'flex', alignItems:'center', gap:16,
        padding:'0 20px', background:'rgba(10,15,26,0.96)',
        borderTop:'1px solid rgba(45,212,191,0.08)',
        fontFamily:'Space Mono,monospace', fontSize:10, color:'#6B7280',
      }}>
        <div style={{width:5,height:5,borderRadius:'50%',background:'#10B981',boxShadow:'0 0 4px #10B981'}} />
        <span>resolver.network</span>
        <span style={{color:'#374151'}}>·</span>
        <span>Sepolia Testnet</span>
        <span style={{color:'#374151'}}>·</span>
        <span>MEV Mitigation Active</span>
        <span style={{marginLeft:'auto',color:'#4B5563'}}>{logs.length} events</span>
      </div>
    </div>
  );
}
