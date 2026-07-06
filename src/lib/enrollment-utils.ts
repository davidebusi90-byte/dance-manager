import { getCategoryMaxAge, getCategoryMinAge, getSportsAge, normalizeCategory, CATEGORY_RULES } from "./category-validation";



/**
 * --- EVENT NAME & DISCIPLINE UTILS ---
 */

export const getEventDiscipline = (eventName: string): string | null => {
    const name = eventName.toLowerCase();
    if (name.includes("standard")) return "standard";
    if (name.includes("latino")) return "latino";
    if (name.includes("combinata")) return "combinata";
    return null;
};

export const formatEventName = (name: string): string => {
    return name
        .replace(/Danze (Standard|Latino Americane|Latino-Americane) - /gi, "")
        .replace(/ \(\d+\/\d+\)/g, "")
        .trim();
};

export const getEffectClassForCouple = (couple: any, eventName: string): string => {
    const discipline = getEventDiscipline(eventName);
    if (!discipline || !couple.discipline_info) return (couple.class || "D").toUpperCase();
    
    // Use discipline specific class if available, fallback to main class
    return (couple.discipline_info[discipline] || couple.class || "D").toUpperCase();
};

/**
 * --- AGE VALIDATION ---
 */

const getMinYoungerAgeForRule = (minAge: number, label?: string): number => {
    // Regola Under 21: il più giovane deve avere almeno 16 anni
    if (label === 'Under 21') return 16;
    
    // Regola Seniors: il più giovane deve avere almeno 30 anni
    if (minAge >= 35) return 30;
    
    // Default: nessuna tolleranza (stessa età minima)
    return minAge;
};

export const isEventAllowedByAge = (
    et: any,
    category: string,
    athlete1BirthDate?: string,
    athlete2BirthDate?: string
): boolean => {
    let minAge = et.min_age;
    let maxAge = et.max_age;

    // Se non ci sono restrizioni in DB, proviamo a estrarle dal nome (es. "Juvenile 1 (6/9)")
    if (minAge === null && maxAge === null) {
        const name = et.event_name.toLowerCase();
        // Cerca pattern tipo (6/9), (10/11), (12/13), (14/15), (16/18), (19/34), (35/44)
        const match = name.match(/\((\d+)\/(\d+)\)/);
        if (match) {
            minAge = parseInt(match[1]);
            maxAge = parseInt(match[2]);
        } else if (name.includes("over 35")) { minAge = 35; }
          else if (name.includes("over 45")) { minAge = 45; }
          else if (name.includes("over 55")) { minAge = 55; }
          else if (name.includes("under 21")) { minAge = 16; maxAge = 20; }
          else if (name.includes("under 16")) { minAge = 6; maxAge = 15; }
    }

    // Se ancora non ci sono restrizioni, permettiamo tutto
    if (minAge === null && maxAge === null) return true;

    // Use precise sports age if birth dates are available
    if (athlete1BirthDate && athlete2BirthDate) {
        const refDate = new Date();
        const age1 = getSportsAge(athlete1BirthDate, refDate);
        const age2 = getSportsAge(athlete2BirthDate, refDate);
        const coupleMinAge = Math.min(age1, age2);
        const coupleMaxAge = Math.max(age1, age2);

        const eventRule = CATEGORY_RULES.find(r => r.minAge === minAge && r.maxAge === maxAge);
        const allowedYoungerMin = minAge !== null ? getMinYoungerAgeForRule(minAge, eventRule?.label) : null;


        if (maxAge !== null && coupleMaxAge > maxAge) return false;
        
        // Il partner più anziano deve ALMENO soddisfare l'età minima della categoria
        if (minAge !== null && coupleMaxAge < minAge) return false;
        
        // Il partner più giovane non deve essere sotto la soglia di tolleranza
        if (allowedYoungerMin !== null && coupleMinAge < allowedYoungerMin) return false;
        return true;
    }

    // Fallback to category-based logic if birth dates are missing
    const coupleMinAge = getCategoryMinAge(category);
    const coupleMaxAge = getCategoryMaxAge(category); // null means no upper bound (e.g. Senior 5, Adult)

    if (maxAge !== null) {
        if (coupleMaxAge === null) return false;
        
        // If it's an "Under X" event, we are more lenient: if the category's MINIMUM 
        // age fits, we allow it (the user is responsible for ensuring the specific athletes fit).
        const isUnderEvent = et.event_name.toLowerCase().includes("under");
        if (isUnderEvent) {
            if (coupleMinAge > maxAge) return false;
        } else {
            // Standard behavior for Senior classes etc: the category must fit.
            if (coupleMaxAge > maxAge) return false;
        }
    }

    // If the event has a minimum age, ensure the couple's category minimum age meets it.
    if (minAge !== null) {
        const eventRule = CATEGORY_RULES.find(r => r.minAge === minAge && r.maxAge === maxAge);
        const allowedYoungerMin = getMinYoungerAgeForRule(minAge, eventRule?.label);
        
        // La massima età della categoria della coppia deve poter raggiungere l'età minima della gara
        if (coupleMaxAge !== null && coupleMaxAge < minAge) return false;
        
        // La minima età della categoria non deve scendere sotto la soglia di tolleranza
        if (coupleMinAge < allowedYoungerMin) return false;
    }

    return true;
};

