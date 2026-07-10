/**
 * supabase-backup.mjs
 * Esporta tutte le tabelle principali da Supabase in JSON e CSV.
 * Viene chiamato da run-backup.ps1 con le variabili d'ambiente già impostate.
 *
 * Uso: node supabase-backup.mjs --dest "\\TRUENAS\ArchivioRD\Iscrizioni Gare\2025-2026"
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Legge .env.local dalla root del progetto
// ---------------------------------------------------------------------------
function loadEnv() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__dir, '..', '..', '.env.local');
  const envFallback = join(__dir, '..', '..', '.env');

  for (const p of [envPath, envFallback]) {
    if (existsSync(p)) {
      const lines = readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
      console.log(`[ENV] Caricato da: ${p}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Calcolo cartella stagione
// Stagione: se mese >= 8 (agosto) → anno-(anno+1), altrimenti (anno-1)-anno
// ---------------------------------------------------------------------------
function getStagione(date = new Date()) {
  const anno = date.getFullYear();
  const mese = date.getMonth() + 1; // 1-12
  if (mese >= 8) {
    return `${anno}-${anno + 1}`;
  } else {
    return `${anno - 1}-${anno}`;
  }
}

// ---------------------------------------------------------------------------
// Converte array di oggetti in CSV
// ---------------------------------------------------------------------------
function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // Racchiude in virgolette se contiene virgola, virgolette o newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))
  ];
  return csvLines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadEnv();

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[ERRORE] VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_SERVICE_ROLE_KEY mancanti.');
    process.exit(1);
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[BACKUP] Utilizzo della chiave Service Role per bypassare RLS (backup completo).');
  } else {
    console.log('[BACKUP] ⚠️ ATTENZIONE: Chiave Service Role non trovata. Il backup utilizzerà la chiave pubblica e potrebbe non esportare i dati protetti da RLS.');
  }

  // Legge il percorso di destinazione dagli argomenti CLI: --dest "..."
  const destIdx = process.argv.indexOf('--dest');
  if (destIdx === -1 || !process.argv[destIdx + 1]) {
    console.error('[ERRORE] Argomento --dest mancante. Esempio: node supabase-backup.mjs --dest "\\\\TRUENAS\\ArchivioRD\\..."');
    process.exit(1);
  }
  const baseDest = process.argv[destIdx + 1];

  const now = new Date();
  const stagione = getStagione(now);

  // Timestamp per il nome cartella del singolo backup: YYYYMMDD_HHMM
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

  // Percorso finale: \\TRUENAS\ArchivioRD\Iscrizioni Gare\2025-2026\20260710_1048
  // baseDest contiene già il percorso con la stagione (es. \\TRUENAS\ArchivioRD\Iscrizioni Gare\2025-2026)
  const backupDir = join(baseDest, timestamp);

  console.log(`[BACKUP] Data:     ${now.toLocaleString('it-IT')}`);
  console.log(`[BACKUP] Stagione: ${stagione}`);
  console.log(`[BACKUP] Cartella: ${backupDir}`);

  // Crea la cartella se non esiste
  mkdirSync(backupDir, { recursive: true });

  // Connessione a Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Tabelle da esportare
  const TABLES = [
    'athletes',
    'competitions',
    'couples',
    'competition_entries',
    'competition_event_types',
    'profiles',
    'user_roles',
    'sync_logs',
  ];

  const manifest = {
    backup_date: now.toISOString(),
    stagione,
    supabase_url: SUPABASE_URL,
    tables: {}
  };

  let totalErrors = 0;

  for (const table of TABLES) {
    process.stdout.write(`[EXPORT] ${table.padEnd(30)} ... `);
    try {
      // Scarica tutti i record (paginazione automatica fino a 1000, poi loop)
      let allRows = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Salva JSON
      const jsonPath = join(backupDir, `${table}.json`);
      writeFileSync(jsonPath, JSON.stringify(allRows, null, 2), 'utf8');

      // Salva CSV
      const csvPath = join(backupDir, `${table}.csv`);
      writeFileSync(csvPath, toCSV(allRows), 'utf8');

      manifest.tables[table] = { rows: allRows.length, status: 'OK' };
      console.log(`OK (${allRows.length} righe)`);
    } catch (err) {
      manifest.tables[table] = { rows: 0, status: 'ERROR', error: err.message };
      console.log(`ERRORE: ${err.message}`);
      totalErrors++;
    }
  }

  // Salva manifest
  const manifestPath = join(backupDir, 'backup_manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n----------------------------------------');
  if (totalErrors === 0) {
    console.log(`[BACKUP] ✅ Completato con successo in: ${backupDir}`);
  } else {
    console.log(`[BACKUP] ⚠️  Completato con ${totalErrors} errore/i. Controlla il manifest.`);
  }
  console.log('----------------------------------------\n');

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[FATALE]', err);
  process.exit(2);
});
