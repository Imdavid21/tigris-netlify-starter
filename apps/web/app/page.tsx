import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";

export default function Home() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="explore-hero">
        <div>
            <h1>Find the next market before everyone else.</h1>
          <p>Launch, trade, and graduate USDC-native tokens on Arc.</p>
        </div>
        <a href="/create" className="primary-link">Launch a token</a>
      </section>
      <Launches />
    </main>
  );
}
