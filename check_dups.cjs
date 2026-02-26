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
let missing = [];

for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const lastName = String(row[0] || "").trim();
    const firstName = String(row[1] || "").trim();
    const cid = String(row[5] || "").trim();

    if (!cid || !firstName || !lastName || cid === "undefined") {
        missing.push(`Riga ${i + 1}: Nome="${firstName}", Cognome="${lastName}", CID="${cid}"`);
        continue;
    }

    athleteRows++;
    if (uniqueCIDs.has(cid)) {
        duplicates.push(`Riga ${i + 1}: ${firstName} ${lastName} (CID: ${cid})`);
    } else {
        uniqueCIDs.add(cid);
    }
}

console.log(`Total data rows: ${athleteRows + missing.length}`);
console.log(`Missing CID or Name: ${missing.length}`);
missing.forEach(m => console.log(' - ' + m));

console.log(`Duplicates: ${duplicates.length}`);
duplicates.forEach(d => console.log(' - ' + d));

console.log(`Unique Valid CIDs: ${uniqueCIDs.size}`);
