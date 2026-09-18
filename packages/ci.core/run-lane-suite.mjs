// packages/ci.core/run-lane-suite.mjs
// Usage: node packages/ci.core/run-lane-suite.mjs <lane-id>
// Runs one lane's node suite the one canonical way: serial files, because
// every suite file already fans out across worker meshes and parallel files
// oversubscribe the machine until pairing trips its timeout. Streams the
// suite output through and exits with its code.
import { spawn } from "node:child_process";
import { laneById } from "./lanes.mjs";

const [laneId] = process.argv.slice(2);
let lane;
try {
  lane = laneById(laneId);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
console.log(`ci.core: lane ${lane.id} suite (${lane.packageDir})`);
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", `./${lane.packageDir}/*.test.ts`], { stdio: "inherit" });
child.on("error", error => {
  console.error(`ci.core: lane ${lane.id} failed to start: ${error.message}`);
  process.exit(2);
});
child.on("exit", (code, signal) => {
  console.log(`ci.core: lane ${lane.id} ${code === 0 ? "pass" : `fail (${signal ?? `code ${code}`})`}`);
  process.exit(code ?? 1);
});
