"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";
import { API_URL, type IndexedTrade } from "@/lib/api";
import { motionSpring } from "@/lib/motion-system";
import styles from "./PriceChart.module.css";

type Range = "5m" | "1h" | "6h" | "1d" | "all";
type PricePoint = { time: UTCTimestamp; price: number };
type HoverPoint = { time: number; price: number };

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
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) {
    return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return "$" + value.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function minMoveFor(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0.000001;
  if (value >= 100) return 0.01;
  if (value >= 1) return 0.0001;
  if (value >= 0.01) return 0.000001;
  if (value >= 0.0001) return 0.00000001;
  return 0.0000000001;
}

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function withAlpha(color: string, opacity: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const raw = Number.parseInt(match[1], 16);
  return `rgba(${(raw >> 16) & 255}, ${(raw >> 8) & 255}, ${raw & 255}, ${opacity})`;
}

function timeToMs(time: Time) {
  if (typeof time === "number") return time * 1000;
  if (typeof time === "string") return new Date(time).getTime();
  return Date.UTC(time.year, time.month - 1, time.day);
}

export function PriceChart({ token }: { token: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [range, setRange] = useState<Range>("1h");
  const [hovered, setHovered] = useState<HoverPoint>();
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    fetch(API_URL + "/tokens/" + token)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setTrades(data?.trades ?? []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  const points = useMemo<PricePoint[]>(() => {
    const duration = ranges.find(([id]) => id === range)?.[2] ?? null;
    const cutoff = duration ? Date.now() - duration : 0;

    const ordered = trades
      .filter((trade) => !duration || new Date(trade.block_time).getTime() >= cutoff)
      .map((trade) => ({
        time: Math.floor(new Date(trade.block_time).getTime() / 1000),
        price: priceOf(trade)
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price) && point.price > 0)
      .sort((a, b) => a.time - b.time);

    const collapsed: PricePoint[] = [];
    for (const point of ordered) {
      const time = point.time as UTCTimestamp;
      const previous = collapsed.at(-1);
      if (previous?.time === time) {
        previous.price = point.price;
      } else {
        collapsed.push({ time, price: point.price });
      }
    }
    return collapsed;
  }, [trades, range]);

  const latest = points.at(-1);
  const displayed = hovered ?? (latest ? { time: Number(latest.time) * 1000, price: latest.price } : undefined);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || points.length < 2) return;

    const primary = cssColor("--md-sys-color-primary", "#435400");
    const surface = cssColor("--md-sys-color-surface-container-lowest", "#ffffff");
    const text = cssColor("--md-sys-color-on-surface-variant", "#47483e");
    const outline = cssColor("--md-sys-color-outline-variant", "#c8c8ba");
    const inverse = cssColor("--md-sys-color-inverse-surface", "#30312b");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: surface },
        textColor: text,
        fontFamily: '"Roboto Flex", "Roboto", system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: true
      },
      localization: {
        priceFormatter: priceLabel
      },
      grid: {
        vertLines: { color: withAlpha(outline, 0.42), style: LineStyle.Dotted },
        horzLines: { color: withAlpha(outline, 0.42), style: LineStyle.Dotted }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: withAlpha(text, 0.55),
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: inverse
        },
        horzLine: {
          color: withAlpha(text, 0.42),
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: inverse
        }
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: range === "5m",
        rightOffset: 3,
        minBarSpacing: 2,
        fixLeftEdge: true
      },
      handleScroll: true,
      handleScale: true
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: primary,
      topColor: withAlpha(primary, 0.18),
      bottomColor: withAlpha(primary, 0.015),
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: surface,
      crosshairMarkerBackgroundColor: primary,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: withAlpha(primary, 0.5),
      priceLineStyle: LineStyle.Dashed,
      priceLineWidth: 1,
      priceFormat: {
        type: "custom",
        formatter: priceLabel,
        minMove: minMoveFor(latest?.price ?? 0)
      }
    });

    series.setData(points.map((point) => ({ time: point.time, value: point.price })));
    chart.timeScale().fitContent();

    const crosshairHandler = (param: Parameters<typeof chart.subscribeCrosshairMove>[0] extends (arg: infer P) => void ? P : never) => {
      if (!param.time || !param.point) {
        setHovered(undefined);
        return;
      }
      const datum = param.seriesData.get(series) as { value?: number } | undefined;
      if (!datum || typeof datum.value !== "number") {
        setHovered(undefined);
        return;
      }
      setHovered({ time: timeToMs(param.time), price: datum.value });
    };

    chart.subscribeCrosshairMove(crosshairHandler);

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chart.remove();
    };
  }, [points, range, themeVersion, latest?.price]);

  return (
    <motion.div
      className={`chart-card ${styles.card}`}
      layout
      transition={{ layout: motionSpring.spatialDefault }}
    >
      <div className={styles.head}>
        <div className={styles.price}>
          <span>{hovered ? new Date(hovered.time).toLocaleString() : "Price"}</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong
              key={displayed ? priceLabel(displayed.price) : "empty"}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={motionSpring.effectsFast}
            >
              {displayed ? priceLabel(displayed.price) : "—"}
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
                setHovered(undefined);
              }}
              whileTap={{ scale: 0.92 }}
              transition={motionSpring.spatialFast}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      <motion.div className={styles.stage} layout>
        {points.length >= 2 ? (
          <div ref={chartRef} className={styles.chartMount} aria-label="Interactive token price chart" />
        ) : (
          <div className={styles.empty}>Price history appears after at least two indexed trades.</div>
        )}
      </motion.div>
    </motion.div>
  );
}
