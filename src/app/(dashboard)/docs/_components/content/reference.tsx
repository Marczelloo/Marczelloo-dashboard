import { A, C, Callout, CodeBlock, DocSection, EnvTable, Fact, Facts, H3, List, P, type EnvRow } from "../doc-parts";

const CORE: EnvRow[] = [
  { name: "ATLASHUB_API_URL", what: "The database's REST API. On the Pi, the internal address skips Cloudflare.", required: true, example: "http://atlashub-gateway:4545" },
  { name: "ATLASHUB_SECRET_KEY", what: "Its secret key.", required: true, example: "sk_…" },
  { name: "ENCRYPTION_KEY", what: "Encrypts environment variables at rest. 32 bytes, base64.", required: true, example: "openssl rand -base64 32" },
];

const ACCESS: EnvRow[] = [
  { name: "OWNER_EMAILS", what: "Comma-separated emails allowed in.", required: true, example: "you@example.com" },
  { name: "CF_ACCESS_TEAM_DOMAIN", what: "Zero Trust → Settings → Custom pages → Team domain.", required: true, example: "https://team.cloudflareaccess.com" },
  { name: "CF_ACCESS_AUD", what: "Zero Trust → Access → Applications → the dashboard → Audience tag.", required: true },
  { name: "PIN_HASH", what: "bcrypt hash of the PIN. Single-quote it in .env, or Compose expands the $ signs.", required: true, example: "'$2a$10$…'" },
  { name: "SESSION_SECRET", what: "Signs the PIN session cookie.", required: true, example: "openssl rand -base64 32" },
  { name: "PIN_SESSION_TTL", what: "How long a PIN session lasts, in seconds. Default 1800." },
];

const DEPLOYS: EnvRow[] = [
  { name: "AGENT_TOKEN", what: "Shared with the agent's own .env; every call to the agent carries it.", required: true, example: "openssl rand -hex 32" },
  { name: "AGENT_URL", what: "Where the agent answers. Default http://mz-agent:8790." },
  { name: "PROJECTS_DIR", what: "Project checkouts on the Pi; the agent mounts it at the same path.", example: "/home/you/projects" },
  { name: "GITHUB_APP_ID", what: "The GitHub App's ID." },
  { name: "GITHUB_INSTALLATION_ID", what: "Its installation on your account." },
  { name: "GITHUB_PRIVATE_KEY_BASE64", what: "Its private key, base64 on one line.", example: "base64 -w 0 key.pem" },
  { name: "GITHUB_WEBHOOK_SECRET", what: "Verifies that webhook calls come from GitHub." },
];

const EDGE: EnvRow[] = [
  { name: "CLOUDFLARE_API_TOKEN", what: "Account › Cloudflare Tunnel: Edit, Zone › DNS: Edit, Zone › Zone: Read." },
  { name: "CLOUDFLARE_ACCOUNT_ID", what: "The account that owns the tunnel." },
  { name: "CLOUDFLARE_TUNNEL_ID", what: "The managed tunnel every route is written to." },
  { name: "CLOUDFLARE_LEGACY_TUNNEL_IDS", what: "Older tunnels; DNS records still pointing at them are moved when a route is saved." },
  { name: "EDGE_NETWORK", what: "Shared network routed containers join on each deploy.", example: "mz-edge" },
  { name: "TUNNEL_ORIGIN", what: <>New routes target containers by name (<C>edge</C>) or loopback ports (<C>loopback</C>, the default).</> },
  { name: "EDGE_DROP_PORTS", what: <>With <C>true</C>, routed services publish no host port. Needs <C>TUNNEL_ORIGIN=edge</C>.</> },
];

const MONITORING: EnvRow[] = [
  { name: "MONITORING_INTERVAL_MS", what: "Starting interval, until one is saved in Settings. Default 60000." },
  { name: "MONITOR_INCIDENT_RETENTION_DAYS", what: "How long closed incidents are kept. Default 90." },
  { name: "UPTIME_RETENTION_DAYS", what: "How long individual checks are kept. Default 30." },
  { name: "CRON_SECRET", what: <>Lets an outside scheduler call <C>/api/cron/monitoring</C>.</> },
  { name: "DISCORD_WEBHOOK_URL", what: "Where alerts are posted." },
];

const OTHER: EnvRow[] = [
  { name: "PORTAINER_URL", what: "Portainer's API. Default http://portainer:9000 inside the Compose network." },
  { name: "PORTAINER_TOKEN", what: "An access token; or give PORTAINER_USERNAME and PORTAINER_PASSWORD instead." },
  { name: "PORTAINER_TOKEN_FILE", what: "Encrypted fallback for a token saved from Settings." },
  { name: "DEMO_MODE", what: <>With <C>true</C>, the instance runs on mock data. See <A href="#demo">Demo instance</A>.</> },
  { name: "DEV_USER_EMAIL / DEV_SKIP_PIN", what: "Local development only; ignored in production." },
];

