import { ProfilePanel } from "@/components/profile-panel";

export default function ProfilePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/" className="brand">Arc Launchpad</a>
        <nav className="nav">
          <a href="/">Explore</a>
          <a href="/analytics">Analytics</a>
          <a href="/create">Create</a>
          <a href="/profile">Profile</a>
        </nav>
      </header>

      <section className="page-heading">
        <h1>Profile</h1>
        <p>Creator fees and wallet activity on Arc.</p>
      </section>

      <ProfilePanel />
    </main>
  );
}
