import Link from "next/link";
import { logout } from "@/app/[locale]/actions";
import type { User } from "@/db/schema";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { LocaleSwitch } from "./LocaleSwitch";

export function Header({ locale, dict, user }: { locale: Locale; dict: Dictionary; user: User | null }) {
  const t = dict.nav;
  return (
    <header className="masthead">
      <Link href={user ? `/${locale}/app` : `/${locale}`} className="wordmark" aria-label="Orario">
        Orario
      </Link>
      <nav aria-label="Orario">
        <LocaleSwitch locale={locale} label={t.otherLanguage} />
        {user ? (
          <>
            <Link href={`/${locale}/app`}>{t.agenda}</Link>
            <Link href={`/${locale}/app/settings`}>{t.settings}</Link>
            <form action={logout}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="linklike">
                {t.logout}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href={`/${locale}/login`}>{t.login}</Link>
            <Link href={`/${locale}/signup`} className="button button--small">
              {t.signup}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function Footer({ dict }: { dict: Dictionary }) {
  return (
    <footer className="colophon">
      <div className="inner">
        <span>
          <span className="wordmark">Orario</span>
          {"  "}
          {dict.footer.tagline}
        </span>
        <span>
          © {new Date().getFullYear()} Orario. {dict.footer.rights}
        </span>
      </div>
    </footer>
  );
}
