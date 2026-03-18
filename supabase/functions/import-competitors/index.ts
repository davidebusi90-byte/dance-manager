import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map for best class order (Aligned with src/lib/class-utils.ts)
const CLASS_ORDER: Record<string, number> = {
    "MASTER": 0,
    "AS": 1,
    "A": 2,
    "A1": 3,
    "A2": 4,
    "B": 5,
    "B1": 5,
    "B2": 6,
    "B3": 7,
    "C": 9,
    "D": 12,
    "S": 13,
};

const getBestClass = (class1: string, class2: string): string => {
    if (!class1) return class2 || "D";
    if (!class2) return class1 || "D";
    const ord1 = CLASS_ORDER[class1.toUpperCase()] || 99;
    const ord2 = CLASS_ORDER[class2.toUpperCase()] || 99;
    return ord1 <= ord2 ? class1 : class2;
};

// Expected payload structure
type AthleteData = {
    code: string;
    first_name: string;
    last_name: string;
    birth_date?: string; // YYYY-MM-DD
    gender?: string;
    email?: string;
    phone?: string;
    category: string;
    class?: string; // Optional in payload, derived if missing
    medical_certificate_expiry?: string; // YYYY-MM-DD
    notes?: string;
    // Flat fields instead of arrays
    resp1?: string;
    resp2?: string;
    resp3?: string;
    resp4?: string;
    disc1?: string;
    class1?: string;
    disc2?: string;
    class2?: string;
    disc3?: string;
    class3?: string;
    disc4?: string;
    class4?: string;
    disc5?: string;
    class5?: string;
    disc6?: string;
    class6?: string;
    partner_code?: string;
    qr_code?: string;
};

