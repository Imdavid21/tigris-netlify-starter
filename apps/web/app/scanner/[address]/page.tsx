import { isAddress } from "viem";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { Holders } from "@/components/holders";
import { RecentTrades } from "@/components/recent-trades";
import { API_URL } from "@/lib/api";
import { quoteAssets } from "@/lib/celestial";
import { ui } from "@/styles/ui";
type Props = { params: Promise<{ address: string }> };
export default async function ScannerPage({ params }: Props) {
  const {address} = await params;
  if (!isAddress(address)) notFound();
  const token = await fetch(API_URL + "/tokens/" + address, {cache:"no-store",signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).catch(()=>null);
  const pair = quoteAssets.find(q=>q.address.toLowerCase() === token?.quote_asset?.toLowerCase()) ?? quoteAssets[0];
  return <main className={ui("app-shell")}><AppHeader />
    <section className={ui("explore-intro")}><div><h1>{token?.name ?? "Token scanner"}</h1><p>{token?.symbol ? token.symbol + " · " : ""}Inspect the token before trading.</p></div><a href={"/token/"+address} className={ui("primary-link")}>Open market</a></section>
    {!token && <div className={ui("system-notice")}>This token is not currently available from the index. Use the explorer to inspect its contract.</div>}
    <section className={ui("about-panel")}><div className={ui("section-title")}><strong>Contract overview</strong><a href={"https://testnet.arcscan.app/address/"+address} target="_blank" rel="noreferrer">Arc Explorer ↗</a></div>
      <div className={ui("about-grid")}><div><span>Token</span><a href={"https://testnet.arcscan.app/address/"+address} target="_blank" rel="noreferrer">{address.slice(0,10)}...{address.slice(-8)}</a></div><div><span>Market</span><strong>{token?.status ?? "Unavailable"}</strong></div><div><span>Pair</span><strong>{token ? pair.symbol : "Unavailable"}</strong></div><div><span>Generation</span><strong>{token?.generation ?? "Unavailable"}</strong></div><div><span>Creator</span>{token?.creator ? <a href={"https://testnet.arcscan.app/address/"+token.creator} target="_blank" rel="noreferrer">{token.creator.slice(0,10)}...{token.creator.slice(-8)}</a> : <strong>Unavailable</strong>}</div><div><span>Curve</span>{token?.curve_address ? <a href={"https://testnet.arcscan.app/address/"+token.curve_address} target="_blank" rel="noreferrer">{token.curve_address.slice(0,10)}...{token.curve_address.slice(-8)}</a> : <strong>Unavailable</strong>}</div></div>
    </section>
    <div className={ui("scanner-tables")}><Holders token={address}/><RecentTrades token={address} quoteDecimals={pair.decimals} quoteSymbol={pair.symbol}/></div><SiteFooter />
  </main>;
}
