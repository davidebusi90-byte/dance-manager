import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { validateAthleteRow } from './src/lib/import-validation.ts';

function testValidation() {
    const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    // Exact replica of how import-utils.ts reads and splits the data
    const headerRow = (rawData[1] as any[] || []).map((h: any) => String(h).toUpperCase().trim());

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

    const findColIdx = (names: string[]) => {
        return headerRow.findIndex(h => names.some(n => h.includes(n.toUpperCase())));
    };
    const discIndices: { disc: number, cls: number }[] = [];
    for (let j = 1; j <= 10; j++) {
        const dIdx = findColIdx([`DISC_${j}`, `DISC. ${j}`, `DISC.${j}`, `DISC ${j}`]);
        const cIdx = findColIdx([`CLASSE_${j}`, `CLASSE ${j}`, `CLASSE.${j}`]);
        if (dIdx !== -1 && cIdx !== -1) {
            discIndices.push({ disc: dIdx, cls: cIdx });
        }
    }

    const parseExcelDate = (value: any): string | null => {
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
        return null; // Should return null if no regex matches
    };

    const DISCIPLINE_MAP: Record<string, string> = {
        "danze latino americane": "latino",
        "danze latine": "latino",
        "latino americane": "latino",
        "latine": "latino",
        "latino": "latino",
        "danze standard": "standard",
        "standard": "standard",
        "combinata standard-latini": "combinata",
        "combinata standard latini": "combinata",
        "combinata": "combinata",
        "10 balli": "combinata",
        "south american showdance": "show_dance",
        "south american show dance": "show_dance",
        "classic showdance": "show_dance",
        "classic show dance": "show_dance",
        "showdance": "show_dance",
        "show dance": "show_dance",
        "show": "show_dance",
    };

    const parseDiscipline = (value: string): string | null => {
        if (!value) return null;
        const normalized = value.toLowerCase().trim();
        return DISCIPLINE_MAP[normalized] || null;
    };

    const parseCategory = (value: string): string => {
        if (!value) return "";
        const match = value.match(/cat:\s*(.+)/i);
        return match ? match[1].trim() : value.trim();
    };

    let validCount = 0;
    let failCount = 0;
    const failures: string[] = [];

    for (let i = 3; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.length === 0) continue;

        const code = String(row[colIdx.CID] || "").trim();
        const firstName = String(row[colIdx.NOME] || "").trim();
        const lastName = String(row[colIdx.COGNOME] || "").trim();
        let sex = String(row[colIdx.SESSO] || "").trim().toUpperCase();
        if (!["M", "F"].includes(sex)) sex = "M";

        if (!code || !firstName || !lastName || code === "undefined") {
            failCount++;
            failures.push(`Row ${i + 1} (${firstName} ${lastName}): Missing required code/name`);
            continue;
        }

        const partnerCode = String(row[colIdx.PARTNER_CID] || "").trim();
        const disciplines: { discipline: string; class: string; raw: string }[] = [];
        for (const { disc, cls } of discIndices) {
            const discValue = String(row[disc] || "").trim();
            const clsValue = String(row[cls] || "").trim().toUpperCase();
            const parsedDisc = parseDiscipline(discValue);
            if (parsedDisc && clsValue) {
                disciplines.push({ discipline: parsedDisc, class: clsValue, raw: discValue });
            }
        }

        const responsabili: string[] = [];
        for (const idx of [colIdx.RESP_1, colIdx.RESP_2, colIdx.RESP_3, colIdx.RESP_4].filter(i => i !== -1)) {
            const resp = String(row[idx] || "").trim();
            if (resp) responsabili.push(resp);
        }

        const athleteData = {
            code,
            firstName,
            lastName,
            birthDate: parseExcelDate(row[colIdx.DATA_NASCITA]),
            sex,
            category: parseCategory(String(row[colIdx.CAT] || "")),
            medicalExpiry: parseExcelDate(row[colIdx.SCADENZA_CERT_MEDICO]),
            disciplines,
            partnerCode: partnerCode && partnerCode !== code ? partnerCode : null,
            partnerFirstName: null,
            partnerLastName: null,
            partnerBirthDate: null,
            partnerMedicalExpiry: null,
            responsabili,
        };

        const validation = validateAthleteRow(athleteData, i);
        if (!validation.ok) {
            failCount++;
            failures.push(`Row ${i + 1} (${firstName} ${lastName}): ` + validation.error);
        } else {
            validCount++;
        }
    }

    console.log(`Valid rows: ${validCount}`);
    console.log(`Failed rows: ${failCount}`);
    if (failures.length > 0) {
        console.log("Failures:");
        failures.forEach(f => console.log(" - " + f));
    }
}

testValidation();
