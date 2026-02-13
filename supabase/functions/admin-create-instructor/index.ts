import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
    email: string;
    password: string;
    full_name: string;
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const authHeader = req.headers.get("Authorization") ?? "";
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Check if the requester is logged in
        const {
            data: { user: requester },
            error: userError,
        } = await userClient.auth.getUser();

        if (userError || !requester) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Check if requester is admin
        const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
            _user_id: requester.id,
            _role: "admin",
        });

        if (roleError || !isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
                status: 403,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // HARDCODED SYNC LOGIC TRIGGERED BY SPECIFIC EMAIL
        if (body.email === "sync_responsibilities@system.local") {
            console.log("TRIGGERING SYNC RESPONSIBILITIES...");
            const adminClient = createClient(supabaseUrl, serviceRoleKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });

            const { data: profiles } = await adminClient.from("profiles").select("id, full_name");
            const { data: athletes } = await adminClient.from("athletes").select("id, responsabili");

            let totalLinked = 0;

            if (profiles && athletes) {
                for (const athlete of athletes) {
                    if (!athlete.responsabili || athlete.responsabili.length === 0) continue;

                    for (const respName of athlete.responsabili) {
                        // Fuzzy match logic in JS
                        const targetName = respName.toLowerCase().trim();
                        // Simple inclusion check as per SQL logic
                        const mathedProfile = profiles.find(p => p.full_name.toLowerCase().includes(targetName) || targetName.split(' ').every(part => p.full_name.toLowerCase().includes(part)));

                        if (mathedProfile) {
                            await adminClient.from("athlete_instructors").upsert({
                                athlete_id: athlete.id,
                                profile_id: mathedProfile.id
                            }, { onConflict: "athlete_id, profile_id" });
                            totalLinked++;
                        }
                    }
                }
            }

            return new Response(JSON.stringify({ message: `Sync completed. Linked ${totalLinked} entries.` }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 1. Create the user in Auth
        const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
            email: body.email,
            password: body.password,
            email_confirm: true, // Auto-confirm email
            user_metadata: { full_name: body.full_name },
        });

        if (createError) throw createError;
        if (!userData.user) throw new Error("User creation failed without error");

        const userId = userData.user.id;
        console.log(`Created user ${userId} (${body.email})`);

        // 2. Insert into profiles (if not created by trigger - but usually handle_new_user trigger does this)
        // Let's check if profile exists, if not create it, if yes update it.
        // However, typically there is a trigger on auth.users that creates a profile.
        // Use upsert to be safe and ensure full_name is set correctly.

        const { error: profileError } = await adminClient
            .from("profiles")
            .upsert({
                user_id: userId,
                full_name: body.full_name,
                email: body.email
            }, { onConflict: "user_id" });

        if (profileError) {
            // If profile creation fails, we might want to rollback user creation?
            // For now, just log and throw.
            console.error("Profile creation failed:", profileError);
            // Attempt cleanup
            await adminClient.auth.admin.deleteUser(userId);
            throw profileError;
        }

        // 3. Assign 'instructor' role
        const { error: roleAssignmentError } = await adminClient
            .from("user_roles")
            .insert({
                user_id: userId,
                role: "instructor"
            });

        if (roleAssignmentError) {
            console.error("Role assignment failed:", roleAssignmentError);
            // Attempt cleanup
            await adminClient.auth.admin.deleteUser(userId); // Cascades to profile?
            throw roleAssignmentError;
        }

        return new Response(JSON.stringify({ user: userData.user }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });

    } catch (error: any) {
        console.error("admin-create-instructor error:", error);
        return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
