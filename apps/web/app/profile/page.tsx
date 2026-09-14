import { AppHeader } from "@/components/app-header";
import { ProfilePanel } from "@/components/profile-panel";
import { SiteFooter } from "@/components/site-footer";

export default function ProfilePage() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>Your launchpad.</h1>
        <p>Launches, creator fees, positions, and trading activity.</p>
      </section>
      <ProfilePanel />
      <SiteFooter />
    </main>
  );
}
