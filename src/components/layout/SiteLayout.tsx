import { Link } from "@tanstack/react-router";
import { ExternalLink, Share2 } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Share" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

const legal = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Use" },
  { to: "/cookies", label: "Cookies & Ads" },
] as const;

const external = [
  { href: "https://zeelinks.com.pk", label: "Zeelinks" },
  { href: "https://passport.zeelinks.com.pk", label: "Passport AI Studio" },
  { href: "https://facebook.com/zeelinksis", label: "Facebook" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <span
              className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground"
              aria-hidden
            >
              <Share2 className="size-4" />
            </span>
            ZeeShare
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 py-10">{children}</main>

      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Our services</p>
              <nav aria-label="External services" className="flex flex-wrap gap-4">
                {external.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {item.label}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </nav>
            </div>
            <nav aria-label="Legal" className="flex flex-wrap gap-4">
              {legal.map((item) => (
                <Link key={item.to} to={item.to} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} ZeeShare · Local network file sharing</p>
            <p>
              A product of{" "}
              <a
                href="https://zeelinks.com.pk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground transition-colors hover:underline"
              >
                Zeelinks
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ContentPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4">
      <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-muted-foreground">{intro}</p>}
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-foreground/85">
        {children}
      </div>
    </article>
  );
}
