
import { ui } from "@/styles/ui";
import { AppHeader } from "@/components/app-header";
import { CreateTokenForm } from "@/components/create-token-form";
import { SiteFooter } from "@/components/site-footer";

export default function CreatePage() {
  return (
    <main className={ui("app-shell")}>
      <AppHeader />
      <section className={ui("page-heading compact")}>
        <h1>Launch a token.</h1>
        <p>Review every economic term before you sign.</p>
      </section>
      <CreateTokenForm />
      <SiteFooter />
    </main>
  );
}
