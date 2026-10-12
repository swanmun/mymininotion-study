#!/usr/bin/env node
// PreToolUse hook: block every tool call that reads, edits, moves or deletes a .env file.
// Template files (.env.example / .env.sample / .env.template) stay allowed.

const path = require("path");

const ALLOWED = new Set([".env.example", ".env.sample", ".env.template"]);

// ".env", ".env.local", ".env.production.local" … but not "process.env" or "dotenv".
const ENV_TOKEN = /(?<![\w$])\.env(?:\.[\w-]+)*/g;

function blockedTokens(text) {
  if (typeof text !== "string" || !text) return [];
  const hits = text.match(ENV_TOKEN) || [];
  return hits.filter((t) => !ALLOWED.has(t.toLowerCase()));
}

function isEnvFile(p) {
  if (typeof p !== "string" || !p) return false;
  const base = path.basename(p.replace(/\\/g, "/")).toLowerCase();
  return /^\.env(\..+)?$/.test(base) && !ALLOWED.has(base);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const tool = input.tool_name || "";
  const ti = input.tool_input || {};
  const msg = (what) =>
    `.env 파일 접근이 차단되었습니다 (${what}). 환경 변수 이름이 필요하면 .env.example을 참고하세요.`;

  // File tools: check the target path.
  for (const key of ["file_path", "notebook_path", "path"]) {
    if (isEnvFile(ti[key])) deny(msg(`${tool}: ${ti[key]}`));
  }

  // Glob / Grep: patterns that target .env files.
  if (tool === "Glob" || tool === "Grep") {
    for (const key of ["pattern", "glob", "path"]) {
      if (tool === "Grep" && key === "pattern") continue; // content regex, not a file target
      const hits = blockedTokens(ti[key]);
      if (hits.length) deny(msg(`${tool}: ${hits.join(", ")}`));
    }
  }

  // Shell tools: any mention of a .env file in the command.
  if (tool === "Bash" || tool === "PowerShell") {
    const hits = blockedTokens(ti.command);
    if (hits.length) deny(msg(`${tool}: ${hits.join(", ")}`));
  }

  process.exit(0);
});
