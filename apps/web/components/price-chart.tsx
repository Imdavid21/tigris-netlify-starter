"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { API_URL, type IndexedTrade } from "@/lib/api";
import { motionSpring } from "@/lib/motion-system";
import styles from "./PriceChart.module.css";

type Range = "5m" | "1h" | "6h" | "1d" | "all";

const ranges: Array<[Range, string, number | null]> = [
  ["5m", "5M", 5 * 60_000],
  ["1h", "1H", 60 * 60_000],
  ["6h", "6H", 6 * 60 * 60_000],
  ["1d", "1D", 24 * 60 * 60_000],
  ["all", "ALL", null]
];

function priceOf(trade: IndexedTrade) {
  const quote = Number(trade.quote_amount) / 1e6;
  const tokens = Number(trade.token_amount) / 1e18;
  return tokens > 0 ? quote / tokens : 0;
}

function priceLabel(value: number) {
  if (value >= 1) return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return "$" + value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}

export function PriceChart({ token }: { token: string }) {
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [range, setRange] = useState<Range>("1h");
  const [hoverIndex, setHoverIndex] = useState<number>();

  useEffect(() => {
    fetch(API_URL + "/tokens/" + token)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setTrades(data?.trades ?? []))
      .catch(() => {});
  }, [token]);

  const points = useMemo(() => {
    const duration = ranges.find(([id]) => id === range)?.[2] ?? null;
    const cutoff = duration ? Date.now() - duration : 0;

    return trades
      .filter((trade) => !duration || new Date(trade.block_time).getTime() >= cutoff)
      .map((trade) => ({
        time: new Date(trade.block_time).getTime(),
        price: priceOf(trade)
      }))
      .filter((point) => Number.isFinite(point.price) && point.price > 0)
      .sort((a, b) => a.time - b.time);
  }, [trades, range]);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const prices = points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = Math.max(max - min, max * 0.001);
    const coords = points.map((point, index) => {
      const x = (index / (points.length - 1)) * 1000;
      const y = 280 - ((point.price - min) / spread) * 240;
      return { x, y };
    });
    const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");

    return {
      min,
      max,
      coords,
      line,
      area: `0,300 ${line} 1000,300`
    };
  }, [points]);

  const latest = points.at(-1)?.price;
  const hovered = hoverIndex === undefined ? undefined : points[hoverIndex];
  const hoveredCoord = geometry && hoverIndex !== undefined ? geometry.coords[hoverIndex] : undefined;

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!geometry || points.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <motion.div
      className={`chart-card ${styles.card}`}
      layout
      transition={{ layout: motionSpring.spatialDefault }}
    >
      <div className={styles.head}>
        <div className={styles.price}>
          <span>Price</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong
              key={latest ? priceLabel(latest) : "empty"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={motionSpring.effectsFast}
            >
              {latest ? priceLabel(latest) : "—"}
            </motion.strong>
          </AnimatePresence>
        </div>

        <div className={styles.ranges} aria-label="Chart range">
          {ranges.map(([id, label]) => (
            <motion.button
              type="button"
              key={id}
              layout
              className={range === id ? styles.active : ""}
              onClick={() => {
                setRange(id);
                setHoverIndex(undefined);
              }}
              whileTap={{ scale: 0.92 }}
              transition={motionSpring.spatialFast}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      <motion.div
        className={styles.stage}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(undefined)}
        layout
      >
        <AnimatePresence mode="wait" initial={false}>
          {geometry ? (
            <motion.div
              key={range + "-chart"}
              style={{ position: "absolute", inset: 0 }}
              initial={{ opacity: 0, scaleY: 0.94, y: 4 }}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={{ opacity: 0, scaleY: 0.98, y: -2 }}
              transition={{
                ...motionSpring.spatialDefault,
                opacity: motionSpring.effectsFast
              }}
            >
              <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="Token price history">
                <motion.polygon
                  points={geometry.area}
                  className={styles.area}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={motionSpring.effectsDefault}
                />
                <motion.polyline
                  points={geometry.line}
                  className={styles.line}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ ...motionSpring.spatialSlow, opacity: motionSpring.effectsFast }}
                />
                <AnimatePresence>
                  {hoveredCoord && (
                    <motion.g
                      key={hoverIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={motionSpring.effectsFast}
                    >
                      <line x1={hoveredCoord.x} x2={hoveredCoord.x} y1="0" y2="300" className={styles.crosshair} />
                      <motion.circle
                        cx={hoveredCoord.x}
                        cy={hoveredCoord.y}
                        r="4"
                        className={styles.dot}
                        initial={{ scale: 0.4 }}
                        animate={{ scale: 1 }}
                        transition={motionSpring.spatialFast}
                      />
                    </motion.g>
                  )}
                </AnimatePresence>
              </svg>
              <div className={styles.axis} aria-hidden="true">
                <span>{priceLabel(geometry.max)}</span>
                <span>{priceLabel((geometry.max + geometry.min) / 2)}</span>
                <span>{priceLabel(geometry.min)}</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className={styles.empty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionSpring.effectsDefault}
            >
              Price history appears after at least two indexed trades.
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hovered && (
            <motion.div
              className={styles.tooltip}
              initial={{ opacity: 0, scale: 0.94, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 2 }}
              transition={motionSpring.spatialFast}
            >
              <strong>{priceLabel(hovered.price)}</strong>
              <span>{new Date(hovered.time).toLocaleString()}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
