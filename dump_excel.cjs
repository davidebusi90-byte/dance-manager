const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

console.log(`Total rawData length: ${rawData.length}`);
for (let i = 0; i < 5; i++) {
    console.log(`Row ${i}: `, rawData[i].slice(0, 6)); // print first 6 cols
}

// Print last 5 rows to see what's at the end
for (let i = rawData.length - 5; i < rawData.length; i++) {
    console.log(`Row ${i}: `, rawData[i].slice(0, 6)); // print first 6 cols
}
