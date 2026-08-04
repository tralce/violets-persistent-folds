import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [pkg, manifest, versions] = await Promise.all([
  readJson("package.json"),
  readJson("manifest.json"),
  readJson("versions.json")
]);

const failures = [];
if (pkg.version !== manifest.version) failures.push("package.json and manifest.json versions differ");
if (versions[manifest.version] !== manifest.minAppVersion) {
  failures.push("versions.json does not map the current version to minAppVersion");
}

if (failures.length > 0) {
  throw new Error(failures.join("; "));
}

console.log(`Release metadata is consistent at ${manifest.version}.`);
