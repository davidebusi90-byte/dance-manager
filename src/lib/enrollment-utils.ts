import { getBestClass } from "./class-utils";
import { getCategoryMinAge, getCategoryMaxAge } from "./category-validation";

export const getEffectClassForCouple = (couple: any, eventName: string) => {
    const rawClass = couple.discipline_info ? (couple.class || "D") : couple.class;
    
    // Normalizzazione B -> B1 come da specifica utente
    const normalize = (c: string) => c?.trim().toUpperCase() === "B" ? "B1" : c;

    if (!couple.discipline_info) return normalize(couple.class);
    const eventNameNorm = eventName.toLowerCase();

    if (eventNameNorm.includes("latino") || eventNameNorm.includes("latini"))
        return normalize(couple.discipline_info["latino"] || couple.class);
    if (eventNameNorm.includes("standard"))
        return normalize(couple.discipline_info["standard"] || couple.class);
    if (eventNameNorm.includes("combinata")) {
        const combClass = couple.discipline_info["combinata"] || couple.class;
        const latClass = couple.discipline_info["latino"];
        const stdClass = couple.discipline_info["standard"];

        let resolvedClass = combClass;
        if (latClass) resolvedClass = getBestClass(resolvedClass, latClass);
        if (stdClass) resolvedClass = getBestClass(resolvedClass, stdClass);
        return normalize(resolvedClass);
    }

    // Handle specific Adult classes A1/A2
    if (eventNameNorm.includes("a1")) return normalize(couple.discipline_info["a1"] || couple.discipline_info["latino"] || couple.discipline_info["standard"] || couple.class);
    if (eventNameNorm.includes("a2")) return normalize(couple.discipline_info["a2"] || couple.discipline_info["latino"] || couple.discipline_info["standard"] || couple.class);
    if (eventNameNorm.includes("master")) return normalize(couple.discipline_info["master"] || couple.class);
    if (eventNameNorm.includes("south american"))
        return normalize(couple.discipline_info["show_dance_sa"] || couple.class);
    if (eventNameNorm.includes("classic showdance"))
        return normalize(couple.discipline_info["show_dance_classic"] || couple.class);
    if (eventNameNorm.includes("show dance") || eventNameNorm.includes("showdance"))
        return normalize(couple.discipline_info["show_dance"] || couple.class);

    return normalize(couple.class);
};

export const isEventAllowedByAge = (et: any, category: string) => {
    const coupleMinAge = getCategoryMinAge(category);
    const coupleMaxAge = getCategoryMaxAge(category); // null means no upper bound (e.g. Senior 5, Adult)

    // If the event has a maximum age limit, the couple's category must fully fit within it.
    if (et.max_age !== null) {
        if (coupleMaxAge === null) return false;
        if (coupleMaxAge > et.max_age) return false;
    }

    // If the event has a minimum age, ensure the couple's category minimum age meets it.
    if (et.min_age !== null && coupleMinAge < et.min_age) return false;

    return true;
};

const getEventDiscipline = (eventName: string): string | null => {
    const lowerName = eventName.toLowerCase();

    // Riconoscimento flessibile (cerca la parola chiave ovunque nel nome)
    if (lowerName.includes("standard")) return "standard";
    if (lowerName.includes("latino") || lowerName.includes("latini") || lowerName.includes("latin")) return "latino";
    if (lowerName.includes("combinata")) return "combinata";

    return null;
};

export const isEventMatchingCoupleDiscipline = (eventName: string, coupleDisciplines: string[]): boolean => {
    if (!coupleDisciplines || coupleDisciplines.length === 0) return true;
    const eventDiscipline = getEventDiscipline(eventName);
    if (!eventDiscipline) return true;

    const normalizedCoupleDisciplines = coupleDisciplines.map(d => d.toLowerCase());

    const isLatino = normalizedCoupleDisciplines.includes("latino") || normalizedCoupleDisciplines.includes("danze latino americane");
    const isStandard = normalizedCoupleDisciplines.includes("standard") || normalizedCoupleDisciplines.includes("danze standard");
    const isCombinata = normalizedCoupleDisciplines.includes("combinata");

    if (eventDiscipline === "latino" && isLatino) return true;
    if (eventDiscipline === "standard" && isStandard) return true;
    if (eventDiscipline === "combinata" && isCombinata) return true;

    return normalizedCoupleDisciplines.includes(eventDiscipline);
};

export const isEventAllowedForCouple = (et: any, couple: any): boolean => {
    if (!isEventMatchingCoupleDiscipline(et.event_name, couple.disciplines || [])) return false;

    const effectiveClass = getEffectClassForCouple(couple, et.event_name);
    let isRaceAllowed = (et.allowed_classes || []).includes(effectiveClass);
    const nameNorm = et.event_name.toLowerCase();
    const c = couple.class.toUpperCase();

    // REGOLA CLASSE C e D - SPECIFICHE UTENTE 13/03/2026
    if (c === "D" || c === "C") {
        // 1. C Open e B Open SEMPRE ammessi (anche se la classe della coppia è inferiore)
        if (nameNorm.includes("c open") || nameNorm.includes("b open")) return true;
    }

    // Regole specifiche aggiuntive SOLO per Classe D
    if (c === "D") {
        const nameUpper = et.event_name.toUpperCase();
        
        // 0. Blocco PREVENTIVO Classi Alte (A, AS, MASTER) - Priorità assoluta
        if (nameUpper.includes("CLASSE A") || nameUpper.includes(" A1") || nameUpper.includes(" A2") || nameUpper.includes(" AS") || nameUpper.includes("MASTER")) return false;

        // 2. Blocco Totale: NON possono vedere Adult, Youth, Under 21
        if (nameNorm.includes("adult") || nameNorm.includes("youth") || nameNorm.includes("under 21")) return false;

        // 3. Under 16: SOLO per le coppie fino alla 14/15 compresa
        if (nameNorm.includes("under 16")) {
            const coupleMaxAge = getCategoryMaxAge(couple.category);
            if (coupleMaxAge !== null && coupleMaxAge <= 15) return true; // 14/15 ha maxAge 15
            return false;
        }

        // 4. Senior 35+: Possono vedere le "Over" a partire dalla Over 35
        // Nota: Qui non facciamo return true immediato per permettere al controllo età di bloccare es. Over 65 per un Senior 1
        const coupleMinAge = getCategoryMinAge(couple.category);
        if (coupleMinAge >= 35 && nameNorm.includes("over")) {
            isRaceAllowed = true;
        }
    }

    // Check età standard (basato sulla categoria della coppia)
    if (!isEventAllowedByAge(et, couple.category)) return false;

    if (!isRaceAllowed) return false;

    return true;
};
