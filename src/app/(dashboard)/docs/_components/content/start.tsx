import { A, C, CodeBlock, DocSection, Fact, Facts, H3, Kbd, List, P, Step, Steps } from "../doc-parts";

export function GettingStarted() {
  return (
    <>
      <DocSection id="overview" title="How it fits together" lead="One dashboard for one Raspberry Pi: projects come from GitHub, a deploy agent builds and runs them, a Cloudflare tunnel publishes them, and monitoring watches the result.">
        <Facts>
          <Fact label="Dashboard">
            This Next.js app, container <C>marczelloo-dashboard</C>, on <C>127.0.0.1:3100</C>. Everything you do goes through it.
          </Fact>
          <Fact label="Deploy agent">
            Container <C>marczelloo-agent</C>, reachable as <C>mz-agent:8790</C>. It holds the Docker socket and the projects directory, and is the only thing that clones, builds and starts projects. It lives in its own Compose project, so deploying the dashboard never restarts it.
          </Fact>
          <Fact label="AtlasHub">The database, over its REST API: projects, services, encrypted variables, deploy history, monitoring state, audit log.</Fact>
          <Fact label="Portainer">Read and act on individual containers — lists, logs, stats, start and stop.</Fact>
          <Fact label="Cloudflare tunnel">
            One managed tunnel, run by <C>marczelloo-cloudflared</C> on the <C>mz-edge</C> network. Routes and DNS records are written through the Cloudflare API.
          </Fact>
          <Fact label="Discord">Where alerts go.</Fact>
        </Facts>
        <H3>A push, end to end</H3>
        <P>
          You push to a project&apos;s branch → GitHub calls the dashboard&apos;s webhook → the dashboard queues a job on the agent → the agent pulls, builds, starts and checks the containers → the result lands on <A href="/deployments">Deployments</A>, and on Discord if the deploy fails.
        </P>
      </DocSection>

      <DocSection id="tour" title="Finding your way" lead="Every page has one job. If something appears in two places, one of them only links to the other.">
        <Facts>
          <Fact label={<A href="/">Overview</A>}>Every project in one table, with problems floated to the top.</Fact>
          <Fact label={<A href="/projects">Projects</A>}>Each project&apos;s deploys, logs, variables, domains, GitHub, code, tasks and settings, one tab each.</Fact>
          <Fact label={<A href="/tasks">Tasks</A>}>General to-dos and every project&apos;s work items in one list.</Fact>
          <Fact label={<A href="/deployments">Deployments</A>}>Every deploy, rollback and variables apply, newest first.</Fact>
          <Fact label={<A href="/host">Host</A>}>The Pi: load, disk, containers, ports, a console and its settings.</Fact>
          <Fact label={<A href="/services">Services</A>}>Every service across projects with its live container state.</Fact>
          <Fact label={<A href="/monitoring">Monitoring</A>}>Uptime, incidents and certificates.</Fact>
          <Fact label={<A href="/audit-log">Audit log</A>}>Who changed what, and when.</Fact>
          <Fact label={<A href="/settings">Settings</A>}>Connections, deploy defaults, the tunnel, monitoring interval and alerts.</Fact>
        </Facts>
        <P>
          <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> opens the command palette from anywhere: jump to a page or a project by typing its name.
        </P>
      </DocSection>

      <DocSection id="install" title="Installing" lead="On a fresh Pi with Docker. Every step runs on the Pi itself.">
        <Steps>
          <Step title="Clone into the projects directory">
            <CodeBlock>{`cd ~/projects
git clone https://github.com/Marczelloo/Marczelloo-dashboard.git
cd Marczelloo-dashboard
cp .env.example .env`}</CodeBlock>
          </Step>
          <Step title="Fill in the required variables">
            <P>
              At minimum <C>ATLASHUB_API_URL</C>, <C>ATLASHUB_SECRET_KEY</C>, <C>OWNER_EMAILS</C>, <C>CF_ACCESS_TEAM_DOMAIN</C>, <C>CF_ACCESS_AUD</C>, <C>PIN_HASH</C>, <C>SESSION_SECRET</C>, <C>ENCRYPTION_KEY</C> and <C>AGENT_TOKEN</C>. The full list is under <A href="#env-vars">Configuration</A>.
            </P>
            <CodeBlock title="generating the secrets">{`openssl rand -base64 32   # SESSION_SECRET, ENCRYPTION_KEY
openssl rand -hex 32      # AGENT_TOKEN
node -e "require('bcryptjs').hash('your-pin', 10).then(console.log)"   # PIN_HASH`}</CodeBlock>
          </Step>
          <Step title="Start the dashboard">
            <CodeBlock>{`docker compose up -d --build`}</CodeBlock>
            <P>
              This starts the dashboard on <C>:3100</C>, the <A href="#demo">demo instance</A> on <C>:3101</C> and Portainer on <C>:9201</C>, all bound to loopback.
            </P>
          </Step>
          <Step title="Start the agent">
            <P>
              The agent needs the host&apos;s Docker binaries in <C>agent/vendor</C> and its own <C>.env</C> with the same <C>AGENT_TOKEN</C>.
            </P>
            <CodeBlock>{`cd agent
mkdir -p vendor ~/projects/.dashboard/agent
cp "$(command -v docker)" vendor/docker
cp "$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')" vendor/docker-compose
cp "$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "buildx"}}{{.Path}}{{end}}{{end}}')" vendor/docker-buildx
printf 'AGENT_TOKEN=%s\\nDOCKER_GID=%s\\nPROJECTS_DIR=%s\\n' "<same token>" "$(getent group docker | cut -d: -f3)" "$HOME/projects" > .env
docker compose build && docker compose up -d`}</CodeBlock>
          </Step>
          <Step title="Start the tunnel">
            <P>
              cloudflared runs on the shared <C>mz-edge</C> network, so projects are reached by container name. Put <C>TUNNEL_TOKEN</C> in a <C>.env</C> beside the Compose file, then set <C>CLOUDFLARE_API_TOKEN</C>, <C>CLOUDFLARE_ACCOUNT_ID</C> and <C>CLOUDFLARE_TUNNEL_ID</C> in the dashboard&apos;s <C>.env</C> so it can manage routes.
            </P>
            <CodeBlock>{`docker network create mz-edge
mkdir -p ~/.config/marczelloo-tunnel && cd ~/.config/marczelloo-tunnel
cp ~/projects/Marczelloo-dashboard/infra/cloudflared/docker-compose.yml .
docker compose up -d`}</CodeBlock>
          </Step>
          <Step title="Check the connections">
            <P>
              Open <A href="/settings#connections">Settings → Connections</A>. The agent, Docker, GitHub and the database should all answer.
            </P>
          </Step>
        </Steps>
        <H3>Local development</H3>
        <List>
          <li>
            <C>npm run dev</C> against real services; set <C>DEV_USER_EMAIL</C> and <C>DEV_SKIP_PIN=true</C> to skip Access and the PIN. Both are ignored when <C>NODE_ENV=production</C>.
          </li>
          <li>
            <C>npm run dev:demo</C> runs on mock data with no backend at all.
          </li>
        </List>
      </DocSection>
    </>
  );
}
