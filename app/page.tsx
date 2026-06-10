'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from './lib/api';
import type { SummaryStats } from './lib/types';

function SonarRing({ size, delay }: { size: number; delay: number }) {
  return (
    <div className="absolute top-1/2 left-1/2 rounded-full border" style={{
      width: size, height: size,
      marginLeft: -size/2, marginTop: -size/2,
      borderColor: 'rgba(45,212,191,0.07)',
      animation: `sonar ${5 + delay}s ease-out ${delay}s infinite`,
    }} />
  );
}

function AnimatedCounter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || to === 0) return;
    done.current = true;
    const dur = 1600, t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) requestAnimationFrame(tick); else setVal(to);
    };
    requestAnimationFrame(tick);
  }, [to]);
  return <>{val.toLocaleString()}{suffix}</>;
}

export default function Home() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<{text:string;color:string}[]>([]);
  const WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000/ws';

  useEffect(() => {
    const load = async () => {
      try {
        const h = await api.health();
        setConfigured(h.live_mode ?? false);
        const s = await api.summaryStats();
        setStats(s);
      } catch { setConfigured(false); }
    };
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => ws!.send(JSON.stringify({ type: 'subscribe', streams: ['all'] }));
        ws.onmessage = (e) => {
          try {
            const ev = JSON.parse(e.data);
            const ts = new Date().toLocaleTimeString('en', { hour12: false });
            if (ev.type === 'transaction_arrived') {
              const d = ev.data;
              setConsoleLogs(p => [...p.slice(-18), {
                text: `[${ts}] tx_arrived ${String(d.tx_hash).slice(0,14)}... ${d.token_in}->${d.token_out} ${d.amount_in}`,
                color: d.is_bot ? '#F97316' : '#2DD4BF',
              }]);
            } else if (ev.type === 'attack_detected') {
              setConsoleLogs(p => [...p.slice(-18), {
                text: `[${ts}] ATTACK_DETECTED ${ev.data.attack_id} conf:${ev.data.confidence}`,
                color: '#EF4444',
              }]);
            } else if (ev.type === 'mitigation_applied') {
              setConsoleLogs(p => [...p.slice(-18), {
                text: `[${ts}] MITIGATED ${ev.data.bundle_id} -> protected lane via Flashbots`,
                color: '#10B981',
              }]);
            } else if (ev.type === 'settlement_confirmed') {
              setConsoleLogs(p => [...p.slice(-18), {
                text: `[${ts}] SETTLED ${ev.data.bundle_id} status:${ev.data.status}`,
                color: '#3B82F6',
              }]);
            }
          } catch {}
        };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch { setTimeout(connect, 3000); }
    };
    connect();
    return () => ws?.close();
  }, [WS_URL]);

  const statItems = [
    { label: 'ATTACKS DETECTED',  value: stats?.total_attacks_detected  ?? 0, color: '#F97316' },
    { label: 'SUCCESS RATE',      value: stats?.success_rate             ?? 0, suffix: '%', color: '#10B981' },
    { label: 'AVG LATENCY',       value: stats?.avg_detection_latency_ms ?? 0, suffix: 'ms', color: '#2DD4BF' },
    { label: 'TRANSACTIONS',      value: stats?.total_transactions        ?? 0, color: '#3B82F6' },
  ];

  return (
    <main style={{ background: '#0A0F1A', minHeight: '100vh', overflow: 'hidden' }}>
      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 56,
        background: 'rgba(10,15,26,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(45,212,191,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '1px solid #2DD4BF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 13, letterSpacing: '0.1em', color: '#F3F4F6' }}>
            RESOLVER
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {configured !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              border: `1px solid ${configured ? 'rgba(16,185,129,0.4)' : 'rgba(249,115,22,0.4)'}`,
              background: configured ? 'rgba(16,185,129,0.08)' : 'rgba(249,115,22,0.08)',
              fontFamily: 'Space Mono,monospace', fontSize: 10,
              color: configured ? '#10B981' : '#F97316',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: configured ? '#10B981' : '#F97316',
                boxShadow: `0 0 6px ${configured ? '#10B981' : '#F97316'}`,
              }} />
              {configured ? 'SEPOLIA LIVE' : 'CONFIGURE .ENV'}
            </div>
          )}
          <Link href="/dashboard">
            <button style={{
              background: 'transparent', border: '1px solid #2DD4BF',
              color: '#2DD4BF', fontFamily: 'Space Mono,monospace',
              fontSize: 11, letterSpacing: '0.08em', padding: '8px 20px',
              borderRadius: 6, cursor: 'pointer',
            }}>
              LAUNCH CONSOLE
            </button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        position: 'relative', minHeight: '78vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '60px 24px 40px',
        overflow: 'hidden',
      }}>
        {/* Sonar rings */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[200, 400, 600, 850].map((s, i) => <SonarRing key={i} size={s} delay={i * 1.5} />)}
        </div>

        {/* Floating nodes */}
        {[
          { top:'20%', left:'12%', color:'#2DD4BF', delay:0 },
          { top:'30%', left:'82%', color:'#F97316', delay:1.5 },
          { top:'65%', left:'8%',  color:'#10B981', delay:3 },
          { top:'72%', left:'88%', color:'#2DD4BF', delay:2 },
          { top:'18%', left:'58%', color:'#EF4444', delay:4 },
        ].map((n, i) => (
          <div key={i} style={{
            position: 'absolute', top: n.top, left: n.left,
            width: 9, height: 9, borderRadius: '50%',
            background: n.color, boxShadow: `0 0 8px ${n.color}`,
            animation: `floatNode 8s ease-in-out ${n.delay}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}

        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'Space Mono,monospace', fontSize: 11, color: '#2DD4BF',
            letterSpacing: '0.15em', marginBottom: 28,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            LIVE ON SEPOLIA TESTNET
          </div>

          <h1 style={{
            fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: 'clamp(3.5rem,10vw,8rem)', lineHeight: 1,
            color: '#F3F4F6', margin: '0 0 12px', letterSpacing: '-0.02em',
          }}>
            RESOLVER
          </h1>

          <div style={{
            fontFamily: 'Space Mono,monospace',
            fontSize: 'clamp(0.75rem,1.5vw,1.05rem)',
            letterSpacing: '0.28em', color: '#2DD4BF', marginBottom: 20,
          }}>
            DETECT &nbsp;·&nbsp; RESOLVE &nbsp;·&nbsp; PROTECT
          </div>

          <p style={{
            maxWidth: 520, fontSize: '1rem', lineHeight: 1.8,
            color: '#9CA3AF', marginBottom: 36,
          }}>
            Real sandwich attack detection and mitigation on Ethereum Sepolia.
            Live Flashbots relay. Replayable analytics. No shortcuts.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
            <Link href="/dashboard">
              <button style={{
                background: 'transparent', border: '1px solid #2DD4BF',
                color: '#2DD4BF', fontFamily: 'Space Mono,monospace',
                fontSize: 12, letterSpacing: '0.08em', padding: '13px 30px',
                borderRadius: 6, cursor: 'pointer',
              }}>
                LAUNCH CONSOLE
              </button>
            </Link>
            <a href="https://github.com/resolver-protocol" target="_blank" rel="noreferrer">
              <button style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: '#9CA3AF', fontFamily: 'Space Mono,monospace',
                fontSize: 12, letterSpacing: '0.08em', padding: '13px 30px',
                borderRadius: 6, cursor: 'pointer',
              }}>
                VIEW SOURCE
              </button>
            </a>
          </div>

          {/* Live console */}
          <div style={{ width: '100%', maxWidth: 680 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 4 }}>
              {['#EF4444','#F97316','#10B981'].map((c,i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, color: '#6B7280', marginLeft: 8, letterSpacing: '0.06em' }}>
                RESOLVER CONSOLE - LIVE FEED
              </span>
            </div>
            <div style={{
              background: 'rgba(10,15,26,0.96)', border: '1px solid rgba(45,212,191,0.2)',
              borderRadius: 12, padding: '18px 20px', height: 250,
              overflowY: 'hidden', fontFamily: 'Space Mono,monospace', fontSize: 11,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
              {consoleLogs.length === 0 && (
                <div style={{ color: '#4B5563' }}>
                  Connecting to Sepolia... waiting for events
                  <span className="blink" style={{ color: '#2DD4BF' }}>_</span>
                </div>
              )}
              {consoleLogs.map((l, i) => (
                <div key={i} style={{ color: l.color, padding: '1px 0', lineHeight: 1.6 }}>{l.text}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '40px 32px', borderTop: '1px solid rgba(45,212,191,0.08)', borderBottom: '1px solid rgba(45,212,191,0.08)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, textAlign: 'center' }}>
          {statItems.map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '2.4rem', color: s.color }}>
                <AnimatedCounter to={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 9, letterSpacing: '0.12em', color: '#9CA3AF', marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, color: '#2DD4BF', letterSpacing: '0.15em', marginBottom: 12 }}>01 / MECHANISM</div>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 'clamp(2rem,5vw,3rem)', lineHeight: 1.1 }}>
            See the attack. <span style={{ color: '#2DD4BF' }}>Watch it fall.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {[
            { phase:'01', title:'The Attack', icon:'⚡', color:'#EF4444',
              desc:'Bot front-runs with high-gas buy, sandwiches your transaction, back-runs with low-gas sell. Extracts value in milliseconds.',
              code:'bot_buy -> victim_swap -> bot_sell' },
            { phase:'02', title:'Detection', icon:'◎', color:'#2DD4BF',
              desc:'Resolver watches the Sepolia mempool. Sliding-window pattern match fires on gas-price ordering and same-pair pattern.',
              code:'confidence: 1.00  latency: <200ms' },
            { phase:'03', title:'Mitigation', icon:'🛡', color:'#10B981',
              desc:'Victim transaction rerouted via real Flashbots private relay. Lands in protected bundle, invisible to sandwich bots.',
              code:'flashbots_relay -> protected -> settled' },
          ].map((c, i) => {
            const rgb = c.color === '#EF4444' ? '239,68,68' : c.color === '#2DD4BF' ? '45,212,191' : '16,185,129';
            return (
              <div key={i} style={{
                background: 'rgba(17,24,39,0.85)', border: `1px solid rgba(${rgb},0.2)`,
                borderRadius: 12, padding: '28px 24px',
              }}>
                <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, color: c.color, marginBottom: 8 }}>PHASE {c.phase}</div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '1.15rem', marginBottom: 12 }}>{c.icon} {c.title}</div>
                <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.75, marginBottom: 14 }}>{c.desc}</p>
                <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, padding: '10px 12px',
                  background: `rgba(${rgb},0.06)`, borderLeft: `2px solid ${c.color}`, borderRadius: 4, color: c.color }}>
                  {c.code}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer style={{ padding: '32px', textAlign: 'center', borderTop: '1px solid rgba(45,212,191,0.08)' }}>
        <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, color: '#4B5563' }}>
          RESOLVER v1.0  MIT LICENSE  SEPOLIA TESTNET  ACADEMIC RESEARCH
        </div>
      </footer>

      <style>{`
        @keyframes sonar {
          0%   { opacity:0.5; transform:translate(-50%,-50%) scale(0.95); }
          70%  { opacity:0.1; }
          100% { opacity:0; transform:translate(-50%,-50%) scale(1.05); }
        }
        @keyframes floatNode {
          0%,100% { transform:translateY(0); opacity:0.7; }
          50%      { transform:translateY(-18px); opacity:1; }
        }
        @keyframes blink { 50% { opacity:0; } }
        .blink { animation:blink 1.2s step-end infinite; }
      `}</style>
    </main>
  );
}
