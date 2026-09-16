"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AnalyticsChart, type AnalyticsChartPoint } from "@/components/analytics-charts";
import { motionSpring } from "@/lib/motion-system";
import styles from "./AnalyticsDashboard.module.css";

type View = "arc" | "supershot";

type Props = {
  arc: any;
  arcDegraded: boolean;
  stats: any;
  daily: any;
  buybacks: any[];
  venues: any[];
  degraded: boolean;
};

function compact(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(number);
}

function exact(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number);
}

function percent(value: unknown, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(digits)}%` : "—";
}

function blockTime(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const seconds = number > 100 ? number / 1000 : number;
  return `${seconds.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`;
}

function short(value?: string | null) {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function relativeTime(value?: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

function toTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}

function CardTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className={styles.cardTitle}><h2>{title}</h2>{action}</div>;
}

function BarList({ rows }: { rows: Array<{ label: string; value: number; href?: string }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className={styles.barList}>
      {rows.length ? rows.map((row) => {
        const content = (
          <>
            <div><span>{row.label}</span><strong>{compact(row.value)}</strong></div>
            <div className={styles.barTrack}><span style={{ width: `${Math.max(2, row.value / max * 100)}%` }} /></div>
          </>
        );
        return row.href ? <a className={styles.barRow} href={row.href} target="_blank" rel="noreferrer" key={`${row.label}-${row.value}`}>{content}</a> : <div className={styles.barRow} key={`${row.label}-${row.value}`}>{content}</div>;
      }) : <div className={styles.empty}>No data yet.</div>}
    </div>
  );
}

function Composition({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: number; rightLabel: string; rightValue: number }) {
  const total = Math.max(1, leftValue + rightValue);
  return (
    <>
      <div className={styles.composition}>
        <span style={{ width: `${leftValue / total * 100}%` }} />
        <span style={{ width: `${rightValue / total * 100}%` }} />
      </div>
      <div className={styles.compositionLegend}>
        <div><i /><span>{leftLabel}</span><strong>{compact(leftValue)}</strong></div>
        <div><i /><span>{rightLabel}</span><strong>{compact(rightValue)}</strong></div>
      </div>
    </>
  );
}

function ArcDashboard({ arc, arcDegraded }: Pick<Props, "arc" | "arcDegraded">) {
  const explorer = arc?.explorerUrl ?? "https://explorer.arc.io";
  const blocks = Array.isArray(arc?.blocks) ? arc.blocks : [];
  const transactions = Array.isArray(arc?.transactions) ? arc.transactions : [];
  const hourly = Array.isArray(arc?.hourly) ? arc.hourly : [];
  const contracts = arc?.contracts ?? {};
  const transactionStats = arc?.transactionStats ?? {};

  const transactionTrend = useMemo<AnalyticsChartPoint[]>(() => (arc?.activity ?? [])
    .map((item: any) => ({ time: toTime(item.date), value: Number(item.transactions ?? 0), label: new Date(item.date).toLocaleDateString() }))
    .filter((point: AnalyticsChartPoint) => point.time > 0 && Number.isFinite(point.value)), [arc?.activity]);

  const hourlyTransactions = useMemo<AnalyticsChartPoint[]>(() => hourly.map((item: any) => ({
    time: toTime(item.time), value: Number(item.transactions ?? 0), label: new Date(item.time).toLocaleString()
  })).filter((point: AnalyticsChartPoint) => point.time > 0 && Number.isFinite(point.value)), [hourly]);

  const hourlySenders = useMemo<AnalyticsChartPoint[]>(() => hourly.map((item: any) => ({
    time: toTime(item.time), value: Number(item.senders ?? 0), label: new Date(item.time).toLocaleString()
  })).filter((point: AnalyticsChartPoint) => point.time > 0 && Number.isFinite(point.value)), [hourly]);

  const hourlySuccess = useMemo<AnalyticsChartPoint[]>(() => hourly.map((item: any) => {
    const success = Number(item.successful ?? 0);
    const failed = Number(item.failed ?? 0);
    const known = success + failed;
    return { time: toTime(item.time), value: known > 0 ? success / known * 100 : NaN, label: new Date(item.time).toLocaleString() };
  }).filter((point: AnalyticsChartPoint) => point.time > 0 && Number.isFinite(point.value)), [hourly]);

  const blockTxPoints = useMemo<AnalyticsChartPoint[]>(() => [...blocks].reverse().map((block: any) => ({
    time: toTime(block.timestamp), value: Number(block.transactions ?? 0), label: `#${block.number ?? "—"}`
  })).filter((point) => point.time > 0 && Number.isFinite(point.value)), [blocks]);

  const gasFillPoints = useMemo<AnalyticsChartPoint[]>(() => [...blocks].reverse().map((block: any) => {
    const used = Number(block.gasUsed);
    const limit = Number(block.gasLimit);
    return {
      time: toTime(block.timestamp),
      value: Number.isFinite(used) && Number.isFinite(limit) && limit > 0 ? Math.min(100, used / limit * 100) : NaN,
      label: `#${block.number ?? "—"}`
    };
  }).filter((point) => point.time > 0 && Number.isFinite(point.value)), [blocks]);

  const totals = useMemo(() => hourly.reduce((acc: { tx: number; contract: number; success: number; failed: number }, row: any) => {
    acc.tx += Number(row.transactions ?? 0);
    acc.contract += Number(row.contractCalls ?? 0);
    acc.success += Number(row.successful ?? 0);
    acc.failed += Number(row.failed ?? 0);
    return acc;
  }, { tx: 0, contract: 0, success: 0, failed: 0 }), [hourly]);

  const topMethods = useMemo(() => (arc?.topMethods ?? []).map((row: any) => ({ label: String(row.method || "Transfer"), value: Number(row.transactions ?? 0) })), [arc?.topMethods]);
  const hotContracts = useMemo(() => {
    const hot = (arc?.hotContracts ?? []).filter((row: any) => row?.address && Number.isFinite(Number(row.transactions))).map((row: any) => ({
      label: row.name || short(row.address),
      value: Number(row.transactions),
      href: `${explorer}/address/${row.address}`
    }));
    if (hot.length) return hot.slice(0, 8);
    return (arc?.topDestinations ?? []).map((row: any) => ({
      label: short(row.to_address),
      value: Number(row.transactions ?? 0),
      href: row.to_address ? `${explorer}/address/${row.to_address}` : undefined
    }));
  }, [arc?.hotContracts, arc?.topDestinations, explorer]);

  if (arcDegraded || !arc?.stats) {
    return <section className={styles.setup}><strong>Arc analytics is not ready.</strong><code>BLOCKSCOUT_API_KEY=your_key</code></section>;
  }

  const otherTransactions = Math.max(0, totals.tx - totals.contract);
  const verified = Number(contracts.verifiedSmartContracts ?? 0);
  const allContracts = Number(contracts.smartContracts ?? 0);
  const verifiedPct = allContracts > 0 ? Math.min(100, verified / allContracts * 100) : 0;
  const syncAge = arc?.fetchedAt ? Date.now() - new Date(arc.fetchedAt).getTime() : 0;

  return (
    <motion.div key="arc" className={styles.view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionSpring.effectsDefault}>
      {syncAge > 60 * 60_000 && <div className={styles.notice}>Arc data is delayed.</div>}

      <section className={styles.summary}>
        <div className={styles.metricGrid}>
          <Metric label="Transactions · 24h" value={compact(transactionStats.transactions24h ?? arc.stats.transactionsToday)} />
          <Metric label="Addresses" value={compact(arc.stats.totalAddresses)} />
          <Metric label="Blocks" value={compact(arc.stats.totalBlocks)} />
          <Metric label="Avg block time" value={blockTime(arc.stats.averageBlockTimeMs)} />
          <Metric label="Utilization" value={percent(arc.stats.networkUtilizationPct)} />
          <Metric label="Pending transactions" value={compact(transactionStats.pendingTransactions)} />
          <Metric label="Smart contracts" value={compact(contracts.smartContracts)} />
          <Metric label="New contracts · 24h" value={compact(contracts.newSmartContracts24h)} />
        </div>
      </section>

      <section className={styles.chartGrid}>
        <AnalyticsChart title="Transactions" points={transactionTrend} rangesEnabled defaultRange="30d" />
        <AnalyticsChart title="Transactions / hour" points={hourlyTransactions} kind="bar" />
        <AnalyticsChart title="Active senders / hour" points={hourlySenders} />
        <AnalyticsChart title="Success rate" points={hourlySuccess} format="percent" />
        <AnalyticsChart title="Transactions / block" points={blockTxPoints} kind="bar" />
        <AnalyticsChart title="Block utilization" points={gasFillPoints} format="percent" />
      </section>

      <section className={styles.insightGrid}>
        <div className={styles.card}>
          <CardTitle title="Transaction mix" />
          <Composition leftLabel="Contract calls" leftValue={totals.contract} rightLabel="Other" rightValue={otherTransactions} />
        </div>
        <div className={styles.card}>
          <CardTitle title="Contract verification" />
          <div className={styles.ringWrap}>
            <div className={styles.ring} style={{ "--ring": `${verifiedPct}%` } as CSSProperties}><span>{percent(verifiedPct)}</span></div>
            <div className={styles.ringStats}>
              <div><span>Verified</span><strong>{compact(verified)}</strong></div>
              <div><span>New verified · 24h</span><strong>{compact(contracts.newVerifiedSmartContracts24h)}</strong></div>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <CardTitle title="Methods · 24h" />
          <BarList rows={topMethods} />
        </div>
        <div className={styles.card}>
          <CardTitle title="Active contracts" />
          <BarList rows={hotContracts} />
        </div>
      </section>

      <section className={styles.tables}>
        <div className={styles.card}>
          <CardTitle title="Blocks" />
          <div className={styles.rows}>
            {blocks.slice(0, 12).map((block: any) => (
              <a key={String(block.hash ?? block.number)} className={styles.row} href={`${explorer}/block/${block.number}`} target="_blank" rel="noreferrer">
                <div><strong>#{compact(block.number)}</strong><span>{short(block.miner)}</span></div>
                <span>{compact(block.transactions)} tx · {relativeTime(block.timestamp)}</span>
              </a>
            ))}
          </div>
        </div>
        <div className={styles.card}>
          <CardTitle title="Transactions" action={<a className={styles.action} href={explorer} target="_blank" rel="noreferrer">Explorer ↗</a>} />
          <div className={styles.rows}>
            {transactions.slice(0, 14).map((tx: any) => (
              <a key={String(tx.hash)} className={styles.row} href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                <div><strong>{tx.method || "Transaction"}</strong><span>{short(tx.from)} → {short(tx.to)}</span></div>
                <span>{relativeTime(tx.timestamp)}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function SupershotDashboard({ stats, daily, buybacks, venues, degraded }: Omit<Props, "arc" | "arcDegraded">) {
  const curve = venues.find((item: any) => item.venue === "CURVE");
  const v4 = venues.find((item: any) => item.venue === "UNISWAP_V4");
  const curveTrades = Number(curve?.trades ?? 0);
  const v4Trades = Number(v4?.trades ?? 0);

  const tradePoints = useMemo<AnalyticsChartPoint[]>(() => (daily?.volume ?? []).map((row: any) => ({ time: toTime(row.day), value: Number(row.trades ?? 0), label: new Date(row.day).toLocaleDateString() })).filter((p: AnalyticsChartPoint) => p.time > 0 && Number.isFinite(p.value)), [daily]);
  const traderPoints = useMemo<AnalyticsChartPoint[]>(() => (daily?.volume ?? []).map((row: any) => ({ time: toTime(row.day), value: Number(row.traders ?? 0), label: new Date(row.day).toLocaleDateString() })).filter((p: AnalyticsChartPoint) => p.time > 0 && Number.isFinite(p.value)), [daily]);
  const launchPoints = useMemo<AnalyticsChartPoint[]>(() => (daily?.launches ?? []).map((row: any) => ({ time: toTime(row.day), value: Number(row.launches ?? 0), label: new Date(row.day).toLocaleDateString() })).filter((p: AnalyticsChartPoint) => p.time > 0 && Number.isFinite(p.value)), [daily]);

  return (
    <motion.div key="supershot" className={styles.view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionSpring.effectsDefault}>
      {degraded && <div className={styles.notice}>Supershot data is delayed.</div>}

      <section className={styles.summary}>
        <div className={styles.metricGrid}>
          <Metric label="Trades" value={compact(stats?.trades)} />
          <Metric label="Traders" value={compact(stats?.unique_traders)} />
          <Metric label="Launches" value={compact(stats?.launches)} />
          <Metric label="Creators" value={compact(stats?.unique_creators)} />
          <Metric label="Trades · 24h" value={compact(daily?.volume?.at(-1)?.trades ?? stats?.traders_24h)} />
          <Metric label="Traders · 24h" value={compact(stats?.traders_24h)} />
          <Metric label="Graduated" value={compact(stats?.graduated)} />
          <Metric label="Open orders" value={compact(stats?.open_orders)} />
        </div>
      </section>

      <section className={styles.chartGridThree}>
        <AnalyticsChart title="Trades" points={tradePoints} rangesEnabled defaultRange="30d" />
        <AnalyticsChart title="Active traders" points={traderPoints} rangesEnabled defaultRange="30d" />
        <AnalyticsChart title="Launches" points={launchPoints} kind="bar" rangesEnabled defaultRange="30d" />
      </section>

      <section className={styles.insightGrid}>
        <div className={styles.card}>
          <CardTitle title="Execution venues" />
          <Composition leftLabel="Curve" leftValue={curveTrades} rightLabel="Uniswap v4" rightValue={v4Trades} />
          <div className={styles.compactStats}>
            <div><span>Curve traders</span><strong>{compact(curve?.traders)}</strong></div>
            <div><span>v4 markets</span><strong>{compact(v4?.markets)}</strong></div>
          </div>
        </div>

        <div className={styles.card}>
          <CardTitle title="Market lifecycle" />
          <div className={styles.lifecycle}>
            <div><span>Launches</span><strong>{compact(stats?.launches)}</strong></div><i>→</i>
            <div><span>Curve</span><strong>{compact(curveTrades)}</strong></div><i>→</i>
            <div><span>Graduated</span><strong>{compact(stats?.graduated)}</strong></div><i>→</i>
            <div><span>v4</span><strong>{compact(v4Trades)}</strong></div><i>→</i>
            <div><span>Buybacks</span><strong>{compact(stats?.buyback_count)}</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <CardTitle title="Buybacks" />
        {!buybacks.length ? <div className={styles.empty}>No buybacks yet.</div> : (
          <div className={styles.buybackRows}>
            {buybacks.slice(0, 10).map((item: any) => (
              <a href={`/token/${item.token}`} className={styles.buybackRow} key={item.tx_hash}>
                <div><strong>{item.post_graduation ? "DEX" : "Curve"}</strong><span>{short(item.token)}</span></div>
                <div><span>Quote spent</span><strong>{item.quote_spent}</strong></div>
                <div><span>Burned</span><strong>{item.tokens_burned}</strong></div>
              </a>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

export function AnalyticsDashboard(props: Props) {
  const [view, setView] = useState<View>("arc");
  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <h1>Analytics</h1>
        <div className={styles.toggle} aria-label="Analytics view">
          <button type="button" className={view === "arc" ? styles.active : ""} onClick={() => setView("arc")}>Arc</button>
          <button type="button" className={view === "supershot" ? styles.active : ""} onClick={() => setView("supershot")}>supershot.fun</button>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {view === "arc" ? <ArcDashboard arc={props.arc} arcDegraded={props.arcDegraded} /> : <SupershotDashboard stats={props.stats} daily={props.daily} buybacks={props.buybacks} venues={props.venues} degraded={props.degraded} />}
      </AnimatePresence>
    </div>
  );
}
