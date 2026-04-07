import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  user_id: string;
  full_name: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] admin-update-instructor: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(`[${requestId}] admin-update-instructor: Missing environment variables`);
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
      console.warn(`[${requestId}] admin-update-instructor: Unauthorized access attempt`);
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
      console.warn(`[${requestId}] admin-update-instructor: Forbidden access by user ${requester.id}`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.user_id || !body?.full_name) {
       throw new Error("user_id and full_name are required");
    }
    
    console.log(`[${requestId}] admin-update-instructor: Updating user ${body.user_id} to ${body.full_name}`);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Update Profile (Bypasses RLS)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ full_name: body.full_name })
      .eq("user_id", body.user_id);

    if (profileError) {
      console.error(`[${requestId}] admin-update-instructor: Profile update failed:`, profileError);
      throw profileError;
    }

    // 2. Identify and re-link athletes by name if necessary
    // This logic seems a bit legacy but we keep it for consistency.
    // Usually linking should be done by profile_id in athlete_instructors.
    const { error: linkError } = await adminClient
      .from("athletes")
      .update({ instructor_id: body.user_id })
      .eq("instructor", body.full_name);

    if (linkError) {
      console.warn(`[${requestId}] admin-update-instructor: Athlete re-linking warning:`, linkError);
    }

    // 3. Update User Metadata in Auth
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(body.user_id, {
      user_metadata: { full_name: body.full_name }
    });
    
    if (authUpdateError) {
      console.warn(`[${requestId}] admin-update-instructor: Auth metadata update warning:`, authUpdateError);
    }

    console.log(`[${requestId}] admin-update-instructor: Successfully updated ${body.user_id}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[${requestId}] admin-update-instructor: Global error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
