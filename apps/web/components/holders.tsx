"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatUnits } from "viem";
import { API_URL } from "@/lib/api";
import { motionSpring } from "@/lib/motion-system";
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
    <motion.section className={styles.panel} layout transition={{layout:motionSpring.spatialDefault}}>
      <div className={styles.head}>
        <strong>Top holders</strong>
        <span>Indexed from transfers</span>
      </div>

      <motion.div className={styles.body} layout>
        <AnimatePresence mode="popLayout" initial={false}>
          {loading ? (
            <motion.p key="loading" className={styles.empty} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>Loading holders...</motion.p>
          ) : !items.length ? (
            <motion.p key="empty" className={styles.empty} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>No indexed holders yet.</motion.p>
          ) : (
            items.slice(0, 20).map((item, index) => (
              <motion.a
                layout
                key={item.holder}
                href={`https://testnet.arcscan.app/address/${item.holder}`}
                target="_blank"
                rel="noreferrer"
                title={`Open ${item.holder} on Arcscan`}
                className={`${styles.row} ${styles.holderRow}`}
                initial={{opacity:0,y:7,scale:.995}}
                animate={{opacity:1,y:0,scale:1}}
                exit={{opacity:0,x:8}}
                transition={{...motionSpring.spatialFast,delay:Math.min(index*.012,.1)}}
                whileHover={{x:3}}
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
              </motion.a>
            ))
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}
