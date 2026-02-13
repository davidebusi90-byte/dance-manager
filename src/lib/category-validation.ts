export type CategoryLabel =
  | "Juvenile 1"
  | "Juvenile 2"
  | "Junior 1"
  | "Junior 2"
  | "Youth"
  | "Under 21"
  | "Adult"
  | "Senior 1"
  | "Senior 2"
  | "Senior 3a"
  | "Senior 3b"
  | "Senior 4a"
  | "Senior 4b"
  | "Senior 5";

type CategoryRule = {
  label: CategoryLabel;
  minAge: number;
  maxAge: number | null;
  displayCode: string; // Age range code for display
};

// Based on the provided business rules.
const CATEGORY_RULES: CategoryRule[] = [
  { label: "Juvenile 1", minAge: 6, maxAge: 9, displayCode: "6/9" },
  { label: "Juvenile 2", minAge: 10, maxAge: 11, displayCode: "10/11" },
  { label: "Junior 1", minAge: 12, maxAge: 13, displayCode: "12/13" },
  { label: "Junior 2", minAge: 14, maxAge: 15, displayCode: "14/15" },
  { label: "Youth", minAge: 16, maxAge: 18, displayCode: "16/18" },
  // Under 21 is a sub-category for ages 19-20.
  { label: "Under 21", minAge: 19, maxAge: 20, displayCode: "19-34" },
  { label: "Adult", minAge: 19, maxAge: 34, displayCode: "19/34" },
  { label: "Senior 1", minAge: 35, maxAge: 44, displayCode: "35/44" },
  { label: "Senior 2", minAge: 45, maxAge: 54, displayCode: "45/54" },
  { label: "Senior 3a", minAge: 55, maxAge: 60, displayCode: "55/60" },
  { label: "Senior 3b", minAge: 61, maxAge: 64, displayCode: "61/64" },
  { label: "Senior 4a", minAge: 65, maxAge: 69, displayCode: "65/69" },
  { label: "Senior 4b", minAge: 70, maxAge: 74, displayCode: "70/74" },
  { label: "Senior 5", minAge: 75, maxAge: null, displayCode: "75+" },
];

export function getSportsAge(birthDateISO: string, referenceDate: Date): number {
  const birthYear = new Date(birthDateISO).getFullYear();
  const refYear = referenceDate.getFullYear();
  return refYear - birthYear;
}

/**
 * Returns the list of allowed categories for an athlete based on their sports age.
 * Includes seasonal transition logic (Jan-Apr allows previous year's category).
 */
export function getAllowedCategories(birthDateISO: string, referenceDate: Date): CategoryLabel[] {
  const sportsAge = getSportsAge(birthDateISO, referenceDate);
  const currentCategoryLabel = expectedCategoryFromAge(sportsAge);

  // If before April 1st, can optionally stay in the category of the previous year
  const isBeforeApril1 = referenceDate.getMonth() < 3; // 0=Jan, 1=Feb, 2=Mar
  if (isBeforeApril1) {
    const previousYearCategoryLabel = expectedCategoryFromAge(sportsAge - 1);
    if (previousYearCategoryLabel !== currentCategoryLabel) {
      return [currentCategoryLabel, previousYearCategoryLabel];
    }
  }

  return [currentCategoryLabel];
}

export function expectedCategoryFromAge(age: number): CategoryLabel {
  const match = CATEGORY_RULES.find((r) => {
    const withinMin = age >= r.minAge;
    const withinMax = r.maxAge === null ? true : age <= r.maxAge;
    return withinMin && withinMax;
  });

  return match?.label ?? "Adult";
}

/**
 * Resolve any supported category input (label, abbreviation, or age-range code)
 * to the canonical normalised key such as "juvenile1", "senior3a", etc.
 */
export function normalizeCategory(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_.\/]/g, "");

  // Common abbreviations & label forms
  const labelMap: Record<string, string> = {
    juv1: "juvenile1",
    juv2: "juvenile2",
    ju1: "juvenile1",
    ju2: "juvenile2",
    juvenile1: "juvenile1",
    juvenile2: "juvenile2",
    junior1: "junior1",
    junior2: "junior2",
    youth: "youth",
    under21: "under21",
    u21: "under21",
    adult: "adult",
    senior1: "senior1",
    senior2: "senior2",
    senior3a: "senior3a",
    senior3b: "senior3b",
    senior4a: "senior4a",
    senior4b: "senior4b",
    senior5: "senior5",
  };

  if (labelMap[s]) return labelMap[s];

  // Age-range display codes
  const codeMap: Record<string, string> = {
    "69": "juvenile1",
    "1011": "juvenile2",
    "1213": "junior1",
    "1415": "junior2",
    "1618": "youth",
    "1920": "under21",
    "1934": "adult",
    "3544": "senior1",
    "4554": "senior2",
    "5560": "senior3a",
    "6164": "senior3b",
    "6569": "senior4a",
    "7074": "senior4b",
    "75": "senior5",
    "75+": "senior5",
  };

  if (codeMap[s]) return codeMap[s];

  return s;
}

export function normalizeCategoryLabel(label: CategoryLabel): string {
  return normalizeCategory(label);
}

/**
 * Returns a formatted category display string like "6/9 (Juvenile 1)"
 */
