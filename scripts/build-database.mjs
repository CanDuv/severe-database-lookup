import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npm run build:data -- <path-to-csv>");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const rows = parseCsv(await readFile(resolve(inputPath), "utf8"));
const header = rows.shift();
const idColumn = header?.indexOf("Profile User ID") ?? -1;
if (idColumn < 0) throw new Error('CSV is missing the "Profile User ID" column.');

const ids = [...new Set(rows.map((row) => row[idColumn]?.trim()).filter((id) => /^\d{1,20}$/.test(id)))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const output = {
  schemaVersion: 1,
  source: "Severe Injection Database - Refined Raw Data.csv",
  sourceRecordCount: rows.length,
  uniqueProfileUserIdCount: ids.length,
  ids,
};
const outputPath = resolve("data/cheater-user-ids.json");
await mkdir(resolve("data"), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${ids.length} unique profile IDs to ${outputPath}`);

