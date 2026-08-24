import { createFileRoute } from "@tanstack/react-router";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "Privacy Policy — ZeeShare";
const description =
  "How ZeeShare handles your data: files are never uploaded or stored, and only minimal technical information is processed to pair devices on the same network.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <SiteLayout>
      <ContentPage
        title="Privacy Policy"
        intro="Last updated: 19 August 2026. This policy explains exactly what ZeeShare does and does not process."
      >
        <h2>1. Files you share</h2>
        <p>
          ZeeShare does not upload, store, scan, copy or back up your files. File contents are
          transferred directly between your devices over your own network using an encrypted browser
          peer connection. We have no technical ability to access them.
        </p>

        <h2>2. Information used to pair devices</h2>
        <p>To group devices that are on the same network, the service temporarily processes:</p>
        <ul className="space-y-2">
          <li>A one-way hash derived from your network's public address. The address itself is not stored.</li>
          <li>A random session identifier that exists only while the page is open.</li>
          <li>
            The names and sizes of the files you choose to offer, so they can be listed on your other
            devices.
          </li>
          <li>Short-lived connection details needed to start a direct transfer.</li>
        </ul>
        <p>
          This information is removed automatically when you close the page. It is never sold or used
          for profiling.
        </p>

        <h2>3. No accounts</h2>
        <p>
          ZeeShare has no sign-up. We do not collect names, email addresses or phone numbers unless
          you email us directly, in which case we use your message only to reply.
        </p>

        <h2>4. Cookies and advertising</h2>
        <p>
          ZeeShare uses essential local browser storage to keep the page working. Advertising partners
          may set cookies to measure and personalise ads on our informational pages. See our{" "}
          <a className="text-primary hover:underline" href="/cookies">
            Cookies &amp; Ads
          </a>{" "}
          page for details and opt-out links.
        </p>

        <h2>5. Third-party services</h2>
        <p>
          We use a hosting and realtime messaging provider to serve the website and relay the small
          pairing messages described in section 2, and a public address lookup service to determine
          which network you are on. These providers process technical data such as IP addresses in
          order to deliver the service.
        </p>

        <h2>6. Children</h2>
        <p>
          The service is not directed at children under 13, and we do not knowingly collect personal
          information from them.
        </p>

        <h2>7. Your rights</h2>
        <p>
          Because we do not hold accounts or file data, there is normally nothing to export or delete.
          If you believe we hold information about you, contact us and we will respond within 30 days.
        </p>

        <h2>8. Changes</h2>
        <p>
          If this policy changes materially, the updated date above will change and the new version
          will be published on this page.
        </p>

        <h2>9. Contact</h2>
        <p>
          Privacy questions can be sent to{" "}
          <a className="text-primary hover:underline" href="mailto:support@zeelinks.com.pk">
            support@zeelinks.com.pk
          </a>
          .
        </p>
      </ContentPage>
    </SiteLayout>
  );
}
