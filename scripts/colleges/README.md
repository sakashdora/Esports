# Refreshing the Odisha college list

`src/lib/odishaCollegesExtra.ts` is generated. Hand-checked entries live in `src/lib/odishaColleges.ts`.

1. Download every district PDF linked from https://chseodisha.nic.in/all_affiliated_colleges/ into one folder
   (lowercase file names, e.g. `khorda.pdf`; see the `DISTRICTS` map in `extract.mjs`).
2. Save the Wikipedia wikitext of "List of colleges affiliated to Biju Patnaik University of Technology"
   and "List of colleges affiliated to the Sambalpur University" as JSON
   (`https://en.wikipedia.org/w/api.php?action=parse&page=<title>&prop=wikitext&format=json`) into another folder.
3. Run (needs `pdftotext` from poppler):

```
node scripts/colleges/extract.mjs <pdf-folder> <wiki-folder> rows.json
node scripts/colleges/generate.mjs rows.json src/lib/odishaCollegesExtra.ts
npm test
```
