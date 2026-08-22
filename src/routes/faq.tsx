import { createFileRoute } from "@tanstack/react-router";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "ZeeShare FAQ — Limits, Privacy and Supported Devices";
const description =
  "Answers about file size limits, privacy, supported browsers and why ZeeShare only works between devices on the same local network.";

const faqs = [
  {
    q: "Is there really no file size limit?",
    a: "Correct. Files are streamed directly between the two devices in small chunks, so memory usage stays flat regardless of size. The practical limit is the free storage on the receiving device.",
  },
  {
    q: "Do my files get uploaded to a server?",
    a: "No. Only the file name and size are announced to other devices on your network so they can appear in the list. The file contents travel straight from one device to the other.",
  },
  {
    q: "Why can't I see a device that is not on my Wi-Fi?",
    a: "ZeeShare is intentionally local-only. Devices are grouped by network, and connections use local addresses, so remote devices cannot appear or connect.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. A modern browser is all that is required on phones, tablets, laptops and desktops.",
  },
  {
    q: "Does it cost anything?",
    a: "No. Because there is no cloud storage and no bandwidth cost for transfers, ZeeShare is free to use.",
  },
  {
    q: "Is the transfer encrypted?",
    a: "Yes. Browser peer connections are encrypted by default, so the data moving across your network is protected in transit.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: Faq,
});

function Faq() {
  return (
    <SiteLayout>
      <ContentPage title="Frequently asked questions" intro="The short answers people ask for most.">
        <dl className="space-y-3">
          {faqs.map((item) => (
            <div key={item.q} className="panel p-5">
              <dt className="text-base font-semibold">{item.q}</dt>
              <dd className="mt-2 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </ContentPage>
    </SiteLayout>
  );
}
