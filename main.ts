import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ai-excited-01 entry: "Lanternback: The Village That Rides the Dawn Whale".
// Deterministic by design: copy the vendored entry.png to the output
// directory. No network, no randomness, so every run writes identical bytes.
// Round 2 rebuild (2026-11-16): same vendored image, rewritten entrypoint.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });

const here = dirname(fileURLToPath(import.meta.url));
copyFileSync(join(here, "entry.png"), join(outDir, "entry.png"));
