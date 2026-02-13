import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type DanceCategory = Database["public"]["Enums"]["dance_category"];

const VALID_DANCE_CATEGORIES: DanceCategory[] = ["standard", "latino", "combinata", "show_dance"];


// Allow letters (including accented), spaces, hyphens, apostrophes
const nameRegex = /^[A-Za-zÀ-ÿ\s''-]+$/;
// Allow alphanumeric, dots, hyphens, underscores, slashes
const codeRegex = /^[A-Za-z0-9.\-_\/]+$/;

export const athleteImportSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Codice obbligatorio")
    .max(30, "Codice troppo lungo (max 30)")
    .regex(codeRegex, "Codice contiene caratteri non validi"),
  firstName: z
    .string()
    .trim()
    .min(1, "Nome obbligatorio")
    .max(100, "Nome troppo lungo (max 100)")
    .regex(nameRegex, "Nome contiene caratteri non validi"),
  lastName: z
    .string()
    .trim()
    .min(1, "Cognome obbligatorio")
    .max(100, "Cognome troppo lungo (max 100)")
    .regex(nameRegex, "Cognome contiene caratteri non validi"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data di nascita non valida")
    .nullable(),
  sex: z
    .string()
    .max(10, "Sesso troppo lungo")
    .optional()
    .default(""),
  category: z
    .string()
    .trim()
    .max(50, "Categoria troppo lunga (max 50)"),
  medicalExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data scadenza certificato non valida")
    .nullable(),
  disciplines: z.array(
    z.object({
      discipline: z.enum(VALID_DANCE_CATEGORIES as [DanceCategory, ...DanceCategory[]]),
      class: z
        .string()
        .trim()
        .toUpperCase()
        .max(10, "Classe troppo lunga"),
    })
  ).max(4, "Massimo 4 discipline"),
  partnerCode: z
    .string()
    .trim()
    .max(30, "Codice partner troppo lungo")
    .regex(codeRegex, "Codice partner contiene caratteri non validi")
    .nullable()
    .or(z.literal("")),
  partnerFirstName: z
    .string()
    .trim()
    .max(100, "Nome partner troppo lungo")
    .nullable()
    .or(z.literal("")),
  partnerLastName: z
    .string()
    .trim()
    .max(100, "Cognome partner troppo lungo")
    .nullable()
    .or(z.literal("")),
  partnerBirthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data nascita partner non valida")
    .nullable(),
  partnerMedicalExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data certificato partner non valida")
    .nullable(),
  responsabili: z
    .array(
      z.string().trim().max(100, "Nome responsabile troppo lungo (max 100)")
    )
    .max(4, "Massimo 4 responsabili"),
});

export type ValidatedAthleteData = z.infer<typeof athleteImportSchema>;

export const MAX_IMPORT_ROWS = 1000;

export function validateAthleteRow(
  data: unknown,
  rowIndex: number
): { ok: true; data: ValidatedAthleteData } | { ok: false; error: string } {
  const result = athleteImportSchema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const firstError = result.error.errors[0];
  return {
    ok: false,
    error: `Riga ${rowIndex + 1}: ${firstError.path.join(".")}: ${firstError.message}`,
  };
}
