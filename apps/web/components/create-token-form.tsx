"use client";

import { FormEvent, useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import { addresses, arcTestnet } from "@/lib/arc";
import { factoryAbi } from "@/lib/abi";

export function CreateTokenForm() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect a wallet first.");
      return;
    }

    if (!addresses.factory) {
      setFormError("Factory address is not configured.");
      return;
    }

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const symbol = String(data.get("symbol") ?? "").trim();

    if (!name || !symbol) {
      setFormError("Name and ticker are required.");
      return;
    }

    try {
      if (chainId !== arcTestnet.id) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      await writeContractAsync({
        address: addresses.factory,
        abi: factoryAbi,
        functionName: "createToken",
        args: [name, symbol],
        chainId: arcTestnet.id
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
      <input name="name" maxLength={32} placeholder="Name" required />
      <input name="symbol" maxLength={10} placeholder="Ticker" required />
      <input name="image" type="file" accept="image/*" disabled />
      <textarea name="description" placeholder="Description (metadata phase)" disabled />
      <input name="website" placeholder="Website (metadata phase)" disabled />
      <input name="twitter" placeholder="X (metadata phase)" disabled />
      <input name="telegram" placeholder="Telegram (metadata phase)" disabled />

      <button type="submit" disabled={isPending || receipt.isLoading}>
        {isPending
          ? "Confirm in wallet"
          : receipt.isLoading
            ? "Confirming"
            : receipt.isSuccess
              ? "Launched"
              : "Launch token"}
      </button>

      {hash && <p style={{ opacity: 0.65, wordBreak: "break-all" }}>Tx: {hash}</p>}
      {(formError || error) && (
        <p style={{ color: "#ff9d9d" }}>
          {formError ?? error?.message}
        </p>
      )}
    </form>
  );
}
