import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, ".env.local");
const forwardTarget = process.env.STRIPE_WEBHOOK_FORWARD_TO || "localhost:3000/api/stripe/webhook";

const child = spawn("stripe", ["listen", "--forward-to", forwardTarget], {
  cwd: projectRoot,
  stdio: ["inherit", "pipe", "pipe"]
});

let wroteSecret = false;

function upsertWebhookSecret(secret) {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `STRIPE_WEBHOOK_SECRET=${secret}`;
  const next = existing.includes("STRIPE_WEBHOOK_SECRET=")
    ? existing.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line)
    : `${existing.trimEnd()}\n${line}\n`;

  fs.writeFileSync(envPath, next.replace(/^\n/, ""), "utf8");
  console.log(`\n[stripe] STRIPE_WEBHOOK_SECRET actualizado en ${envPath}\n`);
}

function handleChunk(chunk, stream) {
  const text = chunk.toString();
  stream.write(text);

  if (wroteSecret) return;
  const match = text.match(/whsec_[A-Za-z0-9]+/);
  if (!match) return;

  upsertWebhookSecret(match[0]);
  wroteSecret = true;
}

child.stdout.on("data", (chunk) => handleChunk(chunk, process.stdout));
child.stderr.on("data", (chunk) => handleChunk(chunk, process.stderr));

child.on("error", (error) => {
  if ((error && "code" in error && error.code === "ENOENT") || /ENOENT/.test(String(error))) {
    console.error("[stripe] Stripe CLI no está instalada o no está en tu PATH.");
    console.error("[stripe] Instálala y autentícate con `stripe login`, luego vuelve a correr `npm run stripe:listen`.");
    process.exit(1);
  }

  console.error("[stripe] No se pudo iniciar stripe listen:", error);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
