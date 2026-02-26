
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { validateAthleteRow } from "@/lib/import-validation";
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

        const headerRow = (rawData[1] || []).map((h: any) => String(h).toUpperCase().trim());

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

        const athletes: any[] = [];

        for (let i = 3; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            const code = String(row[colIdx.CID] || "").trim();
            const firstName = String(row[colIdx.NOME] || "").trim();
            const lastName = String(row[colIdx.COGNOME] || "").trim();
            let sex = String(row[colIdx.SESSO] || "").trim().toUpperCase();
            if (!["M", "F"].includes(sex)) sex = "M";

            if (!code || !firstName || !lastName) continue;

            const partnerCode = String(row[colIdx.PARTNER_CID] || "").trim();
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
            if (validation.ok) athletes.push(validation.data);
        }

        if (athletes.length === 0) return { success: false, message: "Nessun atleta valido trovato." };

        // Dedup Excel data by code (keep first occurrence)
        const excelAthleteMap = new Map<string, any>();
        athletes.forEach(a => { if (!excelAthleteMap.has(a.code)) excelAthleteMap.set(a.code, a); });
        const excelCodes = new Set(excelAthleteMap.keys());

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
        const instructorId = profile?.id || null;

        // --- STEP 1: Fetch existing athletes from DB ---
        const { data: existingAthletes, error: fetchError } = await (supabase
            .from("athletes")
            .select("id, code, first_name, last_name, birth_date, gender, medical_certificate_expiry, category, class, responsabili, is_deleted") as any);
        if (fetchError) throw fetchError;

        const dbAthleteMap = new Map<string, any>(
            (existingAthletes || []).map(a => [a.code, a])
        );

        // --- STEP 2: Determine inserts, updates, soft-deletes ---
        const toInsert: any[] = [];
        const toUpdate: { id: string; changes: any }[] = [];

        for (const [code, a] of excelAthleteMap) {
            const dbAthlete = dbAthleteMap.get(code);
            const newData = {
                code,
                first_name: a.firstName,
                last_name: a.lastName,
                category: a.category || "Senza categoria",
                class: a.disciplines.length > 0 ? a.disciplines[0].class : "D",
                birth_date: a.birthDate,
                gender: a.sex,
                medical_certificate_expiry: a.medicalExpiry,
                instructor_id: instructorId,
                responsabili: a.responsabili,
            };

            if (!dbAthlete) {
                // New athlete
                toInsert.push(newData);
            } else {
                // Check if anything changed
                const changed =
                    dbAthlete.first_name !== newData.first_name ||
                    dbAthlete.last_name !== newData.last_name ||
                    dbAthlete.birth_date !== newData.birth_date ||
                    dbAthlete.gender !== newData.gender ||
                    dbAthlete.medical_certificate_expiry !== newData.medical_certificate_expiry ||
                    dbAthlete.category !== newData.category ||
                    dbAthlete.class !== newData.class ||
                    JSON.stringify(dbAthlete.responsabili) !== JSON.stringify(newData.responsabili) ||
                    dbAthlete.is_deleted;

                if (changed) {
                    toUpdate.push({ id: dbAthlete.id, changes: { ...newData, is_deleted: false } as any });
                }
            }
        }

        // Soft-delete athletes no longer in Excel
        const toSoftDelete = (existingAthletes || [])
            .filter(a => !a.is_deleted && !excelCodes.has(a.code))
            .map(a => a.id);

        let inserted = 0, updated = 0, deleted = 0;

        if (toInsert.length > 0) {
            const { error } = await supabase.from("athletes").insert(toInsert);
            if (error) throw new Error(`Errore inserimento: ${error.message}`);
            inserted = toInsert.length;
        }

        for (const { id, changes } of toUpdate) {
            const { error } = await supabase.from("athletes").update(changes).eq("id", id);
            if (error) console.error(`Errore aggiornamento atleta ${id}:`, error.message);
            else updated++;
        }

        if (toSoftDelete.length > 0) {
            const { error } = await (supabase.from("athletes").update({ is_deleted: true } as any).in("id", toSoftDelete) as any);
            if (error) console.error("Errore soft-delete atleti:", error.message);
            else deleted = toSoftDelete.length;
        }

        // --- STEP 3: Re-fetch all active athletes to get current IDs ---
        const { data: activeAthletes } = await (supabase
            .from("athletes")
            .select("id, code, is_deleted")
            .eq("is_deleted", false) as any);

        const activeCodeToId = new Map<string, string>(
            ((activeAthletes || []) as any[]).map((a: any) => [a.code, a.id])
        );

        // --- STEP 4: Sync couples ---
        // Build expected couples from Excel
        const expectedPairs = new Set<string>();
        const couplesToCreate: any[] = [];
        const processedPairs = new Set<string>();

        for (const a of athletes) {
            if (!a.partnerCode || a.partnerCode === a.code) continue;
            if (!activeCodeToId.has(a.code) || !activeCodeToId.has(a.partnerCode)) continue;

            const pairKey = [a.code, a.partnerCode].sort().join("-");
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);
            expectedPairs.add(pairKey);

            const athlete1Id = activeCodeToId.get(a.code)!;
            const athlete2Id = activeCodeToId.get(a.partnerCode)!;
            const partner = athletes.find((p: any) => p.code === a.partnerCode);

            const disciplineInfo: Record<string, string> = {};
            const allDiscs = [...(a.disciplines || []), ...(partner?.disciplines || [])];
            const uniqueDiscNames = [...new Set(allDiscs.map(d => d.discipline))];
            let bestOverallClass = "D";

            uniqueDiscNames.forEach(discName => {
                const classes = allDiscs.filter(d => d.discipline === discName).map(d => d.class);
                let best = classes[0];
                for (let k = 1; k < classes.length; k++) best = getBestClass(best, classes[k]);
                const raws = allDiscs.filter(d => d.discipline === discName);
                raws.forEach(re => {
                    const rawNorm = (re.raw || "").toLowerCase();
                    let key = re.discipline as string;
                    if (re.discipline === "show_dance") {
                        if (rawNorm.includes("south american")) key = "show_dance_sa";
                        else if (rawNorm.includes("classic")) key = "show_dance_classic";
                    }
                    disciplineInfo[key] = disciplineInfo[key] ? getBestClass(disciplineInfo[key], re.class) : re.class;
                });
                bestOverallClass = getBestClass(bestOverallClass, best);
            });

            if (disciplineInfo["combinata"] || (disciplineInfo["standard"] && disciplineInfo["latino"])) {
                const resolved = getBestClass(disciplineInfo["combinata"] || "D", disciplineInfo["latino"] || "D");
                disciplineInfo["combinata"] = getBestClass(resolved, disciplineInfo["standard"] || "D");
                bestOverallClass = getBestClass(bestOverallClass, disciplineInfo["combinata"]);
            }

            couplesToCreate.push({
                athlete1_id: athlete1Id,
                athlete2_id: athlete2Id,
                category: a.category || "Senza categoria",
                class: bestOverallClass,
                disciplines: uniqueDiscNames,
                discipline_info: disciplineInfo,
                instructor_id: instructorId,
                is_active: true,
            });
        }

        // Upsert only couples from Excel (insert new, update existing)
        if (couplesToCreate.length > 0) {
            const { error } = await supabase
                .from("couples")
                .upsert(couplesToCreate, { onConflict: 'athlete1_id,athlete2_id' });
            if (error) console.error("Errore upsert coppie:", error.message);
        }

        // Deactivate couples no longer in Excel
        const { data: activeCouples } = await supabase
            .from("couples")
            .select("id, athlete1_id, athlete2_id")
            .eq("is_active", true);

        const couplesToDeactivate = (activeCouples || []).filter(c => {
            if (c.athlete1_id === c.athlete2_id) return true; // self-couples → deactivate
            const a1Code = [...activeCodeToId.entries()].find(([, id]) => id === c.athlete1_id)?.[0];
            const a2Code = [...activeCodeToId.entries()].find(([, id]) => id === c.athlete2_id)?.[0];
            if (!a1Code || !a2Code) return true;
            const pairKey = [a1Code, a2Code].sort().join("-");
            return !expectedPairs.has(pairKey);
        }).map(c => c.id);

        if (couplesToDeactivate.length > 0) {
            await supabase.from("couples").update({ is_active: false }).in("id", couplesToDeactivate);
        }

        return {
            success: true,
            count: activeAthletes?.length || 0,
            inserted,
            updated,
            deleted,
            couples: couplesToCreate.length,
        };

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

        const rawCompetitions: any[] = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            const name = String(row[nameIdx] || "").trim();
            const date = parseExcelDate(row[dateIdx]);
            if (!name || !date) continue;

            rawCompetitions.push({
                name,
                date,
                end_date: endDateIdx !== -1 ? parseExcelDate(row[endDateIdx]) : null,
                location: locationIdx !== -1 ? String(row[locationIdx] || "").trim() || null : null,
                registration_deadline: deadlineIdx !== -1 ? parseExcelDate(row[deadlineIdx]) : null,
                late_fee_deadline: lateFeeIdx !== -1 ? parseExcelDate(row[lateFeeIdx]) : null,
                description: descriptionIdx !== -1 ? String(row[descriptionIdx] || "").trim() || null : null,
            });
        }

        // Deduplicate before processing
        const uniqueCompsMap = new Map();
        rawCompetitions.forEach(c => {
            const key = `${c.name.toLowerCase()}-${c.date}`;
            if (!uniqueCompsMap.has(key)) {
                uniqueCompsMap.set(key, c);
            }
        });
        const competitions = Array.from(uniqueCompsMap.values());

        let created = 0, updated = 0;
        for (const comp of competitions) {
            const { data: existing } = await supabase
                .from("competitions")
                .select("id, is_deleted")
                .eq("name", comp.name)
                .eq("date", comp.date)
                .limit(1)
                .maybeSingle() as any;

            if (existing) {
                if (existing.is_deleted) {
                    // Skip re-importing manually deleted competition
                    continue;
                }
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
