// Writes src/lib/odishaCollegesExtra.ts from rows.json.
// Usage: node generate.mjs <rows.json> <out.ts>
import fs from 'node:fs';

const [rowsFile, outFile] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));

const cityFix = (c) => c
  .replace(/^(Bhubaneshwar|BBSR|BHUBANESWAR)$/i, 'Bhubaneswar')
  .replace(/^CTC$/i, 'Cuttack')
  .replace(/^BAM$/i, 'Berhampur')
  .replace(/^Khurda$/i, 'Khordha')
  .replace(/^Brahmapur$/i, 'Berhampur')
  .trim();

const seen = new Set();
const out = [];
for (const r of rows) {
  const name = r.name.replace(/;\s*/g, ', ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  const city = cityFix(r.city.replace(/[’‘]/g, "'"));
  const key = name.toLowerCase().replace(/autonomous|[^a-z0-9]/g, '') + '|' + city.toLowerCase().replace(/[^a-z]/g, '');
  if (seen.has(key)) continue;
  seen.add(key);
  out.push([name, city, r.category]);
}
out.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

const header = `// GENERATED FILE: do not edit by hand. Hand-checked entries live in odishaColleges.ts.
//
// Extra Odisha institutions for the registration college search, loaded only when a student
// opens the college box. Sources (fetched ${new Date().toISOString().slice(0, 10)}):
// - CHSE Odisha affiliated +2 colleges, district lists: https://chseodisha.nic.in/all_affiliated_colleges/
// - Wikipedia, List of colleges affiliated to Biju Patnaik University of Technology (B.Tech, MBA, MCA)
// - Wikipedia, List of colleges affiliated to the Sambalpur University
// Category codes: H = +2 higher secondary, D = degree, E = engineering, M = MBA/MCA,
// MED = medical and health, L = law.

export type ExtraCategoryCode = 'H' | 'D' | 'E' | 'M' | 'MED' | 'L';

export const EXTRA_COLLEGE_ROWS: [name: string, city: string, category: ExtraCategoryCode][] = [
`;
const body = out.map(([n, c, k]) => `  [${JSON.stringify(n)}, ${JSON.stringify(c)}, '${k}'],`).join('\n');
fs.writeFileSync(outFile, header + body + '\n];\n');
console.log(out.length, 'rows written');
