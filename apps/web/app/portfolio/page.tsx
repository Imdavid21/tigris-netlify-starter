import { AppHeader } from "@/components/app-header";
import { ProfilePanel } from "@/components/profile-panel";
import { SiteFooter } from "@/components/site-footer";

export default function PortfolioPage() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>Portfolio</h1>
        <p>Your positions, launches, orders, fees, and trading activity.</p>
      </section>
      <ProfilePanel />
      <SiteFooter />
    </main>
  );
}
