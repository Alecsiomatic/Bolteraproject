import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const children = [];
let shuttingDown = false;

const terminateChildren = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      const signal = isWindows ? "SIGINT" : "SIGTERM";
      child.kill(signal);
    }
  }

  setTimeout(() => {
    process.exit(code);
  }, 100);
};

const startProcess = (label, command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWindows,
    env: process.env,
    ...options,
  });

  children.push(child);
  console.log(`▶️  [${label}] ${command} ${args.join(" ")}`);

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(`✅  [${label}] finalizó (code 0)`);
    } else {
      console.error(`❌  [${label}] terminó con código ${code ?? "unknown"}`);
    }
    terminateChildren(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(`❌  [${label}] falló al iniciar`, error);
    terminateChildren(1);
  });
};

process.once("SIGINT", () => terminateChildren(0));
process.once("SIGTERM", () => terminateChildren(0));

startProcess("backend", "pnpm", ["--dir", "server", "dev"]);
startProcess("frontend", "pnpm", ["run", "dev:web"]);
