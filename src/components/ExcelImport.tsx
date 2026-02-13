import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Check, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { validateAthleteRow, MAX_IMPORT_ROWS } from "@/lib/import-validation";
import { getBestClass } from "@/lib/class-utils";
import { validateCoupleCategory } from "@/lib/category-validation";

type DanceCategory = Database["public"]["Enums"]["dance_category"];

interface AthleteData {
  code: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string;
  category: string;
  medicalExpiry: string | null;
  disciplines: { discipline: DanceCategory; class: string; raw: string }[];
  partnerCode: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  partnerBirthDate: string | null;
  partnerMedicalExpiry: string | null;
  responsabili: string[];
}



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
  const mdyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (mdyy) {
    const year = parseInt(mdyy[3]) > 50 ? `19${mdyy[3]}` : `20${mdyy[3]}`;
    return `${year}-${mdyy[1].padStart(2, "0")}-${mdyy[2].padStart(2, "0")}`;
  }
  const mdyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyyyy) {
    return `${mdyyyy[3]}-${mdyyyy[1].padStart(2, "0")}-${mdyyyy[2].padStart(2, "0")}`;
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

interface ExcelImportProps {
  onImportComplete: () => void;
}

export default function ExcelImport({ onImportComplete }: ExcelImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedData, setParsedData] = useState<AthleteData[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    athletes: number;
    couples: number;
    updated: number;
    errors: number;
    validationErrors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        const rawData = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
          header: 1,
          defval: ""
        });

        if (rawData.length < 2) {
          toast({ title: "File vuoto", description: "Il file Excel non contiene dati", variant: "destructive" });
          return;
        }

        if (rawData.length - 1 > MAX_IMPORT_ROWS) {
          toast({ title: "File troppo grande", description: `Massimo ${MAX_IMPORT_ROWS} righe consentite.`, variant: "destructive" });
          return;
        }

        // Parse header row from row 2 (index 1)
        const headerRow = (rawData[1] || []).map((h: any) => String(h).toUpperCase().trim());

        // Helper to find column index by name (fallback)
        const findColIdx = (names: string[]) => {
          return headerRow.findIndex(h => names.some(n => h.includes(n.toUpperCase())));
        };

        const colIdx = {
          // Primary Athlete (Left Side)
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

          // Partner Reference
          PARTNER_CID: 18, // S

          // Fallback / Generic
          GEN_COGNOME: findColIdx(["COGNOME", "SURNAME", "LAST NAME"]),
          GEN_NOME: findColIdx(["NOME", "FIRST NAME"]),
          GEN_DATA_NASCITA: findColIdx(["DATA_NASCITA", "DATA NASCITA", "BIRTH DATE", "BORN"]),
          GEN_SESSO: findColIdx(["SESSO", "SEX", "GENDER"]),
          GEN_CID: findColIdx(["CODICE_CID", "CODICE CID", "CID", "TESSERA"]),
          GEN_SCADENZA: findColIdx(["SCADENZA_CERT_MEDICO", "CERT_MEDICO", "SCADENZA CERT", "MEDICAL"]),
        };


        // Trova tutte le coppie DISC/CLASSE (es. DISC_1, CLASSE_1, ...)
        const discIndices: { disc: number, cls: number }[] = [];
        for (let j = 1; j <= 10; j++) {
          const dIdx = findColIdx([`DISC_${j}`, `DISC. ${j}`, `DISC.${j}`, `DISC ${j}`]); // Added "DISC N" variant
          const cIdx = findColIdx([`CLASSE_${j}`, `CLASSE ${j}`, `CLASSE.${j}`]);
          if (dIdx !== -1 && cIdx !== -1) {
            discIndices.push({ disc: dIdx, cls: cIdx });
          }
        }

        // Check if we have at least one valid set of columns
        const hasSpecificCols = colIdx.CID !== -1 && colIdx.NOME !== -1;
        const hasGenericCols = colIdx.GEN_CID !== -1 && colIdx.GEN_NOME !== -1;

        if (!hasSpecificCols && !hasGenericCols) {
          console.error("Header not found. Header row was:", headerRow);
          toast({
            title: "Formato non riconosciuto",
            description: "Impossibile trovare le colonne fondamentali (Cavaliere/Dama o Nome/Cognome/CID). Verifica la riga 4 del file.",
            variant: "destructive"
          });
          return;
        }

        const athletes: AthleteData[] = [];
        const validationErrors: string[] = [];
        // Data starts from row 4 (index 3)
        for (let i = 3; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          // Helper to extract athlete from row (Single Athlete)
          const extractAthlete = () => {
            let code = String(row[colIdx.CID] || "").trim();
            let firstName = String(row[colIdx.NOME] || "").trim();
            let lastName = String(row[colIdx.COGNOME] || "").trim();

            // Should be E (4)
            let sex = String(row[colIdx.SESSO] || "").trim().toUpperCase();
            if (!["M", "F"].includes(sex)) sex = "M"; // Fallback

            // Use Generic if specific not found (fallback logic)
            if (colIdx.CID === -1) {
              code = String(row[colIdx.GEN_CID] || "").trim();
              firstName = String(row[colIdx.GEN_NOME] || "").trim();
              lastName = String(row[colIdx.GEN_COGNOME] || "").trim();
              sex = colIdx.GEN_SESSO !== -1 ? String(row[colIdx.GEN_SESSO] || "").trim().toUpperCase() : "M";
            }

            if (!code || !firstName || !lastName) return null;

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
            const respIndices = [colIdx.RESP_1, colIdx.RESP_2, colIdx.RESP_3, colIdx.RESP_4].filter(idx => idx !== -1);
            for (const idx of respIndices) {
              const resp = String(row[idx] || "").trim();
              if (resp) responsabili.push(resp);
            }

            return {
              code,
              firstName,
              lastName,
              birthDate: parseExcelDate(row[colIdx.DATA_NASCITA] || row[colIdx.GEN_DATA_NASCITA]),
              sex,
              category: parseCategory(String(row[colIdx.CAT] || "")),
              medicalExpiry: parseExcelDate(row[colIdx.SCADENZA_CERT_MEDICO] || row[colIdx.GEN_SCADENZA]),
              disciplines,
              partnerCode: partnerCode || null,
              partnerFirstName: null,
              partnerLastName: null,
              partnerBirthDate: null,
              partnerMedicalExpiry: null,
              responsabili
            };
          };

          const athlete = extractAthlete();
          if (athlete) {
            const validation = validateAthleteRow(athlete, i);
            if (validation.ok) {
              athletes.push(validation.data);
            } else {
              validationErrors.push(validation.error);
            }
          }


        }

        if (athletes.length === 0 && validationErrors.length > 0) {
          toast({ title: "Errori di validazione", description: `Tutti i ${validationErrors.length} record contengono errori.`, variant: "destructive" });
          return;
        }

        setParsedData(athletes);
        setImportResult(validationErrors.length > 0 ? { athletes: 0, updated: 0, couples: 0, errors: 0, validationErrors } : null);
        setStep("preview");
      } catch (error) {
        console.error("Excel parse error:", error);
        toast({ title: "Errore nella lettura", description: "Impossibile leggere il file Excel", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStep("importing");
    setImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      const instructorId = profile?.id || null;

      // Map to unique athletes by code
      const uniqueAthletesMap = new Map();
      parsedData.forEach(a => {
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

      // Batch Processing Couples
      const couplesToUpsert: any[] = [];
      const processedPairs = new Set<string>();

      for (const athlete of parsedData) {
        if (!codeToId.has(athlete.code) || !athlete.partnerCode || !codeToId.has(athlete.partnerCode)) continue;

        const pairKey = [athlete.code, athlete.partnerCode].sort().join("-");
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const athlete1Id = codeToId.get(athlete.code)!;
        const athlete2Id = codeToId.get(athlete.partnerCode)!;

        // Category validation
        const athlete1 = athlete; // In context of loop
        const athlete2 = parsedData.find(a => a.code === athlete.partnerCode);

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

        // Build discipline_info JSON using the best class between both athletes
        const disciplineInfo: Record<string, string> = {};
        const allDisciplineEntries = [...(athlete1?.disciplines || []), ...(athlete2?.disciplines || [])];

        // Find best class for each discipline name
        const uniqueDisciplineNames = [...new Set(allDisciplineEntries.map(d => d.discipline))];
        let bestOverallClass = "D";

        uniqueDisciplineNames.forEach(discName => {
          // Find all classes for this discipline
          const discClasses = allDisciplineEntries
            .filter(d => d.discipline === discName)
            .map(d => d.class);

          let bestDiscClass = discClasses[0];
          for (let k = 1; k < discClasses.length; k++) {
            bestDiscClass = getBestClass(bestDiscClass, discClasses[k]);
          }

          // We also need to differentiate showdance subtypes in discipline_info keys
          // but for the "best overall class" we just use the raw key
          const rawEntries = allDisciplineEntries.filter(d => d.discipline === discName);
          rawEntries.forEach(re => {
            const rawNorm = re.raw.toLowerCase();
            let key = re.discipline as string;
            if (re.discipline === "show_dance") {
              if (rawNorm.includes("south american")) key = "show_dance_sa";
              else if (rawNorm.includes("classic")) key = "show_dance_classic";
            }

            // If already set, take the best
            disciplineInfo[key] = disciplineInfo[key]
              ? getBestClass(disciplineInfo[key], re.class)
              : re.class;
          });

          // Update best overall class
          bestOverallClass = getBestClass(bestOverallClass, bestDiscClass);
        });

        // SPECIAL RULE: For "Combinata", the class must be the highest among Standard, Latino, and Combinata itself
        if (disciplineInfo["combinata"] || (disciplineInfo["standard"] && disciplineInfo["latino"])) {
          const latClass = disciplineInfo["latino"];
          const stdClass = disciplineInfo["standard"];
          const combClass = disciplineInfo["combinata"];

          let resolvedCombClass = combClass || "D";
          if (latClass) resolvedCombClass = getBestClass(resolvedCombClass, latClass);
          if (stdClass) resolvedCombClass = getBestClass(resolvedCombClass, stdClass);

          disciplineInfo["combinata"] = resolvedCombClass;

          // Also update the best overall class if the resolved combinata class is better
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
          has_category_anomaly: hasAnomaly,
          anomaly_reason: anomalyReason,
          last_validated_at: new Date().toISOString(),
        });
      }

      let couplesCreated = 0;
      if (couplesToUpsert.length > 0) {
        const { error: couplesError } = await supabase
          .from("couples")
          .upsert(couplesToUpsert, { onConflict: 'athlete1_id, athlete2_id' });

        if (couplesError) console.error("Couples upsert error:", couplesError);
        else couplesCreated = couplesToUpsert.length;
      }

      setImportResult({
        athletes: insertedAthletes.length,
        updated: 0, // Upsert doesn't easily distinguish without more logic
        couples: couplesCreated,
        errors: 0,
        validationErrors: [],
      });
      setStep("done");
      toast({ title: "Import completato", description: `${insertedAthletes.length} atleti processati.` });
      onImportComplete();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: "Errore", description: error.message || "Errore durante l'importazione", variant: "destructive" });
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setStep("upload");
    setParsedData([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <Upload className="w-4 h-4" />
        Importa Atleti
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && (setIsOpen(false), resetDialog())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importa Atleti e Coppie da Excel
            </DialogTitle>
            <DialogDescription>
              {step === "upload" && "Seleziona il file Excel Competitori"}
              {step === "preview" && `Trovati ${parsedData.length} atleti.`}
              {step === "importing" && "Importazione in corso..."}
              {step === "done" && "Importazione completata!"}
            </DialogDescription>
          </DialogHeader>

          {step === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Trascina il file qui o clicca per selezionare</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="font-medium">{parsedData.length} atleti pronti per l'importazione.</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetDialog}>Annulla</Button>
                <Button onClick={handleImport} disabled={importing}>Importa ora</Button>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p>Importazione in corso...</p>
            </div>
          )}

          {step === "done" && importResult && (
            <div className="space-y-4">
              <div className="bg-green-500/10 p-6 text-center rounded-lg">
                <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-green-600">Completato!</p>
                <p>{importResult.athletes} atleti e {importResult.couples} coppie processate.</p>
              </div>
              <Button className="w-full" onClick={() => setIsOpen(false)}>Chiudi</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
