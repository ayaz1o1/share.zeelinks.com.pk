import { createFileRoute } from "@tanstack/react-router";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "Cookies & Advertising Disclosure — ZeeShare";
const description =
  "How ZeeShare uses cookies and local storage, how third-party advertising cookies work, and how to opt out of personalised ads.";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/cookies" },
    ],
    links: [{ rel: "canonical", href: "/cookies" }],
  }),
  component: Cookies,
});

function Cookies() {
  return (
    <SiteLayout>
      <ContentPage
        title="Cookies & advertising"
        intro="Last updated: 19 August 2026. A plain-language summary of what is stored in your browser and why."
      >
        <h2>Essential storage</h2>
        <p>
          The sharing page keeps a random session identifier in browser memory while it is open so your
          devices can recognise each other. It is discarded as soon as the tab is closed and is not
          used for tracking.
        </p>

        <h2>Analytics</h2>
        <p>
          We may use privacy-respecting, aggregated analytics to understand how many people use the
          site and which pages are helpful. This does not identify individuals and never includes file
          names.
        </p>

        <h2>Advertising cookies</h2>
        <p>
          Informational pages on this site may display advertising supplied by third-party networks
          such as Google. These partners may use cookies or similar identifiers to measure ad
          performance and, where permitted, personalise the ads you see.
        </p>
        <ul className="space-y-2">
          <li>
            Third-party vendors, including Google, use cookies to serve ads based on a user's prior
            visits to this or other websites.
          </li>
          <li>
            Google's use of advertising cookies enables it and its partners to serve ads based on your
            visits to this site and other sites on the internet.
          </li>
          <li>
            You can opt out of personalised advertising in Google's Ads Settings, and you can opt out
            of many other vendors through the industry opt-out pages operated by the NAI and EDAA.
          </li>
        </ul>

        <h2>Managing cookies yourself</h2>
        <p>
          Every major browser lets you block or delete cookies in its privacy settings. Blocking
          advertising cookies does not affect file transfers, which never rely on cookies.
        </p>

        <h2>Questions</h2>
        <p>
          Write to{" "}
          <a className="text-primary hover:underline" href="mailto:support@zeelinks.com.pk">
            support@zeelinks.com.pk
          </a>{" "}
          if anything here is unclear.
        </p>
      </ContentPage>
    </SiteLayout>
  );
}
