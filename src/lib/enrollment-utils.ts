import { getBestClass } from "./class-utils";
import { getCategoryMinAge, getCategoryMaxAge } from "./category-validation";

export const getEffectClassForCouple = (couple: any, eventName: string) => {
    if (!couple.discipline_info) return couple.class;
    const eventNameNorm = eventName.toLowerCase();

    if (eventNameNorm.includes("latino") || eventNameNorm.includes("latini"))
        return couple.discipline_info["latino"] || couple.class;
    if (eventNameNorm.includes("standard"))
        return couple.discipline_info["standard"] || couple.class;
    if (eventNameNorm.includes("combinata")) {
        const combClass = couple.discipline_info["combinata"] || couple.class;
        const latClass = couple.discipline_info["latino"];
        const stdClass = couple.discipline_info["standard"];

        let resolvedClass = combClass;
        if (latClass) resolvedClass = getBestClass(resolvedClass, latClass);
        if (stdClass) resolvedClass = getBestClass(resolvedClass, stdClass);
        return resolvedClass;
    }

    // Handle specific Adult classes A1/A2
    if (eventNameNorm.includes("a1")) return couple.discipline_info["a1"] || couple.discipline_info["latino"] || couple.discipline_info["standard"] || couple.class;
    if (eventNameNorm.includes("a2")) return couple.discipline_info["a2"] || couple.discipline_info["latino"] || couple.discipline_info["standard"] || couple.class;
    if (eventNameNorm.includes("master")) return couple.discipline_info["master"] || couple.class;
    if (eventNameNorm.includes("south american"))
        return couple.discipline_info["show_dance_sa"] || couple.class;
    if (eventNameNorm.includes("classic showdance"))
        return couple.discipline_info["show_dance_classic"] || couple.class;
    if (eventNameNorm.includes("show dance") || eventNameNorm.includes("showdance"))
        return couple.discipline_info["show_dance"] || couple.class;

    return couple.class;
};

export const isEventAllowedByAge = (et: any, category: string) => {
    const coupleMinAge = getCategoryMinAge(category);
    const coupleMaxAge = getCategoryMaxAge(category); // null means no upper bound (e.g. Senior 5, Adult)

    // If the event has a maximum age limit, the couple's category must fully fit within it.
    // A couple in "Adult" (19/34) must NOT see Under 21 (maxAge=20), because their category
    // has athletes up to 34. We check that the category's max age doesn't exceed the event's max age.
    if (et.max_age !== null) {
        // If category has no upper bound (e.g. Adult fallback, Senior 5), they are too old.
        if (coupleMaxAge === null) return false;
        // If category's upper bound exceeds the event's max age, they are too old.
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

    // Supporto per nuovi nomi completi richiesti
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
    const eventNameNorm = et.event_name.toLowerCase();
    const c = couple.class.toUpperCase();

    // Regola Universale Under 16 (D-A): classi D-A possono sempre gareggiare Under 16
    if (eventNameNorm.includes("under 16") && ["D", "C", "B", "B1", "B2", "B3", "A", "A1", "A2"].includes(c)) {
        isRaceAllowed = true;
        // NOTA: Non facciamo return true immediato per permettere il check di età standard più in basso
    }

    // Regola speciale Classe D: può accedere a gare open/senior fuori dalla propria categoria.
    // Usiamo getCategoryMinAge come proxy dell'età della coppia (è l'età minima della categoria assegnata).
    // NOTA: questa regola viene valutata PRIMA del controllo età standard, perché le categorie
    // assegnate al DB potrebbero non corrispondere perfettamente all'età reale.
    if (c === "D") {
        const coupleMinAge = getCategoryMinAge(couple.category);
        let classD_override = false;
        if (eventNameNorm.includes("c open") || eventNameNorm.includes("b open") || eventNameNorm.includes("under 16")) classD_override = true;
        else if (coupleMinAge >= 35 && (eventNameNorm.includes("over") || eventNameNorm.includes("adult open"))) classD_override = true;
        else if (coupleMinAge >= 16 && coupleMinAge <= 18 && (eventNameNorm.includes("youth open") || eventNameNorm.includes("adult open"))) classD_override = true;
        else if (coupleMinAge >= 19 && coupleMinAge <= 34 && eventNameNorm.includes("adult open")) classD_override = true;

        if (classD_override) {
            // Classe D override: non applichiamo il check di età standard, ma verifichiamo
            // che non sia una gara di classe A/AS
            const name = et.event_name.toUpperCase();
            if (name.includes("CLASSE A") || name.includes(" A1") || name.includes(" A2") || name.includes(" AS")) return false;
            return true;
        }
    }

    // Check età standard (basato sulla categoria della coppia)
    if (!isEventAllowedByAge(et, couple.category)) return false;

    if (!isRaceAllowed) return false;

    // Filtro aggiuntivo visibilità Classe D (A, A1, A2, AS)
    if (c === "D") {
        const name = et.event_name.toUpperCase();
        if (name.includes("CLASSE A") || name.includes(" A1") || name.includes(" A2") || name.includes(" AS")) return false;
    }

    return true;
};
