"use client";

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  degraded: boolean;
  api: boolean;
  indexer: boolean;
  ingestion: string;
};

export function ProtocolStatus() {
  const [health, setHealth] = useState<Health>();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const next = await fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ ok: false, degraded: true, api: false, indexer: false, ingestion: "offline" }));
      if (mounted) setHealth(next);
    };

    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!health || health.ok) return null;

  const detail = !health.api
    ? "API unavailable. Discovery and analytics may be stale."
    : !health.indexer
      ? "Indexer unavailable. New launches and market activity may appear late."
      : health.ingestion !== "live"
        ? "Indexer is catching up. Market data may be delayed."
        : "Some indexed services are degraded.";

  return (
    <div className="protocol-status" role="status">
      <span className="protocol-status-dot" />
      <strong>Degraded performance</strong>
      <span>{detail} Trading still reads critical state from contracts.</span>
    </div>
  );
}
