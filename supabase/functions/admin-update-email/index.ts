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
  console.log(`[${requestId}] admin-update-email: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(`[${requestId}] admin-update-email: Missing environment variables`);
      throw new Error("Missing backend configuration");
    }

    // Parse body early
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${requestId}] admin-update-email: Failed to parse JSON body`);
      throw new Error("Invalid JSON body");
    }

    const { user_id, new_email } = body;
    if (!user_id || !new_email) {
      throw new Error("Missing user_id or new_email");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      throw new Error("Invalid email format");
    }

    // Auth verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error(`[${requestId}] admin-update-email: Missing Authorization header`);
      throw new Error("No authorization header provided");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requester }, error: userError } = await userClient.auth.getUser();
    if (userError || !requester) {
      console.error(`[${requestId}] admin-update-email: Auth error:`, userError?.message);
      throw new Error("Unauthorized: " + (userError?.message || "Invalid session"));
    }

    // Role verification (Admin only)
    console.log(`[${requestId}] admin-update-email: Verifying admin role for: ${requester.email}`);
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "admin",
    });

    if (roleError) {
      console.error(`[${requestId}] admin-update-email: Role check RPC error:`, roleError.message);
      throw new Error("Error verifying user roles");
    }

    if (!isAdmin) {
      console.warn(`[${requestId}] admin-update-email: Access denied for user: ${requester.email}`);
      throw new Error("Forbidden: Admin role required");
    }

    // Email Update using Service Role
    console.log(`[${requestId}] admin-update-email: Updating email for target user_id: ${user_id}`);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      email: new_email,
      email_confirm: true,
      user_metadata: { email: new_email }
    });

    if (updateError) {
      console.error(`[${requestId}] admin-update-email: Admin update error:`, updateError.message);
      throw updateError;
    }

    // Also update profile email if it exists there
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ email: new_email })
      .eq("user_id", user_id);

    if (profileError) {
      console.warn(`[${requestId}] admin-update-email: Could not update profile email:`, profileError);
    }

    console.log(`[${requestId}] admin-update-email: Email successfully updated`);
    return new Response(JSON.stringify({ success: true, message: "Email updated" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    const errorMsg = error.message || "Internal server error";
    console.error(`[${requestId}] admin-update-email: Caught error:`, errorMsg);
    return new Response(JSON.stringify({ 
      error: errorMsg,
      requestId 
    }), {
      status: error.status || 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
