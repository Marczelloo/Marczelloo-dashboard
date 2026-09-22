import { A, C, Callout, DocSection, Fact, Facts, H3, List, P, Step, Steps } from "../doc-parts";

export function UsingIt() {
  return (
    <>
      <DocSection id="projects" title="Projects" lead="A project is one repository and everything that runs from it: its services, domains, variables, deploys and tasks.">
        <H3>Adding one</H3>
        <P>
          <A href="/projects/new">New project</A> has two paths. <strong className="font-medium text-fg">From GitHub</strong> is the one to use for anything that runs on the Pi: pick a repository and the dashboard reads its root to propose how to build it. <strong className="font-medium text-fg">Manual</strong> creates a project for tracking only — links, notes and tasks, nothing deployed.
        </P>
        <Facts>
          <Fact label="Own Compose file">
            <C>compose.yaml</C> or <C>docker-compose.yml</C> in the repository is used as it is, with the profiles you pick.
          </Fact>
          <Fact label="Own Dockerfile">The dashboard writes the Compose file around it, taking the port from <C>EXPOSE</C>.</Fact>
          <Fact label="Node.js">Next.js, Nuxt, SvelteKit, Remix, Express or plain Node, on <C>node:20-alpine</C>.</Fact>
          <Fact label="Static site">Vite, Astro without a server, or a bare <C>index.html</C>: built, then served by nginx with an SPA fallback.</Fact>
          <Fact label="Python">FastAPI, Flask or a script, on <C>python:3.12-slim</C>.</Fact>
        </Facts>
        <P>Type, port, commands and output directory can all be corrected in the form. A generated Compose file lives on the Pi beside the agent&apos;s state; nothing is written into your repository.</P>

        <H3>Inside a project</H3>
        <Facts>
          <Fact label="Overview">Status, the latest deploy, services with their containers, and the open tasks.</Fact>
          <Fact label="Deployments">Deploy now, the history with logs, and rollback to any earlier release.</Fact>
          <Fact label="Logs">Every container of the project in one stream, merged by time, or one service at a time.</Fact>
          <Fact label="Environment">Variables per service. See <A href="#environment">Environment variables</A>.</Fact>
          <Fact label="Domains">Public hostnames. See <A href="#domains">Domains and the tunnel</A>.</Fact>
          <Fact label="GitHub">Commits, pull requests, releases, branches, security alerts and contributors.</Fact>
          <Fact label="Code">The README, a file browser and the dependency list.</Fact>
          <Fact label="Tasks">The project&apos;s work items; the board view is one click away.</Fact>
          <Fact label="Settings">Name, status, links, the deploy configuration, and deleting the project.</Fact>
        </Facts>
        <P>
          A project is <C>active</C>, <C>inactive</C>, <C>maintenance</C> or <C>archived</C>. Its services are <C>docker</C> (run by the agent), <C>vercel</C> or <C>external</C> — the last two are only watched, never deployed.
        </P>
      </DocSection>

      <DocSection id="deploys" title="Deploys" lead="Every project deploys the same way. The agent runs one job at a time and never leaves a project on a version that did not start.">
        <H3>What starts one</H3>
        <List>
          <li>
            A push to the project&apos;s configured branch, delivered by the GitHub App&apos;s webhook. A project with no branch set deploys pushes to <C>main</C> or <C>master</C>.
          </li>
          <li>
            <strong className="font-medium text-fg">Deploy</strong> on the project, which deploys the latest commit of that branch.
          </li>
          <li>Saving and applying environment variables, which restarts the running release with the new file.</li>
        </List>
        <H3>What the agent does</H3>
        <Steps>
          <Step title="Syncs the repository">Clones it into the projects directory if missing, otherwise fetches and checks out the exact commit.</Step>
          <Step title="Validates and builds">Checks the Compose file, then builds the images, tagged with the commit.</Step>
          <Step title="Keeps what is live">Tags the images of the running version so there is always something to go back to.</Step>
          <Step title="Starts the new containers">
            <C>docker compose up -d</C> with the new images, attached to <C>mz-edge</C> when the project has a domain.
          </Step>
          <Step title="Waits for health">
            The containers have to stay up without restarting, exiting or reporting <C>unhealthy</C>, and pass their own healthchecks if they have any.
          </Step>
          <Step title="Keeps it, or rolls back">
            If that gate fails, the previous release is started again and the deploy ends as <strong className="font-medium text-fg">rolled back</strong>, with the reason.
          </Step>
        </Steps>
        <P>
          Each job&apos;s log is kept and opens from its row on <A href="/deployments">Deployments</A> or the project&apos;s Deployments tab; while a job runs, the row shows the step it is on. Monitoring stays quiet for a project while it deploys and for two minutes after.
        </P>
        <Callout>
          <P>Pushing the same commit twice is harmless: the second job is marked superseded instead of building again.</P>
        </Callout>
      </DocSection>

      <DocSection id="environment" title="Environment variables" lead="Variables belong to a service, are stored encrypted, and reach the container as a file at run time — never inside an image.">
        <List>
          <li>
            Values are encrypted with AES-256-GCM using <C>ENCRYPTION_KEY</C> before they reach the database. Seeing or changing them asks for the PIN.
          </li>
          <li>Add one in the dialog, or paste or load a whole <C>.env</C> file at once.</li>
          <li>
            <strong className="font-medium text-fg">Apply</strong> hands the file to the agent, which writes it into the repository directory and restarts the running release. If the containers then fail the health gate, the previous file is put back and the service restarted on it.
          </li>
          <li>Every save of the file is kept as a version, names only in the list; any earlier version can be restored from the service&apos;s Environment tab.</li>
        </List>
        <Callout tone="warn">
          <P>
            Changing <C>ENCRYPTION_KEY</C> makes every stored value unreadable. Keep it with your other secrets and never rotate it without re-entering the variables.
          </P>
        </Callout>
      </DocSection>

      <DocSection id="domains" title="Domains and the tunnel" lead="Every public hostname is a route on one Cloudflare tunnel plus a proxied DNS record, both written through the API.">
        <P>
          A project&apos;s Domains tab adds a hostname: pick the zone, the service and its port. The route and the DNS record are created together, and the tunnel picks the change up without a restart, so other domains never blink.
        </P>
        <Facts>
          <Fact label={<C>TUNNEL_ORIGIN=edge</C>}>
            Routes point at the container by name, <C>http://&lt;container&gt;:&lt;port&gt;</C>, over the shared <C>mz-edge</C> network.
          </Fact>
          <Fact label={<C>EDGE_DROP_PORTS=true</C>}>Services with a domain stop publishing a port on the host at all; the tunnel is the only way in.</Fact>
          <Fact label={<C>TUNNEL_ORIGIN=loopback</C>}>
            The older mode: routes point at <C>127.0.0.1:&lt;port&gt;</C> on the Pi.
          </Fact>
        </Facts>
        <P>
          <A href="/settings#tunnel">Settings → Tunnel</A> lists every route, which project it belongs to, and whether the tunnel is healthy.
        </P>
      </DocSection>

      <DocSection id="tasks" title="Tasks" lead="One list for everything you mean to do, with or without a project.">
        <List>
          <li>
            General to-dos and each project&apos;s work items appear together on <A href="/tasks">Tasks</A>, filterable by status and project, and searchable.
          </li>
          <li>
            A work item is a <C>todo</C>, <C>bug</C> or <C>change</C>, with a priority from <C>low</C> to <C>critical</C>, and moves through <C>open</C> → <C>in progress</C> → <C>done</C>, or <C>blocked</C>.
          </li>
          <li>New tasks open in a dialog wherever you are; a project&apos;s Tasks tab links to its board.</li>
        </List>
      </DocSection>

      <DocSection id="host" title="Host" lead="Everything about the Pi itself, one tab per concern.">
        <Facts>
          <Fact label="Overview">Alerts, load, memory and disk with short history, Docker totals, quick actions, network and the agent&apos;s state.</Fact>
          <Fact label="Resources">Load, memory, disk and build cache in detail.</Fact>
          <Fact label="Containers">Every container grouped by Compose project: start, stop, restart, quick logs, and a detail page with its environment and mounts.</Fact>
          <Fact label="Ports">What listens on the Pi, and on which address.</Fact>
          <Fact label="Console">A command line into the agent. See below.</Fact>
          <Fact label="Settings">This host, routing, connections, monitoring and the agent, read-only, with links to where each is changed.</Fact>
        </Facts>
        <H3>The console</H3>
        <P>
          The console runs commands inside the agent&apos;s container, not a shell on the Pi. It exists for looking around, so it takes a fixed list:
        </P>
        <List>
          <li>
            <C>docker</C> with <C>ps</C>, <C>images</C>, <C>inspect</C>, <C>logs</C>, <C>stats</C>, <C>top</C>, <C>port</C>, <C>start</C>, <C>stop</C>, <C>restart</C>, <C>network ls|inspect</C>, <C>volume ls|inspect</C>, <C>system df</C> and <C>compose ps|logs|config|top</C>.
          </li>
          <li>
            <C>df</C>, <C>free</C>, <C>uptime</C>, <C>ls</C>, <C>du</C>, <C>cat</C>, <C>head</C>, <C>tail</C>, <C>grep</C>, <C>wc</C>, read-only <C>git</C> and a few more. File reads stay inside the projects directory.
          </li>
          <li>No pipes, redirects or chaining. Every command asks for the PIN and is written to the audit log.</li>
        </List>
      </DocSection>

      <DocSection id="monitoring" title="Monitoring" lead="One loop checks everything that can break, and speaks up only when something changes.">
        <Facts>
          <Fact label="Agent">Answers on its status endpoint.</Fact>
          <Fact label="Containers">
            Every container of every agent project: not exited with an error, not restarting, not <C>unhealthy</C>, not killed for memory.
          </Fact>
          <Fact label="Domains">Every hostname on the tunnel and every service URL answers below 500.</Fact>
          <Fact label="Certificates">Every domain&apos;s certificate, every 12 hours: a warning at 14 days left, a failure at 3.</Fact>
          <Fact label="Disk">A warning under 10% free, a failure under 5%.</Fact>
        </Facts>
        <List>
          <li>A target is down after two failed checks in a row; disk and certificates count from the first.</li>
          <li>Each stretch of trouble is one incident, closed when the target recovers. Closed incidents are kept for 90 days.</li>
          <li>
            The interval is set in <A href="/settings#monitoring">Settings → Monitoring</A>. <A href="/monitoring">Monitoring</A> can also run a round on demand.
          </li>
        </List>
      </DocSection>

      <DocSection id="alerts" title="Alerts" lead="Alerts go to one Discord channel, through DISCORD_WEBHOOK_URL.">
        <P>
          <A href="/settings#notifications">Settings → Alerts</A> has a switch per event: deploy started, finished and failed; service down and back; container unhealthy; certificate expiring. Failures and outages are on by default; routine deploy messages are off.
        </P>
        <P>Monitoring alerts are sent on a change of state only, so a service that stays down is reported once, and again when it comes back.</P>
      </DocSection>
    </>
  );
}
