import { AppHeader } from "@/components/app-header";
import { ProfilePanel } from "@/components/profile-panel";

export default function ProfilePage() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>Your Celestial account.</h1>
        <p>Markets, positions, creator fees, and trading activity in one place.</p>
      </section>
      <ProfilePanel />
    </main>
  );
}
