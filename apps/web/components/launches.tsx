"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { formatUnits } from "viem";
import { curveAbi } from "@/lib/abi";
import { API_URL } from "@/lib/api";
import { createArcPublicClient } from "@/lib/rpc";
import { motionSpring } from "@/lib/motion-system";
import { TokenCard } from "@/components/token-card";
import styles from "./Launches.module.css";

type IndexedLaunch = {
  address: `0x${string}`;
  curve_address: `0x${string}`;
  name: string;
  symbol: string;
  status: string;
  generation?: string;
  quote_asset?: `0x${string}` | null;
  image?: string | null;
  volume_24h?: string;
  trades_24h?: number;
  last_trade_at?: string | null;
  created_at?: string;
};

type Launch = IndexedLaunch & {
  raised?: bigint;
  threshold?: bigint;
};

type Sort = "activity" | "newest" | "oldest" | "graduation" | "volume";
type WindowFilter = "all" | "24h" | "7d";

const PAGE_SIZE = 20;

const QUOTE_DECIMALS: Record<string, number> = {
  "0x3600000000000000000000000000000000000000": 6,
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": 6,
  "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf": 8
};

function decimals(item: Launch) {
  return item.quote_asset ? QUOTE_DECIMALS[item.quote_asset.toLowerCase()] ?? 6 : 6;
}

