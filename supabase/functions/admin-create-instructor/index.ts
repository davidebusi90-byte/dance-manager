import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  email: string;
  password: string;
  full_name: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] admin-create-instructor: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(`[${requestId}] admin-create-instructor: Missing environment variables`);
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
      console.warn(`[${requestId}] admin-create-instructor: Unauthorized access attempt`);
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
      console.warn(`[${requestId}] admin-create-instructor: Forbidden access by user ${requester.id}`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as Body;
    console.log(`[${requestId}] admin-create-instructor: Creating instructor ${body.email} (${body.full_name})`);

    // Special Case: Sync Responsibilities (Legacy Support)
    if (body.email === "sync_responsibilities@system.local") {
       return await handleSync(supabaseUrl, serviceRoleKey, requestId);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create the user in Auth
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });

    if (createError) {
      console.error(`[${requestId}] admin-create-instructor: Auth creation failed:`, createError);
      throw createError;
    }
    
    if (!userData.user) throw new Error("User creation failed without error");

    const userId = userData.user.id;
    console.log(`[${requestId}] admin-create-instructor: Created Auth user ${userId}`);

    // 2. Upsert Profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        user_id: userId,
        full_name: body.full_name,
        email: body.email
      }, { onConflict: "user_id" });

    if (profileError) {
      console.error(`[${requestId}] admin-create-instructor: Profile creation failed:`, profileError);
      await adminClient.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // 3. Assign Instructor Role
    const { error: roleAssignmentError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "instructor"
      });

    if (roleAssignmentError) {
      console.error(`[${requestId}] admin-create-instructor: Role assignment failed:`, roleAssignmentError);
      await adminClient.auth.admin.deleteUser(userId);
      throw roleAssignmentError;
    }

    console.log(`[${requestId}] admin-create-instructor: Success for ${body.email}`);
    return new Response(JSON.stringify({ user: userData.user }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[${requestId}] admin-create-instructor: Global error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function handleSync(supabaseUrl: string, serviceRoleKey: string, requestId: string) {
  console.log(`[${requestId}] admin-create-instructor: Starting SYNC process...`);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles } = await adminClient.from("profiles").select("id, full_name");
  const { data: athletes } = await adminClient.from("athletes").select("id, responsabili");

  let totalLinked = 0;
  if (profiles && athletes) {
    for (const athlete of athletes) {
      if (!athlete.responsabili?.length) continue;
      for (const respName of athlete.responsabili) {
        const target = respName.toLowerCase().trim();
        const match = profiles.find(p => 
            p.full_name.toLowerCase().includes(target) || 
            target.split(' ').every(part => p.full_name.toLowerCase().includes(part))
        );
        if (match) {
          await adminClient.from("athlete_instructors").upsert({
            athlete_id: athlete.id,
            profile_id: match.id
          }, { onConflict: "athlete_id, profile_id" });
          totalLinked++;
        }
      }
    }
  }

  console.log(`[${requestId}] admin-create-instructor: SYNC completed. ${totalLinked} entries.`);
  return new Response(JSON.stringify({ message: `Sync completed. Linked ${totalLinked} entries.` }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
