#!/usr/bin/env node
// Stop hook: scan source for env var usage and hardcoded config values,
// then (re)write .env.example. Never reads real .env files.

const fs = require("fs");
const path = require("path");

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const OUT = path.join(ROOT, ".env.example");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", ".specify", "specs", "public", "coverage", "dist", "build", "out"]);
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), files);
    } else if (EXTS.has(path.extname(ent.name)) && !/\.d\.ts$/.test(ent.name)) {
      files.push(path.join(dir, ent.name));
    }
  }
  return files;
}

const toSnake = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();

const ENV_REF = /(?:process\.env|import\.meta\.env)(?:\.([A-Z_][A-Z0-9_]*)|\[\s*["'`]([A-Z_][A-Z0-9_]*)["'`]\s*\])/g;
// const NAME = "literal"
const CONST_LIT = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(["'`])([^"'`\n]+)\2/g;
const SECRET_PATTERNS = [
  /^eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+$/, // JWT
  /^sb_(publishable|secret)_[\w-]+$/, // Supabase keys
  /^sk-[\w-]{16,}$/, // API secret keys
  /^(ghp|gho|github_pat)_[\w]{20,}$/,
  /^AKIA[0-9A-Z]{16}$/,
];
const CONFIG_NAME = /(URL|URI|HOST|ENDPOINT|DOMAIN|API|KEY|SECRET|TOKEN|PASSWORD|PASS|DSN|BUCKET|PROJECT_?ID|CLIENT_?ID)/;

const used = new Map(); // NAME -> Set(file)
const hardcoded = new Map(); // NAME -> { value, where, secret }

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (/\.test\.|\.spec\.|vitest|jest/.test(rel)) continue;
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);

  for (const m of src.matchAll(ENV_REF)) {
    const name = m[1] || m[2];
    if (name === "NODE_ENV") continue;
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(rel);
  }

  lines.forEach((line, i) => {
    if (/process\.env|import\.meta\.env/.test(line)) return;
    for (const m of line.matchAll(CONST_LIT)) {
      const [, ident, , value] = m;
      const name = toSnake(ident);
      const secret = SECRET_PATTERNS.some((re) => re.test(value));
      const isUrl = /^(https?|wss?|postgres(ql)?|mysql|redis|mongodb(\+srv)?):\/\//.test(value);
      if (secret || (isUrl && CONFIG_NAME.test(name))) {
        hardcoded.set(name, { value, where: `${rel}:${i + 1}`, secret });
      }
    }
  });
}

// Keep example values the user already wrote.
const prev = {};
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/);
    if (m) prev[m[1]] = m[2];
  }
}

const out = [
  "# 자동 생성: .claude/hooks/env-example.js (Stop 훅)",
  "# 실제 값은 .env.local에 넣고, 이 파일에는 키 이름과 예시 값만 둡니다.",
  "",
];
if (used.size) {
  out.push("# ── 코드에서 사용 중인 환경 변수 ──");
  for (const name of [...used.keys()].sort()) {
    out.push(`# 사용처: ${[...used.get(name)].join(", ")}`);
    out.push(`${name}=${prev[name] ?? ""}`);
  }
  out.push("");
}
const pending = [...hardcoded.keys()].filter((n) => !used.has(n)).sort();
if (pending.length) {
  out.push("# ── 하드코딩 의심 (환경 변수로 옮길 후보) ──");
  for (const name of pending) {
    const h = hardcoded.get(name);
    out.push(`# ${h.where}${h.secret ? " — 비밀값으로 보임, 코드에서 제거 필요" : ""}`);
    out.push(`${name}=${prev[name] ?? (h.secret ? "" : h.value)}`);
  }
  out.push("");
}
// Keys the user added by hand stay in the file.
const extra = Object.keys(prev).filter((n) => !used.has(n) && !pending.includes(n));
if (extra.length) {
  out.push("# ── 직접 추가한 항목 ──");
  for (const name of extra) out.push(`${name}=${prev[name]}`);
  out.push("");
}

const next = out.join("\n");
const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
const changed = before !== next;
if (changed) fs.writeFileSync(OUT, next);

const secrets = pending.filter((n) => hardcoded.get(n).secret);
const notes = [];
if (changed) notes.push(`.env.example 갱신 (변수 ${used.size}개, 하드코딩 후보 ${pending.length}개)`);
if (secrets.length) notes.push(`비밀값 하드코딩 의심: ${secrets.map((n) => hardcoded.get(n).where).join(", ")}`);
if (notes.length) process.stdout.write(JSON.stringify({ systemMessage: notes.join(" · ") }));
