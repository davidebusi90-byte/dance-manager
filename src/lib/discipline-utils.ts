import { Athlete, Couple } from "@/types/dashboard";
import { getBestClass } from "./class-utils";

/**
 * Normalizza la stringa della classe (es. "B" -> "B1") per la visualizzazione.
 */
export const normalizeClassDisplay = (cls: string | null | undefined): string => {
  if (!cls || cls === "-") return "-";
  const upper = cls.trim().toUpperCase();
  return upper === "B" ? "B1" : upper;
};

/**
 * Risolve la classe (livello) per una specifica disciplina, considerando i dati di entrambi gli atleti, 
 * del record di coppia e gestendo le logiche di fallback (specialmente per la Combinata).
 */
export function resolveDisciplineClass(
  disciplineKey: string,
  athlete1?: Athlete | null,
  athlete2?: Athlete | null,
  couple?: Couple | null
): string {
  // 1. Estrazione dati diretti dalla coppia (Fonte Primaria)
  const coupleInfo = couple?.discipline_info || {};
  const directClass = coupleInfo[disciplineKey];

  if (directClass && directClass !== "-" && directClass !== "") {
    return normalizeClassDisplay(directClass);
  }

  // 2. Se non c'è info specifica nella coppia, cerchiamo negli atleti
  const class1 = athlete1?.discipline_info?.[disciplineKey] || null;
  const class2 = athlete2?.discipline_info?.[disciplineKey] || null;
  const athletesBest = (class1 && class2) ? getBestClass(class1, class2) : (class1 || class2 || null);

  if (athletesBest) {
    return normalizeClassDisplay(athletesBest);
  }

  // 3. Fallback sulla classe generale della coppia o degli atleti
  const fallbackClass = couple?.class || athlete1?.class || athlete2?.class || "D";
  return normalizeClassDisplay(fallbackClass);
}
