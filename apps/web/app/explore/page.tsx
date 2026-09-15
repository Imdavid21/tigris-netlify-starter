import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";
import { SiteFooter } from "@/components/site-footer";

export default function ExplorePage() {
  return (
    <main className="app-shell explore-page">
      <AppHeader />
      <section className="explore-intro">
        <div>
          <h1>Discover</h1>
          <p>New, active, near-graduation, and graduated Celestial markets on Arc.</p>
        </div>
        <a href="/create" className="primary-link">Launch a token</a>
      </section>
      <Launches />
      <SiteFooter />
    </main>
  );
}
