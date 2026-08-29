import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const inventories = [
  {
    lockfile: "package-lock.json",
    output: "docs/dependency-inventory/npm-workspace.csv",
  },
  {
    lockfile: "website/package-lock.json",
    output: "docs/dependency-inventory/npm-website.csv",
  },
];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function packageName(packagePath, metadata) {
  if (metadata.name) return metadata.name;

  const normalized = packagePath.replaceAll("\\", "/");
  const marker = "node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return "";
  return normalized.slice(markerIndex + marker.length);
}

function licenseName(license) {
  if (typeof license === "string" && license.trim()) return license.trim();
  if (Array.isArray(license)) return license.map(licenseName).filter(Boolean).join(" OR ");
  if (license && typeof license === "object") {
    return licenseName(license.type) || licenseName(license.name);
  }
  return "UNKNOWN";
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeInventory({ lockfile, output }) {
  const lockfilePath = resolve(repositoryRoot, lockfile);
  const lock = JSON.parse(readFileSync(lockfilePath, "utf8"));
  const dependencies = new Map();

  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    if (!packagePath.includes("node_modules/") || !metadata.version) continue;

    const name = packageName(packagePath, metadata);
    if (!name) continue;

    const row = {
      package: name,
      version: metadata.version,
      license: licenseName(metadata.license),
      source: lockfile,
    };
    dependencies.set(`${row.package}@${row.version}`, row);
  }

  const rows = [...dependencies.values()].sort(
    (left, right) =>
      compareText(left.package, right.package) || compareText(left.version, right.version),
  );
  const unknown = rows.filter((row) => row.license === "UNKNOWN");
  if (unknown.length) {
    throw new Error(
      `${lockfile} contains ${unknown.length} package(s) without license metadata: ` +
        unknown.map((row) => `${row.package}@${row.version}`).join(", "),
    );
  }

  const lines = [
    ["package", "version", "license", "source"],
    ...rows.map((row) => [row.package, row.version, row.license, row.source]),
  ];
  const contents = `${lines.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
  const outputPath = resolve(repositoryRoot, output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, contents, "utf8");
  process.stdout.write(`${output}: ${rows.length} unique packages, 0 unknown licenses\n`);
}

for (const inventory of inventories) writeInventory(inventory);
