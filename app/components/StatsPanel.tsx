'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import type { SummaryStats } from '../lib/types';

interface StatCardProps { label: string; value: string|number; color: string; suffix?: string; }
function StatCard({ label, value, color, suffix='' }: StatCardProps) {
  return (
    <div className="card p-5 rounded-xl">
      <div className="mono text-xs mb-2" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>{label}</div>
      <div className="font-display font-bold" style={{fontSize:'2.2rem', color, lineHeight:1}}>
        {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState<SummaryStats|null>(null);
  const [history, setHistory] = useState<{t:string; det:number; mit:number}[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const s = await api.summaryStats();
        setStats(s);
        setHistory(prev => {
          const now = new Date().toLocaleTimeString('en',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
          const next = [...prev, { t: now, det: s.avg_detection_latency_ms, mit: s.avg_mitigation_latency_ms }];
          return next.slice(-20);
        });
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 4000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return (
    <div className="flex items-center justify-center h-48" style={{color:'#9CA3AF'}}>
      <div className="mono text-sm">Loading statistics...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ATTACKS DETECTED"  value={stats.total_attacks_detected}  color="#F97316" />
        <StatCard label="ATTACKS MITIGATED" value={stats.total_attacks_mitigated} color="#10B981" />
        <StatCard label="SUCCESS RATE"      value={stats.success_rate} suffix="%" color="#2DD4BF" />
        <StatCard label="TOTAL EVENTS"      value={stats.total_events}            color="#3B82F6" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="AVG DETECTION MS"  value={stats.avg_detection_latency_ms}  suffix="ms" color="#2DD4BF" />
        <StatCard label="AVG MITIGATION MS" value={stats.avg_mitigation_latency_ms} suffix="ms" color="#10B981" />
        <StatCard label="TOTAL TRANSACTIONS" value={stats.total_transactions}        color="#9CA3AF" />
      </div>

      {history.length > 2 && (
        <div className="card p-5 rounded-xl">
          <div className="mono text-xs mb-4" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>LATENCY OVER TIME (ms)</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={history} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,65,81,0.4)" />
              <XAxis dataKey="t" stroke="#4B5563" tick={{fontSize:9,fontFamily:'Space Mono,monospace'}} />
              <YAxis stroke="#4B5563" tick={{fontSize:9,fontFamily:'Space Mono,monospace'}} />
              <Tooltip
                contentStyle={{background:'#111827',border:'1px solid rgba(45,212,191,0.2)',borderRadius:8,fontFamily:'Space Mono,monospace',fontSize:11}}
                labelStyle={{color:'#9CA3AF'}} />
              <Line type="monotone" dataKey="det" stroke="#2DD4BF" strokeWidth={2} dot={false} name="Detection ms" />
              <Line type="monotone" dataKey="mit" stroke="#10B981" strokeWidth={2} dot={false} name="Mitigation ms" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
