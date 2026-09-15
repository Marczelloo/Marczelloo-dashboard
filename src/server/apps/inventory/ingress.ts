import { parse } from "yaml";
import type { IngressRule } from "../types";

export function parseIngressConfig(raw: string): IngressRule[] {
  const document = parse(raw) as { ingress?: unknown } | null;
  if (!document || !Array.isArray(document.ingress)) {
    throw new Error("Konfiguracja cloudflared nie ma sekcji ingress.");
  }

  return document.ingress.map((rule, position) => {
    const value = rule as { hostname?: unknown; path?: unknown; service?: unknown; originRequest?: unknown } | null;
    if (!value || typeof value.service !== "string") {
      throw new Error(`Reguła ingress #${position + 1} nie ma pola service.`);
    }
    return {
      position,
      hostname: typeof value.hostname === "string" ? value.hostname.toLowerCase() : null,
      path: typeof value.path === "string" ? value.path : null,
      service: value.service,
      originRequest: value.originRequest && typeof value.originRequest === "object" ? (value.originRequest as Record<string, unknown>) : null,
    };
  });
}

export function countHostnames(rules: IngressRule[]): number {
  return new Set(rules.map((rule) => rule.hostname).filter(Boolean)).size;
}
