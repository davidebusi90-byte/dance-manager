import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
    user_id: string;
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const authHeader = req.headers.get("Authorization") ?? "";
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const {
            data: { user },
            error: userError,
        } = await userClient.auth.getUser();

        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Role check
        const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
        });

        if (roleError || !isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const body = (await req.json()) as Body;
        if (!body?.user_id) {
            return new Response(JSON.stringify({ error: "Missing user_id" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 1. Find profile ID
        const { data: profile, error: profileFetchError } = await adminClient
            .from("profiles")
            .select("id, full_name")
            .eq("user_id", body.user_id)
            .single();

        if (profileFetchError) {
            console.warn("Profile not found or already deleted:", profileFetchError);
        }

        if (profile) {
            // 2. Nullify references in related tables
            console.log(`Clearing instructor references for profile ${profile.id} (${profile.full_name})`);

            // Remove from athlete_instructors
            const { error: aiError } = await adminClient
                .from("athlete_instructors")
                .delete()
                .eq("profile_id", profile.id);

            if (aiError) console.error("Error deleting athlete_instructors:", aiError);

            // Nullify instructor_id in athletes
            const { error: athleteUpdateError } = await adminClient
                .from("athletes")
                .update({ instructor_id: null })
                .eq("instructor_id", profile.id);

            if (athleteUpdateError) console.error("Error updating athletes instructor_id:", athleteUpdateError);

            // Nullify instructor_id in couples
            const { error: coupleUpdateError } = await adminClient
                .from("couples")
                .update({ instructor_id: null })
                .eq("instructor_id", profile.id);

            if (coupleUpdateError) console.error("Error updating couples instructor_id:", coupleUpdateError);

            // NEW: Remove name from responsabili array in athletes
            if (profile.full_name) {
                console.log(`Removing '${profile.full_name}' from responsabili arrays...`);
                // Using Postgres array_remove to remove the name from the text array
                // We need to use .rpc or raw query if possible, but supabase-js update doesn't support complex logic easily.
                // However, we can use a raw RPC or just fetch and update. 
                // Since this is "aggressive" and possibly many rows, a raw query is best. 
                // But we define this function in Deno. We can't easily run raw SQL string unless we have an RPC for it.
                // Alternatively, we can assume the dataset is manageable or use a specific RPC if we had one.
                // Wait, we are in a Supabase Edge Function. We can use the adminClient to call an RPC or...
                // Actually, `adminClient` is just a supabase-js client.

                // Workaround: We can't do `responsabili = array_remove(responsabili, ...)` directly in .update() with current JS SDK easily without rpc.
                // Let's try to fetch athletes who have this name in responsabili and update them.

                const { data: athletesWithResp, error: fetchRespError } = await adminClient
                    .from("athletes")
                    .select("id, responsabili")
                    .contains("responsabili", [profile.full_name]); // .contains works for array match? Yes for json/array cols.

                if (!fetchRespError && athletesWithResp && athletesWithResp.length > 0) {
                    console.log(`Found ${athletesWithResp.length} athletes with this responsible person.`);
                    for (const athlete of athletesWithResp) {
                        const newResp = (athlete.responsabili || []).filter((r: string) => r !== profile.full_name);
                        await adminClient
                            .from("athletes")
                            .update({ responsabili: newResp })
                            .eq("id", athlete.id);
                    }
                }
            }

            // NEW: Explicitly delete profile
            const { error: profileDeleteError } = await adminClient
                .from("profiles")
                .delete()
                .eq("id", profile.id);

            if (profileDeleteError) {
                console.error("Error deleting profile:", profileDeleteError);
                // If profile delete fails, we might still want to try deleting auth user, or throw?
                // If it fails due to existing FKs we missed, auth delete will likely fail too.
            }
        }

        // 3. Delete from auth.users (cascades to profiles and user_roles usually, but we did explicit profile delete above)
        console.log(`Deleting auth user ${body.user_id}`);
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.user_id);

        // If deleteError happens (e.g. user not found), we should still return ok if profile was deleted? 
        // Or propagate error. User wants "aggressive".
        if (deleteError) {
            console.error("Error deleting auth user:", deleteError);
            return new Response(JSON.stringify({ error: deleteError.message, ok: false }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    } catch (error: any) {
        console.error("admin-delete-user error:", error);
        return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
