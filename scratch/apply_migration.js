import { execSync } from 'child_process';

async function applyMigration() {
  console.log("=== APPLYING SUPABASE MIGRATIONS TO REMOTE DB ===");
  try {
    const output = execSync('npx supabase db push', { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Migration push successful!");
    console.log(output);
  } catch (error) {
    console.error("Migration push failed:");
    console.error(error.stdout || error.message);
    if (error.stderr) console.error(error.stderr);
  }
}

applyMigration();
