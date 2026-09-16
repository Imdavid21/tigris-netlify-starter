import { AppHeader } from "@/components/app-header";
import { CreateTokenForm } from "@/components/create-token-form";
import { SiteFooter } from "@/components/site-footer";
import styles from "./CreatePage.module.css";

export default function CreatePage() {
  return (
    <main className={`app-shell ${styles.page}`}>
      <AppHeader />
      <section className="page-heading compact">
        <h1>Create</h1>
      </section>
      <CreateTokenForm />
      <SiteFooter />
    </main>
  );
}
