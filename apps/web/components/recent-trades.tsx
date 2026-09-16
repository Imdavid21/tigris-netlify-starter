"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { formatUnits } from "viem";
import { API_URL, type IndexedTrade } from "@/lib/api";
import { quoteAssets } from "@/lib/celestial";
import { motionSpring } from "@/lib/motion-system";
import { RailScanLoader } from "@/components/dotmatrix/supershot-loaders";
import styles from "./MarketTable.module.css";

type Holder = {
  holder: string;
  balance: string;
};

type TokenDetails = {
  address?: string;
  curve_address?: string | null;
  creator?: string | null;
  pool_address?: string | null;
  quote_asset?: string | null;
  generation?: string | null;
  status?: string | null;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  trades?: IndexedTrade[];
};

type DataTab = "trades" | "holders" | "about" | "details";

const tabs: Array<{ value: DataTab; label: string }> = [
  { value: "trades", label: "Trades" },
  { value: "holders", label: "Holders" },
  { value: "about", label: "About" },
  { value: "details", label: "Details" }
];

function short(value?: string | null, lead = 7, tail = 5) {
  if (!value) return "—";
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

function displayTime(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function arcscanAddress(value: string) {
  return `https://arc-scan.org/address/${value}`;
}

export function RecentTrades({ token }: { token: string }) {
  const [tab, setTab] = useState<DataTab>("trades");
  const [details, setDetails] = useState<TokenDetails>({});
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      fetch(API_URL + "/tokens/" + token)
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({})),
      fetch(API_URL + "/tokens/" + token + "/holders")
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .catch(() => ({ items: [] }))
    ]).then(([tokenData, holderData]) => {
      if (!active) return;
      setDetails(tokenData as TokenDetails);
      setHolders((holderData.items ?? []) as Holder[]);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [token]);

  const trades = details.trades ?? [];
  const quoteAsset = useMemo(() => {
    return quoteAssets.find((asset) => asset.address.toLowerCase() === details.quote_asset?.toLowerCase()) ?? quoteAssets[0];
  }, [details.quote_asset]);

  const socialLinks = [
    details.website ? { label: "Website", href: details.website } : null,
    details.twitter ? {
      label: "X",
      href: details.twitter.startsWith("http") ? details.twitter : "https://x.com/" + details.twitter.replace("@", "")
    } : null,
    details.telegram ? {
      label: "Telegram",
      href: details.telegram.startsWith("http") ? details.telegram : "https://" + details.telegram
    } : null
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <LayoutGroup id={`market-data-${token.toLowerCase()}`}>
      <motion.section className={styles.panel} layout transition={{ layout: motionSpring.spatialDefault }}>
        <div className={styles.tabs} role="tablist" aria-label="Market data">
          {tabs.map((item) => (
            <motion.button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              className={`${styles.tabButton} ${tab === item.value ? styles.activeTab : ""}`}
              onClick={() => setTab(item.value)}
              whileTap={{ scale: .95 }}
              transition={motionSpring.spatialFast}
            >
              {tab === item.value && (
                <motion.span
                  className={styles.tabIndicator}
                  layoutId="market-data-active-tab"
                  transition={motionSpring.spatialDefault}
                />
              )}
              <span className={styles.tabLabel}>{item.label}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="loading"
              className={styles.empty}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <RailScanLoader size={30} dotSize={3.2} speed={1.15} ariaLabel="Loading market data" tone="muted" />
              <span>Loading market data</span>
            </motion.div>
          ) : tab === "trades" ? (
            <motion.div key="trades" className={styles.body} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionSpring.effectsDefault}>
              <div className={`${styles.tableHead} ${styles.tradeColumns}`}>
                <span>Side</span><span>{quoteAsset.symbol}</span><span>Tokens</span><span>Trader</span><span>Time</span>
              </div>
              {!trades.length ? (
                <p className={styles.empty}>No indexed trades yet.</p>
              ) : trades.slice(0, 28).map((trade, index) => (
                <motion.a
                  layout
                  key={trade.tx_hash + String(trade.block_time)}
                  href={`https://arc-scan.org/tx/${trade.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.row} ${styles.tradeColumns}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionSpring.spatialFast, delay: Math.min(index * .01, .09) }}
                >
                  <span className={`${styles.side} ${trade.side === "BUY" ? styles.buy : styles.sell}`}>{trade.side === "BUY" ? "Buy" : "Sell"}</span>
                  <span className={styles.value}>{Number(formatUnits(BigInt(trade.quote_amount), quoteAsset.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                  <span className={styles.value}>{Number(formatUnits(BigInt(trade.token_amount), 18)).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                  <span className={styles.address}>{short(trade.trader, 6, 4)} ↗</span>
                  <span className={styles.time}>{displayTime(trade.block_time)}</span>
                </motion.a>
              ))}
            </motion.div>
          ) : tab === "holders" ? (
            <motion.div key="holders" className={styles.body} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionSpring.effectsDefault}>
              <div className={`${styles.tableHead} ${styles.holderColumns}`}><span>Rank</span><span>Holder</span><span>Balance</span></div>
              {!holders.length ? <p className={styles.empty}>No indexed holders yet.</p> : holders.slice(0, 28).map((item, index) => (
                <motion.a
                  layout
                  key={item.holder}
                  href={arcscanAddress(item.holder)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.row} ${styles.holderColumns}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionSpring.spatialFast, delay: Math.min(index * .01, .09) }}
                >
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.address}>{short(item.holder)} ↗</span>
                  <span className={styles.value}>{Number(formatUnits(BigInt(item.balance), 18)).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                </motion.a>
              ))}
            </motion.div>
          ) : tab === "about" ? (
            <motion.div key="about" className={styles.infoPane} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionSpring.effectsDefault}>
              <div>
                <span className={styles.infoEyebrow}>About this market</span>
                <p>{details.description || "No project description has been indexed yet. Contract data and market activity remain available below."}</p>
              </div>
              {socialLinks.length > 0 && <div className={styles.socials}>{socialLinks.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div>}
            </motion.div>
          ) : (
            <motion.div key="details" className={styles.detailGrid} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionSpring.effectsDefault}>
              <div><span>Token contract</span><a href={arcscanAddress(token)} target="_blank" rel="noreferrer">{short(token, 10, 8)} ↗</a></div>
              <div><span>Curve</span>{details.curve_address ? <a href={arcscanAddress(details.curve_address)} target="_blank" rel="noreferrer">{short(details.curve_address, 10, 8)} ↗</a> : <strong>—</strong>}</div>
              <div><span>Creator</span>{details.creator ? <a href={arcscanAddress(details.creator)} target="_blank" rel="noreferrer">{short(details.creator, 10, 8)} ↗</a> : <strong>—</strong>}</div>
              <div><span>DEX pool</span>{details.pool_address ? <a href={arcscanAddress(details.pool_address)} target="_blank" rel="noreferrer">{short(details.pool_address, 10, 8)} ↗</a> : <strong>—</strong>}</div>
              <div><span>Generation</span><strong>{details.generation || "—"}</strong></div>
              <div><span>Status</span><strong>{details.status || "—"}</strong></div>
              <div><span>Quote asset</span><a href={arcscanAddress(quoteAsset.address)} target="_blank" rel="noreferrer">{quoteAsset.symbol} ↗</a></div>
              <div><span>Indexed holders</span><strong>{holders.length.toLocaleString()}</strong></div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </LayoutGroup>
  );
}