import { Header } from "@/components/layout";
import { Terminal } from "@/components/features/terminal";

export const dynamic = "force-dynamic";

export default function TerminalPage() {
  return (
    <>
      <Header title="Terminal" description="Execute commands on the Raspberry Pi" />

      <div className="p-6">
        <div className="max-w-4xl">
          <Terminal />

          {/* Quick commands section */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickCommandCard
              title="System Info"
              commands={[
                { label: "Hostname", command: "hostname" },
                { label: "Uptime", command: "uptime" },
                { label: "Memory", command: "free -h" },
                { label: "Disk Space", command: "df -h /" },
              ]}
            />
            <QuickCommandCard
              title="Docker"
              commands={[
                { label: "Running Containers", command: 'docker ps --format "table {{.Names}}\t{{.Status}}"' },
                { label: "All Containers", command: 'docker ps -a --format "table {{.Names}}\t{{.Status}}"' },
                { label: "Images", command: 'docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"' },
                { label: "Disk Usage", command: "docker system df" },
              ]}
            />
            <QuickCommandCard
              title="Network"
              commands={[
                { label: "IP Address", command: "hostname -I" },
                { label: "Open Ports", command: "ss -tlnp" },
                { label: "Network Stats", command: "netstat -i" },
              ]}
            />
          </div>

          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium mb-2">Security Notice</h3>
            <p className="text-xs text-muted-foreground">
              Commands are executed on the Raspberry Pi through the Runner service. Some dangerous commands (like rm -rf
              /, shutdown, reboot) are blocked for safety. All commands are logged for audit purposes.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function QuickCommandCard({ title, commands }: { title: string; commands: Array<{ label: string; command: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="space-y-2">
        {commands.map((cmd) => (
          <div key={cmd.command} className="group">
            <p className="text-xs text-muted-foreground">{cmd.label}</p>
            <code className="text-xs font-mono text-primary/80 break-all">{cmd.command}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
