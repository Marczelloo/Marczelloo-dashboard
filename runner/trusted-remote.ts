import net from "node:net";

export function isTrustedRemote(address: string | undefined): boolean {
  if (!address) return false;
  const ip = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (!net.isIPv4(ip)) return false;
  const [first, second] = ip.split(".").map(Number);
  return first === 172 && second >= 16 && second <= 31;
}
