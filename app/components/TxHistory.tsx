'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import type { TxRecord } from '../lib/types';

const ITEMS_PER_PAGE = 20;

export default function TxHistory() {
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchTransactions = useCallback(async (pageNum: number, replace = false) => {
    try {
      setLoading(true);
      const limit = ITEMS_PER_PAGE;
      const offset = (pageNum - 1) * limit;
      // Note: the backend API currently only supports limit, not offset.
      // We'll fetch the latest 50 transactions and then paginate client-side.
      // For a real implementation, the backend should support pagination.
      const r = await api.txHistory(100); // fetch up to 100 latest
      const all = r.transactions;
      const start = offset;
      const end = offset + limit;
      const newTxs = all.slice(start, end);
      setHasMore(end < all.length);
      if (replace) {
        setTxs(newTxs);
      } else {
        setTxs(prev => [...prev, ...newTxs]);
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions(1, true);
  }, [fetchTransactions]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage(prev => prev + 1);
          fetchTransactions(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );
    const currentRef = loadMoreRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [hasMore, loading, page, fetchTransactions]);

  const statusColor = (s: string) =>
    s === 'confirmed' ? '#10B981' : s === 'failed' ? '#EF4444' : s === 'submitted' ? '#F97316' : '#9CA3AF';

  return (
    <div className="card rounded-xl overflow-hidden" style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(45,212,191,0.12)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 sticky top-0 z-10"
        style={{
          background: 'rgba(17,24,39,0.95)',
          borderBottom: '1px solid rgba(45,212,191,0.15)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="mono text-xs" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
          TRANSACTION HISTORY
        </span>
        <span className="mono text-xs" style={{ color: '#2DD4BF' }}>
          {txs.length} / {txs.length} records
        </span>
      </div>

      {/* Table wrapper with horizontal scroll */}
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Space Mono,monospace', fontSize: 11, minWidth: 700 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'rgba(17,24,39,0.95)', zIndex: 5 }}>
            <tr style={{ borderBottom: '1px solid rgba(55,65,81,0.6)' }}>
              {['TX HASH', 'PAIR', 'AMOUNT', 'GAS', 'STATUS', 'ATTACK', 'TIME'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 12px',
                    textAlign: 'left',
                    color: '#6B7280',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txs.map((tx, i) => (
              <tr
                key={tx.tx_hash}
                style={{
                  borderBottom: '1px solid rgba(55,65,81,0.3)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(17,24,39,0.3)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45,212,191,0.05)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(17,24,39,0.3)')
                }
              >
                <td style={{ padding: '10px 12px' }}>
                  <a
                    href={tx.etherscan_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#3B82F6', textDecoration: 'none', fontFamily: 'Space Mono,monospace' }}
                  >
                    {tx.tx_hash.slice(0, 6)}...{tx.tx_hash.slice(-4)}
                  </a>
                </td>
                <td style={{ padding: '10px 12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                  {tx.token_in}/{tx.token_out}
                </td>
                <td style={{ padding: '10px 12px', color: '#F3F4F6' }}>{tx.amount_in?.toFixed(4)}</td>
                <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>
                  {tx.gas_price ? Math.round(tx.gas_price / 1e9) + ' gwei' : '-'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      color: statusColor(tx.status),
                      fontSize: 10,
                      background: `${statusColor(tx.status)}15`,
                      padding: '2px 6px',
                      borderRadius: 12,
                      display: 'inline-block',
                    }}
                  >
                    {tx.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {tx.attack_id ? (
                    <span
                      style={{
                        color: '#EF4444',
                        fontSize: 10,
                        background: 'rgba(239,68,68,0.1)',
                        padding: '2px 6px',
                        borderRadius: 12,
                        display: 'inline-block',
                      }}
                    >
                      SANDWICH
                    </span>
                  ) : (
                    <span
                      style={{
                        color: '#10B981',
                        fontSize: 10,
                        background: 'rgba(16,185,129,0.1)',
                        padding: '2px 6px',
                        borderRadius: 12,
                        display: 'inline-block',
                      }}
                    >
                      CLEAN
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                  {new Date(tx.created_at * 1000).toLocaleTimeString('en', { hour12: false })}
                </td>
               </tr>
            ))}
          </tbody>
        </table>

        {/* Loading indicator & infinite scroll trigger */}
        {loading && txs.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div
              className="animate-spin rounded-full h-6 w-6"
              style={{ border: '2px solid #2DD4BF', borderTopColor: 'transparent' }}
            />
            <span className="ml-3 mono text-xs" style={{ color: '#9CA3AF' }}>
              Loading transactions...
            </span>
          </div>
        )}

        {!loading && txs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#6B7280' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M8 10h8M8 14h4" strokeLinecap="round" />
            </svg>
            <span className="mono text-xs mt-3">No transactions yet</span>
            <span className="mono text-xs" style={{ color: '#4B5563' }}>
              Execute a swap or attack to see history
            </span>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && txs.length > 0 && (
          <div ref={loadMoreRef} className="py-4 text-center">
            <div
              className="inline-block animate-spin rounded-full h-4 w-4"
              style={{ border: '2px solid #2DD4BF', borderTopColor: 'transparent' }}
            />
            <span className="ml-2 mono text-xs" style={{ color: '#6B7280' }}>
              Loading more...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}