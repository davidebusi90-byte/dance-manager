const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

const colIdx = {
    COGNOME: 0,
    NOME: 1,
    DATA_NASCITA: 3,
    SESSO: 4,
    CID: 5,
    SCADENZA_CERT_MEDICO: 7,
    CAT: 10,
    RESP_1: 11,
    RESP_2: 12,
    RESP_3: 13,
    RESP_4: 14,
    PARTNER_CID: 18,
};

const parseExcelDate = (value) => {
    if (!value) return null;
    if (typeof value === "number") {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }
    }
    const str = String(value).trim();
    const dmyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyy) {
        const year = parseInt(dmyy[3]) > 50 ? `19${dmyy[3]}` : `20${dmyy[3]}`;
        return `${year}-${dmyy[2].padStart(2, "0")}-${dmyy[1].padStart(2, "0")}`;
    }
    const dmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyyyy) {
        return `${dmyyyy[3]}-${dmyyyy[2].padStart(2, "0")}-${dmyyyy[1].padStart(2, "0")}`;
    }
    const yyyymmdd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yyyymmdd) {
        return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, "0")}-${yyyymmdd[3].padStart(2, "0")}`;
    }
    return null;
};

let missingNamesOrCodes = [];
let validRows = 0;
let errorsCount = 0;

for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const lastName = String(row[colIdx.COGNOME] || "").trim();
    const firstName = String(row[colIdx.NOME] || "").trim();
    const birthDateStr = row[colIdx.DATA_NASCITA];
    const cid = String(row[colIdx.CID] || "").trim();
    const medicalExpiryStr = row[colIdx.SCADENZA_CERT_MEDICO];

    if (!cid || !firstName || !lastName || cid === "undefined") {
        missingNamesOrCodes.push(`Riga Excel ${i + 1}: Nome="${firstName}", Cognome="${lastName}", CID="${cid}"`);
        continue;
    }

    const birthDate = parseExcelDate(birthDateStr);
    const medicalExpiry = parseExcelDate(medicalExpiryStr);

    let rowErrors = [];

    if (birthDateStr && !birthDate) rowErrors.push(`Data Nascita non valida: ${birthDateStr}`);
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) rowErrors.push(`Data Nascita formato non accettato: ${birthDate}`);

    if (medicalExpiryStr && !medicalExpiry) rowErrors.push(`Scadenza Certificato non valida: ${medicalExpiryStr}`);
    if (medicalExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(medicalExpiry)) rowErrors.push(`Scadenza Certificato formato non accettato: ${medicalExpiry}`);

    if (rowErrors.length > 0) {
        console.log(`Riga Excel ${i + 1}: ${firstName} ${lastName} (CID: ${cid}) -> ERRORE: ${rowErrors.join(', ')}`);
        errorsCount++;
    } else {
        validRows++;
    }
}
console.log(`\nRisultati: ${validRows} valide, ${errorsCount} con errori (esclusi quelli senza nome/cognome/cid).`);
console.log("\nRighe ignorate per mancanza di nome, cognome o CID:");
missingNamesOrCodes.forEach(r => console.log(r));
