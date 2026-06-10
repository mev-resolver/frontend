'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function AttackControls() {
  const [loading,   setLoading]   = useState(false);
  const [autoOn,    setAutoOn]    = useState(false);
  const [interval,  setIntervalV] = useState(10);
  const [lastResult,setLast]      = useState('');
  const [configured,setConfigured]= useState<boolean | null>(null);
  const [missing,   setMissing]   = useState<string[]>([]);

  useEffect(() => {
    api.attackStatus()
      .then(s => {
        setAutoOn(s.auto_running);
        setConfigured(s.configured ?? false);
        setMissing(s.missing_config ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  const manualAttack = async () => {
    setLoading(true); setLast('');
    try {
      const r = await api.manualAttack() as Record<string,unknown>;
      const res = r.result as Record<string,unknown> | undefined;
      if (res) {
        setLast(
          `Submitted: buy=${String(res.buy_tx).slice(0,12)}...` +
          ` victim=${String(res.victim_tx).slice(0,12)}...` +
          ` sell=${String(res.sell_tx).slice(0,12)}...` +
          ` det=${res.detection_ms}ms`
        );
      }
    } catch (e: unknown) {
      const msg = (e as {message?:string}).message || String(e);
      if (msg.includes('503') || msg.includes('missing')) {
        setLast('ERROR: Blockchain not configured. Fill .env and restart.');
      } else {
        setLast('ERROR: ' + msg);
      }
    } finally { setLoading(false); }
  };

  const toggleAuto = async () => {
    try {
      const next = !autoOn;
      await api.autoAttack(next, interval);
      setAutoOn(next);
    } catch (e: unknown) {
      setLast('ERROR: ' + String(e));
    }
  };

  return (
    <div className="card p-6 rounded-xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="mono text-xs" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>
          ATTACK SIMULATOR
        </div>
        {configured !== null && (
          <span className="mono text-xs px-2 py-1 rounded" style={{
            background: configured ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${configured ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            color: configured ? '#10B981' : '#EF4444',
          }}>
            {configured ? 'SEPOLIA LIVE' : 'NOT CONFIGURED'}
          </span>
        )}
      </div>

      {!configured && missing.length > 0 && (
        <div className="p-4 rounded-xl" style={{
          background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)'
        }}>
          <div className="mono text-xs mb-2" style={{color:'#EF4444'}}>MISSING CONFIGURATION</div>
          {missing.map(k => (
            <div key={k} className="mono text-xs" style={{color:'#FCA5A5'}}>- {k}</div>
          ))}
          <div className="mt-2 text-xs" style={{color:'#9CA3AF', lineHeight:1.7}}>
            Add these to your <code style={{color:'#2DD4BF'}}>.env</code> file and restart.
            See <code style={{color:'#2DD4BF'}}>guide.md</code> for setup instructions.
          </div>
        </div>
      )}

      {configured && (
        <div className="p-4 rounded-xl" style={{
          background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)'
        }}>
          <p className="text-xs" style={{color:'#9CA3AF', lineHeight:1.75}}>
            Submits real Sepolia transactions: bot front-run buy, victim swap (held for Flashbots),
            bot back-run sell. Resolver detects and reroutes the victim via the private relay.
            Costs real testnet gas.
          </p>
        </div>
      )}

      <button
        className="w-full mono text-xs"
        style={{
          padding:'14px', borderRadius:8, cursor: loading || !configured ? 'not-allowed' : 'pointer',
          background:'transparent',
          border:`1px solid ${configured ? '#EF4444' : 'rgba(239,68,68,0.3)'}`,
          color: configured ? '#EF4444' : 'rgba(239,68,68,0.4)',
          letterSpacing:'0.08em', transition:'all 0.2s',
          opacity: !configured ? 0.5 : 1,
        }}
        onClick={manualAttack}
        disabled={loading || !configured}
      >
        {loading ? 'SUBMITTING TO SEPOLIA...' : 'EXECUTE SANDWICH ATTACK'}
      </button>

      {lastResult && (
        <div className="mono text-xs p-3 rounded-lg" style={{
          background: lastResult.startsWith('ERROR')
            ? 'rgba(239,68,68,0.07)' : 'rgba(45,212,191,0.06)',
          border: `1px solid ${lastResult.startsWith('ERROR') ? 'rgba(239,68,68,0.2)' : 'rgba(45,212,191,0.2)'}`,
          color: lastResult.startsWith('ERROR') ? '#FCA5A5' : '#2DD4BF',
          wordBreak:'break-all', lineHeight:1.6,
        }}>
          {lastResult}
        </div>
      )}

      <div style={{borderTop:'1px solid rgba(55,65,81,0.5)', paddingTop:16}}>
        <div className="mono text-xs mb-3" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>AUTO ATTACK LOOP</div>
        <div className="flex items-center gap-3 mb-3">
          <span style={{color:'#9CA3AF', fontSize:12}}>Interval (sec)</span>
          <input type="number" min={5} max={120} value={interval}
            onChange={e => setIntervalV(Number(e.target.value))}
            disabled={!configured}
            style={{
              width:64, background:'#1F2937', border:'1px solid #374151',
              color:'#F3F4F6', borderRadius:6, padding:'4px 8px',
              fontFamily:'Space Mono,monospace', fontSize:12,
            }} />
        </div>
        <button
          onClick={toggleAuto}
          disabled={!configured}
          className="w-full mono text-xs"
          style={{
            padding:'11px', borderRadius:8, letterSpacing:'0.08em',
            cursor: configured ? 'pointer' : 'not-allowed',
            background: autoOn ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.08)',
            border: `1px solid ${autoOn ? 'rgba(16,185,129,0.4)' : 'rgba(249,115,22,0.35)'}`,
            color: autoOn ? '#10B981' : '#F97316',
            opacity: !configured ? 0.4 : 1,
          }}>
          {autoOn ? 'STOP AUTO ATTACK' : 'START AUTO ATTACK'}
        </button>
      </div>
    </div>
  );
}
