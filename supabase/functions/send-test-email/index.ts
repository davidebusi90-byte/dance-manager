import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const { to } = await req.json();

        if (!to) {
            return new Response(JSON.stringify({ error: "Campo 'to' mancante" }), {
                status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        if (!RESEND_API_KEY) {
            return new Response(JSON.stringify({
                success: false,
                error: "RESEND_API_KEY non configurata nei Secrets di Supabase."
            }), {
                status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Dance Manager <ufficiogare@ritmodanza.net>",
                to: [to],
                subject: "✅ Test Email – Il sistema funziona!",
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2 style="color: #4f46e5;">Ottime notizie!</h2>
                        <p>Il sistema di invio email di <strong>Dance Manager</strong> è configurato correttamente.</p>
                        <p>Dominio verificato: <strong>antigravity.it</strong> ✅</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #666;">Inviata il: ${new Date().toLocaleString('it-IT')}</p>
                    </div>
                `,
            }),
        });

        const data = await res.json();

        return new Response(JSON.stringify({
            success: res.ok,
            id: data?.id,
            error: res.ok ? null : (data?.message || "Errore Resend")
        }), {
            status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
