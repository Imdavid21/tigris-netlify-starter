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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function toTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function SectionHead({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <div><h2>{title}</h2>{text && <p>{text}</p>}</div>
      {action}
    </div>
  );
}

function ArcDashboard({ arc, arcDegraded }: Pick<Props, "arc" | "arcDegraded">) {
  const explorer = arc?.explorerUrl ?? "https://explorer.arc.io";
  const blocks = Array.isArray(arc?.blocks) ? arc.blocks : [];
  const transactions = Array.isArray(arc?.transactions) ? arc.transactions : [];

  const transactionTrend = useMemo<AnalyticsChartPoint[]>(() => (arc?.activity ?? [])
    .map((item: any) => ({ time: toTime(item.date), value: Number(item.transactions ?? 0), label: new Date(item.date).toLocaleDateString() }))
    .filter((point: AnalyticsChartPoint) => point.time > 0 && Number.isFinite(point.value)), [arc?.activity]);

  const blockTxPoints = useMemo<AnalyticsChartPoint[]>(() => [...blocks].reverse()
    .map((block: any) => ({
      time: toTime(block.timestamp),
      value: Number(block.transactions ?? 0),
      label: `Block ${block.number ?? "—"}`
    }))
    .filter((point) => point.time > 0 && Number.isFinite(point.value)), [blocks]);

  const gasFillPoints = useMemo<AnalyticsChartPoint[]>(() => [...blocks].reverse()
    .map((block: any) => {
      const used = Number(block.gasUsed);
      const limit = Number(block.gasLimit);
      return {
        time: toTime(block.timestamp),
        value: Number.isFinite(used) && Number.isFinite(limit) && limit > 0 ? Math.min(100, (used / limit) * 100) : NaN,
        label: `Block ${block.number ?? "—"}`
      };
    })
    .filter((point) => point.time > 0 && Number.isFinite(point.value)), [blocks]);

  const recent = useMemo(() => {
    const validBlocks = blocks.filter((block: any) => Number.isFinite(Number(block.transactions)));
    const avgTxBlock = validBlocks.length ? validBlocks.reduce((sum: number, block: any) => sum + Number(block.transactions), 0) / validBlocks.length : NaN;
    const fillValues = blocks.map((block: any) => {
      const used = Number(block.gasUsed);
      const limit = Number(block.gasLimit);
      return Number.isFinite(used) && Number.isFinite(limit) && limit > 0 ? (used / limit) * 100 : NaN;
    }).filter(Number.isFinite) as number[];
    const avgGasFill = fillValues.length ? fillValues.reduce((a, b) => a + b, 0) / fillValues.length : NaN;

    const successful = transactions.filter((tx: any) => /ok|success|confirmed/i.test(String(tx.status ?? ""))).length;
    const failed = transactions.filter((tx: any) => /error|fail|revert/i.test(String(tx.status ?? ""))).length;
    const known = successful + failed;
    const successRate = known ? successful / known * 100 : NaN;
    const senders = new Set(transactions.map((tx: any) => tx.from).filter(Boolean)).size;
    const receivers = new Set(transactions.map((tx: any) => tx.to).filter(Boolean)).size;

    const methodMap = new Map<string, number>();
    for (const tx of transactions) {
      const raw = String(tx.method || "Transfer").replace(/\(.*/, "").trim();
      const method = raw || "Transfer";
      methodMap.set(method, (methodMap.get(method) ?? 0) + 1);
    }
    const methods = [...methodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { avgTxBlock, avgGasFill, successful, failed, successRate, senders, receivers, methods };
  }, [blocks, transactions]);

  if (arcDegraded || !arc?.stats) {
    return (
      <section className={styles.setup}>
        <strong>Arc data source is not active yet.</strong>
        <p>{arc?.error ?? "Add the Blockscout API key to the API service to activate chain analytics."}</p>
        <code>BLOCKSCOUT_API_KEY=your_key</code>
      </section>
    );
  }

  const utilization = Math.max(0, Math.min(100, Number(arc.stats.networkUtilizationPct) || 0));
  const success = Math.max(0, Math.min(100, Number(recent.successRate) || 0));
  const maxMethod = Math.max(1, ...recent.methods.map(([, count]) => count));

  return (
    <motion.div key="arc" className={styles.view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={motionSpring.effectsDefault}>
      <section className={styles.hero}>
        <div className={styles.heroHead}>
          <div><h1>Arc analytics</h1><p>Network activity, throughput, block utilization, and recent transaction behavior.</p></div>
          <span className={styles.livePill}>Live</span>
        </div>
        <div className={styles.metricGrid}>
          <Metric label="Transactions today" value={compact(arc.stats.transactionsToday)} />
          <Metric label="Total transactions" value={compact(arc.stats.totalTransactions)} />
          <Metric label="Total blocks" value={compact(arc.stats.totalBlocks)} />
          <Metric label="Addresses" value={compact(arc.stats.totalAddresses)} />
          <Metric label="Average block time" value={blockTime(arc.stats.averageBlockTimeMs)} />
          <Metric label="Network utilization" value={percent(arc.stats.networkUtilizationPct)} />
          <Metric label="Recent tx / block" value={exact(recent.avgTxBlock)} note="Recent block sample" />
          <Metric label="Recent unique senders" value={compact(recent.senders)} note={`${transactions.length} tx sample`} />
        </div>
        <p className={styles.source}>Blockscout · refreshed {relativeTime(arc.fetchedAt)}</p>
      </section>

      <section className={styles.chartGridLarge}>
        <AnalyticsChart title="Network transactions" subtitle="Daily activity" points={transactionTrend} rangesEnabled defaultRange="30d" />
        <AnalyticsChart title="Transactions per block" subtitle="Recent blocks" points={blockTxPoints} kind="bar" footer="Recent Blockscout block sample." />
      </section>

      <section className={styles.chartGridLarge}>
        <AnalyticsChart title="Block gas utilization" subtitle="Gas used / gas limit" points={gasFillPoints} kind="area" format="percent" footer="Recent block utilization, not the chain-wide utilization counter." />

        <div className={styles.healthCard}>
          <SectionHead title="Network health" text="Current chain utilization and recent transaction outcomes." />
          <div className={styles.rings}>
            <div className={styles.ringItem}>
              <div className={styles.ring} style={{ "--ring": `${utilization}%` } as CSSProperties}><span>{percent(utilization)}</span></div>
              <strong>Chain utilization</strong><small>Current Blockscout counter</small>
            </div>
            <div className={styles.ringItem}>
              <div className={`${styles.ring} ${styles.positiveRing}`} style={{ "--ring": `${success}%` } as CSSProperties}><span>{Number.isFinite(recent.successRate) ? percent(success) : "—"}</span></div>
              <strong>Recent success rate</strong><small>{recent.successful} successful · {recent.failed} failed</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.diagramGrid}>
        <div className={styles.panel}>
          <SectionHead title="Network flow" text="A compact view from participants to execution and settlement." />
          <div className={styles.flowDiagram}>
            <div className={styles.flowNode}><span>Addresses</span><strong>{compact(arc.stats.totalAddresses)}</strong><small>Network participants</small></div>
            <div className={styles.flowArrow}>→</div>
            <div className={styles.flowNode}><span>Transactions today</span><strong>{compact(arc.stats.transactionsToday)}</strong><small>Execution layer</small></div>
            <div className={styles.flowArrow}>→</div>
            <div className={styles.flowNode}><span>Blocks</span><strong>{compact(arc.stats.totalBlocks)}</strong><small>{blockTime(arc.stats.averageBlockTimeMs)} average</small></div>
          </div>
          <div className={styles.flowFoot}><span>Recent receivers <strong>{compact(recent.receivers)}</strong></span><span>Avg recent block fill <strong>{percent(recent.avgGasFill)}</strong></span></div>
        </div>

        <div className={styles.panel}>
          <SectionHead title="Recent method mix" text={`Top methods across the latest ${transactions.length} transactions.`} />
          <div className={styles.methodBars}>
            {recent.methods.length ? recent.methods.map(([method, count]) => (
              <div className={styles.methodRow} key={method}>
                <div><span>{method}</span><strong>{count}</strong></div>
                <div className={styles.methodTrack}><span style={{ width: `${count / maxMethod * 100}%` }} /></div>
              </div>
            )) : <p className={styles.empty}>No recent method data.</p>}
          </div>
        </div>
      </section>

      <section className={styles.tables}>
        <div className={styles.tableCard}>
          <SectionHead title="Latest blocks" text="Block production and transaction counts." />
          <div className={styles.rows}>
            {blocks.slice(0, 12).map((block: any) => (
              <a key={String(block.hash ?? block.number)} className={styles.row} href={`${explorer}/block/${block.number}`} target="_blank" rel="noreferrer">
                <div><strong>Block {compact(block.number)}</strong><span>{short(block.miner)}</span></div>
                <span>{compact(block.transactions)} tx · {relativeTime(block.timestamp)}</span>
              </a>
            ))}
          </div>
        </div>

        <div className={styles.tableCard}>
          <SectionHead title="Latest transactions" text="Live transaction sample with explorer deep links." action={<a className={styles.action} href={explorer} target="_blank" rel="noreferrer">Explorer ↗</a>} />
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
  const venueTotal = Math.max(1, curveTrades + v4Trades);

  const tradePoints = useMemo<AnalyticsChartPoint[]>(() => (daily?.volume ?? []).map((row: any) => ({ time: toTime(row.day), value: Number(row.trades ?? 0), label: new Date(row.day).toLocaleDateString() })).filter((p: AnalyticsChartPoint) => p.time > 0 && Number.isFinite(p.value)), [daily]);
  const traderPoints = useMemo<AnalyticsChartPoint[]>(() => (daily?.volume ?? []).map((row: any) => ({ time: toTime(row.day), value: Number(row.traders ?? 0), label: new Date(row.day).toLocaleDateString() })).filter((p: AnalyticsChartPoint) => p.time > 0 && Number.isFinite(p.value)), [daily]);
  const launchPoints = useMemo<AnalyticsChartPoint[]>(() => (daily?.launches ?? []).map((row: any) => ({ time: toTime(row.day), value: Number(row.launches ?? 0), label: new Date(row.day).toLocaleDateString() })).filter((p: AnalyticsChartPoint) => p.time > 0 && Number.isFinite(p.value)), [daily]);

  return (
    <motion.div key="supershot" className={styles.view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={motionSpring.effectsDefault}>
      {degraded && <div className={styles.notice}><strong>Supershot analytics may be delayed.</strong><span>The protocol indexer is currently degraded.</span></div>}

      <section className={`${styles.hero} ${styles.supershotHero}`}>
        <div className={styles.heroHead}>
          <div><h1>supershot.fun analytics</h1><p>Launch, trading, graduation, venue, and buyback activity.</p></div>
          <a className={styles.action} href="/explore">View markets</a>
        </div>
        <div className={styles.metricGrid}>
          <Metric label="Trades · 24h" value={compact(daily?.volume?.at(-1)?.trades ?? stats?.traders_24h)} />
          <Metric label="Launches · 24h" value={compact(stats?.launches_24h)} />
          <Metric label="Unique traders" value={compact(stats?.unique_traders)} />
          <Metric label="Unique creators" value={compact(stats?.unique_creators)} />
          <Metric label="Graduated" value={compact(stats?.graduated)} />
          <Metric label="Open orders" value={compact(stats?.open_orders)} />
          <Metric label="Post-grad trades" value={compact(stats?.post_graduation_trades)} />
          <Metric label="Buyback executions" value={compact(stats?.buyback_count)} />
        </div>
      </section>

      <section className={styles.chartGridThree}>
        <AnalyticsChart title="Daily trades" subtitle="Indexed trading activity" points={tradePoints} rangesEnabled defaultRange="30d" />
        <AnalyticsChart title="Active traders" subtitle="Unique traders by day" points={traderPoints} kind="area" />
        <AnalyticsChart title="Token launches" subtitle="Markets created by day" points={launchPoints} kind="bar" />
      </section>

      <section className={styles.diagramGrid}>
        <div className={styles.panel}>
          <SectionHead title="Execution venue mix" text="Trading transitions from the curve to Uniswap v4 after graduation." />
          <div className={styles.venueBar}>
            <span style={{ width: `${curveTrades / venueTotal * 100}%` }} />
            <span style={{ width: `${v4Trades / venueTotal * 100}%` }} />
          </div>
          <div className={styles.venueLegend}>
            <div><span className={styles.dot} /><p><strong>{compact(curveTrades)}</strong> Curve trades</p></div>
            <div><span className={`${styles.dot} ${styles.dotAlt}`} /><p><strong>{compact(v4Trades)}</strong> Uniswap v4 trades</p></div>
          </div>
          <div className={styles.venueStats}><span>Curve traders <strong>{compact(curve?.traders)}</strong></span><span>v4 markets <strong>{compact(v4?.markets)}</strong></span></div>
        </div>

        <div className={styles.panel}>
          <SectionHead title="Market lifecycle" text="How Supershot activity moves through the protocol." />
          <div className={styles.lifecycle}>
            <div><span>Launch</span><strong>{compact(stats?.launches)}</strong></div><i>→</i>
            <div><span>Curve</span><strong>{compact(curveTrades)}</strong></div><i>→</i>
            <div><span>Graduated</span><strong>{compact(stats?.graduated)}</strong></div><i>→</i>
            <div><span>v4 trades</span><strong>{compact(stats?.post_graduation_trades)}</strong></div><i>→</i>
            <div><span>Buybacks</span><strong>{compact(stats?.buyback_count)}</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <SectionHead title="Buyback and burn" text="Recent protocol-funded executions." />
        {buybacks.length ? (
          <div className={styles.buybackRows}>
            {buybacks.slice(0, 10).map((item: any) => (
              <a href={`/token/${item.token}`} className={styles.buybackRow} key={item.tx_hash}>
                <div><strong>{item.post_graduation ? "DEX buyback" : "Curve buyback"}</strong><span>{short(item.token)}</span></div>
                <div><span>Quote spent</span><strong>{item.quote_spent}</strong></div>
                <div><span>Tokens burned</span><strong>{item.tokens_burned}</strong></div>
              </a>
            ))}
          </div>
        ) : <div className={styles.empty}>No buyback executions indexed yet.</div>}
      </section>
    </motion.div>
  );
}

export function AnalyticsDashboard(props: Props) {
  const [view, setView] = useState<View>("arc");

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <div>
          <span>Analytics</span>
          <p>Chain-wide network intelligence and Supershot protocol data.</p>
        </div>
        <div className={styles.toggle} role="tablist" aria-label="Analytics view">
          <button type="button" role="tab" aria-selected={view === "arc"} className={view === "arc" ? styles.active : ""} onClick={() => setView("arc")}>Arc</button>
          <button type="button" role="tab" aria-selected={view === "supershot"} className={view === "supershot" ? styles.active : ""} onClick={() => setView("supershot")}>supershot.fun</button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {view === "arc" ? <ArcDashboard arc={props.arc} arcDegraded={props.arcDegraded} /> : <SupershotDashboard stats={props.stats} daily={props.daily} buybacks={props.buybacks} venues={props.venues} degraded={props.degraded} />}
      </AnimatePresence>
    </div>
  );
}
