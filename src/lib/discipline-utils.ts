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
  
  let coupleClass = couple?.discipline_info?.[disciplineKey] || null;
  
  // Fallback per il record coppia: se non c'è info specifica, guarda il campo 'class' generale
  // ma solo se la disciplina è gestita da quella coppia.
  if (!coupleClass && couple) {
    const mappedKey = disciplineKey === "show_dance_sa" || disciplineKey === "show_dance_classic" ? "show_dance" : disciplineKey;
    if (couple.disciplines?.includes(mappedKey)) {
      coupleClass = couple.class;
    }
  }

  // --- Caso Speciale: Combinata (CMB) ---
  if (disciplineKey === "combinata") {
    // Cerchiamo prima se c'è un'info esplicita
    let resolved = class1 || class2 || coupleClass;
    
    // Se manca l'info esplicita sulla Combinata, calcoliamo il meglio tra Latino e Standard (fallback)
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
    } else {
      // Se abbiamo info sulla combinata, facciamo comunque il "best" tra gli atleti e la coppia
      if (class1) resolved = getBestClass(resolved, class1);
      if (class2) resolved = getBestClass(resolved, class2);
    }
    
    // Se alla fine non abbiamo nulla, il default è D per la Combinata
    const finalComb = (resolved === "-" || !resolved) ? "D" : resolved;
    return normalizeClassDisplay(finalComb);
  }

  // --- Caso Standard / Altre Discipline ---
  // Risolviamo prendendo la "migliore" classe tra le 3 fonti
  let finalClass = coupleClass || "-";
  if (class1 && class1 !== "-") finalClass = finalClass === "-" ? class1 : getBestClass(finalClass, class1);
  if (class2 && class2 !== "-") finalClass = finalClass === "-" ? class2 : getBestClass(finalClass, class2);
  
  // ULTIMO FALLBACK: Se non abbiamo ancora nulla per questa disciplina specifica,
  // usiamo la 'class' generale degli atleti (per dati legacy o incompleti)
  if (finalClass === "-") {
    if (athlete1?.class && athlete1.class !== "D") finalClass = athlete1.class;
    if (athlete2?.class && athlete2.class !== "D") {
      finalClass = finalClass === "-" ? athlete2.class : getBestClass(finalClass, athlete2.class);
    }
  }
  
  return normalizeClassDisplay(finalClass);
}
