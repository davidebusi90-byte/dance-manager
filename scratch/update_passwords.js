import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runUpdate() {
  console.log("=== STARTING PASSWORDS UPDATE PROCESS ===");

  // 1. Read Excel file
  let excelInstructors = [];
  try {
    const workbook = XLSX.readFile('Password Dance Manager.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Parse pairs: row i is Name, row i+1 is Email & Password
    for (let i = 0; i < jsonData.length; i += 2) {
      const nameRow = jsonData[i];
      const credentialRow = jsonData[i + 1];

      if (!nameRow || !credentialRow) continue;

      const name = nameRow['Dance Manager'] ? nameRow['Dance Manager'].trim() : '';
      const email = credentialRow['Dance Manager'] ? credentialRow['Dance Manager'].trim().toLowerCase() : '';
      const password = credentialRow['Password'] ? credentialRow['Password'].trim() : '';

      if (name && email && password) {
        excelInstructors.push({ name, email, password });
      }
    }
  } catch (err) {
    console.error("Error parsing Excel file:", err);
    return;
  }

  console.log(`Parsed ${excelInstructors.length} instructors from Excel.`);
  console.table(excelInstructors.map(item => ({ name: item.name, email: item.email, passwordLength: item.password.length })));

  // 2. Fetch all Auth users
  console.log("\nFetching Supabase Auth users...");
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000
  });

  if (listError) {
    console.error("Error listing users from auth schema:", listError);
    return;
  }
  console.log(`Found ${users.length} registered auth users in Supabase.`);

  // 3. Update passwords
  for (const instructor of excelInstructors) {
    console.log(`\nProcessing: ${instructor.name} (${instructor.email})`);

    // Skip Caterina Alberghini
    if (instructor.email === 'alberghini.caterina@ritmodanza.net') {
      console.log(`>> Skipping Caterina Alberghini (already updated per request)`);
      continue;
    }

    // Find user by email
    const authUser = users.find(u => u.email && u.email.trim().toLowerCase() === instructor.email);

    if (!authUser) {
      console.warn(`[WARNING] User not found in Supabase Auth for email: ${instructor.email}`);
      continue;
    }

    console.log(`Found auth user ID: ${authUser.id} for email: ${instructor.email}`);

    // Update password
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: instructor.password }
    );

    if (updateError) {
      console.error(`[ERROR] Failed to update password for ${instructor.email}:`, updateError.message);
    } else {
      console.log(`[SUCCESS] Password updated successfully for ${instructor.email}`);
    }
  }

  console.log("\n=== PASSWORD UPDATE COMPLETED ===");
}

runUpdate();
