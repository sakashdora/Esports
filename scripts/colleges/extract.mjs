// Builds the extra Odisha college rows from the downloaded official/public lists.
// Usage: node extract.mjs <chse-pdf-dir> <wiki-json-dir> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [chseDir, wikiDir, outFile] = process.argv.slice(2);

const DISTRICTS = {
  angul: 'Angul', balasore: 'Balasore', baragarh: 'Bargarh', bhadrak: 'Bhadrak', bolangir: 'Balangir',
  boudh: 'Boudh', cuttack: 'Cuttack', deogarh: 'Deogarh', dhenkanal: 'Dhenkanal', gajapati: 'Gajapati',
  ganjam: 'Ganjam', jagatsingpur: 'Jagatsinghpur', jajpur: 'Jajpur', jharsuguda: 'Jharsuguda',
  kalahandi: 'Kalahandi', kendrapada: 'Kendrapara', kendujhar: 'Keonjhar', khorda: 'Khordha',
  koraput: 'Koraput', malkangiri: 'Malkangiri', mayurbhanj: 'Mayurbhanj', nabarngpur: 'Nabarangpur',
  nayagarh: 'Nayagarh', nuapada: 'Nuapada', phulabani: 'Kandhamal', puri: 'Puri', raygada: 'Rayagada',
  sambalpur: 'Sambalpur', subarnapur: 'Subarnapur',
};

const ABBREV = [
  [/\bMAHAV\.?(?=\s|,|$)/gi, 'Mahavidyalaya'],
  [/\bMOHAV\.?(?=\s|,|$)/gi, 'Mahavidyalaya'],
  [/\bMAHAVIDYALAY\b/gi, 'Mahavidyalaya'],
  [/\bJR\.?(?=\s|,|$)/gi, 'Junior'],
  [/\bH\.?\s?S\.?\s+SCHOOL\b/gi, 'Higher Secondary School'],
  [/\bHR\.?\s?SEC\.?\b/gi, 'Higher Secondary'],
  [/\bSC\.(?=\s|,|$)/gi, 'Science'],
  [/\bEDN\.?(?=\s|,|$)/gi, 'Education'],
  [/\bED\.(?=\s|,|$)/gi, 'Education'],
  [/\bTECH\.(?=\s|,|$)/gi, 'Technology'],
  [/\bCOLL\.?(?=\s|,|$)/gi, 'College'],
  [/\bVIDYA\.(?=\s|,|$)/gi, 'Vidyalaya'],
];

const UPPER_ABBREV = [
  [/\bSC\b\.?/g, 'Science'],
  [/\bSCI\b\.?/g, 'Science'],
  [/\bEDU\b\.?/g, 'Education'],
  [/\bINST\b\.?/g, 'Institute'],
  [/\bVOC\b\.?/g, 'Vocational'],
  [/\bGOVT\b\.?/g, 'Govt.'],
  [/\bMAHILA\b/g, 'Mahila'],
  [/\bH\.S\.?(?=\s|,|$)/g, 'Higher Secondary'],
];

const KEEP_UPPER = /^(DAV|SVM|ITI|OAV|NAC|SCS|BJB|USBM|HSS|KIIT|SOA|OUAT|ST|SC|ST)$/;

