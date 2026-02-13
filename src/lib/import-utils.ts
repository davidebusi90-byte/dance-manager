
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { validateAthleteRow, MAX_IMPORT_ROWS } from "@/lib/import-validation";
import { validateCoupleCategory } from "@/lib/category-validation";
import { getBestClass } from "@/lib/class-utils";
import type { Database } from "@/integrations/supabase/types";

type DanceCategory = Database["public"]["Enums"]["dance_category"];

const DISCIPLINE_MAP: Record<string, DanceCategory> = {
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

const parseDiscipline = (value: string): DanceCategory | null => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    return DISCIPLINE_MAP[normalized] || null;
};

const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "number") {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }
    }
    const str = String(value).trim();

    // Support DD/MM/YYYY or DD-MM-YYYY (Italian standard)
    // We prioritize this over MM/DD/YYYY
    const dmyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyy) {
        const year = parseInt(dmyy[3]) > 50 ? `19${dmyy[3]}` : `20${dmyy[3]}`;
        // Map as Day/Month/Year
        return `${year}-${dmyy[2].padStart(2, "0")}-${dmyy[1].padStart(2, "0")}`;
    }

    const dmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyyyy) {
        // Map as Day/Month/Year
        return `${dmyyyy[3]}-${dmyyyy[2].padStart(2, "0")}-${dmyyyy[1].padStart(2, "0")}`;
    }

    const yyyymmdd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yyyymmdd) {
        return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, "0")}-${yyyymmdd[3].padStart(2, "0")}`;
    }
    return null;
};

const parseCategory = (value: string): string => {
    if (!value) return "";
    const match = value.match(/cat:\s*(.+)/i);
    return match ? match[1].trim() : value.trim();
};

export async function importCompetitors(arrayBuffer: ArrayBuffer) {
    try {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        const rawData = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
            header: 1,
            defval: ""
        });

        if (rawData.length < 2) throw new Error("File vuoto o formato non valido");

        // Parse header row from row 2 (index 1)
        const headerRow = (rawData[1] || []).map((h: any) => String(h).toUpperCase().trim());

        // Column mapping for the PRIMARY athlete (the one on the left)
        // User confirmed: One row = One Athlete. Partner is just referenced.
        const colIdx = {
            COGNOME: 0, // A
            NOME: 1,    // B
            DATA_NASCITA: 3, // D
            SESSO: 4,   // E
            CID: 5,     // F
            SCADENZA_CERT_MEDICO: 7, // H
            CAT: 10,    // K
            RESP_1: 11, // L
            RESP_2: 12, // M
            RESP_3: 13, // N
            RESP_4: 14, // O

            // Partner Reference Columns (for linking only)
            PARTNER_CID: 18, // S
        };

        // Find dynamic discipline columns
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

        const athletes: any[] = [];

        // Data starts from row 4 (index 3)
        for (let i = 3; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            // Helper to extract athlete from row (Single Athlete Logic)
            const extractAthlete = () => {


                let code = String(row[colIdx.CID] || "").trim();
                let firstName = String(row[colIdx.NOME] || "").trim();
                let lastName = String(row[colIdx.COGNOME] || "").trim();
                // Read Sex always from Col E (Index 4)
                let sex = String(row[colIdx.SESSO] || "").trim().toUpperCase();

                // Se la colonna sesso è vuota o non valida, usa il valore di default in base al prefisso
                if (!["M", "F"].includes(sex)) sex = "M"; // Fallback

                if (!code || !firstName || !lastName) return null;

                // Partner CID (from Col S / Index 18)
                let partnerCode = String(row[colIdx.PARTNER_CID] || "").trim();

                const disciplines: { discipline: DanceCategory; class: string; raw: string }[] = [];
                for (const { disc, cls } of discIndices) {
                    const discValue = String(row[disc] || "").trim();
                    const clsValue = String(row[cls] || "").trim().toUpperCase();
                    const parsedDisc = parseDiscipline(discValue);

                    if (parsedDisc && clsValue) {
                        disciplines.push({ discipline: parsedDisc, class: clsValue, raw: discValue });
                    }
                }

                const responsabili: string[] = [];
                const respIndices = [colIdx.RESP_1, colIdx.RESP_2, colIdx.RESP_3, colIdx.RESP_4].filter(idx => idx !== -1);
                for (const idx of respIndices) {
                    const resp = String(row[idx] || "").trim();
                    if (resp) responsabili.push(resp);
                }

                return {
                    code,
                    firstName,
                    lastName,
                    birthDate: parseExcelDate(row[colIdx.DATA_NASCITA]),
                    sex,
                    category: parseCategory(String(row[colIdx.CAT] || "")),
                    medicalExpiry: parseExcelDate(row[colIdx.SCADENZA_CERT_MEDICO]),
                    disciplines,
                    partnerCode: partnerCode || null,
                    partnerFirstName: null,
                    partnerLastName: null,
                    partnerBirthDate: null,
                    partnerMedicalExpiry: null,
                    responsabili,
                };
            };

            const athlete = extractAthlete();
            if (athlete) {
                const validation = validateAthleteRow(athlete, i);
                if (validation.ok) athletes.push(validation.data);
            }
        }

        if (athletes.length === 0) return { success: false, message: "Nessun atleta valido trovato." };

        // UPSERT LOGIC
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
        const instructorId = profile?.id || null;

        const uniqueAthletesMap = new Map();
        athletes.forEach((a: any) => {
            if (!uniqueAthletesMap.has(a.code)) {
                uniqueAthletesMap.set(a.code, {
                    code: a.code,
                    first_name: a.firstName,
                    last_name: a.lastName,
                    category: a.category || "Senza categoria",
                    class: a.disciplines.length > 0 ? a.disciplines[0].class : "D",
                    birth_date: a.birthDate,
                    gender: a.sex,
                    medical_certificate_expiry: a.medicalExpiry,
                    instructor_id: instructorId,
                    responsabili: a.responsabili,
                });
            }
        });

        const athletesData = Array.from(uniqueAthletesMap.values());

        const { data: insertedAthletes, error: athletesError } = await supabase
            .from("athletes")
            .upsert(athletesData, { onConflict: 'code' })
            .select('id, code');

        if (athletesError) throw athletesError;

        const codeToId = new Map(insertedAthletes.map(a => [a.code, a.id]));

        // Couples
        const couplesToUpsert: any[] = [];
        const processedPairs = new Set<string>();

        for (const athlete of athletes) {
            if (!codeToId.has(athlete.code) || !athlete.partnerCode || !codeToId.has(athlete.partnerCode)) continue;

            const pairKey = [athlete.code, athlete.partnerCode].sort().join("-");
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);

            const athlete1Id = codeToId.get(athlete.code)!;
            const athlete2Id = codeToId.get(athlete.partnerCode)!;

            const athlete1 = athlete;
            const athlete2 = athletes.find((a: any) => a.code === athlete.partnerCode);

            let hasAnomaly = false;
            let anomalyReason = null;

            if (athlete1 && athlete2) {
                const validation = validateCoupleCategory({
                    storedCategory: athlete.category || "Senza categoria",
                    athlete1BirthDateISO: athlete1.birthDate,
                    athlete2BirthDateISO: athlete2.birthDate,
                    onDate: new Date(),
                });
                if (!validation.ok) {
                    hasAnomaly = true;
                    anomalyReason = (validation as any).reason;
                }
            }

            const disciplineInfo: Record<string, string> = {};
            const allDisciplineEntries = [...(athlete1?.disciplines || []), ...(athlete2?.disciplines || [])];

            const uniqueDisciplineNames = [...new Set(allDisciplineEntries.map(d => d.discipline))];
            let bestOverallClass = "D";

            uniqueDisciplineNames.forEach(discName => {
                const discClasses = allDisciplineEntries
                    .filter(d => d.discipline === discName)
                    .map(d => d.class);

                let bestDiscClass = discClasses[0];
                for (let k = 1; k < discClasses.length; k++) {
                    bestDiscClass = getBestClass(bestDiscClass, discClasses[k]);
                }

                const rawEntries = allDisciplineEntries.filter(d => d.discipline === discName);
                rawEntries.forEach(re => {
                    const rawNorm = (re.raw || "").toLowerCase();
                    let key = re.discipline as string;
                    if (re.discipline === "show_dance") {
                        if (rawNorm.includes("south american")) key = "show_dance_sa";
                        else if (rawNorm.includes("classic")) key = "show_dance_classic";
                    }
                    disciplineInfo[key] = disciplineInfo[key] ? getBestClass(disciplineInfo[key], re.class) : re.class;
                });
                bestOverallClass = getBestClass(bestOverallClass, bestDiscClass);
            });

            if (disciplineInfo["combinata"] || (disciplineInfo["standard"] && disciplineInfo["latino"])) {
                const latClass = disciplineInfo["latino"];
                const stdClass = disciplineInfo["standard"];
                const combClass = disciplineInfo["combinata"];
                let resolvedCombClass = combClass || "D";
                if (latClass) resolvedCombClass = getBestClass(resolvedCombClass, latClass);
                if (stdClass) resolvedCombClass = getBestClass(resolvedCombClass, stdClass);
                disciplineInfo["combinata"] = resolvedCombClass;
                bestOverallClass = getBestClass(bestOverallClass, resolvedCombClass);
            }

            couplesToUpsert.push({
                athlete1_id: athlete1Id,
                athlete2_id: athlete2Id,
                category: athlete.category || "Senza categoria",
                class: bestOverallClass,
                disciplines: uniqueDisciplineNames,
                discipline_info: disciplineInfo,
                instructor_id: instructorId,
                is_active: true,
            });
        }

        if (couplesToUpsert.length > 0) {
            const { error: couplesError } = await supabase
                .from("couples")
                .upsert(couplesToUpsert, { onConflict: 'athlete1_id,athlete2_id' });

            if (couplesError) {
                console.error("Couples upsert error:", couplesError);
                throw new Error(`Errore creazione coppie: ${couplesError.message}`);
            }
        }

        return { success: true, count: insertedAthletes.length, couples: couplesToUpsert.length };

    } catch (error: any) {
        console.error("Import error:", error);
        return { success: false, message: error.message };
    }
}

export async function importCompetitions(arrayBuffer: ArrayBuffer) {
    try {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, defval: "" });

        if (rawData.length < 2) throw new Error("File vuoto");

        const headerRow = rawData[0].map((h: any) => String(h).toLowerCase().trim());
        const findColumnIndex = (possibleNames: string[]) => {
            for (const name of possibleNames) {
                const idx = headerRow.findIndex((h: string) => h.includes(name));
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const nameIdx = findColumnIndex(["nome", "competizione", "gara", "name"]);
        const dateIdx = findColumnIndex(["data", "date", "data gara"]);
        const endDateIdx = findColumnIndex(["data fine", "end date", "fine"]);
        const locationIdx = findColumnIndex(["luogo", "location", "sede", "località"]);
        const deadlineIdx = findColumnIndex(["scadenza", "deadline", "scadenza iscrizione"]);
        const lateFeeIdx = findColumnIndex(["mora", "late fee", "data aumento quota", "aumento quota"]);
        const descriptionIdx = findColumnIndex(["descrizione", "description", "note"]);

        if (nameIdx === -1 || dateIdx === -1) throw new Error("Colonne 'Nome' e 'Data' mancanti.");

        const competitions: any[] = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            const name = String(row[nameIdx] || "").trim();
            if (!name) continue;

            competitions.push({
                name,
                date: parseExcelDate(row[dateIdx]),
                end_date: endDateIdx !== -1 ? parseExcelDate(row[endDateIdx]) : null,
                location: locationIdx !== -1 ? String(row[locationIdx] || "").trim() || null : null,
                registration_deadline: deadlineIdx !== -1 ? parseExcelDate(row[deadlineIdx]) : null,
                late_fee_deadline: lateFeeIdx !== -1 ? parseExcelDate(row[lateFeeIdx]) : null,
                description: descriptionIdx !== -1 ? String(row[descriptionIdx] || "").trim() || null : null,
            });
        }

        let created = 0, updated = 0;
        for (const comp of competitions) {
            if (!comp.date) continue;
            const { data: existing } = await supabase.from("competitions").select("id").eq("name", comp.name).eq("date", comp.date).maybeSingle();
            if (existing) {
                await supabase.from("competitions").update(comp).eq("id", existing.id);
                updated++;
            } else {
                await supabase.from("competitions").insert(comp);
                created++;
            }
        }
        return { success: true, created, updated };

    } catch (error: any) {
        console.error("Competition import error:", error);
        return { success: false, message: error.message };
    }
}
