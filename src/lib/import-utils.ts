
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { validateAthleteRow } from "@/lib/import-validation";
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
    const dmyy = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
    if (dmyy) {
        const year = parseInt(dmyy[3]) > 50 ? `19${dmyy[3]}` : `20${dmyy[3]}`;
        // Map as Day/Month/Year
        return `${year}-${dmyy[2].padStart(2, "0")}-${dmyy[1].padStart(2, "0")}`;
    }

    const dmyyyy = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (dmyyyy) {
        // Map as Day/Month/Year
        return `${dmyyyy[3]}-${dmyyyy[2].padStart(2, "0")}-${dmyyyy[1].padStart(2, "0")}`;
    }

    const yyyymmdd = str.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
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
