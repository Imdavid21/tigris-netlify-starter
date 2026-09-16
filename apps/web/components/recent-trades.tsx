"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatUnits } from "viem";
import { API_URL, type IndexedTrade } from "@/lib/api";
import { motionSpring } from "@/lib/motion-system";
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
    <motion.section className={styles.panel} layout transition={{layout:motionSpring.spatialDefault}}>
      <div className={styles.head}>
        <strong>Recent trades</strong>
        <span>Indexed from Arc</span>
      </div>

      <motion.div className={styles.body} layout>
        <AnimatePresence mode="popLayout" initial={false}>
          {loading ? (
            <motion.p key="loading" className={styles.empty} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>Loading trades...</motion.p>
          ) : !trades.length ? (
            <motion.p key="empty" className={styles.empty} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>No indexed trades yet.</motion.p>
          ) : (
            trades.slice(0, 20).map((trade,index) => (
              <motion.div
                layout
                key={trade.tx_hash + String(trade.block_time)}
                className={`${styles.row} ${styles.tradeRow}`}
                initial={{opacity:0,y:7,scale:.995}}
                animate={{opacity:1,y:0,scale:1}}
                exit={{opacity:0,x:-8}}
                transition={{...motionSpring.spatialFast,delay:Math.min(index*.012,.1)}}
              >
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
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}
