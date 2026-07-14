import { execSync } from "node:child_process";

/**
 * Stops Node processes that belong to this repo only (api/web watchers).
 */
const marker = "FRS-AdvanceTraffic\\source";

try {
  const out = execSync(
    `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match '${marker.replace(/\\/g, "\\\\")}' } | ForEach-Object { $_.ProcessId }"`,
    { encoding: "utf8" },
  );
  const pids = out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
      console.log(`Stopped PID ${pid}`);
    } catch {
      // already gone
    }
  }
  if (pids.length === 0) console.log("No FRS AdvanceTraffic node processes found.");
} catch {
  console.log("No FRS AdvanceTraffic node processes found.");
}
