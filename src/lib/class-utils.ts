/**
 * Definizione della gerarchia delle classi di danza in ordine di importanza.
 * Più basso è l'indice, più importante è la classe.
 */
export const CLASS_RANK: Record<string, number> = {
    "MASTER": 0,
    "AS": 1,
    "A": 2,
    "A1": 3,
    "A2": 4,
    "B1": 5,
    "B2": 6,
    "B3": 7,
    "B": 8, // Classe B generica, solitamente meno importante di B1/B2 se presenti
    "C": 9,
    "D": 12,
};

/**
 * Confronta due classi e restituisce la migliore (più importante).
 */
export function getBestClass(classA: string | null | undefined, classB: string | null | undefined): string {
    if (!classA && !classB) return "D";
    if (!classA) return normalizeClass(classB!);
    if (!classB) return normalizeClass(classA!);

    const normA = normalizeClass(classA);
    const normB = normalizeClass(classB);

    const rankA = CLASS_RANK[normA] ?? 99;
    const rankB = CLASS_RANK[normB] ?? 99;

    return rankA <= rankB ? normA : normB;
}

/**
 * Normalizza la stringa della classe per il confronto.
 */
function normalizeClass(cls: string): string {
    return cls.trim().toUpperCase();
}

/**
 * Verifica se la classe A è più o ugualmente importante della classe B.
 */
export function isClassHigherOrEqual(classA: string, classB: string): boolean {
    const rankA = CLASS_RANK[normalizeClass(classA)] ?? 99;
    const rankB = CLASS_RANK[normalizeClass(classB)] ?? 99;
    return rankA <= rankB;
}
