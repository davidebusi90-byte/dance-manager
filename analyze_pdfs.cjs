const fs = require('fs');
const path = require('path');

// Load pdfjs-dist
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Patterns to search for
const CATEGORY_PATTERNS = [
    /Debuttanti/gi,
    /Principianti/gi,
    /Class\s*[A-D]/gi,
    /Juvenile/gi,
    /Junior/gi,
    /Youth/gi,
    /Adult/gi,
    /Senior/gi,
    /Over\s*\d+/gi,
    /Seniores/gi,
    /Giovanissimi/gi,
    /Ragazzi/gi,
    /Allievi/gi,
    /Bambini/gi
];

const DISCIPLINE_PATTERNS = [
    /Latino?\s*Americane?/gi,
    /Standard/gi,
    /Combinata/gi,
    /Latin/gi,
    /Ballroom/gi,
    /10\s*Dance/gi,
    /Liscio/gi
];

const CLASS_PATTERNS = [
    /Class\s*[A-D]/gi,
    /Classe\s*[A-D]/gi,
    /[A-D]\s*Class/gi
];

async function extractTextFromPDF(pdfPath) {
    const dataBuffer = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdfDocument = await loadingTask.promise;

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return { text: fullText, numPages: pdfDocument.numPages };
}

async function analyzePDF(pdfPath) {
    const filename = path.basename(pdfPath, '.pdf');

    try {
        const { text, numPages } = await extractTextFromPDF(pdfPath);

        // Extract matches
        const categories = new Set();
        const disciplines = new Set();
        const classes = new Set();

        CATEGORY_PATTERNS.forEach(pattern => {
            const matches = text.match(pattern) || [];
            matches.forEach(m => categories.add(m.trim()));
        });

        DISCIPLINE_PATTERNS.forEach(pattern => {
            const matches = text.match(pattern) || [];
            matches.forEach(m => disciplines.add(m.trim()));
        });

        CLASS_PATTERNS.forEach(pattern => {
            const matches = text.match(pattern) || [];
            matches.forEach(m => classes.add(m.trim()));
        });

        // Extract event names (lines that look like competition events)
        const lines = text.split('\n');
        const eventPatterns = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            // Look for lines that contain both a category and a discipline
            const hasCategory = CATEGORY_PATTERNS.some(p => {
                p.lastIndex = 0;
                return p.test(trimmed);
            });
            const hasDiscipline = DISCIPLINE_PATTERNS.some(p => {
                p.lastIndex = 0;
                return p.test(trimmed);
            });

            if (hasCategory && hasDiscipline && trimmed.length < 150 && trimmed.length > 10) {
                eventPatterns.push(trimmed);
            }
        });

        return {
            filename,
            textLength: text.length,
            pageCount: numPages,
            categories: Array.from(categories).sort(),
            disciplines: Array.from(disciplines).sort(),
            classes: Array.from(classes).sort(),
            sampleEvents: [...new Set(eventPatterns)].slice(0, 30),
            textPreview: text.substring(0, 3000)
        };
    } catch (error) {
        return {
            filename,
            error: error.message
        };
    }
}

async function main() {
    const pdfDir = 'iscrizioni in pdf';
    const outputFile = 'pdf_analysis_results.json';

    const pdfFiles = fs.readdirSync(pdfDir)
        .filter(f => f.endsWith('.pdf'))
        .sort();

    console.log(`Found ${pdfFiles.length} PDF files\n${'='.repeat(80)}`);

    const results = [];

    for (const pdfFile of pdfFiles) {
        const pdfPath = path.join(pdfDir, pdfFile);
        console.log(`\nAnalyzing: ${pdfFile}`);

        const analysis = await analyzePDF(pdfPath);
        results.push(analysis);

        if (analysis.error) {
            console.log(`  ✗ Error: ${analysis.error}`);
        } else {
            console.log(`  ✓ Pages: ${analysis.pageCount}`);
            console.log(`  ✓ Text length: ${analysis.textLength} characters`);
            console.log(`  ✓ Categories: ${analysis.categories.join(', ') || 'None'}`);
            console.log(`  ✓ Disciplines: ${analysis.disciplines.join(', ') || 'None'}`);
            console.log(`  ✓ Classes: ${analysis.classes.join(', ') || 'None'}`);
            console.log(`  ✓ Sample events found: ${analysis.sampleEvents.length}`);
        }
    }

    // Save results
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\nAnalysis complete! Results saved to: ${outputFile}`);

    // Summary statistics
    const allCategories = new Set();
    const allDisciplines = new Set();
    const allClasses = new Set();
    const allEvents = new Set();

    results.forEach(result => {
        if (!result.error) {
            result.categories?.forEach(c => allCategories.add(c));
            result.disciplines?.forEach(d => allDisciplines.add(d));
            result.classes?.forEach(cl => allClasses.add(cl));
            result.sampleEvents?.forEach(e => allEvents.add(e));
        }
    });

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total PDFs analyzed: ${results.length}`);
    console.log(`\nAll categories found (${allCategories.size}):`);
    Array.from(allCategories).sort().forEach(c => console.log(`  - ${c}`));
    console.log(`\nAll disciplines found (${allDisciplines.size}):`);
    Array.from(allDisciplines).sort().forEach(d => console.log(`  - ${d}`));
    console.log(`\nAll classes found (${allClasses.size}):`);
    Array.from(allClasses).sort().forEach(cl => console.log(`  - ${cl}`));
    console.log(`\nTotal unique event patterns: ${allEvents.size}`);
}

main().catch(console.error);
