const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

const nameRegex = /^[A-Za-zÀ-ÿ\s''-]+$/;
const codeRegex = /^[A-Za-z0-9.\-_\/]+$/;

for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const lastName = String(row[0] || "").trim();
    const firstName = String(row[1] || "").trim();
    const cid = String(row[5] || "").trim();

    if (!cid || !firstName || !lastName || cid === "undefined") continue;

    let errors = [];

    if (cid.length > 30) errors.push("CID > 30");
    if (!codeRegex.test(cid)) errors.push("CID contains invalid chars");

    if (firstName.length > 100) errors.push("First Name > 100");
    if (!nameRegex.test(firstName)) errors.push("First Name contains invalid chars");

    if (lastName.length > 100) errors.push("Last Name > 100");
    if (!nameRegex.test(lastName)) errors.push("Last Name contains invalid chars");

    const category = String(row[10] || "").trim();
    if (category.length > 50) errors.push("Category > 50");

    const partnerCid = String(row[18] || "").trim();
    if (partnerCid && !codeRegex.test(partnerCid)) errors.push("Partner CID contains invalid chars");

    const responsabili = [String(row[11] || "").trim(), String(row[12] || "").trim(), String(row[13] || "").trim(), String(row[14] || "").trim()].filter(Boolean);
    if (responsabili.length > 4) errors.push("Too many responsabili");
    responsabili.forEach((r, idx) => {
        if (r.length > 100) errors.push(`Responsabile ${idx + 1} > 100`);
    });

    if (errors.length > 0) {
        console.log(`Row ${i + 1}: ${firstName} ${lastName} (CID: ${cid}) Failed validation:`, errors.join(', '));
    }
}
