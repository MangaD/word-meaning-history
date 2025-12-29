// scripts/build.mjs
import { mkdir, rm, copyFile, cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIST = "dist";

async function build(target) {
  const outDir = join(DIST, target);
  const manifestPath = join("manifests", `manifest.${target}.json`);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // Copy folders
  await cp("src", join(outDir, "src"), { recursive: true });
  await cp("icons", join(outDir, "icons"), { recursive: true });

  // Write manifest.json
  const manifest = await readFile(manifestPath, "utf8");
  await writeFile(join(outDir, "manifest.json"), manifest, "utf8");

  console.log(`Built: ${outDir}`);
}

const target = process.argv[2];

if (!target || !["chrome", "firefox", "all"].includes(target)) {
  console.log("Usage: node scripts/build.mjs <chrome|firefox|all>");
  process.exit(1);
}

await mkdir(DIST, { recursive: true });

if (target === "all") {
  await build("chrome");
  await build("firefox");
} else {
  await build(target);
}
