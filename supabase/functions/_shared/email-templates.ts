/**
 * Template per l'email di conferma iscrizione gara.
 */
export function getEnrollmentConfirmationHtml(coupleName: string, competitionsHtml: string): string {
  const currentYear = new Date().getFullYear();
  
  return `
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
    .comp-title { margin: 0 0 10px 0; color: #744210; font-size: 17px; font-weight: 600; }
    .comp-details { margin: 0; color: #975a16; font-size: 14px; }
    .notice-box { background-color: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 12px; margin: 30px 0; }
    .notice-title { margin: 0 0 10px 0; color: #c53030; font-size: 16px; font-weight: 700; }
    .notice-text { margin: 0; font-size: 14px; color: #9b2c2c; }
    .blog-link { display: inline-block; margin-top: 20px; color: #5a67d8; text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { font-size: 12px; color: #a0aec0; text-align: center; padding: 30px; background-color: #edf2f7; }
    .highlight { color: #e53e3e; font-weight: bold; }
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
      <p class="welcome-text">Gentili <strong>${coupleName}</strong>,</p>
      <p>La vostra iscrizione è stata registrata correttamente. Ecco il riepilogo delle attività:</p>
      
      ${competitionsHtml}

      <div class="notice-box">
        <p class="notice-title">Azione richiesta per la conferma</p>
        <p class="notice-text">
          L'iscrizione sarà considerata <span class="highlight">definitiva</span> solo dopo aver 
          effettuato il pagamento della quota <strong>in buchetta</strong> presso la segreteria.
        </p>
      </div>

      <a href="https://ritmodanza.net/index.php/category-blog" class="blog-link">Visita il nostro Blog →</a>
    </div>
    
    <div class="footer">
      <p>&copy; ${currentYear} Ritmo Danza - Dance Manager System</p>
      <p>Messaggio automatico generato dal sistema di gestione.</p>
    </div>
  </div>
</body>
</html>
  `;
}