/**
 * --- DISCIPLINE & CLASS VALIDATION ---
 */

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
    // 1. Check età prioritario
    if (!isEventAllowedByAge(et, couple.category, couple.athlete1?.birth_date, couple.athlete2?.birth_date)) return false;

    // 2. Check disciplina
    if (!isEventMatchingCoupleDiscipline(et.event_name, couple.disciplines || [])) return false;

    // 3. Calcolo classe effettiva (gestione ST/LA/Comb)
    const effectiveClass = getEffectClassForCouple(couple, et.event_name);
    let isRaceAllowed = (et.allowed_classes || []).includes(effectiveClass);
    
    // 4. Compatibilità classi storiche (B -> B1, B2, B3)
    if (!isRaceAllowed) {
        if (effectiveClass === "A") {
            isRaceAllowed = (et.allowed_classes || []).includes("A1") || (et.allowed_classes || []).includes("A2");
        } else if (effectiveClass === "B" || effectiveClass === "B1") {
            isRaceAllowed = (et.allowed_classes || []).includes("B") || (et.allowed_classes || []).includes("B1") || (et.allowed_classes || []).includes("B2") || (et.allowed_classes || []).includes("B3");
        }
    }

    const nameNorm = et.event_name.toLowerCase();
    const nameFormattedNorm = formatEventName(et.event_name).toLowerCase();
    const c = couple.class.toUpperCase();
    
    // 5. REGOLA MASTER: Esclusività classe MASTER
    const isMasterRace = nameFormattedNorm.includes("master");
    if (effectiveClass === "MASTER") {
        if (!isMasterRace) return false;
    } else if (isMasterRace) {
        return false;
    }

    // 6. REGOLA AS: Solo eventi Open
    if (c === "AS" && !nameFormattedNorm.includes("open")) return false;

    // 7. REGOLA OVER: Esclusione incrociata Over 35/45/55
    if (nameNorm.includes("over 35")) {
        const age1 = couple.athlete1?.birth_date ? getSportsAge(couple.athlete1.birth_date, new Date()) : null;
        const age2 = couple.athlete2?.birth_date ? getSportsAge(couple.athlete2.birth_date, new Date()) : null;
        const effectiveMaxAge = (age1 !== null && age2 !== null) ? Math.max(age1, age2) : getCategoryMinAge(couple.category);

        if (effectiveMaxAge !== null && effectiveMaxAge >= 55) return false;
    }

    // 8. REGOLE OPEN & RISING STAR: Accesso basato su età e classi alte
    if (nameNorm.includes("youth open") && normalizeCategory(couple.category) === "youth") {
        isRaceAllowed = true;
    }
    if (nameNorm.includes("rising star")) {
        const allowsAdultTiers = (et.allowed_classes || []).some(cls => ["A", "A1", "A2"].includes(cls));
        if (isRaceAllowed || allowsAdultTiers) isRaceAllowed = true;
    }

    // 9. REGOLA CLASSE C/D: Accesso a Open B e Open C
    if (c === "D" || c === "C") {
        const isOpenBC = /\b(open\s+(?:classe\s+)?b|b\s+open|open\s+(?:classe\s+)?c|c\s+open)\b/i.test(nameNorm);
        if (isOpenBC) return true;
    }

    // 10. REGOLE SPECIFICHE CLASSE D
    if (c === "D") {
        const nameUpper = et.event_name.toUpperCase();
        
        // Blocchi classi alte
        if (nameUpper.includes("CLASSE A") || nameUpper.includes("ADULT OPEN") || /\bA[12]\b/.test(nameUpper) || /\bAS\b/.test(nameUpper) || nameUpper.includes("MASTER")) return false;

        // Blocco Under 21
        if (nameNorm.includes("under 21")) return false;

        // Blocco selettivo Adult/Youth (tranne gare D o Youth Open)
        const isDRace = nameNorm.includes("classe d") || (et.allowed_classes || []).includes("D");
        const isYouthOpen = nameNorm.includes("youth open");
        if (!isDRace && !isYouthOpen && (nameNorm.includes("adult") || nameNorm.includes("youth"))) return false;

        // Under 16: Solo fino a 14/15
        if (nameNorm.includes("under 16")) {
            const coupleMaxAge = getCategoryMaxAge(couple.category);
            return coupleMaxAge !== null && coupleMaxAge <= 15;
        }

        // Senior 35+: Abilitazione Over
        if (getCategoryMinAge(couple.category) >= 35 && nameNorm.includes("over")) {
            isRaceAllowed = true;
        }
    }

    // 11. REGOLA B1: Nelle gare Syllabus per fascia d'età NON partecipa la classe B1
    //     (deve usare solo la B Open). B2 e B3 possono ancora gareggiare nelle loro
    //     categorie per età. La regola NON si applica a: Over, Under, Open, Rising Star, Master.
    //     L'effectiveClass è già calcolato per disciplina.
    const isRegularAgeCategory =
        !nameNorm.includes("open") &&
        !nameNorm.includes("rising star") &&
        !nameNorm.includes("master") &&
        !nameNorm.includes("over") &&
        !nameNorm.includes("under");
    if (["B", "B1"].includes(effectiveClass) && isRegularAgeCategory) {
        return false;
    }

    return isRaceAllowed;
};
