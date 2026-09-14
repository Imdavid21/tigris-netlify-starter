import { AppHeader } from "@/components/app-header";
import { CreateTokenForm } from "@/components/create-token-form";

export default function CreatePage() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>Launch a token.</h1>
        <p>Review every economic term before you sign.</p>
      </section>
      <CreateTokenForm />
    </main>
  );
}