type Body = {
    athletes: AthleteData[];
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const expectedApiKey = Deno.env.get("IMPORT_API_KEY");
        if (expectedApiKey) {
            const requestApiKey = req.headers.get("x-api-key") || req.headers.get("X-Api-Key");
            if (requestApiKey !== expectedApiKey) {
                return new Response(JSON.stringify({ error: "Unauthorized: Invalid API Key" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                });
            }
        }

        if (req.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
                status: 405,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const body = (await req.json()) as Body;

        if (!body || !body.athletes || !Array.isArray(body.athletes)) {
            return new Response(JSON.stringify({ error: "Invalid payload format. Expected { athletes: [...] }" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const results = {
            successful: 0,
            failed: 0,
            couples_synced: 0,
            errors: [] as any[],
        };

        // 1. Process Athletes
        for (const athlete of body.athletes) {
            if (!athlete.code || !athlete.first_name || !athlete.last_name || !athlete.category) {
                results.failed++;
                results.errors.push({ code: athlete.code, error: "Missing required fields (code, first_name, last_name, category)" });
                continue;
            }

            // Collect disciplines first to derive class if missing
            const disciplinesForAthlete: { discipline: string; class: string }[] = [];
            const disciplineInfo: Record<string, string> = {};
            for (let i = 1; i <= 6; i++) {
                const disc = (athlete as any)[`disc${i}`] || (athlete as any)[`Disc${i}`];
                const cls = (athlete as any)[`class${i}`] || (athlete as any)[`Class${i}`];
                if (disc && cls) {
                    disciplinesForAthlete.push({ discipline: disc, class: cls });
                    
                    const discName = disc.toLowerCase();
                    let key = discName;
                    if (discName.includes("latino")) key = "latino";
                    else if (discName.includes("standard")) key = "standard";
                    else if (discName.includes("combinata")) key = "combinata";
                    
                    disciplineInfo[key] = disciplineInfo[key] ? getBestClass(disciplineInfo[key], cls.toUpperCase()) : cls.toUpperCase();
                }
            }

            let derivedClass = athlete.class;
            if (!derivedClass && disciplinesForAthlete.length > 0) {
                derivedClass = disciplinesForAthlete.reduce((best, curr) => getBestClass(best, curr.class), disciplinesForAthlete[0].class);
            }
            if (!derivedClass) derivedClass = "D"; // Default fallback

            // Collect responsabili from flat fields
            const responsabili = [athlete.resp1, athlete.resp2, athlete.resp3, athlete.resp4]
                .filter(r => r && r.trim() !== "");

            const { error } = await adminClient
                .from("athletes")
                .upsert({
                    code: athlete.code,
                    first_name: athlete.first_name,
                    last_name: athlete.last_name,
                    birth_date: athlete.birth_date || null,
                    gender: (athlete.gender || "M").toUpperCase(),
                    email: athlete.email || null,
                    phone: athlete.phone || null,
                    category: athlete.category,
                    class: derivedClass.toUpperCase(),
                    discipline_info: disciplineInfo,
                    medical_certificate_expiry: athlete.medical_certificate_expiry || null,
                    responsabili: responsabili.length > 0 ? responsabili : null,
                    notes: athlete.notes || null,
                    qr_code: athlete.qr_code || null,
                }, { onConflict: "code" });

            if (error) {
                results.failed++;
                results.errors.push({ code: athlete.code, error: error.message });
            } else {
                results.successful++;
            }
        }

        // 2. Map Couples (logic simplified to match Excel/Frontend structure)
        const activeAthletesMap = new Map<string, string>();
        const { data: athletes } = await adminClient.from("athletes").select("id, code");
        athletes?.forEach(a => activeAthletesMap.set(a.code, a.id));

        const couplesToUpsert: any[] = [];
        const processedPairs = new Set<string>();

        for (const athlete of body.athletes) {
            if (!athlete.partner_code || athlete.partner_code === athlete.code) continue;
            
            const a1Id = activeAthletesMap.get(athlete.code);
            const a2Id = activeAthletesMap.get(athlete.partner_code);
            if (!a1Id || !a2Id) continue;

            const pairKey = [athlete.code, athlete.partner_code].sort().join("-");
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);

            // Collect disciplines from flat fields (up to 6)
            const disciplines: { discipline: string; class: string }[] = [];
            for (let i = 1; i <= 6; i++) {
                const disc = (athlete as any)[`disc${i}`] || (athlete as any)[`Disc${i}`];
                const cls = (athlete as any)[`class${i}`] || (athlete as any)[`Class${i}`];
                if (disc && cls) {
                    disciplines.push({ discipline: disc, class: cls });
                }
            }

            const disciplineInfo: Record<string, string> = {};
            let bestClass = "D";

            const uniqueDiscs = new Set<string>();
            disciplines.forEach(d => {
                const discName = d.discipline.toLowerCase();
                let key = discName;
                if (discName.includes("latino")) key = "latino";
                else if (discName.includes("standard")) key = "standard";
                else if (discName.includes("combinata")) key = "combinata";
                else if (discName.includes("show")) {
                    if (discName.includes("south american")) key = "show_dance_sa";
                    else if (discName.includes("classic")) key = "show_dance_classic";
                    else key = "show_dance";
                }

                const cls = d.class.toUpperCase();
                disciplineInfo[key] = disciplineInfo[key] ? getBestClass(disciplineInfo[key], cls) : cls;
                bestClass = getBestClass(bestClass, cls);
                
                // Add to standard categories if matched
                if (["latino", "standard", "combinata", "show_dance"].includes(key.replace(/_sa|_classic/, ""))) {
                    uniqueDiscs.add(key.replace(/_sa|_classic/, ""));
                }
            });

            couplesToUpsert.push({
                athlete1_id: a1Id,
                athlete2_id: a2Id,
                category: athlete.category || "Senza categoria",
                class: bestClass,
                disciplines: Array.from(uniqueDiscs),
                discipline_info: disciplineInfo,
                is_active: true,
            });
        }

        if (couplesToUpsert.length > 0) {
            const { error: couplesError } = await adminClient
                .from("couples")
                .upsert(couplesToUpsert, { onConflict: "athlete1_id,athlete2_id" });
            
            if (!couplesError) results.couples_synced = couplesToUpsert.length;
            else console.error("Couples upsert error:", couplesError);
        }

        // 3. Log Sync Result for Real-time Notification (Inserted after processing completes)
        try {
            const { failed: logFailed, successful: logSuccess, couples_synced: logCouples } = results;
            const syncMessage = `Sincronizzazione completata: ${logSuccess} atleti, ${logCouples} coppie.`;
            
            await adminClient
                .from("sync_logs")
                .insert({
                    status: (logFailed && logFailed > 0) ? "warning" : "success",
                    message: syncMessage,
                    results: results
                });
        } catch (logErr) {
            console.error("Error logging sync result:", logErr);
        }

        return new Response(JSON.stringify({
            message: "Import process completed.",
            results
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });

    } catch (error: unknown) {
        console.error("import-competitors error:", error);
        return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
