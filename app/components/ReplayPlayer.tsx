'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { WsEvent, EventRecord } from '../lib/types';

interface Props { onReplay: (events: WsEvent[]) => void; onClear: () => void; }

export default function ReplayPlayer({ onReplay, onClear }: Props) {
  const [startTs, setStartTs] = useState<number>(0);
  const [endTs,   setEndTs]   = useState<number>(0);
  const [speed,   setSpeed]   = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState('');
  const [minTs,   setMinTs]   = useState<number>(Date.now()/1000 - 3600);
  const [maxTs,   setMaxTs]   = useState<number>(Date.now()/1000);

  useEffect(() => {
    const now = Date.now()/1000;
    setMaxTs(now); setEndTs(now);
    setMinTs(now - 3600); setStartTs(now - 600);
  }, []);

  const doReplay = async () => {
    if (startTs >= endTs) { setStatus('Start must be before end'); return; }
    setLoading(true); setStatus('');
    try {
      const { events } = await api.replayEvents(startTs, endTs);
      if (!events.length) { setStatus('No events in range'); setLoading(false); return; }
      setStatus(`Replaying ${events.length} events at ${speed}x...`);
      onClear();
      const wsEvents: WsEvent[] = events.map((e: EventRecord) => ({
        type: e.event_type as WsEvent['type'],
        data: e.payload,
        timestamp: e.timestamp,
      }));
      // Feed events with delay based on original timing + speed
      const tStart = wsEvents[0].timestamp;
      wsEvents.forEach((ev, i) => {
        const delay = ((ev.timestamp - tStart) / speed) * 1000;
        setTimeout(() => {
          onReplay([ev]);
          if (i === wsEvents.length-1) {
            setStatus(`Replay complete: ${wsEvents.length} events`);
            setLoading(false);
          }
        }, delay);
      });
    } catch(e) {
      setStatus('Error: ' + String(e));
      setLoading(false);
    }
  };

  const fmt = (ts: number) => new Date(ts*1000).toLocaleTimeString('en',{hour12:false});

  return (
    <div className="card p-6 rounded-xl space-y-4">
      <div className="mono text-xs" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>SESSION REPLAY</div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div style={{color:'#9CA3AF', fontSize:11, marginBottom:6}}>Start</div>
          <input type="range" min={minTs} max={maxTs} step={60} value={startTs}
            onChange={e => setStartTs(Number(e.target.value))}
            style={{width:'100%', accentColor:'#2DD4BF'}} />
          <div className="mono text-xs mt-1" style={{color:'#2DD4BF'}}>{fmt(startTs)}</div>
        </div>
        <div>
          <div style={{color:'#9CA3AF', fontSize:11, marginBottom:6}}>End</div>
          <input type="range" min={minTs} max={maxTs} step={60} value={endTs}
            onChange={e => setEndTs(Number(e.target.value))}
            style={{width:'100%', accentColor:'#2DD4BF'}} />
          <div className="mono text-xs mt-1" style={{color:'#2DD4BF'}}>{fmt(endTs)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span style={{color:'#9CA3AF', fontSize:12}}>Speed</span>
        {[0.5,1,2,4].map(s => (
          <button key={s} onClick={() => setSpeed(s)} style={{
            padding:'4px 10px', borderRadius:6, cursor:'pointer',
            fontFamily:'Space Mono,monospace', fontSize:11,
            background: speed===s ? '#2DD4BF' : 'transparent',
            border: `1px solid ${speed===s ? '#2DD4BF' : 'rgba(45,212,191,0.3)'}`,
            color: speed===s ? '#0A0F1A' : '#2DD4BF',
          }}>{s}x</button>
        ))}
      </div>

      <div className="flex gap-3">
        <button className="btn-primary" style={{flex:1}} onClick={doReplay} disabled={loading}>
          {loading ? 'REPLAYING...' : '⏪ REPLAY EVENTS'}
        </button>
        <button onClick={() => { onClear(); setStatus(''); }} style={{
          padding:'10px 16px', borderRadius:6, cursor:'pointer',
          fontFamily:'Space Mono,monospace', fontSize:11,
          background:'transparent', border:'1px solid rgba(156,163,175,0.3)', color:'#9CA3AF',
        }}>CLEAR</button>
      </div>

      {status && (
        <div className="mono text-xs p-2 rounded" style={{
          background:'rgba(45,212,191,0.05)', border:'1px solid rgba(45,212,191,0.15)', color:'#2DD4BF',
        }}>{status}</div>
      )}
    </div>
  );
}
