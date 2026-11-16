import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function start(label, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    detached: true,
  });

  child.on("error", (error) => {
    console.error(`[${label}] could not start: ${error.message}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`[${label}] exited with ${reason}`);
    if (label === "web") {
      shutdown(typeof code === "number" ? code : 1);
    }
  });

  children.push(child);
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }
  setTimeout(() => process.exit(code), 400).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("web", "next", ["dev", "-H", "127.0.0.1"]);
start("server", "cargo", ["run", "--manifest-path", "server/Cargo.toml"]);
