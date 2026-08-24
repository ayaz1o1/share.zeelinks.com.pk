import { createFileRoute } from "@tanstack/react-router";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "Terms of Use — ZeeShare";
const description =
  "The rules for using ZeeShare, including acceptable use, availability expectations and limitation of liability for local network file transfers.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <SiteLayout>
      <ContentPage
        title="Terms of Use"
        intro="Last updated: 19 August 2026. By using ZeeShare you agree to these terms."
      >
        <h2>1. The service</h2>
        <p>
          ZeeShare is a free browser tool that helps devices on the same local network transfer files
          directly to each other. We do not host, store or deliver your files.
        </p>

        <h2>2. Acceptable use</h2>
        <p>You agree not to use ZeeShare to:</p>
        <ul className="space-y-2">
          <li>share material you do not have the right to distribute;</li>
          <li>distribute malware or content that is unlawful in your jurisdiction;</li>
          <li>share files on networks you are not authorised to use;</li>
          <li>attempt to disrupt, overload or reverse engineer the pairing service.</li>
        </ul>

        <h2>3. Your responsibility for content</h2>
        <p>
          You are solely responsible for the files you send and receive. Since transfers are direct
          between devices, we cannot review, moderate or recover them.
        </p>

        <h2>4. Availability</h2>
        <p>
          The service is provided as-is and may be unavailable, changed or discontinued at any time.
          Transfers depend on your network; guest networks, VPNs and networks with client isolation may
          prevent devices from connecting.
        </p>

        <h2>5. No warranty</h2>
        <p>
          ZeeShare is provided without warranties of any kind, including fitness for a particular
          purpose or uninterrupted operation. Always keep your own backup of important files.
        </p>

        <h2>6. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, ZeeShare and its operators are not liable for lost or
          corrupted data, interrupted transfers, or any indirect or consequential damages arising from
          use of the service.
        </p>

        <h2>7. Advertising</h2>
        <p>
          Informational pages may display third-party advertising. We are not responsible for the
          content of advertisements or the sites they lead to.
        </p>

        <h2>8. Governing law</h2>
        <p>
          These terms are governed by the laws of the Islamic Republic of Pakistan, without regard to
          conflict-of-law rules.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a className="text-primary hover:underline" href="mailto:support@zeelinks.com.pk">
            support@zeelinks.com.pk
          </a>
          .
        </p>
      </ContentPage>
    </SiteLayout>
  );
}
