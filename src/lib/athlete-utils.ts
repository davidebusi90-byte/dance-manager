/**
 * Heuristic to detect if CID (code) and Category/Place (category) are swapped.
 * This is common in legacy imports where the birth place was mapped to CID.
 */
export function isCidAndCategorySwapped(code: string, category: string): boolean {
  if (!code || !category) return false;
  
  // Codice Fiscale pattern (16 chars, alphanumeric with specific structure)
  const isCfLike = (s: string) => /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(s) || (s.length >= 11 && /\d/.test(s));
  
  // Place/City pattern (no digits, short-ish)
  const isPlaceLike = (s: string) => !/\d/.test(s) && s.length < 50;

  // If code is a place and category is a CID, they are swapped
  return isPlaceLike(code) && isCfLike(category);
}

/**
 * Returns the corrected code and category based on the swap heuristic.
 */
export function getCorrectedAthleteData(athlete: { code: string; category: string }) {
  if (isCidAndCategorySwapped(athlete.code, athlete.category)) {
    return {
      code: athlete.category,
      category: athlete.code
    };
  }
  return {
    code: athlete.code,
    category: athlete.category
  };
}
