"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { Rocket, Loader2, X, Check, AlertCircle } from "lucide-react";

interface Service {
  id: string;
  name: string;
  type: "docker" | "vercel" | "external";
  deploy_strategy?: "pull_restart" | "pull_rebuild" | "compose_up" | "manual";
}

interface DeployAllButtonProps {
  services: Service[];
  projectId: string;
}

type DeployStrategy = "pull_restart" | "pull_rebuild" | "compose_up";

interface DeployResult {
  serviceId: string;
  serviceName: string;
  success: boolean;
  message?: string;
}

export function DeployAllButton({ services, projectId }: DeployAllButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [strategy, setStrategy] = useState<DeployStrategy>("pull_restart");
  const [deploying, setDeploying] = useState(false);
  const [results, setResults] = useState<DeployResult[]>([]);
  const [currentService, setCurrentService] = useState<string | null>(null);

  // Filter to only docker services that aren't manual
  const deployableServices = services.filter((s) => s.type === "docker" && s.deploy_strategy !== "manual");

  if (deployableServices.length === 0) {
    return null;
  }

  async function handleDeployAll() {
    setDeploying(true);
    setResults([]);

    for (const service of deployableServices) {
      setCurrentService(service.name);
      try {
        const response = await fetch("/api/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: service.id,
            projectId,
            strategy,
          }),
        });

        const result = await response.json();

        setResults((prev) => [
          ...prev,
          {
            serviceId: service.id,
            serviceName: service.name,
            success: result.success,
            message: result.error || result.message,
          },
        ]);
      } catch (error) {
        setResults((prev) => [
          ...prev,
          {
            serviceId: service.id,
            serviceName: service.name,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ]);
      }
    }

    setCurrentService(null);
    setDeploying(false);
  }

  function handleClose() {
    if (!deploying) {
      setShowDialog(false);
      setResults([]);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="bg-primary hover:bg-primary/90"
      >
        <Rocket className="h-4 w-4" />
        Deploy All
      </Button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl mx-4">
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              disabled={deploying}
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Deploy All Services
            </h2>

            {results.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Deploy {deployableServices.length} Docker service{deployableServices.length > 1 ? "s" : ""} with the
                  selected strategy.
                </p>

                {/* Services list */}
                <div className="mb-4 max-h-32 overflow-y-auto space-y-1">
                  {deployableServices.map((service) => (
                    <div key={service.id} className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/30">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <span>{service.name}</span>
                    </div>
                  ))}
                </div>

                {/* Strategy selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Deploy Strategy</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                      <input
                        type="radio"
                        name="strategy"
                        value="pull_restart"
                        checked={strategy === "pull_restart"}
                        onChange={() => setStrategy("pull_restart")}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-sm">Pull & Restart</span>
                        <p className="text-xs text-muted-foreground">
                          Git pull latest changes and restart container (fastest)
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                      <input
                        type="radio"
                        name="strategy"
                        value="pull_rebuild"
                        checked={strategy === "pull_rebuild"}
                        onChange={() => setStrategy("pull_rebuild")}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-sm">Pull & Rebuild</span>
                        <p className="text-xs text-muted-foreground">
                          Git pull and rebuild Docker image (when dependencies change)
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                      <input
                        type="radio"
                        name="strategy"
                        value="compose_up"
                        checked={strategy === "compose_up"}
                        onChange={() => setStrategy("compose_up")}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-sm">Compose Up</span>
                        <p className="text-xs text-muted-foreground">
                          Run docker compose up -d --build (full redeploy)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleDeployAll} disabled={deploying} className="flex-1">
                    {deploying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        Deploy All
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleClose} disabled={deploying}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Results display */}
                <div className="mb-4 flex items-center gap-4">
                  {successCount > 0 && (
                    <Badge variant="success">
                      <Check className="h-3 w-3 mr-1" />
                      {successCount} succeeded
                    </Badge>
                  )}
                  {failCount > 0 && (
                    <Badge variant="danger">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {failCount} failed
                    </Badge>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                  {results.map((result) => (
                    <div
                      key={result.serviceId}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        result.success ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"
                      }`}
                    >
                      {result.success ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{result.serviceName}</p>
                        {result.message && <p className="text-xs text-muted-foreground truncate">{result.message}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {currentService && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deploying {currentService}...
                  </div>
                )}

                <Button onClick={handleClose} className="w-full" disabled={deploying}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
