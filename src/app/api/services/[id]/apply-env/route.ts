import { NextRequest, NextResponse } from "next/server";
import { auditLogs } from "@/server/atlashub";
import { services } from "@/server/data";
import { queueAgentEnvApply } from "@/server/agent/env-apply";
import { buildComposeRecreateCommand, getDeploymentConfig, resolveComposeStack, runHostCommand, SELF_COMPOSE_PROJECT } from "@/server/deployments";
import { shellQuote } from "@/server/runner/safe-paths";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return NextResponse.json(demo.result, { status: 403 });

    const user = await requirePinVerification();
    const { id } = await params;
    const service = await services.getServiceById(id);
    if (!service) return NextResponse.json({ success: false, error: "Nie znaleziono serwisu." }, { status: 404 });
    if (service.type !== "docker") {
      return NextResponse.json({ success: false, error: "Zmienne można zastosować tylko dla serwisu Docker." }, { status: 400 });
    }

    // Agent projects: recreate on the current release with the health gate instead of a host command.
    const config = service.project_id ? await getDeploymentConfig(service.project_id) : null;
    if (config?.engine === "agent") {
      const read = await runHostCommand(`if [ -f ${shellQuote(`${config.repoPath}/.env`)} ]; then cat ${shellQuote(`${config.repoPath}/.env`)}; fi`, 30_000);
      if (!read.success) return NextResponse.json({ success: false, error: "Nie udało się odczytać pliku .env." }, { status: 502 });
      if (!read.stdout) return NextResponse.json({ success: false, error: "Projekt nie ma pliku .env do zastosowania." }, { status: 404 });
      const queued = await queueAgentEnvApply({ config, serviceId: id, triggeredBy: user.email, fileName: ".env", content: read.stdout, previous: read.stdout });
      await auditLogs.logAction(user.email, "update", "service", id, { apply_env: true, engine: "agent", deploy_id: queued.deployId, job_id: queued.jobId });
      return NextResponse.json({ success: true, agent: queued });
    }

    const stack = await resolveComposeStack({ containerName: service.container_id, composeProject: service.compose_project });
    if (stack.project === SELF_COMPOSE_PROJECT) {
      return NextResponse.json(
        { success: false, selfDeployRequired: true, error: "Plik zapisany. Dashboard zastosuje zmienne przy najbliższym self-deployu (push do main)." },
        { status: 409 }
      );
    }

    // Services that wait for a dependency's healthcheck (NeoBeat bot → Lavalink) start only after it passes;
    // a timeout that kills Compose earlier leaves them created but never started.
    const result = await runHostCommand(buildComposeRecreateCommand(stack), 600_000);
    await auditLogs.logAction(user.email, "update", "service", id, {
      apply_env: true,
      compose_project: stack.project,
      services: stack.services,
      success: result.success,
    });

    if (!result.success) {
      const detail = (result.stderr || result.stdout).split("\n").slice(-12).join("\n");
      return NextResponse.json({ success: false, error: `Docker Compose nie odtworzył kontenerów:\n${detail}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, project: stack.project, services: stack.services });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHENTICATED" ? 401 : 403 }
      );
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Nie udało się zastosować zmiennych." }, { status: 500 });
  }
}
