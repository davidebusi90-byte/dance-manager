// script to check for potential duplicate athletes in the database
// primarily looking for matching first name, last name, and birth date where the CID is different (often one being a birthplace)

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Initialize Supabase Client
const envVars = {} as Record<string, string>;
const parseEnv = (content: string) => {
  content.split("\n").forEach((line) => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, "$1");
    }
  });
};

if (fs.existsSync(".env")) parseEnv(fs.readFileSync(".env", "utf-8"));
if (fs.existsSync(".env.local")) parseEnv(fs.readFileSync(".env.local", "utf-8"));

const supabaseUrl = envVars["VITE_SUPABASE_URL"] || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = envVars["VITE_SUPABASE_ANON_KEY"] || envVars["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  console.log("Analyzing athletes table for potential duplicates...");

  const { data: athletes, error } = await supabase
    .from("athletes")
    .select("id, code, first_name, last_name, birth_date, category, is_deleted");

  if (error) {
    console.error("Error fetching athletes:", error);
    return;
  }

  const grouped = new Map<string, typeof athletes>();

  // Group by First Name + Last Name + Birth Date
  athletes.forEach((athlete) => {
    // Normalizza i nomi per evitare discrepanze
    const first = athlete.first_name.trim().toLowerCase();
    const last = athlete.last_name.trim().toLowerCase();
    const dob = athlete.birth_date || "UNDEFINED";
    
    const key = `${first}|${last}|${dob}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(athlete);
  });

  let duplicateCount = 0;

  console.log("--------------------------------------------------");
  for (const [key, group] of grouped.entries()) {
    if (group.length > 1) {
      duplicateCount++;
      const [first, last, dob] = key.split("|");
      console.log(`POTENTIAL DUPLICATE FOUND: ${first.toUpperCase()} ${last.toUpperCase()} (DOB: ${dob})`);
      
      group.forEach(a => {
        console.log(`  - CID: ${a.code.padEnd(20)} | Category: ${a.category?.padEnd(20) || "NULL"} | Deleted: ${a.is_deleted ? "YES" : "NO"} | ID: ${a.id}`);
      });
      console.log("--------------------------------------------------");
    }
  }

  console.log(`\nAnalysis complete. Found ${duplicateCount} potential duplicate groups.`);
}

checkDuplicates().catch(console.error);
