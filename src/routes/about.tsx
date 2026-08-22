import { createFileRoute } from "@tanstack/react-router";

import { ContentPage, SiteLayout } from "@/components/layout/SiteLayout";

const title = "About ZeeShare — Local File Sharing Without Cloud Storage";
const description =
  "ZeeShare is a browser-based tool for moving files between devices on the same network, built to remove the upload limits of cloud sharing services.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <ContentPage
        title="About ZeeShare"
        intro="A simpler way to move files between the devices already sitting next to each other."
      >
        <p>
          Moving a large video from a phone to a laptop usually means cables, a messaging app that
          compresses everything, or a cloud service with an upload cap. ZeeShare removes all three.
          Open the same page on both devices and the transfer happens over the network they are
          already connected to.
        </p>

        <h2>What we set out to fix</h2>
        <ul className="space-y-2">
          <li>Upload size caps that exist because of storage cost, not user need.</li>
          <li>Waiting for a slow internet upload when both devices are in the same room.</li>
          <li>Accounts, sign-ups and installers for a task that takes ten seconds.</li>
          <li>Copies of private files sitting on someone else's server.</li>
        </ul>

        <h2>How it is funded</h2>
        <p>
          Because transfers never touch our infrastructure, running ZeeShare costs almost nothing.
          The site is supported by unobtrusive advertising on the informational pages, which keeps
          the tool itself free and free of limits.
        </p>

        <h2>Where it runs</h2>
        <p>
          ZeeShare works in modern browsers on Android, iOS, Windows, macOS and Linux. Nothing needs
          to be installed on any of them.
        </p>
      </ContentPage>
    </SiteLayout>
  );
}
