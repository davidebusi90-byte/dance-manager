import { getBestClass } from "./class-utils";
import { getCategoryMinAge, getCategoryMaxAge, getSportsAge, normalizeCategory, getMinYoungerAgeForRule, CATEGORY_RULES } from "./category-validation";

/**
 * --- FORMATTING UTILITIES ---
 */

const getEventDiscipline = (eventName: string): string | null => {
    const lowerName = eventName.toLowerCase();
    if (lowerName.includes("standard") || /\bst\b/i.test(lowerName)) return "standard";
    if (
        lowerName.includes("latino") || 
        lowerName.includes("latini") || 
        lowerName.includes("latin") || 
        /\bla\b/i.test(lowerName)
    ) return "latino";
    if (lowerName.includes("combinata")) return "combinata";
    return null;
};

/**
 * Formatta i nomi delle gare aggiungendo classe e categoria dove richiesto.
 */
export const formatEventName = (name: string, effectiveClass?: string | null, coupleCategory?: string | null): string => {
    if (!name) return "";
    let formatted = name;
    
    // Normalizzazione: Open Classe A -> Adult Open
    if (/open\s+classe\s+a/gi.test(formatted)) {
        const disc = getEventDiscipline(formatted);
        if (disc === "latino") formatted = "Adult Open Latini";
        else if (disc === "standard") formatted = "Adult Open Standard";
        else formatted = "Adult Open";
    }
    
    const lowerName = formatted.toLowerCase();
    
    // Pulizia nomi Over: rimuove classi superflue prima del prefisso Over
    if (lowerName.includes("over")) {
        formatted = formatted.replace(/(?:classe\s+)?\b(AS|QS|A1|A2|A|B1|B2|B3|B|C|D)\b\s+(-?\s*over)/i, "$2");
        formatted = formatted.replace(/\s{2,}/g, " ").trim();
    }

    // Aggiunta classe fissa (es. "Junior 1 - D") per gare non Open/Over/Under
    if (effectiveClass && !lowerName.includes("open") && !lowerName.includes("over") && !lowerName.includes("under")) {
        const classPattern = new RegExp(`\\b${effectiveClass}\\b`, "i");
        if (!classPattern.test(formatted)) {
            formatted = `${formatted} - ${effectiveClass}`;
        }
    }

    // Aggiunta categoria della coppia alla fine per gare Open, Rising Star e Amator Open A
    const isOpenType = lowerName.includes("open") || lowerName.includes("rising star") || lowerName.includes("amator open a");
    if (coupleCategory && isOpenType) {
        const catPattern = new RegExp(`\\b${coupleCategory}\\b`, "i");
        if (!catPattern.test(formatted)) {
            formatted = `${formatted} (${coupleCategory})`;
        }
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
    let minAge = et.min_age;
    let maxAge = et.max_age;

    // FALLBACK: If min_age or max_age are missing from DB, try to extract them from the event name
    // (e.g. "Juvenile 1 (6/9)" or "Over 35")
    if (minAge === null && maxAge === null && et.event_name) {
        const nameNorm = et.event_name.toLowerCase();
        
        // Check for common age ranges in brackets or name
        // Use the same rules as normalizeCategory to find match
        for (const rule of CATEGORY_RULES) {
            const labelNorm = rule.label.toLowerCase();
            const codeNorm = rule.displayCode.replace(/[/-]/g, "");
            
            if (nameNorm.includes(labelNorm) || nameNorm.includes(codeNorm)) {
                minAge = rule.minAge;
                maxAge = rule.maxAge;
                break;
            }
        }
        
        // Special cases for "Rising Star" / "Amator Open A"
        if (minAge === null && (nameNorm.includes("rising star") || nameNorm.includes("amator open a"))) {
            if (!nameNorm.includes("master")) {
                minAge = 16; // Rising Star / Amator Open A (Youth/Adult 16+)
            }
            // Rising Star Master has NO age limit, ONLY class limit
            maxAge = null;
        }

        // Special case for "Adult Master"
        if (minAge === null && nameNorm.includes("adult master")) {
            minAge = null; // No age limit for Master
            maxAge = null;
        }

        // Special case for "Over X" if still not found
        if (minAge === null) {
            const overMatch = nameNorm.match(/over\s*(\d+)/i);
            if (overMatch) minAge = parseInt(overMatch[1]);
        }
        // Special case for "Under X" if still not found 
        if (maxAge === null) {
            const underMatch = nameNorm.match(/under\s*(\d+)/i);
            if (underMatch) maxAge = parseInt(underMatch[1]);
        }
    }

    // If birth dates are available, use precise sports age check
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
        const isOpenBC = /\b(open\s+b|b\s+open|open\s+c|c\s+open)\b/i.test(nameNorm);
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

    return isRaceAllowed;
};

