const SECRET = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|MASTER_?KEY|DSN|WEBHOOK|COOKIE|_PASS$)/i;

/** Key names whose values the UI masks by default. */
export function isSecretKey(key: string): boolean {
  return SECRET.test(key);
}
