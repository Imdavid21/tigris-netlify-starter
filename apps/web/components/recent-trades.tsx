"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { API_URL, type IndexedTrade } from "@/lib/api";
import styles from "./MarketTable.module.css";

export function RecentTrades({ token }: { token: string }) {
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch(API_URL + "/tokens/" + token)
      .then((response) => (response.ok ? response.json() : null))
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
    <section className={styles.panel}>
      <div className={styles.head}>
        <strong>Recent trades</strong>
        <span>Indexed from Arc</span>
      </div>

      <div className={styles.body}>
        {loading ? (
          <p className={styles.empty}>Loading trades...</p>
        ) : !trades.length ? (
          <p className={styles.empty}>No indexed trades yet.</p>
        ) : (
          trades.slice(0, 20).map((trade) => (
            <div key={trade.tx_hash + String(trade.block_time)} className={`${styles.row} ${styles.tradeRow}`}>
              <span className={`${styles.side} ${trade.side === "BUY" ? styles.buy : styles.sell}`}>
                {trade.side === "BUY" ? "Buy" : "Sell"}
              </span>
              <a
                href={`https://testnet.arcscan.app/address/${trade.trader}`}
                target="_blank"
                rel="noreferrer"
                className={styles.address}
                title={`Open ${trade.trader} on Arcscan`}
              >
                {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
              </a>
              <span className={styles.value}>
                {Number(formatUnits(BigInt(trade.quote_amount), 6)).toLocaleString(undefined, {
                  maximumFractionDigits: 2
                })} USDC
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
