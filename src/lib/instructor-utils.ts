/**
 * Utility functions for instructor-athlete matching
 */

interface Athlete {
    id: string;
    instructor_id?: string | null;
    responsabili?: string[] | null;
}

interface Profile {
    id: string;
    full_name: string;
}

/**
 * Normalize a name by removing titles and splitting into parts
 */
export function normalizeName(name: string): string[] {
    const titles = ["maestro", "maestra", "m.", "prof.", "prof", "istruttore"];
    return name
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter(w => w.length > 1 && !titles.includes(w));
}

/**
 * Check if an instructor is responsible for an athlete using fuzzy matching
 * Matches if:
 * - instructor_id matches the profile id
 * - At least 2 name parts match between instructor and responsabili
 * - OR all parts of the shorter name are present in the longer name
 */
export function isInstructorResponsibleForAthlete(
    athlete: Athlete,
    instructorProfile: Profile
): boolean {
    // Direct instructor_id match
    if (athlete.instructor_id === instructorProfile.id) {
        return true;
    }

    // Fuzzy matching on responsabili
    const respsJoint = (athlete.responsabili || []).join(" ");
    const instructorParts = normalizeName(instructorProfile.full_name);
    const respParts = normalizeName(respsJoint);

    if (instructorParts.length === 0 || respParts.length === 0) {
        return false;
    }

    const common = instructorParts.filter(p => respParts.includes(p));

    // Match if at least 2 parts coincide or if all parts of the shorter name are present
    const minRequired = Math.min(instructorParts.length, respParts.length, 2);
    return common.length >= minRequired;
}

/**
 * Filter athletes to only those an instructor is responsible for
 */
export function filterAthletesByInstructor<T extends Athlete>(
    athletes: T[],
    instructorProfile: Profile | null
): T[] {
    if (!instructorProfile) {
        return [];
    }

    return athletes.filter(athlete =>
        isInstructorResponsibleForAthlete(athlete, instructorProfile)
    );
}

/**
 * Check if an instructor is responsible for a couple
 * Returns true if the instructor is responsible for either athlete in the couple
 */
export function isInstructorResponsibleForCouple(
    athlete1: Athlete | undefined,
    athlete2: Athlete | undefined,
    instructorProfile: Profile
): boolean {
    if (!athlete1 && !athlete2) {
        return false;
    }

    const responsible1 = athlete1 ? isInstructorResponsibleForAthlete(athlete1, instructorProfile) : false;
    const responsible2 = athlete2 ? isInstructorResponsibleForAthlete(athlete2, instructorProfile) : false;

    return responsible1 || responsible2;
}

/**
 * Check if an instructor is responsible for a couple based on couple's responsabili array
 * Returns true if the instructor's name matches any of the responsabili
 */
export function isInstructorResponsibleForCoupleByResponsabili(
    instructorName: string,
    coupleResponsabili: string[]
): boolean {
    if (!instructorName || coupleResponsabili.length === 0) {
        return false;
    }

    const respsJoint = coupleResponsabili.join(" ");
    const instructorParts = normalizeName(instructorName);
    const respParts = normalizeName(respsJoint);

    if (instructorParts.length === 0 || respParts.length === 0) {
        return false;
    }

    const common = instructorParts.filter(p => respParts.includes(p));

    // Match if at least 2 parts coincide or if all parts of the shorter name are present
    const minRequired = Math.min(instructorParts.length, respParts.length, 2);
    return common.length >= minRequired;
}
