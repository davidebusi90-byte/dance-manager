const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

console.log(`Total rows in Excel (rawData.length): ${rawData.length}`);
