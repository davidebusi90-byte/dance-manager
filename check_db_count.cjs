const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
const env = {};
envText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    const { data: athletes, error } = await supabase
        .from('athletes')
        .select('code, is_deleted, first_name, last_name');

    if (error) {
        console.error(error);
        return;
    }

    const activeAthletes = athletes.filter(a => !a.is_deleted);
    console.log(`Total athletes in DB: ${athletes.length}`);
    console.log(`Active athletes in DB: ${activeAthletes.length}`);
    console.log(`Soft-deleted athletes in DB: ${athletes.length - activeAthletes.length}`);

    // Let's compare with the excel valid CIDs
    const XLSX = require('xlsx');
    const filePath = path.join(process.cwd(), 'File di origine', 'Competitori_ok.xls');
    const workbook = XLSX.readFile(filePath);
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });

    const excelCids = new Set();
    for (let i = 3; i < rawData.length; i++) {
        const cid = String(rawData[i][5] || "").trim();
        if (cid && cid !== "undefined") excelCids.add(cid);
    }

    const dbActiveCids = new Set(activeAthletes.map(a => a.code));

    console.log(`Valid CIDs in Excel: ${excelCids.size}`);
    console.log(`Active CIDs in DB: ${dbActiveCids.size}`);

    console.log('CIDs in Excel but not in DB:');
    for (let cid of excelCids) {
        if (!dbActiveCids.has(cid)) console.log(` - ${cid}`);
    }
}
checkDb();
