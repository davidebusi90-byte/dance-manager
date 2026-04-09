import { getCategoryMaxAge, getCategoryMinAge, getSportsAge, normalizeCategory, CATEGORY_RULES, getMinYoungerAgeForRule } from "./category-validation";
import { resolveDisciplineClass } from "./discipline-utils";
import { getBestClass } from "./class-utils";

/**
 * --- FORMATTING UTILITIES ---
 */

export const getEventDiscipline = (eventName: string): string | null => {
    const lowerName = eventName.toLowerCase();
    if (lowerName.includes("standard") || /\bst\b/i.test(lowerName) || lowerName.startsWith("st ") || lowerName.includes(" st ")) return "standard";
    if (
        lowerName.includes("latino") || 
        lowerName.includes("latini") || 
        lowerName.includes("latin") || 
        /\bla\b/i.test(lowerName) || 
        lowerName.startsWith("la ") || 
        lowerName.includes(" la ")
    ) return "latino";
    if (lowerName.includes("combinata") || lowerName.startsWith("c ") || lowerName.includes(" c ")) return "combinata";
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

    // Pulizia generica ST/LA/C all'inizio
    formatted = formatted
        .replace(/^(ST|LA|C|Danze (Standard|Latino Americane|Latino-Americane))\s*[-–:]*\s*/gi, "")
        .replace(/ \(\d+[/-]\d+\)/g, "") // Rimuove (6/9), (6-9) etc.
        .trim();

    const isUnder16 = formatted.toLowerCase().includes("under 16");
    if (isUnder16) {
        formatted = formatted.replace(/\s*\(\d+[/-]\d+\)/gi, "").trim();
    }

    const isOpenType = formatted.toLowerCase().includes("open") || formatted.toLowerCase().includes("rising star") || formatted.toLowerCase().includes("amator open a");
    
    // Aggiunta classe fissa per gare non Open/Over/Under
    if (effectiveClass && !isOpenType && !formatted.toLowerCase().includes("over") && !isUnder16) {
        const classPattern = new RegExp(`\\b${effectiveClass}\\b`, "i");
        if (!classPattern.test(formatted)) {
            formatted = `${formatted} ${effectiveClass.toUpperCase()}`;
        }
    }

    // Aggiunta categoria della coppia alla fine per gare Open e simili
    if (coupleCategory && !isUnder16) {
        const catPattern = new RegExp(`\\b${coupleCategory.replace('-', '\\-')}\\b`, "i");
        if (!catPattern.test(formatted)) {
            formatted = `${formatted} (${coupleCategory})`;
        }
    }
    
    // Prepende la disciplina abbreviata
    const discipline = getEventDiscipline(name);
    let discAbbr = "";
    if (discipline === "standard") discAbbr = "ST";
    else if (discipline === "latino") discAbbr = "LA";
    else if (discipline === "combinata") discAbbr = "C";

    return discAbbr ? `${discAbbr} ${formatted}` : formatted;
};

export const getEffectClassForCouple = (couple: any, eventName: string): string => {
    const discipline = getEventDiscipline(eventName);
    
    // Normalizzazione B -> B1 come da specifica utente
    const normalize = (c: string) => (c?.trim().toUpperCase() === "B") ? "B1" : c?.toUpperCase();

    if (!discipline) return normalize(couple.class || "D");
    
    // Se abbiamo info specifiche per disciplina negli atleti, usiamo resolveDisciplineClass
    if (couple.athlete1?.discipline_info || couple.athlete2?.discipline_info || couple.discipline_info) {
        const discInfo = couple.discipline_info || {};
        if (discipline === "latino") return normalize(discInfo["latino"] || couple.class);
        if (discipline === "standard") return normalize(discInfo["standard"] || couple.class);
        if (discipline === "combinata") {
            const latClass = discInfo["latino"];
            const stdClass = discInfo["standard"];
            const combClass = discInfo["combinata"] || couple.class;
            let resolved = combClass;
            if (latClass) resolved = getBestClass(resolved, latClass);
            if (stdClass) resolved = getBestClass(resolved, stdClass);
            return normalize(resolved);
        }
    }

    // Fallback alla classe di coppia standard
    return normalize(couple.class);
};

