import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOGO_BASE64 = `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`;

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
                        .logo-circle { width: 125px; height: 125px; background-color: #3f4752; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; overflow: hidden; }
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
                          
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0; padding: 0;">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td align="center" valign="middle" width="125" height="125" style="width: 125px; height: 125px; background-color: #3f4752; border-radius: 50%;">
                            <img src="https://rd-dance-manager.vercel.app/logo-white.png" alt="Dance Manager Logo" width="100" style="display: block; width: 100px; height: auto; margin: 0 auto;">
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
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
