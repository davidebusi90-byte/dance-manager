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
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const { to } = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: "Campo 'to' mancante" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: "BREVO_API_KEY non configurata nei Secrets di Supabase."
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Dance Manager", email: "ufficiogare@ritmodanza.net" },
        to: [{ email: to }],
        subject: "Anteprima Grafica - Dance Manager",
        htmlContent: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <style>
                        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #4a5568; margin: 0; padding: 0; background-color: #f7fafc; }
                        .container { max-width: 600px; margin: 30px auto; padding: 0; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                        .header { background-color: #2c333d; padding: 40px 20px; text-align: center; color: #ffffff; }
                        .logo-circle { width: 80px; height: 80px; background-color: #3f4752; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                        .header-title { font-size: 32px; font-weight: 700; margin: 0 0 10px 0; color: #ffffff; }
                        .header-subtitle { font-size: 14px; color: #cbd5e0; margin: 0; }
                        .header-subtitle a { color: #ffffff; text-decoration: underline; }
                        .content { padding: 40px; }
                        .welcome-text { font-size: 18px; color: #2d3748; margin-bottom: 25px; }
                        .comp-card { margin-bottom: 20px; padding: 20px; background-color: #fffaf0; border-left: 5px solid #fbd38d; border-radius: 8px; }
                        .notice-box { background-color: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 12px; margin: 30px 0; }
                        .notice-title { margin: 0 0 10px 0; color: #c53030; font-size: 16px; font-weight: 700; }
                        .blog-link { display: inline-block; margin-top: 20px; color: #5a67d8; text-decoration: none; font-weight: 600; font-size: 14px; }
                        .footer { font-size: 12px; color: #a0aec0; text-align: center; padding: 30px; background-color: #edf2f7; }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <div class="header">
                          <div class="logo-circle">
                            <img src="https://rd-dance-manager.vercel.app/logo.png" alt="Dance Manager Logo" style="width: 50px; height: auto;">
                          </div>
                          <h1 class="header-title">Iscrizione Gara</h1>
                          <p class="header-subtitle">
                            Per qualsiasi anomalia contattare <a href="mailto:ufficiogare@ritmodanza.net">ufficiogare@ritmodanza.net</a>
                          </p>
                        </div>
                        
                        <div class="content">
                          <p class="welcome-text">Gentili <strong>Mario Rossi / Anna Bianchi</strong>,</p>
                          <p>Questa è un'anteprima del nuovo design in toni pastello:</p>
                          
                          <div class="comp-card">
                            <p style="margin: 0; font-weight: 600; color: #744210;">Campionato Regionale 2026</p>
                            <p style="margin: 5px 0 0 0; color: #975a16; font-size: 14px;">Gare: 19/34 anni B1 Danze Standard, Combinata 10 Danze</p>
                          </div>

                          <div class="notice-box">
                            <p class="notice-title">Azione richiesta per la conferma</p>
                            <p style="margin: 0; font-size: 14px; color: #9b2c2c;">
                              L'iscrizione sarà definitiva solo dopo aver consegnato la quota <strong>in buchetta</strong> presso la segreteria.
                            </p>
                          </div>

                          <a href="https://ritmodanza.net/index.php/category-blog" class="blog-link">Visita il nostro Blog →</a>
                        </div>
                        
                        <div class="footer">
                          <p>&copy; ${new Date().getFullYear()} Ritmo Danza - Dance Manager System</p>
                        </div>
                      </div>
                    </body>
                    </html>
                `,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({
      success: res.ok,
      id: data?.messageId,
      error: res.ok ? null : (data?.message || "Errore Brevo")
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
