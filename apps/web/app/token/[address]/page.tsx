import { getAddress } from "viem";
import { TokenMarket } from "@/components/token-market";

type Props = { params: Promise<{ address: string }> };

export default async function TokenPage({ params }: Props) {
  const { address } = await params;
  const token = getAddress(address);
  return <TokenMarket token={token} />;
}
