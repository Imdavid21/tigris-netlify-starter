"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { erc20Abi, factoryAbi } from "@/lib/abi";
import {
  celestialAddresses,
  celestialFactoryAbi,
  quoteAssets
} from "@/lib/celestial";
import { ensureArcChain } from "@/lib/wallet";
import { useWalletSession } from "@/components/wallet-session";

function getProvider(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

export function CreateTokenForm() {
  const { address, connect } = useWalletSession();
  const [status, setStatus] = useState<"idle" | "wallet" | "submitted" | "confirmed">("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [error, setError] = useState<string>();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [quoteSymbol, setQuoteSymbol] = useState<"USDC" | "EURC" | "cirBTC">("USDC");
  const [developerBuy, setDeveloperBuy] = useState("");
  const [creatorFeeWallet, setCreatorFeeWallet] = useState("");
  const [creatorTax, setCreatorTax] = useState("0");
  const [holderFee, setHolderFee] = useState("0");
  const [snipeExemptions, setSnipeExemptions] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const previewSymbol = useMemo(() => symbol.trim().toUpperCase() || "TOKEN", [symbol]);
  const selectedQuote = quoteAssets.find((q) => q.symbol === quoteSymbol) ?? quoteAssets[0];
  const celestialReady = Boolean(celestialAddresses.factory);

  const usesCelestialFeatures =
    Boolean(description.trim() || image.trim() || website.trim() || twitter.trim() || telegram.trim()) ||
    Boolean(developerBuy && Number(developerBuy) > 0) ||
    Boolean(creatorFeeWallet.trim()) ||
    Number(creatorTax) > 0 ||
    Number(holderFee) > 0 ||
    Boolean(snipeExemptions.trim()) ||
    quoteSymbol !== "USDC";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const ethereum = getProvider();
    if (!ethereum) {
      setError("No EVM wallet detected.");
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

      const account = address ?? await connect();
      if (!account) throw new Error("No wallet account available.");

      const wallet = createWalletClient({
        account,
        chain: arcTestnet,
        transport: custom(ethereum)
      });
      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(
          process.env.NEXT_PUBLIC_ARC_RPC_URL ??
            "https://rpc.testnet.arc.network"
        )
      });

      let txHash: `0x${string}`;
      let receiptAbi: typeof factoryAbi | typeof celestialFactoryAbi;

      if (celestialAddresses.factory) {
        const creatorTaxBps = BigInt(Math.round(Math.max(0, Number(creatorTax || "0")) * 100));
        const holderFeeBps = BigInt(Math.round(Math.max(0, Number(holderFee || "0")) * 100));
        if (creatorTaxBps > 500n) throw new Error("Creator tax cannot exceed 5%.");
        if (holderFeeBps > 300n) throw new Error("Holder fee sharing cannot exceed 3%.");

        const feeRecipient =
          creatorFeeWallet.trim() && isAddress(creatorFeeWallet.trim())
            ? creatorFeeWallet.trim() as `0x${string}`
            : zeroAddress;

        const exemptions = snipeExemptions
          .split(/[\n,\s]+/)
          .map((x) => x.trim())
          .filter(Boolean);

        if (exemptions.some((x) => !isAddress(x))) {
          throw new Error("One or more snipe-exemption addresses are invalid.");
        }

        const params = {
          name: cleanName,
          symbol: cleanSymbol,
          quoteAsset: selectedQuote.address,
          creatorFeeRecipient: feeRecipient,
          creatorTaxBps,
          holderFeeBps,
          metadata: {
            description: description.trim(),
            image: image.trim(),
            website: website.trim(),
            twitter: twitter.trim(),
            telegram: telegram.trim()
          },
          snipeExemptions: exemptions as `0x${string}`[]
        };

        const devBuyAmount =
          developerBuy && Number(developerBuy) > 0
            ? parseUnits(developerBuy, selectedQuote.decimals)
            : 0n;

        if (devBuyAmount > 0n) {
          const allowance = await publicClient.readContract({
            address: selectedQuote.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, celestialAddresses.factory]
          }) as bigint;

          if (allowance < devBuyAmount) {
            setStatus("wallet");
            const approveHash = await wallet.writeContract({
              address: selectedQuote.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [celestialAddresses.factory, devBuyAmount]
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }

          const preview = await publicClient.readContract({
            address: celestialAddresses.factory,
            abi: celestialFactoryAbi,
            functionName: "previewInitialBuy",
            args: [selectedQuote.address, creatorTaxBps, holderFeeBps, devBuyAmount]
          }) as readonly [bigint, bigint];

          const minTokensOut = preview[0] * 99n / 100n;
          txHash = await wallet.writeContract({
            address: celestialAddresses.factory,
            abi: celestialFactoryAbi,
            functionName: "createTokenAndBuy",
            args: [params, devBuyAmount, minTokensOut]
          });
        } else {
          txHash = await wallet.writeContract({
            address: celestialAddresses.factory,
            abi: celestialFactoryAbi,
            functionName: "createToken",
            args: [params]
          });
        }

        receiptAbi = celestialFactoryAbi;
      } else {
        if (usesCelestialFeatures) {
          throw new Error(
            "The Celestial protocol deployment is not active yet. Advanced launch terms cannot be safely stored on the V1 factory."
          );
        }
        if (!addresses.factory) throw new Error("Factory address is not configured.");

        txHash = await wallet.writeContract({
          address: addresses.factory,
          abi: factoryAbi,
          functionName: "createToken",
          args: [cleanName, cleanSymbol]
        });
        receiptAbi = factoryAbi;
      }

      setHash(txHash);
      setStatus("submitted");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("confirmed");

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: receiptAbi,
            data: log.data,
            topics: log.topics
          });
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

  const graduationText =
    quoteSymbol === "cirBTC" ? "0.10 cirBTC" : "10,000 " + quoteSymbol;

  return (
    <form onSubmit={submit} className="create-grid">
      <div className="create-main">
        <section className="form-card">
          <div className="form-section-head">
            <div><span className="step-index">01</span><h2>Token</h2></div>
            <span className="live-badge">{celestialReady ? "Celestial" : "V1"}</span>
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

          <label>
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this market?" />
          </label>

          <div className="field-grid two">
            <label><span>Image URL</span><input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https:// or ipfs://" /></label>
            <label><span>Website</span><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></label>
            <label><span>X / Twitter</span><input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" /></label>
            <label><span>Telegram</span><input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="t.me/..." /></label>
          </div>
        </section>

        <section className="form-card">
          <div className="form-section-head">
            <div><span className="step-index">02</span><h2>Launch economics</h2></div>
          </div>

          <div className="field-grid two">
            <label>
              <span>Pair asset</span>
              <select value={quoteSymbol} onChange={(e) => setQuoteSymbol(e.target.value as typeof quoteSymbol)}>
                {quoteAssets.map((q) => <option key={q.symbol} value={q.symbol}>{q.symbol}</option>)}
              </select>
            </label>
            <label>
              <span>Developer buy</span>
              <input value={developerBuy} onChange={(e) => setDeveloperBuy(e.target.value)} inputMode="decimal" placeholder={"0 " + quoteSymbol} />
            </label>
          </div>

          <div className="economics-table">
            <div><span>Supply</span><strong>1,000,000,000</strong></div>
            <div><span>Pair</span><strong>{quoteSymbol}</strong></div>
            <div><span>Base trade fee</span><strong>1.00%</strong></div>
            <div><span>Graduation target</span><strong>{graduationText}</strong></div>
            <div><span>Launch protection</span><strong>5-second decay</strong></div>
            <div><span>Liquidity</span><strong>Reserved + locked</strong></div>
          </div>

          <button type="button" className="text-button" onClick={() => setAdvanced(!advanced)}>
            {advanced ? "Hide" : "Show"} advanced controls
          </button>

          {advanced && (
            <div className="advanced-grid">
              <label><span>Creator fee wallet</span><input value={creatorFeeWallet} onChange={(e) => setCreatorFeeWallet(e.target.value)} placeholder={address ?? "0x..."} /></label>
              <label><span>Creator tax</span><input value={creatorTax} onChange={(e) => setCreatorTax(e.target.value)} inputMode="decimal" placeholder="0.00" /></label>
              <label><span>Holder fee sharing</span><input value={holderFee} onChange={(e) => setHolderFee(e.target.value)} inputMode="decimal" placeholder="0.00" /></label>
              <label className="full"><span>Snipe-tax exemptions</span><input value={snipeExemptions} onChange={(e) => setSnipeExemptions(e.target.value)} placeholder="0xabc..., 0xdef..." /></label>
            </div>
          )}
        </section>

        <section className="form-card review-card">
          <div className="form-section-head">
            <div><span className="step-index">03</span><h2>Review</h2></div>
          </div>
          <p className="review-copy">
            Metadata and launch economics are immutable for this market once the transaction confirms.
            {developerBuy && Number(developerBuy) > 0 ? " The developer buy executes in the same launch transaction after token approval." : ""}
          </p>

          <button className="launch-cta" type="submit" disabled={status === "wallet" || status === "submitted"}>
            {status === "wallet" ? "Confirm in wallet" : status === "submitted" ? "Confirming launch" : status === "confirmed" ? "Launched" : "Launch token"}
          </button>

          {hash && <p className="tx-hash">Tx {hash}</p>}
          {error && <p className="form-error">{error}</p>}
        </section>
      </div>

      <aside className="launch-preview">
        <div className="token-avatar">{previewSymbol.slice(0, 2)}</div>
        <h3>{name || "Untitled token"}</h3>
        <p className="preview-symbol">{"$" + previewSymbol}</p>
        <p className="preview-description">{description || "Add a token description."}</p>

        <div className="preview-rule" />
        <div className="preview-stat"><span>Market</span><strong>Bonding curve</strong></div>
        <div className="preview-stat"><span>Pair</span><strong>{quoteSymbol}</strong></div>
        <div className="preview-stat"><span>Graduation</span><strong>{graduationText}</strong></div>
        <div className="preview-stat"><span>Creator tax</span><strong>{Number(creatorTax || 0).toFixed(2)}%</strong></div>
        <div className="preview-stat"><span>Holder sharing</span><strong>{Number(holderFee || 0).toFixed(2)}%</strong></div>
        <div className="preview-stat"><span>Liquidity</span><strong>Locked</strong></div>

        <div className="preview-note">
          <span className="status-dot" />
          Trading opens after the launch transaction confirms.
        </div>
      </aside>
    </form>
  );
}
