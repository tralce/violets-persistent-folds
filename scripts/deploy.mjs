import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const vault = process.argv[2];
if (!vault) throw new Error("Usage: npm run deploy -- /path/to/vault");

const destination = resolve(vault, ".obsidian", "plugins", "frontmatter-folds");
await mkdir(destination, { recursive: true });
await Promise.all(["main.js", "manifest.json", "versions.json"].map((name) =>
  copyFile(resolve(name), resolve(destination, name))
));
console.log(`Deployed Frontmatter Folds to ${destination}`);
