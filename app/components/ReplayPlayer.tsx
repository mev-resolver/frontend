'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import type { WsEvent, EventRecord } from '../lib/types';

interface Props {
  onReplay: (events: WsEvent[]) => void;
  onClear: () => void;
  compact?: boolean;
}

export default function ReplayPlayer({ onReplay, onClear, compact = false }: Props) {
  const [startTs, setStartTs] = useState<number>(0);
  const [endTs, setEndTs] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [minTs, setMinTs] = useState<number>(0);
  const [maxTs, setMaxTs] = useState<number>(0);
  const [scrubValue, setScrubValue] = useState<number>(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);

  const eventCache = useRef<WsEvent[]>([]);
  const replayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cancelReplay = useRef<boolean>(false);

  // Initialize timestamps only on the client
  useEffect(() => {
    setIsClient(true);
    const now = Date.now() / 1000;
    setMaxTs(now);
    setEndTs(now);
    setMinTs(now - 3600);
    setStartTs(now - 600);
  }, []);

  // Prevent hydration mismatch by not rendering sliders until client is ready
  if (!isClient) {
    return <div className="mono text-xs" style={{ color: '#9CA3AF' }}>Loading replay controls...</div>;
  }

  const fetchEvents = async (start: number, end: number) => {
    setLoading(true);
    setStatus('');
    try {
      const { events } = await api.replayEvents(start, end);
      if (!events.length) {
        setStatus('No events in range');
        eventCache.current = [];
        setCurrentEventIndex(0);
        setIsPlaying(false);
        return;
      }
      const wsEvents: WsEvent[] = events.map((e: EventRecord) => ({
        type: e.event_type as WsEvent['type'],
        data: e.payload,
        timestamp: e.timestamp,
      }));
      eventCache.current = wsEvents;
      setCurrentEventIndex(0);
      setStatus(`Loaded ${wsEvents.length} events`);
    } catch (e) {
      setStatus('Error fetching events');
      eventCache.current = [];
    } finally {
      setLoading(false);
    }
  };

  const stopReplay = () => {
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }
    cancelReplay.current = true;
    setIsPlaying(false);
    setStatus('Replay stopped');
  };

  const pauseReplay = () => {
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }
    setIsPlaying(false);
    setStatus('Paused');
  };

  const resumeReplay = () => {
    if (eventCache.current.length === 0 || cancelReplay.current) return;
    setIsPlaying(true);
    setStatus(`Resuming replay at ${speed}x...`);
    const startIdx = currentEventIndex;
    const events = eventCache.current;
    const tStart = events[startIdx].timestamp;
    for (let i = startIdx; i < events.length; i++) {
      const ev = events[i];
      const delay = ((ev.timestamp - tStart) / speed) * 1000;
      const timeout = setTimeout(() => {
        if (cancelReplay.current) return;
        onReplay([ev]);
        setCurrentEventIndex(i + 1);
        if (i === events.length - 1) {
          setIsPlaying(false);
          setStatus(`Replay complete (${events.length} events)`);
          cancelReplay.current = false;
        }
      }, delay);
      replayTimeoutRef.current = timeout;
    }
  };

  const startReplay = () => {
    if (eventCache.current.length === 0) return;
    stopReplay();
    cancelReplay.current = false;
    onClear();
    setCurrentEventIndex(0);
    resumeReplay();
  };

  const handleScrub = (value: number) => {
    setScrubValue(value);
    if (eventCache.current.length === 0) return;
    const idx = Math.floor((value / 100) * eventCache.current.length);
    const targetEvent = eventCache.current[idx];
    if (targetEvent) {
      stopReplay();
      onClear();
      onReplay([targetEvent]);
      setCurrentEventIndex(idx);
      setStatus(`Scrubbed to event #${idx + 1}`);
    }
  };

  const fmt = (ts: number) => new Date(ts * 1000).toLocaleTimeString('en', { hour12: false });

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchEvents(startTs, endTs)}
            disabled={loading}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'Space Mono,monospace',
              fontSize: 9,
              background: 'transparent',
              border: '1px solid #2DD4BF',
              color: '#2DD4BF',
            }}
          >
            {loading ? '...' : 'LOAD'}
          </button>
          <button
            onClick={startReplay}
            disabled={eventCache.current.length === 0}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              cursor: eventCache.current.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'Space Mono,monospace',
              fontSize: 9,
              background: 'transparent',
              border: '1px solid #2DD4BF',
              color: '#2DD4BF',
              opacity: eventCache.current.length === 0 ? 0.4 : 1,
            }}
          >
            ▶ REPLAY
          </button>
          {isPlaying ? (
            <button
              onClick={pauseReplay}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                fontFamily: 'Space Mono,monospace',
                fontSize: 9,
                background: 'transparent',
                border: '1px solid #F97316',
                color: '#F97316',
                cursor: 'pointer',
              }}
            >
              ⏸ PAUSE
            </button>
          ) : (
            <button
              onClick={resumeReplay}
              disabled={eventCache.current.length === 0 || currentEventIndex >= eventCache.current.length}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'Space Mono,monospace',
                fontSize: 9,
                background: 'transparent',
                border: '1px solid #2DD4BF',
                color: '#2DD4BF',
                opacity: eventCache.current.length === 0 || currentEventIndex >= eventCache.current.length ? 0.4 : 1,
              }}
            >
              ▶ RESUME
            </button>
          )}
          <button
            onClick={stopReplay}
            disabled={eventCache.current.length === 0}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              fontFamily: 'Space Mono,monospace',
              fontSize: 9,
              background: 'transparent',
              border: '1px solid #EF4444',
              color: '#EF4444',
              cursor: eventCache.current.length === 0 ? 'not-allowed' : 'pointer',
              opacity: eventCache.current.length === 0 ? 0.4 : 1,
            }}
          >
            ⏹ STOP
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{
              background: '#1F2937',
              border: '1px solid #374151',
              color: '#F3F4F6',
              fontSize: 9,
              padding: '2px 4px',
              borderRadius: 4,
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <button
            onClick={onClear}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              background: 'transparent',
              border: '1px solid #4B5563',
              color: '#9CA3AF',
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            CLEAR
          </button>
        </div>
        {status && <div style={{ fontSize: 8, color: '#2DD4BF' }}>{status}</div>}
      </div>
    );
  }

  // Full version (compact style but full size – keep all controls)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => fetchEvents(startTs, endTs)}
          disabled={loading}
          className="mono"
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'Space Mono,monospace',
            fontSize: 10,
            background: 'transparent',
            border: '1px solid #2DD4BF',
            color: '#2DD4BF',
          }}
        >
          {loading ? 'LOADING...' : 'LOAD EVENTS'}
        </button>
        <button
          onClick={startReplay}
          disabled={eventCache.current.length === 0}
          className="mono"
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            cursor: eventCache.current.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'Space Mono,monospace',
            fontSize: 10,
            background: 'transparent',
            border: '1px solid #2DD4BF',
            color: '#2DD4BF',
            opacity: eventCache.current.length === 0 ? 0.4 : 1,
          }}
        >
          ▶ REPLAY
        </button>
        {isPlaying ? (
          <button
            onClick={pauseReplay}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              fontFamily: 'Space Mono,monospace',
              fontSize: 10,
              background: 'transparent',
              border: '1px solid #F97316',
              color: '#F97316',
              cursor: 'pointer',
            }}
          >
            ⏸ PAUSE
          </button>
        ) : (
          <button
            onClick={resumeReplay}
            disabled={eventCache.current.length === 0 || currentEventIndex >= eventCache.current.length}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'Space Mono,monospace',
              fontSize: 10,
              background: 'transparent',
              border: '1px solid #2DD4BF',
              color: '#2DD4BF',
              opacity: eventCache.current.length === 0 || currentEventIndex >= eventCache.current.length ? 0.4 : 1,
            }}
          >
            ▶ RESUME
          </button>
        )}
        <button
          onClick={stopReplay}
          disabled={eventCache.current.length === 0}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontFamily: 'Space Mono,monospace',
            fontSize: 10,
            background: 'transparent',
            border: '1px solid #EF4444',
            color: '#EF4444',
            cursor: eventCache.current.length === 0 ? 'not-allowed' : 'pointer',
            opacity: eventCache.current.length === 0 ? 0.4 : 1,
          }}
        >
          ⏹ STOP
        </button>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{
            background: '#1F2937',
            border: '1px solid #374151',
            color: '#F3F4F6',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
        <button
          onClick={onClear}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            background: 'transparent',
            border: '1px solid #4B5563',
            color: '#9CA3AF',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          CLEAR
        </button>
      </div>

      {/* Time range sliders */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>Start</div>
          <input
            type="range"
            min={minTs}
            max={maxTs}
            step={60}
            value={startTs}
            onChange={(e) => setStartTs(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#2DD4BF' }}
          />
          <div className="mono text-xs" style={{ color: '#2DD4BF' }}>{fmt(startTs)}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>End</div>
          <input
            type="range"
            min={minTs}
            max={maxTs}
            step={60}
            value={endTs}
            onChange={(e) => setEndTs(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#2DD4BF' }}
          />
          <div className="mono text-xs" style={{ color: '#2DD4BF' }}>{fmt(endTs)}</div>
        </div>
      </div>

      {/* Scrubber */}
      <div>
        <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>Scrub</div>
        <input
          type="range"
          min={0}
          max={100}
          value={scrubValue}
          onChange={(e) => handleScrub(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#2DD4BF' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#6B7280' }}>
          <span>00:00</span>
          <span>{eventCache.current.length > 0 ? `${eventCache.current.length} events` : '—'}</span>
          <span>{fmt(endTs)}</span>
        </div>
      </div>

      {status && (
        <div
          className="mono text-xs p-2 rounded"
          style={{
            background: 'rgba(45,212,191,0.05)',
            border: '1px solid rgba(45,212,191,0.15)',
            color: '#2DD4BF',
            fontSize: 9,
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}