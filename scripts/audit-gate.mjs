#!/usr/bin/env node
// Fails on any high/critical production advisory unless it is listed in audit-exceptions.json
// with a justification and an expiry date. Usage: node scripts/audit-gate.mjs <package dir>
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = resolve(process.argv[2] ?? ".");
const exceptions = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "audit-exceptions.json"), "utf8"));
let raw;
try {
  raw = execSync("npm audit --omit=dev --json", { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch (e) {
  raw = e.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw);
const today = new Date().toISOString().slice(0, 10);
const seen = new Map();
for (const v of Object.values(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via === "string" || !["high", "critical"].includes(via.severity)) continue;
    seen.set(via.url, via);
  }
}
let failed = false;
for (const [url, via] of seen) {
  const ex = exceptions.find((e) => e.advisory === url);
  if (ex && ex.expires >= today) {
    console.log(`ALLOWED  ${via.severity} ${via.name} ${url} (until ${ex.expires}): ${ex.reason}`);
  } else {
    failed = true;
    console.log(`FAIL     ${via.severity} ${via.name} ${url}${ex ? ` (exception expired ${ex.expires})` : ""}`);
  }
}
console.log(failed ? "Audit gate failed." : `Audit gate passed (${seen.size} high/critical advisories, all with current exceptions).`);
process.exit(failed ? 1 : 0);
