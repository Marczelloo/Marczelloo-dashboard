import { A, C, Callout, DocSection, Fact, Facts, H3, List, P } from "../doc-parts";

export function Security() {
  return (
    <>
      <DocSection id="access" title="Access and PIN" lead="Two locks: Cloudflare Access decides who reaches the dashboard at all, and a PIN guards everything that changes or reveals something.">
        <H3>Who gets in</H3>
        <P>
          The dashboard sits behind a Cloudflare Access application. Every request carries Access&apos;s signed token, which the dashboard verifies against <C>CF_ACCESS_TEAM_DOMAIN</C> and <C>CF_ACCESS_AUD</C>, and the email in it must be listed in <C>OWNER_EMAILS</C>. A request without a valid token is refused, even from inside the network.
        </P>
        <H3>What asks for the PIN</H3>
        <List>
          <li>Creating, changing or deleting projects, services and work items.</li>
          <li>Seeing, changing, applying or restoring environment variables.</li>
          <li>Deploys and rollbacks, and clearing deploy history.</li>
          <li>Starting, stopping, restarting or removing containers, and the host console.</li>
          <li>The monitoring interval, the Portainer token and the Discord test.</li>
        </List>
        <P>
          A correct PIN opens a session for <C>PIN_SESSION_TTL</C> seconds, 30 minutes by default, signed with <C>SESSION_SECRET</C>. The PIN itself is only ever stored as the bcrypt hash in <C>PIN_HASH</C>.
        </P>
        <H3>What is recorded</H3>
        <P>
          Deploys and rollbacks, container actions, console commands, and changes to projects, services, work items and variables are written to the <A href="/audit-log">Audit log</A> with who did it and when. Variable values never are — only their names.
        </P>
        <Callout tone="warn">
          <P>
            <C>DEV_USER_EMAIL</C> and <C>DEV_SKIP_PIN</C> exist for local work and are ignored when <C>NODE_ENV=production</C>. There is no way to switch either lock off in production.
          </P>
        </Callout>
      </DocSection>

      <DocSection id="demo" title="Demo instance" lead="A copy of the dashboard on made-up data, safe to show anyone.">
        <Facts>
          <Fact label="Turned on by">
            <C>DEMO_MODE=true</C>. The <C>dashboard-demo</C> service in the Compose file runs it on <C>:3101</C>.
          </Fact>
          <Fact label="Data">A fixed set of projects, services, deploys, logs and monitoring history, generated in memory. It never reads the database, the agent or Cloudflare.</Fact>
          <Fact label="Changes">Anything that would write is refused with a message; the host console is off.</Fact>
          <Fact label="Access">Needs no Cloudflare Access application or PIN, because there is nothing behind it.</Fact>
        </Facts>
        <P>
          Locally, <C>npm run dev:demo</C> starts the same thing.
        </P>
      </DocSection>
    </>
  );
}
