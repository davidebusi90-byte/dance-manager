
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

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

const EXCEL_PATH = path.join(process.cwd(), 'File di origine', 'Competizioni.xlsx');

async function syncExcel() {
    console.log('🔄 Sincronizzazione Excel con database...');

    try {
        // 1. Fetch deleted competitions from Supabase
        const { data: deletedComps, error } = await supabase
            .from('competitions')
            .select('name, date')
            .eq('is_deleted', true);

        if (error) throw error;
        console.log(`🗑️ Trovate ${deletedComps.length} competizioni eliminate nel database.`);

        if (deletedComps.length === 0) {
            console.log('✅ Nessuna competizione da eliminare dal file Excel.');
            return;
        }

        // 2. Read existing Excel file
        if (!fs.existsSync(EXCEL_PATH)) {
            console.error(`❌ File non trovato: ${EXCEL_PATH}`);
            return;
        }

        const workbook = XLSX.readFile(EXCEL_PATH);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        // 3. Filter out deleted competitions
        const filteredData = rawData.filter((row) => {
            const name = String(row['Nome'] || row['Competizione'] || row['Gara'] || '').trim();
            const dateStr = row['Data']; // Excel date might be a number or string

            // Normalize date for comparison
            let rowDate = '';
            if (typeof dateStr === 'number') {
                const d = XLSX.SSF.parse_date_code(dateStr);
                rowDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
            } else {
                // Try to parse string date
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    rowDate = d.toISOString().split('T')[0];
                }
            }

            const isDeleted = deletedComps.some(dc =>
                dc.name.toLowerCase() === name.toLowerCase() &&
                dc.date === rowDate
            );

            return !isDeleted;
        });

        console.log(`📊 Righe prima: ${rawData.length}, Righe dopo: ${filteredData.length}`);

        // 4. Save updated Excel file
        const newWorksheet = XLSX.utils.json_to_sheet(filteredData);
        workbook.Sheets[sheetName] = newWorksheet;
        XLSX.writeFile(workbook, EXCEL_PATH);

        console.log('✅ File Excel aggiornato con successo!');
    } catch (err) {
        console.error('❌ Errore durante la sincronizzazione:', err);
    }
}

syncExcel();
