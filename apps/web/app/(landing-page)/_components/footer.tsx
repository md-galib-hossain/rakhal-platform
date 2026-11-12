import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import rakhalLogo from "@/public/logo-mark.svg";

export function Footer() {
  const t = useTranslations("landing.footer");
  const tn = useTranslations("landing.nav");
  const tc = useTranslations("common");
  const year = new Date().getFullYear();

  // TODO(landing): terms/privacy pages don't exist yet (backend has versioned legal docs —
  // RAKHAL-236); wire these to real routes when the legal pages are built.
  const columns = [
    {
      title: t("product"),
      links: [
        { label: tn("features"), href: "#features" },
        { label: tn("pricing"), href: "#pricing" },
        { label: tn("faq"), href: "#faq" },
      ],
    },
    {
      title: t("company"),
      links: [
        { label: t("about"), href: "#" },
        { label: t("contact"), href: "mailto:hello@rakhal.app" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { label: t("terms"), href: "#" },
        { label: t("privacy"), href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="block h-9 w-[150px] overflow-hidden">
            <Image src={rakhalLogo} alt="Rakhal" className="h-full w-full object-cover object-left" />
          </Link>
          <p className="mt-4 max-w-xs text-sm text-sidebar-muted">{t("tagline")}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-sidebar-muted">{col.title}</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-sidebar-foreground/10">
        <p className="mx-auto max-w-6xl px-6 py-6 text-sm text-sidebar-muted">
          © {year} {tc("appName")} · {t("rights")}
        </p>
      </div>
    </footer>
  );
}
