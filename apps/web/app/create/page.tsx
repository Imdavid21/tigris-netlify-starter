import { AppHeader } from "@/components/app-header";
import { CreateTokenForm } from "@/components/create-token-form";

export default function CreatePage() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>Put a market in orbit.</h1>
        <p>Define the market, review the terms, and launch onchain.</p>
      </section>
      <CreateTokenForm />
    </main>
  );
}
