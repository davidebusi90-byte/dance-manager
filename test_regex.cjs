const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

// Allow letters (including accented), spaces, hyphens, apostrophes
const nameRegex = /^[A-Za-zÀ-ÿ\s''-]+$/;
// Allow alphanumeric, dots, hyphens, underscores, slashes
const codeRegex = /^[A-Za-z0-9.\-_\/]+$/;

for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const lastName = String(row[0] || "").trim();
    const firstName = String(row[1] || "").trim();
    const cid = String(row[5] || "").trim();

    if (!cid || !firstName || !lastName || cid === "undefined") {
        continue;
    }

    let errors = [];
    if (!codeRegex.test(cid)) errors.push(`CID invalido: "${cid}"`);
    if (!nameRegex.test(firstName)) errors.push(`Nome invalido: "${firstName}"`);
    if (!nameRegex.test(lastName)) errors.push(`Cognome invalido: "${lastName}"`);

    if (errors.length > 0) {
        console.log(`Riga ${i + 1}: ${firstName} ${lastName} -> ${errors.join(", ")}`);
    }
}
