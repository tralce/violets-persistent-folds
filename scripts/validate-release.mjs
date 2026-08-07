import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [pkg, manifest, versions] = await Promise.all([
  readJson("package.json"),
  readJson("manifest.json"),
  readJson("versions.json")
]);

const failures = [];
if (pkg.version !== manifest.version) failures.push("package.json and manifest.json versions differ");
if (pkg.name !== "violets-persistent-folds") failures.push("package name is not violets-persistent-folds");
if (pkg.author !== "tralce") failures.push("package author is not tralce");
if (manifest.id !== "violets-persistent-folds") failures.push("manifest ID is not violets-persistent-folds");
if (manifest.name !== "Violet's Persistent Folds") failures.push("manifest name is not Violet's Persistent Folds");
if (manifest.author !== "tralce") failures.push("manifest author is not tralce");
if (versions[manifest.version] !== manifest.minAppVersion) {
  failures.push("versions.json does not map the current version to minAppVersion");
}

if (failures.length > 0) {
  throw new Error(failures.join("; "));
}

console.log(`Release metadata is consistent at ${manifest.version}.`);
