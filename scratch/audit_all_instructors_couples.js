import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper function to normalize name (matching logic from instructor-utils.ts)
function normalizeName(name) {
    const titles = ["maestro", "maestra", "m.", "prof.", "prof", "istruttore"];
    return name
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter(w => w.length > 1 && !titles.includes(w));
}

// match_names simulation
function matchNames(name1, name2) {
    const parts1 = normalizeName(name1);
    const parts2 = normalizeName(name2);
    if (parts1.length === 0 || parts2.length === 0) return false;

    const common = parts1.filter(p => parts2.includes(p));
    const minRequired = Math.min(parts1.length, parts2.length, 2);
    return common.length >= minRequired;
}

async function runAudit() {
  console.log("=== STARTING COMPREHENSIVE INSTRUCTOR-COUPLES AUDIT ===");
  
  // 1. Fetch profiles, roles, couples, athlete_instructors, and athletes
  const [profilesRes, rolesRes, couplesRes, linksRes, athletesRes] = await Promise.all([
    supabase.from('profiles').select('id, user_id, full_name'),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('couples').select('id, athlete1_id, athlete2_id, instructor_id, responsabili, is_active').eq('is_active', true),
    supabase.from('athlete_instructors').select('athlete_id, profile_id'),
    supabase.from('athletes').select('id, first_name, last_name, responsabili')
  ]);

  if (profilesRes.error || rolesRes.error || couplesRes.error || linksRes.error || athletesRes.error) {
    console.error("Error loading data:", {
      profiles: profilesRes.error,
      roles: rolesRes.error,
      couples: couplesRes.error,
      links: linksRes.error,
      athletes: athletesRes.error
    });
    return;
  }

  const profiles = profilesRes.data;
  const roles = rolesRes.data;
  const couples = couplesRes.data;
  const links = linksRes.data;
  const athletes = athletesRes.data;

  // Filter profiles to get only instructors (who are not admins/supervisors, or just anyone with the instructor role)
  const instructorUserIds = new Set(roles.filter(r => r.role === 'instructor').map(r => r.user_id));
  const instructors = profiles.filter(p => instructorUserIds.has(p.user_id));

  console.log(`Loaded ${instructors.length} instructors and ${couples.length} active couples.`);

  let reportText = `AUDIT REPORT: INSTRUCTOR COUPLES VISIBILITY\n`;
  reportText += `Generated on: ${new Date().toISOString()}\n`;
  reportText += `Total Instructors: ${instructors.length}\n`;
  reportText += `Total Active Couples: ${couples.length}\n`;
  reportText += `========================================================\n\n`;

  const instructorResults = [];

  for (const instructor of instructors) {
    reportText += `Instructor: ${instructor.full_name} (ID: ${instructor.id})\n`;
    reportText += `--------------------------------------------------------\n`;

    let oldRulesCount = 0;
    let newRulesCount = 0;
    const addedCouples = [];
    const visibleCouples = [];

    for (const couple of couples) {
      const a1 = athletes.find(a => a.id === couple.athlete1_id);
      const a2 = athletes.find(a => a.id === couple.athlete2_id);
      const coupleName = `${a1 ? a1.first_name + ' ' + a1.last_name : 'Unknown'} & ${a2 ? a2.first_name + ' ' + a2.last_name : 'Unknown'}`;

      // Old rule: direct instructor_id match
      const hasOldAccess = couple.instructor_id === instructor.id;

      // New rule:
      const hasDirectMatch = couple.instructor_id === instructor.id;
      const isAthlete1Linked = links.some(l => l.athlete_id === couple.athlete1_id && l.profile_id === instructor.id);
      const isAthlete2Linked = links.some(l => l.athlete_id === couple.athlete2_id && l.profile_id === instructor.id);
      const hasNameInResponsabili = (couple.responsabili || []).some(resp => matchNames(resp, instructor.full_name));

      const hasNewAccess = hasDirectMatch || isAthlete1Linked || isAthlete2Linked || hasNameInResponsabili;

      if (hasOldAccess) {
        oldRulesCount++;
      }
      
      if (hasNewAccess) {
        newRulesCount++;
        visibleCouples.push(coupleName);
        if (!hasOldAccess) {
          addedCouples.push({
            name: coupleName,
            reason: isAthlete1Linked || isAthlete2Linked 
              ? `Linked to athlete(s) via athlete_instructors` 
              : `Name matches in couple's responsabili list`
          });
        }
      }
    }

    reportText += `- Couples visible under OLD rules: ${oldRulesCount}\n`;
    reportText += `- Couples visible under NEW rules: ${newRulesCount}\n`;
    reportText += `- Difference: +${newRulesCount - oldRulesCount} couples\n`;

    if (addedCouples.length > 0) {
      reportText += `\n  Newly visible couples:\n`;
      addedCouples.forEach(c => {
        reportText += `  * ${c.name} (${c.reason})\n`;
      });
    }

    reportText += `\n  All visible couples:\n`;
    visibleCouples.forEach(c => {
      reportText += `  - ${c}\n`;
    });

    reportText += `\n========================================================\n\n`;

    instructorResults.push({
      instructor: instructor.full_name,
      oldRulesCount,
      newRulesCount,
      diff: newRulesCount - oldRulesCount
    });
  }

  // Summary table
  reportText += `SUMMARY TABLE\n`;
  reportText += `========================================================\n`;
  reportText += `Instructor | Old Count | New Count | Difference\n`;
  reportText += `--------------------------------------------------------\n`;
  instructorResults.forEach(r => {
    reportText += `${r.instructor.padEnd(25)} | ${String(r.oldRulesCount).padStart(9)} | ${String(r.newRulesCount).padStart(9)} | +${r.diff}\n`;
  });
  reportText += `========================================================\n`;

  // Write report to scratch folder
  fs.writeFileSync('scratch/audit_report.txt', reportText);
  console.log("Audit complete. Report written to scratch/audit_report.txt");
  
  // Also log summary to console
  console.table(instructorResults);
}

runAudit();