export function Reference() {
  return (
    <>
      <DocSection id="env-vars" title="Configuration" lead="Everything the dashboard reads from its .env. Anything not listed here is not used.">
        <EnvTable title="Core" rows={CORE} />
        <EnvTable title="Access" rows={ACCESS} />
        <EnvTable title="Deploys and GitHub" rows={DEPLOYS} />
        <EnvTable title="Tunnel and edge network" rows={EDGE} />
        <EnvTable title="Monitoring and alerts" rows={MONITORING} />
        <EnvTable title="Containers and development" rows={OTHER} />
      </DocSection>

      <DocSection id="agent" title="The agent" lead="A small Node service with the Docker socket. It does only what its typed routes allow, and only for callers holding AGENT_TOKEN.">
        <Facts>
          <Fact label="Its own .env">
            <C>AGENT_TOKEN</C>, <C>DOCKER_GID</C> (from <C>getent group docker</C>), <C>PROJECTS_DIR</C>, and optionally <C>AGENT_BUILD_CACHE_MAX</C>, default <C>10GB</C>.
          </Fact>
          <Fact label="State">
            Jobs, releases and logs under <C>PROJECTS_DIR/.dashboard/agent</C>.
          </Fact>
          <Fact label="Routes">
            <C>/health</C>, <C>/status</C>, <C>/host</C>, <C>/jobs</C> and their logs, <C>/projects/:name</C>, plus environment files, preflight, container restart and the console.
          </Fact>
          <Fact label="Clean-up">Old images and build cache beyond the limit are pruned after deploys.</Fact>
        </Facts>
        <H3>Updating it</H3>
        <P>Deploying the dashboard does not touch the agent, on purpose. After a change under <C>agent/</C> reaches the Pi, rebuild it by hand:</P>
        <CodeBlock>{`cd ~/projects/Marczelloo-dashboard/agent
docker compose build && docker compose up -d`}</CodeBlock>
        <Callout>
          <P>When a dashboard change needs a new agent route, ship and rebuild the agent first, then the dashboard.</P>
        </Callout>
        <Callout tone="warn">
          <P>
            The agent never removes Compose services that disappear from a project&apos;s file. Stop and remove those containers yourself.
          </P>
        </Callout>
      </DocSection>

      <DocSection id="troubleshooting" title="Troubleshooting" lead="The failures that actually happen, and where to look first.">
        <H3>The agent does not answer</H3>
        <List>
          <li>
            <C>docker ps</C> should show <C>marczelloo-agent</C> as healthy; if it restarts, <C>docker logs marczelloo-agent</C> says why.
          </li>
          <li>
            <C>AGENT_TOKEN</C> must be identical in both <C>.env</C> files, and the dashboard recreated after changing it.
          </li>
          <li>Both containers must share the dashboard&apos;s network, where the agent carries the alias <C>mz-agent</C>.</li>
        </List>
        <H3>A push did not deploy</H3>
        <List>
          <li>The project needs a deploy configuration, and the push has to be to its branch — main or master when none is set.</li>
          <li>
            GitHub → the App → Advanced lists each delivery and the dashboard&apos;s answer, which gives the reason a push was skipped.
          </li>
          <li>
            A <C>401</C> there means <C>GITHUB_WEBHOOK_SECRET</C> does not match the App&apos;s.
          </li>
        </List>
        <H3>A deploy failed or rolled back</H3>
        <List>
          <li>The error on the deploy&apos;s row names the step that failed; its log has the full output.</li>
          <li>
            <strong className="font-medium text-fg">Rolled back</strong> means the new version built but did not stay healthy. The previous one is running; look at the new containers&apos; logs from the log for the reason.
          </li>
          <li>
            A build killed without an error message is usually the Pi running out of memory — check <A href="/host?tab=resources">Host → Resources</A>.
          </li>
        </List>
        <H3>A domain shows an error page</H3>
        <List>
          <li>
            <C>502</C>: the tunnel reached nothing. With <C>TUNNEL_ORIGIN=edge</C>, the container has to be on <C>mz-edge</C> and listen on the route&apos;s port; redeploying reattaches it.
          </li>
          <li>
            <C>530</C> or <C>1033</C>: Cloudflare cannot reach the Pi at all. Check that <C>marczelloo-cloudflared</C> runs.
          </li>
        </List>
        <H3>Pages load slowly or data is missing</H3>
        <P>
          AtlasHub allows about 100 requests a minute for the whole dashboard. Monitoring already writes only on changes; a burst of reloads can still hit the limit for a minute. <A href="/settings#connections">Settings → Connections</A> shows whether the database answers.
        </P>
      </DocSection>
    </>
  );
}
