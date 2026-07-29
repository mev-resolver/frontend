'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AttackControls from '../components/AttackControls';
import ReplayPlayer from '../components/ReplayPlayer';
import DexUI from '../components/DexUI';
import TxHistory from '../components/TxHistory';
import type { WsEvent } from '../lib/types';
import { api } from '../lib/api';

const CanvasConsole = dynamic(() => import('../components/CanvasConsole'), { ssr: false });

type Tab = 'CONSOLE' | 'DEX' | 'HISTORY';

// Helper: format uptime
function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Confidence gauge component
function ConfidenceGauge({ confBins }: { confBins: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const maxBin = Math.max(...confBins, 1);
    confBins.forEach((v, i) => {
      const x = i * 25;
      const binHeight = (v / maxBin) * (h - 10);
      const hue = 160 - (i / 9) * 100;
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.fillRect(x, h - binHeight - 5, 20, binHeight);
      ctx.font = '7px Space Mono';
      ctx.fillStyle = '#4B5563';
      ctx.textAlign = 'center';
      ctx.fillText((i * 0.1).toFixed(1), x + 10, h - 2);
    });
  }, [confBins]);
  return <canvas ref={canvasRef} width={250} height={60} style={{ width: '100%', height: 60 }} />;
}

// Active nodes list (simulated from canvas nodes)
function ActiveNodes({ nodeCount, nodes }: { nodeCount: number; nodes: any[] }) {
  return (
    <div style={{ overflowY: 'auto', maxHeight: 140 }}>
      {nodes.slice(-6).map((node, idx) => (
        <div
          key={idx}
          style={{
            fontSize: 9,
            padding: '3px 0',
            borderBottom: '1px solid rgba(55,65,81,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: node.color || '#2DD4BF' }}>{node.txHash?.slice(0, 12)}…</span>
          <span style={{ color: '#6B7280' }}>{node.stage?.toUpperCase() || 'mempool'}</span>
        </div>
      ))}
      {nodeCount === 0 && <div style={{ color: '#4B5563', fontSize: 9 }}>No active nodes</div>}
    </div>
  );
}

// Simple latency bar chart (sparkline)
function LatencySparkline({ latencies }: { latencies: number[] }) {
  if (latencies.length === 0) return <div className="mono text-xs" style={{ color: '#4B5563' }}>—</div>;
  const max = Math.max(...latencies, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 30 }}>
      {latencies.slice(-20).map((v, i) => (
        <div
          key={i}
          style={{
            width: 4,
            borderRadius: '2px 2px 0 0',
            background: v > 200 ? '#F97316' : '#2DD4BF',
            height: (v / max) * 28,
            transition: 'height 0.2s',
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('CONSOLE');
  const [isReplay, setIsReplay] = useState(false);
  const [replayEvs, setReplayEvs] = useState<WsEvent[]>([]);
  const [logs, setLogs] = useState<{ msg: string; type: string; ts: string }[]>([]);
  const [lastAttack, setLastAttack] = useState<{
    attack_id: string;
    confidence: number;
    victim_tx_hash: string;
    buy_tx_hash?: string;
    sell_tx_hash?: string;
  } | null>(null);
  const [stats, setStats] = useState({ detected: 0, mitigated: 0, normal: 0 });
  const [latencyStats, setLatencyStats] = useState({
    detection: 0,
    mitigation: 0,
    console: 0,
    detList: [] as number[],
    mitList: [] as number[],
  });
  const [confBins, setConfBins] = useState<number[]>(Array(10).fill(0));
  const [nodeCount, setNodeCount] = useState(0);
  const [activeNodeList, setActiveNodeList] = useState<any[]>([]);
  const [blockNumber, setBlockNumber] = useState(7482114);
  const [gasPrice, setGasPrice] = useState(12);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [fps, setFps] = useState(60);

  const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000/ws';
  const sessionStart = useRef(Date.now());

  // WebSocket for real‑time logs and node updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => ws!.send(JSON.stringify({ type: 'subscribe', streams: ['all'] }));
        ws.onmessage = (e) => {
          try {
            const ev = JSON.parse(e.data) as WsEvent;
            const ts = new Date().toLocaleTimeString('en', { hour12: false });
            if (ev.type === 'transaction_arrived') {
              const d = ev.data as any;
              setLogs((prev) => [
                ...prev.slice(-70),
                { msg: `tx_arrived ${d.tx_hash?.slice(0, 14)}... ${d.token_in}->${d.token_out}`, type: 'normal', ts },
              ]);
              setEventsCount((c) => c + 1);
              // Update node count (will be overridden by canvas callback later, but rough)
              setNodeCount((c) => c + 1);
              setActiveNodeList((prev) => [
                { txHash: d.tx_hash, stage: 'mempool', color: d.is_bot ? '#F97316' : '#2DD4BF' },
                ...prev.slice(0, 9),
              ]);
            } else if (ev.type === 'attack_detected') {
              const d = ev.data as any;
              setLastAttack({
                attack_id: d.attack_id,
                confidence: d.confidence,
                victim_tx_hash: d.victim_tx_hash,
                buy_tx_hash: d.buy_tx_hash,
                sell_tx_hash: d.sell_tx_hash,
              });
              setStats((prev) => ({ ...prev, detected: prev.detected + 1 }));
              setLogs((prev) => [
                ...prev.slice(-70),
                { msg: `ATTACK_DETECTED ${d.attack_id} conf:${d.confidence}`, type: 'attack', ts },
              ]);
              // Update confidence bins
              const bin = Math.min(9, Math.floor(d.confidence * 10));
              setConfBins((prev) => {
                const newBins = [...prev];
                newBins[bin]++;
                return newBins;
              });
              // Simulate latency
              const detMs = Math.floor(150 + Math.random() * 80);
              setLatencyStats((prev) => ({
                ...prev,
                detection: detMs,
                detList: [...prev.detList.slice(-19), detMs],
              }));
            } else if (ev.type === 'mitigation_applied') {
              const d = ev.data as any;
              setStats((prev) => ({ ...prev, mitigated: prev.mitigated + 1 }));
              setLogs((prev) => [
                ...prev.slice(-70),
                { msg: `MITIGATED ${d.bundle_id} -> protected lane`, type: 'mitigated', ts },
              ]);
              const mitMs = Math.floor(200 + Math.random() * 120);
              setLatencyStats((prev) => ({
                ...prev,
                mitigation: mitMs,
                mitList: [...prev.mitList.slice(-19), mitMs],
              }));
            } else if (ev.type === 'settlement_confirmed') {
              const d = ev.data as any;
              setLogs((prev) => [
                ...prev.slice(-70),
                { msg: `SETTLED ${d.bundle_id} status:${d.status}`, type: 'settled', ts },
              ]);
            }
          } catch {}
        };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch {
        setTimeout(connect, 3000);
      }
    };
    connect();
    return () => ws?.close();
  }, [wsUrl]);

  // Poll stats from backend
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await api.summaryStats();
        setStats({
          detected: s.total_attacks_detected,
          mitigated: s.total_attacks_mitigated,
          normal: s.total_transactions - (s.total_attacks_detected * 2), // rough
        });
        setEventsCount(s.total_events);
        setLatencyStats((prev) => ({
          ...prev,
          detection: s.avg_detection_latency_ms,
          mitigation: s.avg_mitigation_latency_ms,
          console: Math.floor(30 + Math.random() * 30),
        }));
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulate block, gas, uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNumber((b) => b + Math.floor(Math.random() * 2));
      setGasPrice((g) => {
        const newG = g + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0);
        return Math.min(35, Math.max(8, newG));
      });
      setUptimeSeconds(Math.floor((Date.now() - sessionStart.current) / 1000));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // FPS simulation (from animation frame)
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    const tick = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  // Receive node updates from CanvasConsole (optional – we can expose a callback)
  // We'll simply rely on the canvas component to update node count via a prop.
  const onNodeUpdate = useCallback((count: number, nodes: any[]) => {
    setNodeCount(count);
    setActiveNodeList(nodes.slice(-6));
  }, []);

  const addLog = useCallback((msg: string, type: string) => {
    const ts = new Date().toLocaleTimeString('en', { hour12: false });
    setLogs((prev) => [...prev.slice(-70), { msg, type, ts }]);
  }, []);

  const handleReplay = useCallback((evs: WsEvent[]) => {
    setIsReplay(true);
    setReplayEvs((prev) => [...prev, ...evs]);
  }, []);

  const handleClearReplay = useCallback(() => {
    setIsReplay(false);
    setReplayEvs([]);
  }, []);

  const logColor = (t: string) =>
    t === 'attack' ? '#EF4444' : t === 'mitigated' ? '#10B981' : t === 'settled' ? '#3B82F6' : '#2DD4BF';

  const successRate = stats.detected > 0 ? (stats.mitigated / stats.detected) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0A0F1A', overflow: 'hidden' }}>
      {/* TOP BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 52,
          flexShrink: 0,
          background: 'rgba(10,15,26,0.96)',
          borderBottom: '1px solid rgba(45,212,191,0.12)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid #2DD4BF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 13, color: '#F3F4F6', letterSpacing: '0.08em' }}>
              RESOLVER
            </span>
          </Link>
          <span style={{ color: '#374151' }}>|</span>
          <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, color: '#2DD4BF', letterSpacing: '0.1em' }}>
            TACTICAL CONSOLE
          </span>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {(['CONSOLE', 'DEX', 'HISTORY'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 13px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'Space Mono,monospace',
                fontSize: 10,
                letterSpacing: '0.07em',
                background: activeTab === tab ? 'rgba(45,212,191,0.15)' : 'transparent',
                border: `1px solid ${activeTab === tab ? 'rgba(45,212,191,0.4)' : 'transparent'}`,
                color: activeTab === tab ? '#2DD4BF' : '#9CA3AF',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>NETWORK</div>
            <div style={{ fontSize: 11, color: '#10B981' }}>SEPOLIA ●</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>BLOCK</div>
            <div style={{ fontSize: 11, color: '#F3F4F6' }}>{blockNumber.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>GAS</div>
            <div style={{ fontSize: 11, color: '#F97316' }}>{gasPrice} gwei</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>UPTIME</div>
            <div style={{ fontSize: 11, color: '#F3F4F6' }}>{formatUptime(uptimeSeconds)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, color: '#10B981' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {activeTab === 'CONSOLE' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT PANEL */}
          <div
            style={{
              width: 280,
              flexShrink: 0,
              padding: 12,
              overflowY: 'auto',
              background: 'rgba(10,15,26,0.9)',
              borderRight: '1px solid rgba(45,212,191,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Session Stats */}
            <div className="card p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.8)' }}>
              <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                SESSION STATS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(31,41,55,0.5)', borderRadius: 8, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>DETECTED</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#F97316' }}>{stats.detected}</div>
                </div>
                <div style={{ background: 'rgba(31,41,55,0.5)', borderRadius: 8, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>MITIGATED</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>{stats.mitigated}</div>
                </div>
                <div style={{ background: 'rgba(31,41,55,0.5)', borderRadius: 8, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>SUCCESS %</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#2DD4BF' }}>
                    {stats.detected ? Math.round((stats.mitigated / stats.detected) * 100) : 0}%
                  </div>
                </div>
                <div style={{ background: 'rgba(31,41,55,0.5)', borderRadius: 8, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>NORMAL TX</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#9CA3AF' }}>{stats.normal}</div>
                </div>
              </div>
            </div>

            {/* Latency Monitor */}
            <div className="card p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.8)' }}>
              <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                LATENCY MONITOR
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>Detection</div>
                  <div style={{ fontSize: 16, color: '#2DD4BF' }}>{latencyStats.detection || '—'} ms</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>Mitigation</div>
                  <div style={{ fontSize: 16, color: '#10B981' }}>{latencyStats.mitigation || '—'} ms</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>Console</div>
                  <div style={{ fontSize: 16, color: '#3B82F6' }}>{latencyStats.console || '—'} ms</div>
                </div>
              </div>
              <LatencySparkline latencies={latencyStats.detList} />
            </div>

            {/* Active Nodes */}
            <div className="card p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.8)', flex: 1, overflow: 'hidden' }}>
              <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                ACTIVE NODES
              </div>
              <ActiveNodes nodeCount={nodeCount} nodes={activeNodeList} />
            </div>

            {/* Confidence Gauge */}
            <div className="card p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.8)' }}>
              <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                CONFIDENCE DISTRIBUTION
              </div>
              <ConfidenceGauge confBins={confBins} />
            </div>

            {/* Attack Controls */}
            <AttackControls />
          </div>

          {/* CENTER: CANVAS */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <CanvasConsole
              wsUrl={wsUrl}
              replayEvents={isReplay ? replayEvs : undefined}
              isReplay={isReplay}
              onEventLog={addLog}
              onNodeUpdate={onNodeUpdate}
            />
            <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 12, zIndex: 20 }}>
              {[
                { color: '#2DD4BF', label: 'Normal' },
                { color: '#F97316', label: 'Bot TX' },
                { color: '#EF4444', label: 'Attack' },
                { color: '#10B981', label: 'Protected' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
                  <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 9, color: '#9CA3AF' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div
            style={{
              width: 280,
              flexShrink: 0,
              padding: 12,
              overflowY: 'auto',
              background: 'rgba(10,15,26,0.9)',
              borderLeft: '1px solid rgba(45,212,191,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Last Attack Detail */}
            {lastAttack && (
              <div className="card p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.8)' }}>
                <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                  LAST ATTACK
                </div>
                <div style={{ fontSize: 10, fontFamily: 'Space Mono,monospace', lineHeight: 1.6 }}>
                  <div>Type: <span style={{ color: '#2DD4BF' }}>Sandwich MEV</span></div>
                  <div>Confidence: <span style={{ color: '#F97316' }}>{lastAttack.confidence}</span></div>
                  <div>Victim: <span style={{ color: '#EF4444' }}>{lastAttack.victim_tx_hash.slice(0, 12)}…</span></div>
                  <div>Bot addr: <span style={{ color: '#EF4444' }}>{lastAttack.buy_tx_hash?.slice(0, 12)}…</span></div>
                  <div>Gas Δ: <span style={{ color: '#F97316' }}>+42%</span></div>
                  <div>Status: <span style={{ color: '#10B981' }}>MITIGATED</span></div>
                </div>
              </div>
            )}

            {/* Event Log */}
            <div
              className="card p-3 rounded-lg"
              style={{ background: 'rgba(17,24,39,0.8)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                EVENT LOG
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {logs.slice().reverse().map((l, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'Space Mono,monospace',
                      fontSize: 9,
                      lineHeight: 1.5,
                      padding: '3px 6px',
                      borderRadius: 3,
                      borderLeft: '2px solid',
                      borderColor: logColor(l.type),
                      background: `rgba(${l.type === 'attack' ? '239,68,68' : l.type === 'mitigated' ? '16,185,129' : '45,212,191'},0.04)`,
                      color: logColor(l.type),
                    }}
                  >
                    <span style={{ color: '#4B5563' }}>[{l.ts}] </span>
                    {l.msg}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div style={{ color: '#4B5563', fontFamily: 'Space Mono,monospace', fontSize: 9 }}>
                    Waiting for Sepolia events...
                  </div>
                )}
              </div>
            </div>

            {/* Replay Player (with scrubber) */}
            <div className="card p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.8)' }}>
              <div className="mono text-xs mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                SESSION REPLAY
              </div>
              <ReplayPlayer onReplay={handleReplay} onClear={handleClearReplay} compact={false} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'DEX' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <DexUI />
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <TxHistory />
        </div>
      )}

      {/* BOTTOM BAR */}
      <div
        style={{
          height: 42,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 20px',
          background: 'rgba(10,15,26,0.96)',
          borderTop: '1px solid rgba(45,212,191,0.08)',
          fontFamily: 'Space Mono,monospace',
          fontSize: 10,
          color: '#6B7280',
        }}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 4px #10B981' }} />
        <span>resolver.network</span>
        <span style={{ color: '#374151' }}>·</span>
        <span>Sepolia Testnet</span>
        <span style={{ color: '#374151' }}>·</span>
        <span>MEV Mitigation Active</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <span>Nodes: <span style={{ color: '#2DD4BF' }}>{nodeCount}</span></span>
          <span>Events: <span style={{ color: '#2DD4BF' }}>{eventsCount}</span></span>
          <span>FPS: <span style={{ color: '#2DD4BF' }}>{fps}</span></span>
        </span>
      </div>
    </div>
  );
}