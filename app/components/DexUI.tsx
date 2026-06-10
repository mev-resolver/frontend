'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { PriceData } from '../lib/types';

export default function DexUI() {
  const [tokenIn,  setTokenIn]  = useState('RES');
  const [tokenOut, setTokenOut] = useState('OLV');
  const [amountIn, setAmountIn] = useState('100');
  const [amountOut, setAmountOut] = useState('');
  const [price, setPrice] = useState<PriceData|null>(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<string>('');

  useEffect(() => {
    const fetchPrice = async () => {
      try { const p = await api.price(tokenIn, tokenOut); setPrice(p); } catch {}
    };
    fetchPrice();
    const id = setInterval(fetchPrice, 5000);
    return () => clearInterval(id);
  }, [tokenIn, tokenOut]);

  useEffect(() => {
    if (!price || !amountIn) { setAmountOut(''); return; }
    const ain = parseFloat(amountIn) || 0;
    const rIn  = tokenIn==='RES' ? price.res_reserve : price.olv_reserve;
    const rOut = tokenIn==='RES' ? price.olv_reserve : price.res_reserve;
    const out  = ain * rOut / (rIn + ain) * 0.997;
    setAmountOut(out.toFixed(4));
  }, [amountIn, price, tokenIn]);

  const flip = () => {
    setTokenIn(tokenOut); setTokenOut(tokenIn);
    setAmountIn(amountOut || '0'); setAmountOut('');
  };

  const doSwap = async () => {
    const ain = parseFloat(amountIn);
    if (!ain || ain<=0) return;
    setLoading(true); setResult('');
    try {
      const r = await api.swap({ token_in:tokenIn, token_out:tokenOut, amount_in:ain }) as Record<string,unknown>;
      setResult(`Tx: ${(r.tx_hash as string).slice(0,18)}... Out: ${r.amount_out} ${tokenOut}`);
    } catch (e) { setResult('Error: ' + String(e)); }
    finally { setLoading(false); }
  };

  const pairColor = { RES:'#2DD4BF', OLV:'#3B82F6' } as Record<string,string>;

  return (
    <div className="card p-6 rounded-xl">
      <div className="mono text-xs mb-5" style={{color:'#9CA3AF', letterSpacing:'0.1em'}}>DEX SWAP / RES-OLV</div>

      {/* MEV protection notice */}
      <div className="flex items-center gap-2 mb-5 p-3 rounded-xl" style={{background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)'}}>
        <span style={{fontSize:14}}>🛡</span>
        <span style={{color:'#10B981', fontSize:12}}>Resolver MEV protection active</span>
      </div>

      {/* From */}
      <div className="p-4 rounded-xl mb-1" style={{background:'rgba(31,41,55,0.6)', border:'1px solid #1F2937'}}>
        <div className="flex justify-between mb-2">
          <span style={{color:'#9CA3AF', fontSize:11}}>From</span>
          <span style={{color:'#9CA3AF', fontSize:11, fontFamily:'Space Mono,monospace'}}>Balance: 250.00</span>
        </div>
        <div className="flex items-center gap-3">
          <input type="number" value={amountIn} onChange={e => setAmountIn(e.target.value)}
            placeholder="0.00" style={{flex:1, background:'transparent', border:'none', outline:'none',
              color:'#F3F4F6', fontSize:'1.8rem', fontWeight:600, width:'100%'}} />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{
            background:`rgba(${tokenIn==='RES'?'45,212,191':'59,130,246'},0.1)`,
            border:`1px solid rgba(${tokenIn==='RES'?'45,212,191':'59,130,246'},0.3)`,
            color: pairColor[tokenIn], fontSize:13, fontFamily:'Space Mono,monospace', whiteSpace:'nowrap',
          }}>
            <span style={{width:20, height:20, borderRadius:'50%', background: tokenIn==='RES'?'#2DD4BF':'#3B82F6',
              display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#0A0F1A', fontSize:10, fontWeight:700}}>
              {tokenIn[0]}
            </span>
            {tokenIn}
          </div>
        </div>
      </div>

      {/* Flip */}
      <div className="flex justify-center my-1">
        <button onClick={flip} title="Flip" style={{width:40,height:40,borderRadius:'50%',
          background:'#111827', border:'2px solid #1F2937', cursor:'pointer', color:'#9CA3AF',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
          transition:'all 0.2s'}}
          onMouseEnter={e => (e.currentTarget.style.borderColor='#2DD4BF')}
          onMouseLeave={e => (e.currentTarget.style.borderColor='#1F2937')}>
          ↕
        </button>
      </div>

      {/* To */}
      <div className="p-4 rounded-xl mb-5" style={{background:'rgba(31,41,55,0.3)', border:'1px solid #1F2937'}}>
        <div className="flex justify-between mb-2">
          <span style={{color:'#9CA3AF', fontSize:11}}>To (estimated)</span>
        </div>
        <div className="flex items-center gap-3">
          <div style={{flex:1, fontSize:'1.8rem', fontWeight:600, color: amountOut ? '#F3F4F6' : '#4B5563'}}>
            {amountOut || '0.0000'}
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{
            background:`rgba(${tokenOut==='RES'?'45,212,191':'59,130,246'},0.1)`,
            border:`1px solid rgba(${tokenOut==='RES'?'45,212,191':'59,130,246'},0.3)`,
            color: pairColor[tokenOut], fontSize:13, fontFamily:'Space Mono,monospace', whiteSpace:'nowrap',
          }}>
            <span style={{width:20, height:20, borderRadius:'50%', background: tokenOut==='RES'?'#2DD4BF':'#3B82F6',
              display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#0A0F1A', fontSize:10, fontWeight:700}}>
              {tokenOut[0]}
            </span>
            {tokenOut}
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-2 mb-5">
        {[
          ['Rate', price ? `1 ${tokenIn} = ${price.price.toFixed(4)} ${tokenOut}` : '-'],
          ['TVL',  price ? `$${price.tvl_usd.toLocaleString()}` : '-'],
          ['Fee',  '0.3%'],
          ['Route', `${tokenIn} → ${tokenOut} (direct)`],
        ].map(([k,v]) => (
          <div key={k} className="flex justify-between" style={{fontSize:12}}>
            <span style={{color:'#9CA3AF'}}>{k}</span>
            <span className="mono" style={{color:'#F3F4F6'}}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={doSwap} disabled={loading || !amountIn} style={{
        width:'100%', background: loading ? 'rgba(45,212,191,0.2)' : 'linear-gradient(135deg,#2DD4BF,#14b8a6)',
        border:'none', borderRadius:12, color:'#0A0F1A', fontFamily:'DM Sans,sans-serif',
        fontWeight:700, fontSize:15, padding:'16px', cursor: loading ? 'not-allowed' : 'pointer',
        transition:'all 0.2s',
      }}>
        {loading ? 'Routing via Resolver...' : 'Swap via Resolver'}
      </button>

      {result && (
        <div className="mt-3 mono text-xs p-3 rounded-lg" style={{background:'rgba(45,212,191,0.05)', border:'1px solid rgba(45,212,191,0.2)', color:'#2DD4BF', wordBreak:'break-all'}}>
          {result}
        </div>
      )}
      <div className="mono text-xs text-center mt-3" style={{color:'#6B7280'}}>
        Protected via Resolver relay · Sepolia testnet
      </div>
    </div>
  );
}
