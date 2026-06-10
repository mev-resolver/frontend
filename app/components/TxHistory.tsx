'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { TxRecord } from '../lib/types';

export default function TxHistory() {
  const [txs, setTxs] = useState<TxRecord[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try { const r = await api.txHistory(30); setTxs(r.transactions); } catch {}
    };
    fetch();
    const id = setInterval(fetch, 4000);
    return () => clearInterval(id);
  }, []);

  const statusColor = (s: string) =>
    s==='confirmed' ? '#10B981' : s==='failed' ? '#EF4444' : s==='submitted' ? '#F97316' : '#9CA3AF';

  return (
    <div className="card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3"
        style={{borderBottom:'1px solid rgba(45,212,191,0.1)'}}>
        <span className="mono text-xs" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>TRANSACTION HISTORY</span>
        <span className="mono text-xs" style={{color:'#2DD4BF'}}>{txs.length} records</span>
      </div>
      <div style={{maxHeight:400, overflowY:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Space Mono,monospace', fontSize:11}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(55,65,81,0.6)'}}>
              {['TX HASH','PAIR','AMOUNT','GAS','STATUS','ATTACK','TIME'].map(h => (
                <th key={h} style={{padding:'8px 12px', textAlign:'left', color:'#6B7280', fontSize:10, letterSpacing:'0.08em', fontWeight:400}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txs.map((tx, i) => (
              <tr key={tx.tx_hash} style={{borderBottom:'1px solid rgba(55,65,81,0.3)', background: i%2===0 ? 'transparent' : 'rgba(17,24,39,0.3)'}}>
                <td style={{padding:'8px 12px'}}>
                  <a href={tx.etherscan_url} target="_blank" rel="noreferrer" style={{color:'#3B82F6', textDecoration:'none'}}>
                    {tx.tx_hash.slice(0,8)}...{tx.tx_hash.slice(-6)}
                  </a>
                </td>
                <td style={{padding:'8px 12px', color:'#9CA3AF'}}>{tx.token_in}-{tx.token_out}</td>
                <td style={{padding:'8px 12px', color:'#F3F4F6'}}>{tx.amount_in?.toFixed(2)}</td>
                <td style={{padding:'8px 12px', color:'#9CA3AF'}}>{tx.gas_price ? Math.round(tx.gas_price/1e9)+'g' : '-'}</td>
                <td style={{padding:'8px 12px'}}>
                  <span style={{color: statusColor(tx.status), fontSize:10}}>{tx.status.toUpperCase()}</span>
                </td>
                <td style={{padding:'8px 12px'}}>
                  {tx.attack_id
                    ? <span style={{color:'#EF4444', fontSize:10}}>SANDWICH</span>
                    : <span style={{color:'#10B981', fontSize:10}}>CLEAN</span>}
                </td>
                <td style={{padding:'8px 12px', color:'#6B7280'}}>
                  {new Date(tx.created_at*1000).toLocaleTimeString('en',{hour12:false})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {txs.length===0 && (
          <div className="flex items-center justify-center py-12" style={{color:'#6B7280'}}>
            <span className="mono text-xs">Waiting for transactions...</span>
          </div>
        )}
      </div>
    </div>
  );
}
