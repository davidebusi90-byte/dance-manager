import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { user_id, full_name } = await req.json()

        if (!user_id || !full_name) {
            throw new Error('user_id and full_name are required')
        }

        // Update profile with service role (bypasses RLS)
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({ full_name })
            .eq('user_id', user_id)

        if (profileError) throw profileError

        // Re-link athletes
        const { error: linkError } = await supabaseClient
            .from('athletes')
            .update({ instructor_id: user_id })
            .eq('instructor', full_name)

        if (linkError) throw linkError

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
