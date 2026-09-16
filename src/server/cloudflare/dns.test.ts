import { describe, expect, it } from "vitest";
import { dnsRecordsToRemove, planTunnelDns, tunnelTarget, zoneForHostname } from "./dns";

const TUNNEL = "11111111-1111-4111-8111-111111111111";
const LEGACY = "e9a074e3-7ca3-427a-ba23-b14efc8241c9";
const cname = (name: string, content: string, proxied = true) => ({ id: `id-${name}-${content}`, type: "CNAME", name, content, proxied });

describe("zoneForHostname", () => {
  const zones = [{ id: "a", name: "marczelloo.dev" }, { id: "b", name: "nadstrona.pl" }, { id: "c", name: "shop.nadstrona.pl" }];
  it("picks the most specific zone", () => {
    expect(zoneForHostname(zones, "x.shop.nadstrona.pl")?.id).toBe("c");
    expect(zoneForHostname(zones, "nadstrona.pl")?.id).toBe("b");
    expect(zoneForHostname(zones, "Tools.Marczelloo.dev")?.id).toBe("a");
  });
  it("does not match a suffix that is not a label boundary", () => {
    expect(zoneForHostname(zones, "notmarczelloo.dev")).toBeNull();
  });
});

describe("planTunnelDns", () => {
  it("creates a missing record", () => {
    expect(planTunnelDns("app.marczelloo.dev", [], TUNNEL, [LEGACY])).toEqual({ kind: "create" });
  });
  it("leaves a proxied record for this tunnel alone and fixes an unproxied one", () => {
    expect(planTunnelDns("app.marczelloo.dev", [cname("app.marczelloo.dev", tunnelTarget(TUNNEL))], TUNNEL, [])).toEqual({ kind: "none" });
    expect(planTunnelDns("app.marczelloo.dev", [cname("app.marczelloo.dev", tunnelTarget(TUNNEL), false)], TUNNEL, []).kind).toBe("update");
  });
  it("moves a record from the legacy tunnel", () => {
    const record = cname("tools.marczelloo.dev", tunnelTarget(LEGACY));
    expect(planTunnelDns("tools.marczelloo.dev", [record], TUNNEL, [LEGACY])).toEqual({ kind: "update", recordId: record.id });
  });
  it("refuses foreign records", () => {
    expect(planTunnelDns("bookhaven.marczelloo.dev", [cname("bookhaven.marczelloo.dev", "x.vercel-dns-017.com")], TUNNEL, [LEGACY]).kind).toBe("conflict");
    expect(planTunnelDns("a.pl", [{ id: "1", type: "A", name: "a.pl", content: "1.2.3.4" }], TUNNEL, []).kind).toBe("conflict");
  });
});

describe("dnsRecordsToRemove", () => {
  it("removes only CNAMEs pointing at this tunnel", () => {
    const own = cname("app.marczelloo.dev", tunnelTarget(TUNNEL));
    expect(dnsRecordsToRemove("app.marczelloo.dev", [own, cname("app.marczelloo.dev", tunnelTarget(LEGACY))], TUNNEL)).toEqual([own.id]);
  });
});
