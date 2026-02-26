const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

let athleteRows = 0;
const uniqueCIDs = new Set();
let duplicates = [];

for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const lastName = String(row[0] || "").trim();
    const firstName = String(row[1] || "").trim();
    const cid = String(row[5] || "").trim();

    if (!cid || !firstName || !lastName) continue;

    athleteRows++;
    if (uniqueCIDs.has(cid)) {
        duplicates.push(`${firstName} ${lastName} (CID: ${cid})`);
    } else {
        uniqueCIDs.add(cid);
    }
}

console.log(`Total valid athlete rows: ${athleteRows}`);
console.log(`Total unique CIDs: ${uniqueCIDs.size}`);
console.log(`Duplicates: ${athleteRows - uniqueCIDs.size}`);
console.log('Duplicate entries:');
duplicates.forEach(d => console.log(' - ' + d));
