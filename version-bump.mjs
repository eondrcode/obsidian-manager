import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));

let packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
packageLock.version = targetVersion;
if (packageLock.packages?.[""]) packageLock.packages[""].version = targetVersion;
writeFileSync("package-lock.json", JSON.stringify(packageLock, null, 2));
