import { getBestClass } from "./class-utils";
import { getCategoryMinAge, getCategoryMaxAge, getSportsAge } from "./category-validation";

/**
 * Funzione di utilità per formattare i nomi delle gare secondo le specifiche utente.
 * 1. "Open Classe A" -> "Adult Open"
 * 2. Se viene passata la classe, la aggiunge (es. "Junior 1 (12/13) - D")
 */
export const formatEventName = (name: string, effectiveClass?: string | null): string => {
    if (!name) return "";
    
    let formatted = name;
    
    // Regola specifica: Open Classe A -> Adult Open
    const openARegex = /open\s+classe\s+a/gi;
    if (openARegex.test(formatted)) {
        formatted = formatted.replace(openARegex, "Adult Open");
    }
    
    // Regola dell'aggiunta della classe (tranne che per le Open)
    if (effectiveClass && !formatted.toLowerCase().includes("open")) {
        formatted = `${formatted} - ${effectiveClass}`;
    }
    
    return formatted;
};


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

export const isEventAllowedByAge = (et: any, category: string, athlete1BirthDate?: string | null, athlete2BirthDate?: string | null) => {
    // If birth dates are available, use precise sports age check
    if (athlete1BirthDate && athlete2BirthDate) {
        const refDate = new Date();
        const age1 = getSportsAge(athlete1BirthDate, refDate);
        const age2 = getSportsAge(athlete2BirthDate, refDate);
        const coupleMinAge = Math.min(age1, age2);
        const coupleMaxAge = Math.max(age1, age2);

        if (et.max_age !== null && coupleMaxAge > et.max_age) return false;
        if (et.min_age !== null && coupleMinAge < et.min_age) return false;
        return true;
    }

    // Fallback to category-based logic if birth dates are missing
    const coupleMinAge = getCategoryMinAge(category);
    const coupleMaxAge = getCategoryMaxAge(category); // null means no upper bound (e.g. Senior 5, Adult)

    // IMPROVED LOGIC: For overlapping categories like "Under 21", we allow if 
    // the category's typical range overlaps with the event's range.
    
    if (et.max_age !== null) {
        if (coupleMaxAge === null) return false;
        
        // If it's an "Under X" event, we are more lenient: if the category's MINIMUM 
        // age fits, we allow it (the user is responsible for ensuring the specific athletes fit).
        // This solves the "Adult (19-34)" vs "Under 21 (16-20)" issue.
        const isUnderEvent = et.event_name.toLowerCase().includes("under");
        if (isUnderEvent) {
            if (coupleMinAge > et.max_age) return false;
        } else {
            // Standard behavior for Senior classes etc: the category must fit.
            if (coupleMaxAge > et.max_age) return false;
        }
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
    
    // LOGICA DI COMPATIBILITÀ CLASSI (per dati esistenti nel DB)
    if (!isRaceAllowed) {
        if (effectiveClass === "A") {
            isRaceAllowed = (et.allowed_classes || []).includes("A1") || (et.allowed_classes || []).includes("A2");
        } else if (effectiveClass === "B" || effectiveClass === "B1") {
            isRaceAllowed = (et.allowed_classes || []).includes("B1") || (et.allowed_classes || []).includes("B2") || (et.allowed_classes || []).includes("B3");
        }
    }

    const nameNorm = et.event_name.toLowerCase();
    const nameFormattedNorm = formatEventName(et.event_name).toLowerCase();
    const c = couple.class.toUpperCase();

    // REGOLA CLASSE C e D - SPECIFICHE UTENTE 13/03/2026
    if (c === "D" || c === "C") {
        const lowerName = et.event_name.toLowerCase();
        // Controllo flessibile per Open C e Open B - Ora più stringente per evitare falsi positivi
        const isOpenB = /\bopen\s+b\b/i.test(lowerName);
        const isOpenC = /\bopen\s+c\b/i.test(lowerName);

        if (isOpenB || isOpenC) return true;
    }

    // Regole specifiche aggiuntive SOLO per Classe D
    if (c === "D") {
        const nameUpper = et.event_name.toUpperCase();
        
        // 0. Blocco PREVENTIVO Classi Alte (A, AS, MASTER) - Priorità assoluta
        if (nameUpper.includes("CLASSE A") || nameUpper.includes("ADULT OPEN") || nameUpper.includes(" A1") || nameUpper.includes(" A2") || nameUpper.includes(" AS") || nameUpper.includes("MASTER")) return false;

        // 2. Blocco Under 21: MAI per Classe D (richiesta utente 17/03/2026)
        if (nameNorm.includes("under 21")) return false;

        // 3. Blocco selettivo Adult/Youth: Solo se non è una gara Classe D (o Open C/B)
        const isDRace = nameNorm.includes(" classe d") || (et.allowed_classes || []).includes("D");
        if (!isDRace && (nameNorm.includes("adult") || nameNorm.includes("youth"))) return false;

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
    if (!isEventAllowedByAge(et, couple.category, couple.athlete1?.birth_date, couple.athlete2?.birth_date)) return false;

    if (!isRaceAllowed) return false;

    return true;
};

