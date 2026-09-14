import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";

export default function Home() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="explore-hero">
        <div>
            <h1>Markets in orbit.</h1>
          <p>Discover, launch, and trade onchain markets built for Arc.</p>
        </div>
        <a href="/create" className="primary-link">Launch a token</a>
      </section>
      <Launches />
    </main>
  );
}
