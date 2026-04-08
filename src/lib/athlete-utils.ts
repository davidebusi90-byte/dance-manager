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

  // Standard dance category patterns
  const isDanceCategory = (s: string) => 
    /\d+-\d+/.test(s) || 
    /adult|senior|youth|juvenile|junior/i.test(s) || 
    /under \d+/i.test(s) ||
    /over \d+/i.test(s);

  // LOGIC:
  // 1. If code is a place and category is a dance category or CF, they are swapped
  if (isPlaceLike(code) && (isDanceCategory(category) || isCfLike(category))) return true;
  
  // 2. If code is CF and category is a dance category (normally CF would be in category if swapped), but CF is in code...
  // Wait, if it's deactivated legacy data, they might have CF in code and Place in category. 
  // In that case they are NOT swapped (code is CF, category is Place).
  
  return false;
}

/**
 * Detects what type of data is contained in a field to help the UI label it.
 */
export function detectFieldType(value: string | null): 'cf' | 'cid' | 'place' | 'category' | 'contact' | 'name' {
  if (!value) return 'name';
  const v = value.trim();
  
  // CF: 16 chars alnum
  if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(v)) return 'cf';
  
  // Phone/Email: contains @ or many digits
  if (v.includes('@') || v.replace(/\s/g, '').length >= 10 && /^\d+$/.test(v.replace(/[\s-]/g, ''))) return 'contact';
  
  // CID: pure digits, short
  if (/^\d+$/.test(v) && v.length < 10) return 'cid';
  
  // Category logic
  if (/\d+-\d+/.test(v) || /adult|senior|youth|juvenile|junior|under|over/i.test(v)) return 'category';
  
  // If no digits and relatively long, probably a name or place
  if (!/\d/.test(v)) {
    // If it's a known placeholder or short, probably a place/city
    if (v.length < 25) return 'place';
  }
  
  return 'name';
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

/**
 * Advanced remapping for legacy/deactivated data.
 * Tries to put each piece of data in its semantic bucket.
 */
export function smartRemapAthlete(a: { 
  code: string; 
  category: string; 
  responsabili?: string[] | null;
  email?: string | null;
}) {
  const result = {
    cid: null as string | null,
    cf: null as string | null,
    place: null as string | null,
    category: null as string | null,
    contacts: [] as string[],
    instructors: [] as string[]
  };

  // 1. Process Code and Category
  const codeType = detectFieldType(a.code);
  const categoryType = detectFieldType(a.category);

  // Distribute based on detected types
  [ { val: a.code, type: codeType }, { val: a.category, type: categoryType } ].forEach(item => {
    if (item.type === 'cf') result.cf = item.val;
    else if (item.type === 'cid') result.cid = item.val;
    else if (item.type === 'place') result.place = item.val;
    else if (item.type === 'category') result.category = item.val;
  });

  // 2. Process Responsabili (Contacts/Instructors)
  if (a.responsabili) {
    a.responsabili.forEach(r => {
      const type = detectFieldType(r);
      if (type === 'contact') result.contacts.push(r);
      else result.instructors.push(r);
    });
  }

  // 3. Email
  if (a.email) result.contacts.push(a.email);

  return result;
}
