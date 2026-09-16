import { AppHeader } from "@/components/app-header";
import { ProfilePanel } from "@/components/profile-panel";
import { SiteFooter } from "@/components/site-footer";
import styles from "./PortfolioPage.module.css";

export default function PortfolioPage() {
  return (
    <main className={`app-shell ${styles.page}`}>
      <AppHeader />
      <section className="page-heading compact">
        <h1>Portfolio</h1>
      </section>
      <ProfilePanel />
      <SiteFooter />
    </main>
  );
}
