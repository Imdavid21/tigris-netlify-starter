
import { ui } from "@/styles/ui";
import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";
import { SiteFooter } from "@/components/site-footer";

export default function TradePage() {
  return (
    <main className={ui("app-shell explore-page")}>
      <AppHeader />
      <section className={ui("explore-intro")}>
        <div>
          <h1>Trade</h1>
          <p>Find a Celestial market, scan it, and trade from the token terminal.</p>
        </div>
      </section>
      <Launches />
      <SiteFooter />
    </main>
  );
}
