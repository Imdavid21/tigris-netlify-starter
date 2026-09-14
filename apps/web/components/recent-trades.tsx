"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { API_URL, type IndexedTrade } from "@/lib/api";

export function RecentTrades({ token }: { token: string }) {
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch(API_URL + "/tokens/" + token)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.trades) setTrades(data.trades);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>Recent trades</strong>
        <span style={{ opacity: 0.5, fontSize: 13 }}>
          Indexed from Arc
        </span>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid #29302c" }}>
        {loading ? (
          <p style={{ opacity: 0.55 }}>Loading trades...</p>
        ) : !trades.length ? (
          <p style={{ opacity: 0.55 }}>No indexed trades yet.</p>
        ) : (
          trades.slice(0, 20).map((trade) => (
            <div
              key={trade.tx_hash + String(trade.block_time)}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr auto",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid #1d211f",
                fontSize: 13
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {trade.side === "BUY" ? "Buy" : "Sell"}
              </span>
              <span style={{ opacity: 0.6 }}>
                {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
              </span>
              <span>
                {Number(formatUnits(BigInt(trade.quote_amount), 6)).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 }
                )}{" "}
                USDC
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
