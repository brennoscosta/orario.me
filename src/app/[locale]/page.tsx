import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/Header";
import { getUser } from "@/lib/auth";
import { configuredChannels } from "@/lib/channels";
import { monthlyLimit } from "@/lib/limits";
import { getDict } from "@/lib/i18n";
import { isLocale, SITE_URL } from "@/lib/i18n/config";
import { channels } from "@/lib/plans";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: { "pt-BR": "/pt", en: "/en", "x-default": "/pt" },
    },
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const t = dict.home;
  const user = await getUser();
  const available = await configuredChannels();
  const waLimit = (await monthlyLimit("free", "whatsapp")) ?? 0;
  const smsLimit = (await monthlyLimit("free", "sms")) ?? 0;
  const fill = (text: string) => text.replace("{whatsapp}", String(waLimit)).replace("{sms}", String(smsLimit));
  const startHref = user ? `/${locale}/app` : `/${locale}/signup`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Orario",
      url: `${SITE_URL}/${locale}`,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      description: dict.meta.description,
      inLanguage: locale === "pt" ? "pt-BR" : "en",
      offers: { "@type": "Offer", price: "0", priceCurrency: locale === "pt" ? "BRL" : "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: fill(item.a) },
      })),
    },
  ];

  return (
    <>
      <Header locale={locale} dict={dict} user={user} />
      <main id="main">
        <section className="hero">
          <h1 className="display">{t.h1}</h1>
          <p className="lead">{t.lead}</p>
          <div className="hero-actions">
            <Link href={startHref} className="button">
              {user ? dict.nav.agenda : t.cta}
            </Link>
            {!user && <span className="hero-note">{t.ctaNote}</span>}
          </div>

          <figure className="carte-wrap" aria-label={t.carte.label}>
            <div className="carte">
              <p className="carte-day">{t.carte.day}</p>
              <ol>
                {t.carte.items.map((item) => (
                  <li key={item.title}>
                    <span className="carte-time">{item.time}</span>
                    <span>
                      <span className="carte-title">{item.title}</span>
                      <br />
                      <span className="carte-note">{item.note}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="bubble">
              <small>{t.carte.bubbleMeta}</small>
              {t.carte.bubble}
            </p>
          </figure>
        </section>

        <section className="creed">
          <h2 className="display">{t.creed.title}</h2>
          <p>{t.creed.body}</p>
          <ul aria-label={dict.form.channel}>
            {channels.map((channel) => (
              <li key={channel}>
                {dict.channels[channel]}
                {!available[channel] && <span className="tag">{t.creed.soon}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="quiet-faq">
          <h2>{t.faq.title}</h2>
          <div className="faq">
            {t.faq.items.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{fill(item.a)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="creed creed--closing">
          <h2 className="display">{t.closing.title}</h2>
          <Link href={startHref} className="button">
            {user ? dict.nav.agenda : t.closing.cta}
          </Link>
        </section>
      </main>
      <Footer dict={dict} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
