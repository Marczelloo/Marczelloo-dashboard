export interface Section {
  kind: string;
  id: string;
  exitCode: number;
  body: string;
}

const KIND = /^[a-z][a-z-]*$/;
const ID = /^[A-Za-z0-9_.:/@+-]+$/;

/**
 * Runs `command`, then prints its stdout base64-encoded between markers so
 * arbitrary file content cannot collide with the protocol.
 */
export function sectionCommand(kind: string, id: string, command: string): string {
  if (!KIND.test(kind) || !ID.test(id)) throw new Error(`Nieprawidłowa sekcja: ${kind} ${id}`);
  return [
    'mz_tmp="$(mktemp)"',
    `if { ${command} ; } >"$mz_tmp" 2>/dev/null; then mz_code=0; else mz_code=$?; fi`,
    `echo "@@MZ:BEGIN ${kind} ${id}"`,
    'base64 -w0 "$mz_tmp"; echo',
    `echo "@@MZ:END ${kind} ${id} $mz_code"`,
    'rm -f "$mz_tmp"',
  ].join("\n");
}

export function parseSections(stdout: string): Section[] {
  const lines = stdout.split("\n").map((line) => line.trim());
  const sections: Section[] = [];

  for (let index = 0; index < lines.length; index++) {
    const begin = /^@@MZ:BEGIN (\S+) (\S+)$/.exec(lines[index]);
    if (!begin) continue;
    const end = /^@@MZ:END (\S+) (\S+) (\d+)$/.exec(lines[index + 2] ?? "");
    if (!end || end[1] !== begin[1] || end[2] !== begin[2]) {
      throw new Error(`Uszkodzona sekcja wyjścia: ${begin[1]} ${begin[2]}`);
    }
    sections.push({
      kind: begin[1],
      id: begin[2],
      exitCode: Number(end[3]),
      body: Buffer.from(lines[index + 1] ?? "", "base64").toString("utf8"),
    });
    index += 2;
  }

  return sections;
}
