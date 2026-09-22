import { GettingStarted } from "./_components/content/start";
import { Reference } from "./_components/content/reference";
import { Security } from "./_components/content/security";
import { UsingIt } from "./_components/content/using";
import { DocsShell } from "./_components/docs-shell";

export const metadata = { title: "Docs" };

export default function DocsPage() {
  return (
    <DocsShell>
      <GettingStarted />
      <UsingIt />
      <Security />
      <Reference />
    </DocsShell>
  );
}