function money(value: bigint | string | undefined, d = 6) {
  if (value === undefined) return "—";
  try {
    const n = Number(formatUnits(BigInt(value), d));
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
    if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

function progress(item: Launch) {
  if (item.status === "GRADUATED") return 100;
  if (!item.raised || !item.threshold || item.threshold === 0n) return 0;
  return Math.min(100, Number((item.raised * 10_000n) / item.threshold) / 100);
}

function age(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return hrs + "h";
  return Math.floor(hrs / 24) + "d";
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function volumeValue(item: Launch) {
  try {
    return BigInt(item.volume_24h ?? "0");
  } catch {
    return 0n;
  }
}

function Card({ item, graduated = false }: { item: Launch; graduated?: boolean }) {
  const pct = progress(item);
  const d = decimals(item);

  return (
    <TokenCard
      href={`/token/${item.address}`}
      image={item.image}
      name={item.name}
      symbol={item.symbol}
      badge={graduated ? "Graduated" : item.generation === "CELESTIAL" ? "supershot.fun" : "V1"}
      graduated={graduated}
      value={money(item.volume_24h ?? "0", d)}
      metaLeft={`${Number(item.trades_24h ?? 0).toLocaleString()} trades`}
      metaRight={age(item.last_trade_at ?? item.created_at)}
      footLeft={`${item.address.slice(0, 6)}…${item.address.slice(-4)}`}
      footRight={graduated ? "DEX" : pct ? `${pct.toFixed(0)}%` : "24h vol"}
      progress={graduated ? undefined : pct}
    />
  );
}

function LoadingGrid() {
  return (
    <motion.div
      className={styles.surface}
      aria-label="Loading markets"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={motionSpring.effectsDefault}
    >
      <div className={styles.skeletonPanel}>
        <div className={styles.skeletonHead} />
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 10 }).map((_, index) => (
            <motion.div
              key={index}
              className={styles.skeletonCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionSpring.effectsDefault, delay: index * 0.025 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

async function fetchMarketsWithRetry() {
  let lastStatus = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(API_URL + "/tokens?limit=100", { cache: "no-store" });
      lastStatus = response.status;
      if (response.ok) return response.json();
    } catch {
      // Render can briefly refuse connections while a new release becomes healthy.
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }

  throw new Error(lastStatus ? "Market data is temporarily unavailable." : "Market data is reconnecting.");
}

export function Launches() {
  const [items, setItems] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("activity");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const client = createArcPublicClient();

    (async () => {
      try {
        const payload = await fetchMarketsWithRetry();
        const indexed = (payload.items ?? []) as IndexedLaunch[];

        const enriched = await Promise.all(
          indexed.map(async (item): Promise<Launch> => {
            if (!item.curve_address || item.status === "GRADUATED") return item;
            try {
              const [raised, threshold] = await Promise.all([
                client.readContract({
                  address: item.curve_address,
                  abi: curveAbi,
                  functionName: "trackedQuote"
                }),
                client.readContract({
                  address: item.curve_address,
                  abi: curveAbi,
                  functionName: "graduationThreshold"
                })
              ]);
              return { ...item, raised: raised as bigint, threshold: threshold as bigint };
            } catch {
              return item;
            }
          })
        );

        setItems(enriched);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load markets.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, sort, windowFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff = windowFilter === "24h" ? now - 86_400_000 : windowFilter === "7d" ? now - 604_800_000 : 0;

    const matches = items.filter((item) => {
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q);
      const time = timestamp(item.last_trade_at ?? item.created_at);
      return matchesQuery && (!cutoff || time >= cutoff);
    });

    return [...matches].sort((a, b) => {
      if (sort === "volume") {
        const av = volumeValue(a);
        const bv = volumeValue(b);
        return av === bv ? 0 : bv > av ? 1 : -1;
      }
      if (sort === "graduation") return progress(b) - progress(a);
      if (sort === "oldest") return timestamp(a.created_at) - timestamp(b.created_at);
      if (sort === "newest") return timestamp(b.created_at) - timestamp(a.created_at);
      return timestamp(b.last_trade_at ?? b.created_at) - timestamp(a.last_trade_at ?? a.created_at);
    });
  }, [items, query, sort, windowFilter]);

  const graduated = filtered.filter((item) => item.status === "GRADUATED").slice(0, 10);
  const live = filtered.filter((item) => item.status !== "GRADUATED");
  const pageCount = Math.max(1, Math.ceil(live.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleLive = live.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) return <LoadingGrid />;

  return (
    <LayoutGroup id="explore-markets">
      <motion.div className={styles.surface} layout transition={{ layout: motionSpring.spatialDefault }}>
        <AnimatePresence initial={false} mode="popLayout">
          {error && (
            <motion.div
              key="market-error"
              className={styles.notice}
              role="status"
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ ...motionSpring.spatialDefault, opacity: motionSpring.effectsFast }}
            >
              <strong>Market data may be delayed.</strong>
              <span>{error} Trading can remain available from contract state.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="popLayout">
          {graduated.length > 0 && (
            <motion.section
              key="graduated"
              className={`${styles.panel} ${styles.graduatedPanel}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionSpring.spatialDefault}
            >
              <div className={styles.panelHead}>
                <div className={styles.heading}>
                  <h2>Graduated</h2>
                  <motion.span key={graduated.length} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }}>{graduated.length}</motion.span>
                </div>
              </div>
              <motion.div className={styles.grid} layout>
                <AnimatePresence mode="popLayout" initial={false}>
                  {graduated.map((item) => <Card item={item} graduated key={item.address} />)}
                </AnimatePresence>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>

        <motion.section className={styles.panel} layout transition={{ layout: motionSpring.spatialDefault }}>
          <motion.div className={styles.toolbar} layout="position">
            <motion.label className={styles.searchWrap} layout whileFocus={{ scale: 1.005 }}>
              <span className={styles.searchIcon} aria-hidden="true">⌕</span>
              <input
                aria-label="Search tokens"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search token, ticker, or address"
              />
            </motion.label>

            <div className={styles.filters}>
              <div className={styles.segmented} aria-label="Sort markets">
                {([
                  ["activity", "Recent buys"],
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                  ["graduation", "Graduation"],
                  ["volume", "Volume"]
                ] as const).map(([value, label]) => (
                  <motion.button
                    type="button"
                    key={value}
                    layout
                    className={sort === value ? styles.active : ""}
                    onClick={() => setSort(value)}
                    whileTap={{ scale: .92 }}
                    transition={motionSpring.spatialFast}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>

              <div className={styles.segmented} aria-label="Market time range">
                {(["all", "24h", "7d"] as const).map((value) => (
                  <motion.button
                    type="button"
                    key={value}
                    layout
                    className={windowFilter === value ? styles.active : ""}
                    onClick={() => setWindowFilter(value)}
                    whileTap={{ scale: .92 }}
                    transition={motionSpring.spatialFast}
                  >
                    {value === "all" ? "All" : value}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div className={styles.panelHead} layout="position">
            <div className={styles.heading}>
              <h2>Explore</h2>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={live.length}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={motionSpring.effectsFast}
                >{live.length.toLocaleString()} launches</motion.span>
              </AnimatePresence>
            </div>
            <motion.a href="/create" className={styles.createLink} whileHover={{ y: -1 }} whileTap={{ scale: .97 }} transition={motionSpring.spatialFast}>Create</motion.a>
          </motion.div>

          <AnimatePresence mode="popLayout" initial={false}>
            {!visibleLive.length ? (
              <motion.div
                key="empty"
                className={styles.empty}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={motionSpring.spatialDefault}
              >
                <strong>{items.length ? "No matching markets" : "No live markets yet"}</strong>
                <span>{items.length ? "Try another search or time range." : "New launches will appear here automatically."}</span>
              </motion.div>
            ) : (
              <motion.div key={`grid-${safePage}`} className={styles.grid} layout>
                <AnimatePresence mode="popLayout" initial={false}>
                  {visibleLive.map((item) => <Card item={item} key={item.address} />)}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="popLayout">
            {live.length > PAGE_SIZE && (
              <motion.div
                className={styles.pagination}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={motionSpring.spatialFast}
              >
                <motion.button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} whileTap={{ scale: .93 }}>
                  Prev
                </motion.button>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={safePage} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                    {safePage} / {pageCount}
                  </motion.span>
                </AnimatePresence>
                <motion.button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} whileTap={{ scale: .93 }}>
                  Next
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </motion.div>
    </LayoutGroup>
  );
}
