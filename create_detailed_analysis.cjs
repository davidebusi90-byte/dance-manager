const fs = require('fs');

// Load the analysis results
const results = JSON.parse(fs.readFileSync('pdf_analysis_results.json', 'utf-8'));

// Comprehensive analysis
const analysis = {
    allCategories: new Set(),
    allDisciplines: new Set(),
    allClasses: new Set(),
    eventPatterns: new Set(),
    ageGroupPatterns: new Set(),
    competitionTypes: new Set(),
    eventNamingPatterns: []
};

// Extract all unique patterns
results.forEach(result => {
    if (result.error) return;

    // Add to sets
    result.categories?.forEach(c => analysis.allCategories.add(c));
    result.disciplines?.forEach(d => analysis.allDisciplines.add(d));
    result.classes?.forEach(cl => analysis.allClasses.add(cl));

    // Extract competition type from filename
    const filename = result.filename;
    if (filename.includes('Cup')) analysis.competitionTypes.add('Cup');
    if (filename.includes('Championship')) analysis.competitionTypes.add('Championship');
    if (filename.includes('World')) analysis.competitionTypes.add('World Event');
    if (filename.includes('International')) analysis.competitionTypes.add('International');
    if (filename.includes('Interregionale')) analysis.competitionTypes.add('Interregionale');

    // Extract age group patterns from text
    const text = result.textPreview;

    // Age group patterns
    const agePatterns = [
        /(\d+\/\d+)\s*([A-D]|B\d|Assoluto|Open)/gi,
        /(Under\s*\d+)/gi,
        /(Over\s*\d+)/gi,
        /(Juvenile|Junior|Youth|Adult|Senior)\s*\d*/gi
    ];

    agePatterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(m => analysis.ageGroupPatterns.add(m.trim()));
    });

    // Event naming patterns (lines that look like full event names)
    const lines = text.split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();

        // Look for patterns like "Category Discipline" or "Age Category Discipline"
        const eventPattern = /((?:Juvenile|Junior|Youth|Adult|Senior|Over\s*\d+|Under\s*\d+|\d+\/\d+)\s+(?:[A-D]|B\d|Open|Assoluto|Master|Rising\s*Stars?)\s+(?:Open\s+)?(?:Latin|Standard|Ten\s*Dance|Eight\s*Dance))/gi;
        const matches = trimmed.match(eventPattern) || [];
        matches.forEach(m => {
            if (m.length > 10 && m.length < 100) {
                analysis.eventPatterns.add(m.trim());
            }
        });
    });
});

// Create detailed report
const report = {
    summary: {
        totalPDFs: results.length,
        successfulAnalyses: results.filter(r => !r.error).length,
        failedAnalyses: results.filter(r => r.error).length
    },

    categories: {
        count: analysis.allCategories.size,
        list: Array.from(analysis.allCategories).sort()
    },

    disciplines: {
        count: analysis.allDisciplines.size,
        list: Array.from(analysis.allDisciplines).sort()
    },

    classes: {
        count: analysis.allClasses.size,
        list: Array.from(analysis.allClasses).sort()
    },

    ageGroupPatterns: {
        count: analysis.ageGroupPatterns.size,
        list: Array.from(analysis.ageGroupPatterns).sort()
    },

    competitionTypes: {
        count: analysis.competitionTypes.size,
        list: Array.from(analysis.competitionTypes).sort()
    },

    eventPatterns: {
        count: analysis.eventPatterns.size,
        sample: Array.from(analysis.eventPatterns).sort().slice(0, 50)
    },

    competitionList: results.map(r => ({
        name: r.filename,
        pages: r.pageCount,
        categories: r.categories,
        disciplines: r.disciplines,
        hasError: !!r.error
    }))
};

// Save detailed report
fs.writeFileSync('detailed_analysis.json', JSON.stringify(report, null, 2), 'utf-8');

console.log('=== DETAILED ANALYSIS REPORT ===\n');
console.log(`Total PDFs: ${report.summary.totalPDFs}`);
console.log(`Successful: ${report.summary.successfulAnalyses}`);
console.log(`Failed: ${report.summary.failedAnalyses}\n`);

console.log(`=== CATEGORIES (${report.categories.count}) ===`);
report.categories.list.forEach(c => console.log(`  - ${c}`));

console.log(`\n=== DISCIPLINES (${report.disciplines.count}) ===`);
report.disciplines.list.forEach(d => console.log(`  - ${d}`));

console.log(`\n=== CLASSES (${report.classes.count}) ===`);
report.classes.list.forEach(cl => console.log(`  - ${cl}`));

console.log(`\n=== AGE GROUP PATTERNS (${report.ageGroupPatterns.count}) ===`);
report.ageGroupPatterns.list.slice(0, 30).forEach(p => console.log(`  - ${p}`));

console.log(`\n=== COMPETITION TYPES (${report.competitionTypes.count}) ===`);
report.competitionTypes.list.forEach(t => console.log(`  - ${t}`));

console.log(`\n=== SAMPLE EVENT PATTERNS (showing 30 of ${report.eventPatterns.count}) ===`);
report.eventPatterns.sample.slice(0, 30).forEach(e => console.log(`  - ${e}`));

console.log('\n✓ Detailed analysis saved to: detailed_analysis.json');
