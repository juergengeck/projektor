// packages/lab.core/test/commserver.ts
/**
 * Local commserver for hermetic lane tests: the one.models bundle also
 * backing the glue service. Each brand gets its own port so the two lane
 * suites may run side by side.
 */
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const commServerBundle = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "..", "one", "packages", "one.models", "comm_server.bundle.js",
);

export async function startCommServer(port: number): Promise<{ url: string; stop(): Promise<void> }> {
  const child = spawn(process.execPath, [commServerBundle, "-h", "127.0.0.1", "-p", String(port)], {
    stdio: "ignore",
  });
  const deadline = Date.now() + 30_000;
  for (;;) {
    const reachable = await new Promise<boolean>(resolve => {
      const socket = connect(port, "127.0.0.1");
      socket.on("connect", () => { socket.end(); resolve(true); });
      socket.on("error", () => resolve(false));
    });
    if (reachable) break;
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("local commserver never came up");
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return {
    url: `ws://127.0.0.1:${port}`,
    async stop(): Promise<void> {
      child.kill();
    },
  };
}
