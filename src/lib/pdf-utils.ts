import * as pdfjs from 'pdfjs-dist';

// Set the worker source to the relative path in the public folder or use a CDN
// For Vite, we can often rely on the library to handle this or provide a path
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * Extracts all text from a PDF file.
 * @param file The PDF file to extract text from.
 * @returns A promise that resolves to the combined text of all pages.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

/**
 * Extracts CID codes from a string of text.
 * Assumes CIDs are alphanumeric and potentially 5-7 characters long.
 * We'll use a regex that looks for likely CID patterns.
 * @param text The text to search for CIDs.
 * @returns An array of unique CID strings.
 */
export function extractCidsFromText(text: string): string[] {
    // Common CID formats: 
    // - 5 to 6 digits (e.g., 12345, 123456)
    // - Sometimes with prefixes or specific patterns
    // Based on the import-utils.ts, CIDs seem to be strings.
    // We'll look for numeric sequences of 4-7 digits as a starting point.
    const cidRegex = /\b\d{4,7}\b/g;
    const matches = text.match(cidRegex) || [];

    // Also look for the fallback XX0000 format seen in import-utils
    const fallbackRegex = /\bXX\d{4}\b/gi;
    const fallbackMatches = text.match(fallbackRegex) || [];

    return Array.from(new Set([...matches, ...fallbackMatches.map(m => m.toUpperCase())]));
}
