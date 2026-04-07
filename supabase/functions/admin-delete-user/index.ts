import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  user_id: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] admin-delete-user: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(`[${requestId}] admin-delete-user: Missing environment variables`);
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Verify Requester
    const { data: { user: requester }, error: userError } = await userClient.auth.getUser();
    if (userError || !requester) {
      console.warn(`[${requestId}] admin-delete-user: Unauthorized access attempt`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Verify Admin Role
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      console.warn(`[${requestId}] admin-delete-user: Forbidden access by user ${requester.id}`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.user_id) throw new Error("Missing user_id in request body");
    
    console.log(`[${requestId}] admin-delete-user: Deleting user ${body.user_id}`);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find profile ID and Name
    const { data: profile, error: profileFetchError } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", body.user_id)
      .maybeSingle();

    if (profileFetchError) {
      console.error(`[${requestId}] admin-delete-user: Error fetching profile:`, profileFetchError);
    }

    if (profile) {
      console.log(`[${requestId}] admin-delete-user: Cleaning up references for profile ${profile.id} (${profile.full_name})`);

      // Parallel cleanup of referencing tables
      const cleanupTasks = [
        adminClient.from("athlete_instructors").delete().eq("profile_id", profile.id),
        adminClient.from("athletes").update({ instructor_id: null }).eq("instructor_id", profile.id),
        adminClient.from("couples").update({ instructor_id: null }).eq("instructor_id", profile.id)
      ];

      const cleanupResults = await Promise.all(cleanupTasks);
      cleanupResults.forEach((res, idx) => {
        if (res.error) console.error(`[${requestId}] admin-delete-user: Cleanup task ${idx} failed:`, res.error);
      });

      // Special cleanup: Responsabili array in athletes
      if (profile.full_name) {
        console.log(`[${requestId}] admin-delete-user: Removing '${profile.full_name}' from responsabili arrays`);
        const { data: athletesWithResp } = await adminClient
          .from("athletes")
          .select("id, responsabili")
          .contains("responsabili", [profile.full_name]);

        if (athletesWithResp?.length) {
          console.log(`[${requestId}] admin-delete-user: Found ${athletesWithResp.length} athletes to update`);
          for (const athlete of athletesWithResp) {
            const newResp = (athlete.responsabili || []).filter((r: string) => r !== profile.full_name);
            await adminClient.from("athletes").update({ responsabili: newResp }).eq("id", athlete.id);
          }
        }
      }

      // Explicitly delete profile
      const { error: pdError } = await adminClient.from("profiles").delete().eq("id", profile.id);
      if (pdError) console.error(`[${requestId}] admin-delete-user: Profile delete failed:`, pdError);
    }

    // 2. Delete from Auth
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.user_id);
    if (deleteError) {
      console.error(`[${requestId}] admin-delete-user: Auth user delete failed:`, deleteError);
      // Even if user is not found, we might have cleaned up the profile.
      if (deleteError.status !== 404) throw deleteError;
    }

    console.log(`[${requestId}] admin-delete-user: Successfully deleted user ${body.user_id}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[${requestId}] admin-delete-user: Global error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
