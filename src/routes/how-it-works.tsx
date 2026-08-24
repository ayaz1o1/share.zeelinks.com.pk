import { createFileRoute } from "@tanstack/react-router";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "How ZeeShare Works — Local Network Transfers Explained";
const description =
  "ZeeShare pairs devices on the same network automatically and streams files directly between them, so nothing is uploaded and there is no file size limit.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/how-it-works" },
    ],
    links: [{ rel: "canonical", href: "/how-it-works" }],
  }),
  component: HowItWorks,
});

const steps = [
  {
    title: "Open the site on both devices",
    body: "The page itself loads over the internet. That is the only part that uses your data connection.",
  },
  {
    title: "Devices pair themselves",
    body: "Devices sharing the same network are grouped automatically. There is no code to type, no QR to scan and no account to create.",
  },
  {
    title: "Drop or select a file",
    body: "The file is listed for the other devices on your network. It is not uploaded anywhere — only its name and size are announced.",
  },
  {
    title: "Download on the other device",
    body: "Tapping download opens a direct connection between the two devices and streams the file across your local network in small chunks.",
  },
];

function HowItWorks() {
  return (
    <SiteLayout>
      <ContentPage
        title="How it works"
        intro="Four steps, no setup, and no copy of your file on anyone's server."
      >
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step.title} className="panel list-none p-5">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                Step {index + 1}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>

        <h2>Why there is no size limit</h2>
        <p>
          Services that cap uploads do so because every file consumes paid storage and bandwidth on
          their servers. ZeeShare never stores your file, so there is nothing to pay for and nothing
          to limit. The only real limit is the free space on the receiving device.
        </p>

        <h2>Why it stays on your network</h2>
        <p>
          Connections are established using local network addresses only. No relay servers are
          configured, so if two devices are not on the same network a transfer simply will not start.
          That is a deliberate safety property, not a limitation.
        </p>
      </ContentPage>
    </SiteLayout>
  );
}
