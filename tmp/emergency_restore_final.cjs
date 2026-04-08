const https = require('https');

const url = 'https://kymoxuucjfgotjlhkfua.supabase.co';
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
  console.log('--- EMERGENCY RESTORE V2 ---');
  try {
     const logs = await req('/rest/v1/sync_logs?select=id,created_at,message,results&order=created_at.desc&limit=50');
     
     if (!Array.isArray(logs)) {
       console.log('Error from API:', logs);
       return;
     }

     // Look for 19:21 sync or similar (approx 17:21 UTC)
     const healthy = logs.find(l => {
       const hasData = l.message.includes('117') || l.message.includes('119');
       const time = new Date(l.created_at);
       // 19:00 local is 17:00 UTC. So we look for anything before 18:30 UTC
       return hasData && time.getUTCHours() <= 17;
     });

     if (healthy) {
       console.log(`RESTORING LOG ID: ${healthy.id} (${healthy.created_at})`);
       const trigger = `https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/import-competitors?action=trigger-resync&log_id=${healthy.id}`;
       
       https.get(trigger, { headers: { 'Authorization': `Bearer ${key}` } }, (res) => {
          console.log('Triggered. Status:', res.statusCode);
       });
     } else {
       console.log('No healthy log found before my error.');
       logs.slice(0, 10).forEach(l => console.log(`${l.created_at}: ${l.message}`));
     }
  } catch (e) {
    console.log('CRITICAL ERROR:', e.message);
  }
}
restore();
