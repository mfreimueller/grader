const fs = require('fs');

const raw = fs.readFileSync('Grading_raw.csv', 'utf-8').replace(/\r/g, '');
const lines = raw.trimEnd().split('\n');
const header = lines[0].split(';');            // Nachname;Vorname;assessments...
const students = lines.slice(1, -3);           // student rows
const dates = lines.at(-3).split(';');         // session dates
const types = lines.at(-2).split(';');         // assessment types
const maxes = lines.at(-1).split(';');         // max points

// Assessment columns start at index 2 (after Nachname, Vorname)
const assessCols = [];
for (let c = 2; c < header.length; c++) {
  assessCols.push({
    name: header[c],
    type: types[c],
    date: dates[c],
    max: maxes[c] || '',
  });
}

const out = ['Nachname;Vorname;Typ;Name;Datum;Max;Note'];

for (const row of students) {
  const cols = row.split(';');
  const lastname = cols[0].trim();
  const firstname = cols[1].trim();
  for (let i = 0; i < assessCols.length; i++) {
    const { name, type, date, max } = assessCols[i];
    const grade = (cols[2 + i] || '').trim();
    out.push([lastname, firstname, type, name, date, max, grade].join(';'));
  }
}

fs.writeFileSync('Grading_flat.csv', out.join('\n') + '\n');
console.log(`Wrote ${out.length - 1} rows to Grading_flat.csv`);
