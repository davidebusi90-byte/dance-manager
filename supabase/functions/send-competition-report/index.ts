import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
    competitionId: string;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { competitionId } = await req.json() as ReportRequest;

        if (!competitionId) {
            throw new Error("Missing competitionId");
        }

        // 1. Fetch Competition Details
        const { data: competition, error: compError } = await supabase
            .from("competitions")
            .select("*")
            .eq("id", competitionId)
            .single();

        if (compError || !competition) throw new Error("Competition not found");

        // 2. Fetch Entries
        const { data: entries, error: entriesError } = await supabase
            .from("competition_entries")
            .select(`
        *,
        couples (
          id,
          category,
          class,
          athlete1:athletes!couples_athlete1_id_fkey (id, first_name, last_name, responsabili),
          athlete2:athletes!couples_athlete2_id_fkey (id, first_name, last_name, responsabili),
          instructor:profiles!couples_instructor_id_fkey (id, email, full_name)
        )
      `)
            .eq("competition_id", competitionId);

        if (entriesError) throw entriesError;

        // 3. Fetch All Active Couples (to find missing)
        const { data: allCouples, error: couplesError } = await supabase
            .from("couples")
            .select(`
        id,
        category,
        class,
        is_active,
        athlete1:athletes!couples_athlete1_id_fkey (id, first_name, last_name, responsabili),
        athlete2:athletes!couples_athlete2_id_fkey (id, first_name, last_name, responsabili),
        instructor:profiles!couples_instructor_id_fkey (id, email, full_name)
      `)
            .eq("is_active", true);

        if (couplesError) throw couplesError;

        // 4. Fetch All Profiles (to map responsibility names to emails)
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("full_name, email");

        if (profilesError) throw profilesError;

        // --- Processing Data ---

        const deadline = competition.late_fee_deadline ? new Date(competition.late_fee_deadline) : null;
        const isLate = (dateStr: string) => deadline && new Date(dateStr) > deadline;

        // Categories
        const paidEntries = entries.filter(e => e.is_paid);
        const confirmedUnpaidEntries = entries.filter(e => !e.is_paid && !isLate(e.created_at));
        const lateUnpaidEntries = entries.filter(e => !e.is_paid && isLate(e.created_at));

        // Identify Missing Couples
        const registeredCoupleIds = new Set(entries.map(e => e.couple_id));
        const missingCouples = allCouples.filter(c => !registeredCoupleIds.has(c.id));

        // --- Collect Emails ---
        const emailSet = new Set<string>();

        // Helper to add emails from couple
        const addEmailsForCouple = (couple: any) => {
            // Direct instructor
            if (couple.instructor?.email) {
                emailSet.add(couple.instructor.email);
            }

            // Mapped responsabili
            const addRespEmail = (responsabili: string[] | null) => {
                if (!responsabili) return;
                responsabili.forEach(name => {
                    const profile = profiles.find(p => p.full_name.toLowerCase().trim() === name.toLowerCase().trim());
                    if (profile?.email) {
                        emailSet.add(profile.email);
                    }
                });
            };

            addRespEmail(couple.athlete1?.responsabili);
            addRespEmail(couple.athlete2?.responsabili);
        };

        // Add emails for ALL involved couples (registered + missing)
        // entries.forEach(e => addEmailsForCouple(e.couples));
        // missingCouples.forEach(c => addEmailsForCouple(c));

        // OR should we send to ALL instructors regardless? 
        // Usually "mandare una mail ai vari responsabili delle coppie iscritte" implies only those registered?
        // BUT "tutte le coppie che potevano partecipare ma non hanno svolto..." implies we might want to notify them too?
        // Let's include everyone relevant to the lists.
        [...entries.map(e => e.couples), ...missingCouples].forEach(c => {
            if (c) addEmailsForCouple(c);
        });

        const recipients = Array.from(emailSet);

        if (recipients.length === 0) {
            return new Response(JSON.stringify({ message: "No recipients found / Report generated but no emails sent." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // --- Generate HTML Report ---

        const tableStyle = "border-collapse: collapse; width: 100%; margin-bottom: 20px;";
        const thStyle = "border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;";
        const tdStyle = "border: 1px solid #ddd; padding: 8px;";
        const h2Style = "color: #333; border-bottom: 2px solid #333; padding-bottom: 5px;";

        const generateTable = (title: string, data: any[], isEntry: boolean) => {
            if (data.length === 0) return `<p>Nessuna coppia in questa categoria.</p>`;

            const rows = data.map(item => {
                const c = isEntry ? item.couples : item;
                const a1 = c.athlete1 ? `${c.athlete1.first_name} ${c.athlete1.last_name}` : "N/A";
                const a2 = c.athlete2 ? `${c.athlete2.first_name} ${c.athlete2.last_name}` : "N/A";
                return `
          <tr>
            <td style="${tdStyle}">${a1} / ${a2}</td>
            <td style="${tdStyle}">${c.category} - ${c.class}</td>
          </tr>
        `;
            }).join("");

            return `
        <h2 style="${h2Style}">${title} (${data.length})</h2>
        <table style="${tableStyle}">
          <thead>
            <tr>
              <th style="${thStyle}">Coppia</th>
              <th style="${thStyle}">Categoria</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
        };

        const htmlContent = `
      <h1>Report Competizione: ${competition.name}</h1>
      <p>Data: ${new Date(competition.date).toLocaleDateString("it-IT")}</p>
      
      ${generateTable("CONFERMATI E PAGATI", paidEntries, true)}
      ${generateTable("CONFERMATI (DA PAGARE)", confirmedUnpaidEntries, true)}
      ${generateTable("ISCRITTI IN RITARDO (MORA)", lateUnpaidEntries, true)}
      ${generateTable("NON ISCRITTI (MANCANTI)", missingCouples, false)}
    `;

        // --- Send Email ---

        if (!RESEND_API_KEY) {
            console.log("RESEND_API_KEY not set. Simulate sending.");
            console.log("Recipients:", recipients);
            return new Response(JSON.stringify({ success: true, message: "Simulated sending (No API Key)" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Dance Manager <info@antigravity.it>", // Replace with valid sender
                to: ["info@antigravity.it"], // Safety: send to admin/me, bcc others? Or just send to recipients.
                bcc: recipients,
                subject: `Report Iscrizioni: ${competition.name}`,
                html: htmlContent,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(JSON.stringify(data));
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
