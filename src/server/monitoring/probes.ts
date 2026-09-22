import "server-only";

import tls from "node:tls";

const TIMEOUT_MS = 10_000;

export async function probeDomain(host: string): Promise<{ statusCode: number | null; latencyMs: number; error: string | null }> {
  const started = Date.now();
  try {
    const response = await fetch(`https://${host}/`, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "Marczelloo-Dashboard-Monitor/2.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    return { statusCode: response.status, latencyMs: Date.now() - started, error: null };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
    return { statusCode: null, latencyMs: Date.now() - started, error: timedOut ? "No answer within 10 s" : cause ?? (error instanceof Error ? error.message : "Connection error") };
  }
}

export function probeTls(host: string): Promise<{ validTo: string | null; error: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { validTo: string | null; error: string | null }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    const socket = tls.connect({ host, port: 443, servername: host, timeout: TIMEOUT_MS }, () => {
      const certificate = socket.getPeerCertificate();
      const validTo = certificate?.valid_to ? new Date(certificate.valid_to) : null;
      finish(validTo && !Number.isNaN(validTo.getTime()) ? { validTo: validTo.toISOString(), error: null } : { validTo: null, error: "brak certyfikatu" });
    });
    socket.on("timeout", () => finish({ validTo: null, error: "No answer within 10 s" }));
    socket.on("error", (error) => finish({ validTo: null, error: error.message }));
  });
}