/**
 * --- AGE VALIDATION ---
 */

export const isEventAllowedByAge = (
    et: any,
    category: string,
    athlete1BirthDate?: string | null,
    athlete2BirthDate?: string | null
): boolean => {
    let minAge = et.min_age;
    let maxAge = et.max_age;

    // FALLBACK: Estrazione età dal nome evento
    if (minAge === null && maxAge === null && et.event_name) {
        const nameNorm = et.event_name.toLowerCase();
        for (const rule of CATEGORY_RULES) {
            const labelNorm = rule.label.toLowerCase();
            const codeNorm = rule.displayCode.replace(/[/-]/g, "");
            if (nameNorm.includes(labelNorm) || nameNorm.includes(codeNorm)) {
                minAge = rule.minAge;
                maxAge = rule.maxAge;
                break;
            }
        }
        if (minAge === null && (nameNorm.includes("rising star") || nameNorm.includes("amator open a"))) {
            if (!nameNorm.includes("master")) minAge = 16;
            maxAge = null;
        }
        if (minAge === null) {
            const overMatch = nameNorm.match(/over\s*(\d+)/i);
            if (overMatch) minAge = parseInt(overMatch[1]);
        }
        if (maxAge === null) {
            const underMatch = nameNorm.match(/under\s*(\d+)/i);
            if (underMatch) maxAge = parseInt(underMatch[1]);
        }
    }

    // Check preciso con date di nascita
    if (athlete1BirthDate && athlete2BirthDate) {
        const refDate = new Date();
        const age1 = getSportsAge(athlete1BirthDate, refDate);
        const age2 = getSportsAge(athlete2BirthDate, refDate);
        const coupleMinAge = Math.min(age1, age2);
        const coupleMaxAge = Math.max(age1, age2);

        if (maxAge !== null && coupleMaxAge > maxAge) return false;
        if (minAge !== null && coupleMaxAge < minAge) return false;
        
        const eventRule = CATEGORY_RULES.find(r => r.minAge === minAge && r.maxAge === maxAge);
        const allowedYoungerMin = minAge !== null ? getMinYoungerAgeForRule(minAge, eventRule?.label) : null;
        if (allowedYoungerMin !== null && coupleMinAge < allowedYoungerMin) return false;
        
        return true;
    }

    // Check basato su categoria nominale
    const coupleMinAge = getCategoryMinAge(category);
    const coupleMaxAge = getCategoryMaxAge(category);

    if (maxAge !== null) {
        if (coupleMaxAge === null) return false;
        const isUnderEvent = et.event_name.toLowerCase().includes("under");
        if (isUnderEvent) {
            if (coupleMinAge > maxAge) return false;
        } else {
            if (coupleMaxAge > maxAge) return false;
        }
    }
    if (minAge !== null) {
        if (coupleMaxAge !== null && coupleMaxAge < minAge) return false;
        const eventRule = CATEGORY_RULES.find(r => r.minAge === minAge && r.maxAge === maxAge);
        const allowedYoungerMin = getMinYoungerAgeForRule(minAge, eventRule?.label);
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
    const isLatino = normalizedCoupleDisciplines.some(d => d.includes("latino") || d.includes("latini") || d.includes("latin"));
    const isStandard = normalizedCoupleDisciplines.some(d => d.includes("standard"));
    const isCombinata = normalizedCoupleDisciplines.includes("combinata");

    if (eventDiscipline === "latino" && isLatino) return true;
    if (eventDiscipline === "standard" && isStandard) return true;
    if (eventDiscipline === "combinata" && isCombinata) return true;

    return normalizedCoupleDisciplines.includes(eventDiscipline);
};

export const isEventAllowedForCouple = (et: any, couple: any): boolean => {
    // 1. Età
    if (!isEventAllowedByAge(et, couple.category, couple.athlete1?.birth_date, couple.athlete2?.birth_date)) return false;

    // 2. Disciplina
    if (!isEventMatchingCoupleDiscipline(et.event_name, couple.disciplines || [])) return false;

    // 3. Classe Effettiva
    const effectiveClass = getEffectClassForCouple(couple, et.event_name);
    let isRaceAllowed = (et.allowed_classes || []).includes(effectiveClass);
    
    // 4. Compatibilità classi storiche
    if (!isRaceAllowed) {
        if (effectiveClass === "A") {
            isRaceAllowed = (et.allowed_classes || []).includes("A1") || (et.allowed_classes || []).includes("A2");
        } else if (effectiveClass === "B" || effectiveClass === "B1") {
            isRaceAllowed = (et.allowed_classes || []).includes("B") || (et.allowed_classes || []).includes("B1") || (et.allowed_classes || []).includes("B2") || (et.allowed_classes || []).includes("B3");
        }
    }

    const nameNorm = et.event_name.toLowerCase();
    const formattedNameNorm = formatEventName(et.event_name).toLowerCase();
    const baseClass = (couple.class || "D").toUpperCase();
    
    // 5. MASTER esclusivo
    const isMasterRace = formattedNameNorm.includes("master");
    if (effectiveClass === "MASTER") {
        if (!isMasterRace) return false;
    } else if (isMasterRace) {
        return false;
    }

    // 6. AS -> Solo Open
    if (baseClass === "AS" && !formattedNameNorm.includes("open")) return false;

    // 7. Esclusione incrociata Over
    if (nameNorm.includes("over 35")) {
        const age1 = couple.athlete1?.birth_date ? getSportsAge(couple.athlete1.birth_date, new Date()) : null;
        const age2 = couple.athlete2?.birth_date ? getSportsAge(couple.athlete2.birth_date, new Date()) : null;
        const maxAgeFound = (age1 !== null && age2 !== null) ? Math.max(age1, age2) : getCategoryMinAge(couple.category);
        if (maxAgeFound !== null && maxAgeFound >= 55) return false;
    }

    // 8. Youth Exclusion
    if (normalizeCategory(couple.category) === "youth") {
        if (nameNorm.includes("adult") || nameNorm.includes("under 21")) return false;
    }

    // 9. Rising Star / Open
    if (nameNorm.includes("youth open") && normalizeCategory(couple.category) === "youth") {
        if (["B", "B1", "B2", "B3", "A", "A1", "A2", "AS"].includes(effectiveClass)) isRaceAllowed = true;
    }
    if (nameNorm.includes("rising star")) {
        if ((et.allowed_classes || []).some((cls: string) => ["A", "A1", "A2"].includes(cls))) isRaceAllowed = true;
    }

    // 10. Open B/C per classi basse
    if (baseClass === "D" || baseClass === "C") {
        const isOpenBC = /\b(open\s+b|b\s+open|open\s+c|c\s+open)\b/i.test(nameNorm);
        if (isOpenBC) return true;
    }

    // 11. Specifiche Classe D
    if (baseClass === "D") {
        const upper = et.event_name.toUpperCase();
        if (upper.includes("CLASSE A") || upper.includes("ADULT OPEN") || /\bA[12]\b/.test(upper) || /\bAS\b/.test(upper) || upper.includes("MASTER")) return false;
        if (nameNorm.includes("under 21")) return false;
        
        const isDRace = nameNorm.includes("classe d") || (et.allowed_classes || []).includes("D");
        const isYouthOpen = nameNorm.includes("youth open");
        if (!isDRace && !isYouthOpen && (nameNorm.includes("adult") || nameNorm.includes("youth"))) return false;

        if (nameNorm.includes("under 16")) {
            const coupleMaxAge = getCategoryMaxAge(couple.category);
            return coupleMaxAge !== null && coupleMaxAge <= 15;
        }
        if (getCategoryMinAge(couple.category) >= 35 && nameNorm.includes("over")) return true;
    }

    return isRaceAllowed;
};