export function formatCategoryDisplay(categoryLabel: CategoryLabel): string {
  const rule = CATEGORY_RULES.find((r) => r.label === categoryLabel);
  if (!rule) return categoryLabel;
  return `${rule.displayCode} (${rule.label})`;
}

/**
 * Returns the display code for a category (e.g., "6/9" for Juvenile 1)
 */
export function getCategoryDisplayCode(categoryLabel: CategoryLabel): string {
  const rule = CATEGORY_RULES.find((r) => r.label === categoryLabel);
  return rule?.displayCode ?? "";
}

export function validateCategoryMatch(params: {
  storedCategory: string;
  birthDateISO: string | null;
  onDate?: Date;
}):
  | { ok: true; expected: CategoryLabel }
  | { ok: false; expected: CategoryLabel[]; reason: string } {
  const { storedCategory, birthDateISO, onDate = new Date() } = params;
  if (!birthDateISO) {
    return { ok: false, expected: ["Adult"], reason: "Data di nascita mancante" };
  }

  const allowed = getAllowedCategories(birthDateISO, onDate);
  const storedNorm = normalizeCategory(storedCategory);

  const ok = allowed.some(cat => normalizeCategoryLabel(cat) === storedNorm);

  if (ok) {
    return { ok: true, expected: allowed[0] };
  } else {
    const expectedStr = allowed.map(cat => formatCategoryDisplay(cat)).join(" o ");
    return {
      ok: false,
      expected: allowed,
      reason: `Categoria attesa: ${expectedStr}`,
    };
  }
}

export function validateCoupleCategory(params: {
  storedCategory: string;
  athlete1BirthDateISO: string | null;
  athlete2BirthDateISO: string | null;
  onDate?: Date;
}):
  | { ok: true; expected: CategoryLabel }
  | { ok: false; expected: CategoryLabel[]; reason: string } {
  const { storedCategory, athlete1BirthDateISO, athlete2BirthDateISO, onDate = new Date() } = params;
  if (!athlete1BirthDateISO || !athlete2BirthDateISO) {
    return { ok: false, expected: ["Adult"], reason: "Data di nascita mancante (almeno uno)" };
  }

  const sportsAge1 = getSportsAge(athlete1BirthDateISO, onDate);
  const sportsAge2 = getSportsAge(athlete2BirthDateISO, onDate);

  const olderAge = Math.max(sportsAge1, sportsAge2);
  const youngerAge = Math.min(sportsAge1, sportsAge2);

  const allowed = getAllowedCategories(
    sportsAge1 >= sportsAge2 ? athlete1BirthDateISO : athlete2BirthDateISO,
    onDate
  );

  // Logic for age gap handling
  // If the younger partner is too young for the older partner's category (minAge - 5 rule),
  // they generally fall back to a lower category.
  // Specifically for Senior categories, if they don't fit, they fall back to Adult (19-34).

  let effectiveCategoryLabel = allowed[0];
  let effectiveRule = CATEGORY_RULES.find(r => r.label === effectiveCategoryLabel)!;

  // Check if we need to downgrade from Senior to Adult
  // The rule is: younger partner must be roughly within 5 years of the category minimum.
  // If not, they can't dance in that category.

  // We check if the current expected category is valid for the younger partner.
  const minAge = effectiveRule.minAge;
  const okYounger = youngerAge >= minAge - 5;

  if (!okYounger) {
    // If the younger is too young, and we are in a Senior category, fall back to "Adult".
    // Note: We might need a more generic fallback if we have multiple levels (Senior 3 -> Senior 2 etc),
    // but the user only specifically mentioned the fallback to 19-34 (Adult).
    // Let's implement a specific check: if effective is Senior X, and younger is too young, set effective to Adult.

    if (effectiveCategoryLabel.startsWith("Senior")) {
      // Check if they are eligible for Adult
      // Adult min is 19. Younger must be >= 19-5 = 14.
      const adultRule = CATEGORY_RULES.find(r => r.label === "Adult")!;
      if (youngerAge >= adultRule.minAge - 5) {
        effectiveCategoryLabel = "Adult";
        effectiveRule = adultRule;
      }
    }
  }

  // Now validate against the *effective* category
  const storedNorm = normalizeCategory(storedCategory);
  const effectiveNorm = normalizeCategory(effectiveCategoryLabel);
  const isCategoryMatch = storedNorm === effectiveNorm || (effectiveNorm === "under21" && storedNorm === "adult");

  // Re-check younger age against the NEW effective category (should be OK if we fell back correctly)
  const finalMinAge = effectiveRule.minAge;
  const finalOkYounger = youngerAge >= finalMinAge - 5;

  if (isCategoryMatch && finalOkYounger) {
    return { ok: true, expected: effectiveCategoryLabel };
  }

  const reasons: string[] = [];
  if (!isCategoryMatch) {
    const expectedStr = formatCategoryDisplay(effectiveCategoryLabel);
    reasons.push(`Categoria attesa: ${expectedStr}`);
  }
  if (!finalOkYounger) {
    reasons.push(`Partner più giovane (${youngerAge} anni) troppo distante dall'età minima categoria ${effectiveCategoryLabel} (${finalMinAge} anni). Minimo richiesto: ${finalMinAge - 5} anni.`);
  }

  return {
    ok: false,
    expected: [effectiveCategoryLabel],
    reason: reasons.join(" • "),
  };
}

