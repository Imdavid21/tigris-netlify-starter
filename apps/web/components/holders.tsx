"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { API_URL } from "@/lib/api";
import styles from "./MarketTable.module.css";

type Holder = {
  holder: string;
  balance: string;
};

export function Holders({ token }: { token: string }) {
  const [items, setItems] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/tokens/${token}/holders`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <strong>Top holders</strong>
        <span>Indexed from transfers</span>
      </div>

      <div className={styles.body}>
        {loading ? (
          <p className={styles.empty}>Loading holders...</p>
        ) : !items.length ? (
          <p className={styles.empty}>No indexed holders yet.</p>
        ) : (
          items.slice(0, 20).map((item, index) => (
            <a
              key={item.holder}
              href={`https://testnet.arcscan.app/address/${item.holder}`}
              target="_blank"
              rel="noreferrer"
              title={`Open ${item.holder} on Arcscan`}
              className={`${styles.row} ${styles.holderRow}`}
            >
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.address}>
                {item.holder.slice(0, 7)}...{item.holder.slice(-5)}
              </span>
              <span className={styles.value}>
                {Number(formatUnits(BigInt(item.balance), 18)).toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </span>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
