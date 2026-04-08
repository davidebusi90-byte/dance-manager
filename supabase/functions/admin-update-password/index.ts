import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] admin-update-password: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(`[${requestId}] admin-update-password: Missing environment variables`);
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse body early
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${requestId}] admin-update-password: Failed to parse JSON body`);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { user_id, new_password } = body;
    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: "Missing user_id or new_password" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Auth verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn(`[${requestId}] admin-update-password: Missing Authorization header`);
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requester }, error: userError } = await userClient.auth.getUser();
    if (userError || !requester) {
      console.warn(`[${requestId}] admin-update-password: Auth error:`, userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized: " + (userError?.message || "Invalid session") }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Role verification (Admin only)
    console.log(`[${requestId}] admin-update-password: Verifying admin role for: ${requester.email}`);
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "admin",
    });

    if (roleError) {
      console.error(`[${requestId}] admin-update-password: Role check RPC error:`, roleError.message);
      return new Response(JSON.stringify({ error: "Error verifying user roles" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!isAdmin) {
      console.warn(`[${requestId}] admin-update-password: Access denied for user: ${requester.email}`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Password Update using Service Role
    console.log(`[${requestId}] admin-update-password: Updating password for target user_id: ${user_id}`);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error(`[${requestId}] admin-update-password: Admin update error:`, updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[${requestId}] admin-update-password: Password successfully updated`);
    return new Response(JSON.stringify({ success: true, message: "Password updated" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    const errorMsg = error.message || "Internal server error";
    console.error(`[${requestId}] admin-update-password: Caught error:`, errorMsg);
    return new Response(JSON.stringify({ 
      error: errorMsg,
      requestId 
    }), {
      status: error.status || 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
