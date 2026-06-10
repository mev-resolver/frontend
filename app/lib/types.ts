export interface WsEvent {
  type:
    | 'transaction_arrived'
    | 'attack_detected'
    | 'mitigation_applied'
    | 'settlement_confirmed'
    | 'price_update'
    | 'subscribed';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface SummaryStats {
  total_attacks_detected:  number;
  total_attacks_mitigated: number;
  success_rate:            number;
  avg_detection_latency_ms:  number;
  avg_mitigation_latency_ms: number;
  total_transactions: number;
  total_events:       number;
}

export interface TxRecord {
  tx_hash:   string;
  sender:    string;
  token_in:  string;
  token_out: string;
  amount_in: number;
  gas_price: number;
  status:    string;
  attack_id: string | null;
  bundle_id: string | null;
  created_at:    number;
  etherscan_url: string;
}

export interface PriceData {
  res_reserve: number;
  olv_reserve: number;
  price:   number;
  tvl_usd: number;
}

export interface EventRecord {
  id:         number;
  timestamp:  number;
  event_type: string;
  payload:    Record<string, unknown>;
}
