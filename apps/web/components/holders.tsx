"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { API_URL } from "@/lib/api";

type Holder = {
  holder: string;
  balance: string;
};

export function Holders({ token }: { token: string }) {
  const [items, setItems] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_URL + "/tokens/" + token + "/holders")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>Top holders</strong>
        <span className="muted" style={{ fontSize: 13 }}>
          Indexed from transfers
        </span>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid #29302c" }}>
        {loading ? (
          <p className="muted">Loading holders...</p>
        ) : !items.length ? (
          <p className="muted">No indexed holders yet.</p>
        ) : (
          items.slice(0, 20).map((item, index) => (
            <div
              key={item.holder}
              style={{
                display: "grid",
                gridTemplateColumns: "34px 1fr auto",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid #1d211f",
                fontSize: 13
              }}
            >
              <span className="muted">{index + 1}</span>
              <a
                href={"https://testnet.arcscan.app/address/" + item.holder}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
                title={"Open " + item.holder + " on Arcscan"}
              >
                {item.holder.slice(0, 7)}...{item.holder.slice(-5)}
              </a>
              <span>
                {Number(formatUnits(BigInt(item.balance), 18)).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 0 }
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
