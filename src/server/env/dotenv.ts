export interface EnvEntry {
  key: string;
  value: string;
}

export type EnvLine = { kind: "entry"; key: string; value: string; raw: string } | { kind: "other"; raw: string };

const ENTRY = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

function closingQuoteIndex(body: string): number {
  let escaped = false;
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      return index;
    }
  }
  return -1;
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\([\\"nrt])/g, (_match, char: string) => ({ n: "\n", r: "\r", t: "\t" })[char as "n" | "r" | "t"] ?? char);
}

export function parseEnvLines(content: string): EnvLine[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const result: EnvLine[] = [];

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const match = ENTRY.exec(raw);
    if (!match) {
      result.push({ kind: "other", raw });
      continue;
    }

    const [, key, rest] = match;
    const value = rest.trimStart();

    if (value.startsWith('"')) {
      let body = value.slice(1);
      let block = raw;
      while (closingQuoteIndex(body) === -1 && index + 1 < lines.length) {
        index++;
        body += `\n${lines[index]}`;
        block += `\n${lines[index]}`;
      }
      const end = closingQuoteIndex(body);
      result.push({ kind: "entry", key, value: unescapeDoubleQuoted(end === -1 ? body : body.slice(0, end)), raw: block });
    } else if (value.startsWith("'")) {
      const end = value.indexOf("'", 1);
      result.push({ kind: "entry", key, value: end === -1 ? value.slice(1) : value.slice(1, end), raw });
    } else {
      const comment = value.search(/\s#/);
      result.push({ kind: "entry", key, value: (comment === -1 ? value : value.slice(0, comment)).trim(), raw });
    }
  }

  return result;
}

export function parseEnvEntries(content: string): EnvEntry[] {
  const byKey = new Map<string, string>();
  for (const line of parseEnvLines(content)) {
    if (line.kind !== "entry") continue;
    byKey.delete(line.key);
    byKey.set(line.key, line.value);
  }
  return [...byKey].map(([key, value]) => ({ key, value }));
}

export function formatEnvValue(value: string): string {
  if (value === "") return "";
  if (!/[\s#"'$\\`]/.test(value)) return value;
  if (!value.includes("'") && !value.includes("\n")) return `'${value}'`;
  if (value.includes("$")) {
    throw new Error("Wartość zawiera jednocześnie znak $ oraz apostrof lub nową linię — wpisz ją ręcznie w pliku na serwerze.");
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function updateEnvContent(original: string, vars: EnvEntry[]): string {
  const wanted = new Map(vars.map((variable) => [variable.key, variable.value]));
  const written = new Set<string>();
  const output: string[] = [];

  for (const line of parseEnvLines(original)) {
    if (line.kind === "other") {
      output.push(line.raw);
      continue;
    }
    if (!wanted.has(line.key) || written.has(line.key)) continue;

    const value = wanted.get(line.key)!;
    output.push(line.value === value ? line.raw : `${line.key}=${formatEnvValue(value)}`);
    written.add(line.key);
  }

  for (const variable of vars) {
    if (!written.has(variable.key)) {
      output.push(`${variable.key}=${formatEnvValue(variable.value)}`);
      written.add(variable.key);
    }
  }

  return output.length ? `${output.join("\n")}\n` : "";
}
