const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

let skippedRows = 0;
console.log('Skipped rows:');

for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) {
        console.log(`Row ${i + 1}: empty row`);
        skippedRows++;
        continue;
    }

    const lastName = String(row[0] || "").trim();
    const firstName = String(row[1] || "").trim();
    const cid = String(row[5] || "").trim();

    if (!cid || !firstName || !lastName || cid === "undefined") {
        console.log(`Row ${i + 1}: skipped due to missing fields. Name: '${firstName}', Last Name: '${lastName}', CID: '${cid}'`);
        skippedRows++;
        continue;
    }
}
console.log(`Total skipped rows: ${skippedRows}`);
