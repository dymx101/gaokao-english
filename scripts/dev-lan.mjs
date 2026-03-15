import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        server.close(() => resolve(true));
      })
      .listen(port, "0.0.0.0");
  });
}

async function findFreePort(preferredPort) {
  let port = preferredPort;
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port);
    if (free) return port;
    port += 1;
  }
  throw new Error(`No free port found near ${preferredPort}`);
}

const ip = process.env.LAN_IP ?? getLanIp();
if (!ip) {
  console.error(
    "Could not determine LAN IPv4 address. Set LAN_IP=... and retry.",
  );
  process.exit(1);
}

const preferredApiPort = Number(process.env.API_PORT ?? 3001);
const preferredWebPort = Number(process.env.WEB_PORT ?? 3000);

const apiPort = await findFreePort(preferredApiPort);
const webPort = await findFreePort(preferredWebPort);

console.log(`LAN dev starting...`);
console.log(`  Web: http://${ip}:${webPort}`);
console.log(`  API: http://${ip}:${apiPort}`);
if (webPort !== preferredWebPort || apiPort !== preferredApiPort) {
  console.log(
    `  (auto-adjusted ports: preferred web=${preferredWebPort}, api=${preferredApiPort})`,
  );
}
console.log(`(Press Ctrl+C to stop)`);

const api = spawn("pnpm", ["-C", "apps/api", "dev:lan"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(apiPort),
    HOST: "0.0.0.0",
    AUTO_SEED: process.env.AUTO_SEED ?? "1",
  },
});

const web = spawn("pnpm", ["-C", "apps/web", "dev:lan"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(webPort),
    HOST: "0.0.0.0",
    NEXT_PUBLIC_API_URL: `http://${ip}:${apiPort}`,
  },
});

function shutdown(signal) {
  console.log(`\nShutting down (${signal})...`);
  api.kill(signal);
  web.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

api.on("exit", (code) => {
  console.log(`[api] exited with code ${code}`);
  web.kill("SIGTERM");
});
web.on("exit", (code) => {
  console.log(`[web] exited with code ${code}`);
  api.kill("SIGTERM");
});
