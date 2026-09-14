import { getAddress, isAddress } from "viem";
import { notFound } from "next/navigation";
import { TokenMarket } from "@/components/token-market";

type Props = { params: Promise<{ address: string }> };

export default async function TokenPage({ params }: Props) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const token = getAddress(address);
  return <TokenMarket token={token} />;
}
