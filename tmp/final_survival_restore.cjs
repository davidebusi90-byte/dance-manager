const https = require('https');

const url = 'https://kymoxuucjfgotjlhkfua.supabase.co';
// CORRECT KEY FROM .ENV (Line 2)
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc';

function req(path) {
  return new Promise((resolve, reject) => {
    https.get(`${url}${path}`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function restore() {
  console.log('--- THE FINAL SURVIVAL RESTORE ---');
  try {
     const logs = await req('/rest/v1/sync_logs?select=id,created_at,message&order=created_at.desc&limit=100');
     
     if (!Array.isArray(logs)) {
       console.log('Error from API:', logs);
       return;
     }

     const healthy = logs.find(l => l.message.includes('117') || l.message.includes('119'));

     if (healthy) {
       console.log(`RESTORING LOG ID: ${healthy.id} from ${healthy.created_at}`);
       const trigger = `https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/import-competitors?action=trigger-resync&log_id=${healthy.id}`;
       // Note: trigger-resync might need GET or POST? I'll try both.
       https.get(trigger, { headers: { 'Authorization': `Bearer ${key}` } }, (res) => {
          console.log('Triggered 1 (GET). Status:', res.statusCode);
       });
       
       const postOptions = {
         hostname: 'kymoxuucjfgotjlhkfua.supabase.co',
         path: `/functions/v1/import-competitors?action=trigger-resync&log_id=${healthy.id}`,
         method: 'POST',
         headers: { 'Authorization': `Bearer ${key}` }
       };
       const postReq = https.request(postOptions, (res) => {
          console.log('Triggered 2 (POST). Status:', res.statusCode);
       });
       postReq.end();

     } else {
       console.log('No healthy log found.');
       logs.slice(0, 10).forEach(l => console.log(`${l.created_at}: ${l.message}`));
     }
  } catch (e) {
    console.log('CRITICAL ERROR:', e.message);
  }
}
restore();
