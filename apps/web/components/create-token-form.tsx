"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  getAddress,
  http,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { factoryAbi } from "@/lib/abi";
import { ensureArcChain } from "@/lib/wallet";

function getProvider(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

export function CreateTokenForm() {
  const [status, setStatus] = useState<"idle" | "wallet" | "submitted" | "confirmed">("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const previewSymbol = useMemo(() => symbol.trim().toUpperCase() || "TOKEN", [symbol]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const ethereum = getProvider();
    if (!ethereum) {
      setError("No EVM wallet detected.");
      return;
    }
    if (!addresses.factory) {
      setError("Factory address is not configured.");
      return;
    }

    const cleanName = name.trim();
    const cleanSymbol = symbol.trim();
    if (!cleanName || !cleanSymbol) {
      setError("Name and ticker are required.");
      return;
    }

    try {
      setStatus("wallet");
      await ensureArcChain(ethereum);

      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts[0]) throw new Error("No wallet account available.");

      const account = getAddress(accounts[0]);
      const wallet = createWalletClient({
        account,
        chain: arcTestnet,
        transport: custom(ethereum)
      });

      const txHash = await wallet.writeContract({
        address: addresses.factory,
        abi: factoryAbi,
        functionName: "createToken",
        args: [cleanName, cleanSymbol]
      });

      setHash(txHash);
      setStatus("submitted");

      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network")
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("confirmed");

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "TokenCreated") {
            const args = decoded.args as { token: `0x${string}` };
            window.location.href = "/token/" + args.token;
            return;
          }
        } catch {}
      }
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  return (
    <form onSubmit={submit} className="create-grid">
      <div className="create-main">
        <section className="form-card">
          <div className="form-section-head">
            <div>
              <span className="step-index">01</span>
              <h2>Token</h2>
            </div>
            <span className="live-badge">Live</span>
          </div>

          <div className="field-grid two">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Arc Cat" required />
            </label>
            <label>
              <span>Ticker</span>
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={10} placeholder="ACAT" required />
            </label>
          </div>

          <label className="v2-field">
            <span>Description <b>V2</b></span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this token?" disabled />
          </label>

          <div className="field-grid two">
            <label className="v2-field"><span>Image <b>V2</b></span><input type="file" disabled /></label>
            <label className="v2-field"><span>Website <b>V2</b></span><input placeholder="https://" disabled /></label>
            <label className="v2-field"><span>X / Twitter <b>V2</b></span><input placeholder="@handle" disabled /></label>
            <label className="v2-field"><span>Telegram <b>V2</b></span><input placeholder="t.me/..." disabled /></label>
          </div>
        </section>

        <section className="form-card">
          <div className="form-section-head">
            <div>
              <span className="step-index">02</span>
              <h2>Launch economics</h2>
            </div>
            <span className="live-badge">Live</span>
          </div>

          <div className="economics-table">
            <div><span>Supply</span><strong>1,000,000,000</strong></div>
            <div><span>Pair</span><strong>USDC</strong></div>
            <div><span>Trade fee</span><strong>1.00%</strong></div>
            <div><span>Creator share</span><strong>25% of fee</strong></div>
            <div><span>Graduation target</span><strong>$10,000</strong></div>
            <div><span>Liquidity</span><strong>Reserved + locked</strong></div>
          </div>

          <button type="button" className="text-button" onClick={() => setAdvanced(!advanced)}>
            {advanced ? "Hide" : "Show"} PONS-parity controls
          </button>

          {advanced && (
            <div className="advanced-grid">
              <label className="v2-field"><span>Developer buy <b>V2</b></span><input placeholder="0 USDC" disabled /></label>
              <label className="v2-field"><span>Creator fee wallet <b>V2</b></span><input placeholder="0x..." disabled /></label>
              <label className="v2-field"><span>Creator tax <b>V2</b></span><input placeholder="0.00%" disabled /></label>
              <label className="v2-field"><span>Holder fee sharing <b>V2</b></span><input placeholder="Disabled" disabled /></label>
              <label className="v2-field full"><span>Snipe-tax exemptions <b>V2</b></span><input placeholder="Wallet addresses" disabled /></label>
            </div>
          )}
        </section>

        <section className="form-card review-card">
          <div className="form-section-head">
            <div>
              <span className="step-index">03</span>
              <h2>Review</h2>
            </div>
          </div>
          <p className="review-copy">The current Testnet factory makes the live economics immutable. Metadata and advanced creator controls are shown here so you can test the full product direction, but they require the V2 factory.</p>

          <button className="launch-cta" type="submit" disabled={status === "wallet" || status === "submitted"}>
            {status === "wallet" ? "Confirm in wallet" : status === "submitted" ? "Confirming launch" : status === "confirmed" ? "Launched" : "Launch token"}
          </button>

          {hash && <p className="tx-hash">Tx {hash}</p>}
          {error && <p className="form-error">{error}</p>}
        </section>
      </div>

      <aside className="launch-preview">
        <span className="kicker">Preview</span>
        <div className="token-avatar">{previewSymbol.slice(0, 2)}</div>
        <h3>{name || "Untitled token"}</h3>
        <p className="preview-symbol">${previewSymbol}</p>
        <p className="preview-description">{description || "Token description will appear here in V2."}</p>

        <div className="preview-rule" />
        <div className="preview-stat"><span>Market</span><strong>Bonding curve</strong></div>
        <div className="preview-stat"><span>Pair</span><strong>USDC</strong></div>
        <div className="preview-stat"><span>Graduation</span><strong>$10,000</strong></div>
        <div className="preview-stat"><span>Liquidity</span><strong>Locked</strong></div>

        <div className="preview-note">
          <span className="status-dot" />
          Trading opens after the launch transaction confirms.
        </div>
      </aside>
    </form>
  );
}
