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
const usernameColumn = header?.indexOf("Roblox Username") ?? -1;
if (usernameColumn < 0) throw new Error('CSV is missing the "Roblox Username" column.');

const usernamesByKey = new Map();
for (const row of rows) {
  const name = row[usernameColumn]?.trim();
  if (name && /^[A-Za-z0-9_]{3,20}$/.test(name) && !usernamesByKey.has(name.toLowerCase())) {
    usernamesByKey.set(name.toLowerCase(), name);
  }
}
const usernames = [...usernamesByKey.values()].sort((a, b) => a.localeCompare(b));
const output = {
  schemaVersion: 2,
  source: "Severe Injection Database - Refined Raw Data.csv",
  sourceRecordCount: rows.length,
  uniqueRobloxUsernameCount: usernames.length,
  usernames,
};
const outputPath = resolve("data/roblox-usernames.json");
await mkdir(resolve("data"), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${usernames.length} unique Roblox usernames to ${outputPath}`);

