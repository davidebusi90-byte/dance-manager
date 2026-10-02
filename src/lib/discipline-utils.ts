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
  // 1. Estrazione dati specifici per disciplina dalle 3 fonti possibili
  const class1 = athlete1?.discipline_info?.[disciplineKey] || null;
  const class2 = athlete2?.discipline_info?.[disciplineKey] || null;
  const coupleExplicit = couple?.discipline_info?.[disciplineKey] || null;

  // --- Caso Speciale: Combinata (CMB) ---
  if (disciplineKey === "combinata") {
    let resolved: string | null = null;
    
    // Priorità 1: Info esplicite
    const explicitClasses = [class1, class2, coupleExplicit].filter(c => c && c !== "-");
    if (explicitClasses.length > 0) {
      resolved = explicitClasses[0]!;
      for (let i = 1; i < explicitClasses.length; i++) {
        resolved = getBestClass(resolved, explicitClasses[i]!);
      }
    } 
    // Priorità 2: Classe di coppia se ballano combinata
    else if (couple?.disciplines?.includes("combinata") && couple.class) {
      resolved = couple.class;
    }

    // Priorità 3: Fallback Latino e Standard
    if (!resolved || resolved === "-" || resolved === "D") {
      const lat1 = athlete1?.discipline_info?.["latino"];
      const std1 = athlete1?.discipline_info?.["standard"];
      const lat2 = athlete2?.discipline_info?.["latino"];
      const std2 = athlete2?.discipline_info?.["standard"];
      const latC = couple?.discipline_info?.["latino"];
      const stdC = couple?.discipline_info?.["standard"];
      
      let bestLat = lat1 || lat2 || latC || "-";
      if (lat1) bestLat = getBestClass(bestLat, lat1);
      if (lat2) bestLat = getBestClass(bestLat, lat2);
      
      let bestStd = std1 || std2 || stdC || "-";
      if (std1) bestStd = getBestClass(bestStd, std1);
      if (std2) bestStd = getBestClass(bestStd, std2);
      
      resolved = getBestClass(bestLat, bestStd);
    }
    
    // Se alla fine non abbiamo nulla, il default è D per la Combinata
    const finalComb = (resolved === "-" || !resolved) ? "D" : resolved;
    return normalizeClassDisplay(finalComb);
  }

  // --- Caso Standard / Altre Discipline ---
  
  // Priorità 1: Dati Espliciti e Specifici
  const explicitClasses = [class1, class2, coupleExplicit].filter(c => c && c !== "-");
  if (explicitClasses.length > 0) {
    let bestSpecific = explicitClasses[0]!;
    for (let i = 1; i < explicitClasses.length; i++) {
      bestSpecific = getBestClass(bestSpecific, explicitClasses[i]!);
    }
    return normalizeClassDisplay(bestSpecific);
  }

  // Priorità 2: Dati Generici di Coppia (solo se la disciplina è gestita dalla coppia)
  if (couple) {
    const mappedKey = disciplineKey === "show_dance_sa" || disciplineKey === "show_dance_classic" ? "show_dance" : disciplineKey;
    if (couple.disciplines?.includes(mappedKey) && couple.class) {
      return normalizeClassDisplay(couple.class);
    }
  }
  
  // Priorità 3 (Rimossa): Non usiamo più athlete.class come ultimo fallback qui 
  // perché causa la comparsa di discipline mai ballate (es. Show Dance). 
  // L'UI ha già un badge "BASE" se tutte le discipline sono vuote.
  
  return normalizeClassDisplay("-");
}
