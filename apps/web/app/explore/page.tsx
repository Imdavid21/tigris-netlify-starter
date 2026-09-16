import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";
import { SiteFooter } from "@/components/site-footer";
import styles from "./explore.module.css";

export default function ExplorePage() {
  return (
    <main className={styles.page}>
      <AppHeader />

      <div className={styles.canvas}>
        <Launches />
      </div>

      <SiteFooter />
    </main>
  );
}
