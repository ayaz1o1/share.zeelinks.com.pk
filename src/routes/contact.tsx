import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "Contact ZeeShare — Support and Feedback";
const description =
  "Get in touch with the ZeeShare team about bugs, feature requests, advertising or privacy questions.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: Contact,
});

function Contact() {
  return (
    <SiteLayout>
      <ContentPage
        title="Contact us"
        intro="Questions, bug reports and partnership enquiries are all welcome."
      >
        <div className="panel flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground"
              aria-hidden
            >
              <Mail className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <a
                href="mailto:info@zeelinks.com.pk"
                className="text-base font-semibold text-primary hover:underline"
              >
                info@zeelinks.com.pk
              </a>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We usually reply within two business days. For privacy requests, please include the words
            "privacy request" in the subject line.
          </p>
        </div>

        <h2>Before you write in</h2>
        <p>
          If a device is not appearing, check that both devices are on the same Wi-Fi network and that
          neither is using a VPN or mobile data. Guest networks and networks with client isolation
          enabled block direct device-to-device connections.
        </p>
      </ContentPage>
    </SiteLayout>
  );
}
