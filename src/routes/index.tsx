import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ClientOnly";
import { Infinity as InfinityIcon, ShieldCheck, Zap } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ShareBoard } from "@/components/zeeshare/ShareBoard";

const title = "ZeeShare — Unlimited Local Network File Sharing";
const description =
  "Share files between devices on the same Wi-Fi with no size limit, no accounts and no cloud storage. Open the site, drop a file, download it on the other device.";

// This is a single-line comment you can add here
/* from line 84 to
   to 96 contains add block or space for advertisement */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "ZeeShare",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any modern browser",
          description,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Home,
});

const highlights = [
  {
    icon: InfinityIcon,
    title: "No size limit",
    body: "Files stream directly between devices in small chunks, so a 50 GB video works the same as a photo.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing is uploaded",
    body: "No copy is kept on any server. Files move device to device across your own network.",
  },
  {
    icon: Zap,
    title: "Local network speed",
    body: "Transfers run at your Wi-Fi or cable speed instead of your internet upload speed.",
  },
];

function Home() {
  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-3xl px-4 text-center">
        <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
          Share files across <span className="text-brand-gradient">one network</span>, without
          limits
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Open this page on any two devices connected to the same Wi-Fi. Drop a file on one, download
          it on the other.
        </p>
      </div>



      /*
 * Advertisement block
 * Reserved space for future promotional content.
 * Keep this section separate from the main UI.
 */
     <div className="mx-auto mt-6 w-full max-w-3xl px-4">
    <div className="panel flex items-center justify-center gap-2 px-4 py-3 text-sm">
      <span>📢</span>
      <strong>Remote Jobs Available</strong>
      <span className="text-muted-foreground">— We're hiring!</span>
      <a
       // href="/contact"
        href="https://zeelinks.com.pk"
        className="font-semibold text-primary hover:underline"
      >
        Learn More →
      </a>
    </div>
  </div>

  <div className="mt-10">



        
        <ClientOnly
          fallback={
            <div className="mx-auto w-full max-w-3xl px-4">
              <div className="panel h-72" aria-hidden />
            </div>
          }
        >
          <ShareBoard />
        </ClientOnly>
      </div>

      <div className="mx-auto mt-14 w-full max-w-5xl px-4">
        <h2 className="text-center font-display text-2xl font-semibold">
          Why ZeeShare is different
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="panel p-5 text-left">
              <item.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}