function caseWord(word) {
  const bare = word.replace(/[^A-Za-z]/g, '');
  if (!bare) return word;
  // Dotted initials: "B.J.B." stays, "I.G.MAHILA" -> "I.G.Mahila", "GOVT." -> "Govt."
  if (word.includes('.')) {
    return word
      .split('.')
      .map((seg) => (seg.replace(/[^A-Za-z]/g, '').length <= 1 ? seg.toUpperCase() : caseWord(seg)))
      .join('.');
  }
  if (bare.length === 1 || KEEP_UPPER.test(bare) || (bare.length <= 4 && !/[AEIOUY]/i.test(bare))) return word.toUpperCase();
  return word.toLowerCase().replace(/(^|[(\-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

function smartCase(text) {
  let t = text.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,(?=\S)/g, ', ').replace(/^\++2/, '+2').trim();
  const letters = t.replace(/[^A-Za-z]/g, '');
  const isUpper = letters.length > 0 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.8;
  for (const [re, rep] of ABBREV) t = t.replace(re, rep);
  if (isUpper) {
    for (const [re, rep] of UPPER_ABBREV) t = t.replace(re, rep);
    t = t.split(' ').map(caseWord).join(' ');
  }
  return t
    .replace(/'S\b/g, "'s")
    .replace(/\b(Of|And|For|The|In|At)\b/g, (w) => w.toLowerCase())
    .replace(/Academyof/g, 'Academy of')
    .replace(/\s+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function splitNameCity(full, fallbackCity) {
  const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
  // "Name, Town, District" -> drop the trailing district name.
  if (parts.length >= 3 && fallbackCity && parts[parts.length - 1].toLowerCase() === fallbackCity.toLowerCase()) parts.pop();
  if (parts.length >= 2) {
    const city = parts.pop();
    return { name: parts.join(', '), city };
  }
  return { name: full, city: fallbackCity };
}

const rows = [];
const add = (name, city, category, district, source) => {
  name = name.replace(/\s+/g, ' ').trim();
  city = (city || '').replace(/\s+/g, ' ').trim();
  if (name.length < 4) return;
  rows.push({ name, city, category, district, source });
};

// 1. CHSE Odisha +2 (higher secondary) lists, one PDF per district.
for (const file of fs.readdirSync(chseDir).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
  const key = path.basename(file, '.pdf').toLowerCase();
  const district = DISTRICTS[key];
  if (!district) continue;
  const text = execFileSync('pdftotext', ['-layout', path.join(chseDir, file), '-'], { encoding: 'utf8' });
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/\b[A-Z]{2}\d{2,3}\s+(.+?)\s*$/);
    if (!m) continue;
    const raw = m[1].replace(/\s{2,}.*$/, '').trim();
    if (!raw || /^HSS Name$/i.test(raw)) continue;
    const { name, city } = splitNameCity(smartCase(raw), district);
    add(name, city === name ? district : smartCase(city), 'H', district, 'CHSE');
  }
}

// 2. Wikipedia lists (wikitext).
const stripWiki = (s) => s
  .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/g, '')
  .replace(/<!--.*?-->/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/\{\{[^}]*\}\}/g, '')
  .replace(/'''?/g, '')
  .trim();

const bputFile = path.join(wikiDir, 'List_of_colleges_affiliated_to_Biju_Patnaik_University_of_Technology.json');
if (fs.existsSync(bputFile)) {
  const w = JSON.parse(fs.readFileSync(bputFile, 'utf8')).parse.wikitext['*'];
  let category = null;
  for (const line of w.split('\n')) {
    if (/^==\s*Colleges offering B\.Tech/i.test(line)) category = 'E';
    else if (/^==\s*Colleges offering B\.Arch/i.test(line)) category = 'E';
    else if (/^==\s*Colleges offering MCA/i.test(line)) category = 'M';
    else if (/^==\s*Colleges offering MBA/i.test(line)) category = 'M';
    else if (/^==\s*(References|Table legend)/i.test(line)) category = null;
    if (!category || !/^\|(?![-}+])/.test(line)) continue;
    const cell = stripWiki(line.slice(1).split('||')[0]);
    if (!cell || /^(name|college|institute name)$/i.test(cell) || cell.length > 110) continue;
    const { name, city } = splitNameCity(smartCase(cell), '');
    add(name, city, category, '', 'Wikipedia BPUT');
  }
}

const suFile = path.join(wikiDir, 'List_of_colleges_affiliated_to_the_Sambalpur_University.json');
if (fs.existsSync(suFile)) {
  const w = JSON.parse(fs.readFileSync(suFile, 'utf8')).parse.wikitext['*'];
  for (const line of w.split('\n')) {
    if (!/^\|(?![-}+])/.test(line)) continue;
    const cell = stripWiki(line.slice(1).split('||')[0]).replace(/^\s*\|/, '').trim();
    if (!cell || cell.length > 110) continue;
    const parts = cell.split(',').map((p) => p.trim()).filter(Boolean);
    // "Name, Town, District" -> keep the town as the city.
    const name = parts[0];
    const city = parts.length >= 3 ? parts[1] : parts[1] || '';
    const category = /higher secondary|junior/i.test(name) ? 'H'
      : /nursing|medical|ayurved|homoeo|homeo|pharma/i.test(name) ? 'MED'
      : /law college/i.test(name) ? 'L'
      : /engineering|technology/i.test(name) ? 'E'
      : /management|mba|mca/i.test(name) ? 'M' : 'D';
    add(name, city, category, '', 'Wikipedia Sambalpur University');
  }
}

fs.writeFileSync(outFile, JSON.stringify(rows, null, 1));
const by = rows.reduce((a, r) => ((a[r.source] = (a[r.source] || 0) + 1), a), {});
console.log(rows.length, by);
