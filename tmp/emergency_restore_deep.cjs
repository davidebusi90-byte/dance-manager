const https = require('https');

const url = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjExNzIwNjc5NDUsImV4cCI6MjA4NjA0MTg0NX0.9l9uO7h0_5-1T7y8p76m2N5w6Z9o2rY8q9K9a5j4r4M';

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
  console.log('--- DEEP SEARCH RESTORE ---');
  try {
     const logs = await req('/rest/v1/sync_logs?select=id,created_at,message&order=created_at.desc&limit=100');
     
     if (!Array.isArray(logs)) {
       console.log('Error from API:', logs);
       return;
     }

     // Find the absolutely last healthy sync log ever.
     const healthy = logs.find(l => l.message.includes('117') || l.message.includes('119'));

     if (healthy) {
       console.log(`RESTORING LOG ID: ${healthy.id} (${healthy.created_at})`);
       const trigger = `https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/import-competitors?action=trigger-resync&log_id=${healthy.id}`;
       
       https.get(trigger, { headers: { 'Authorization': `Bearer ${key}` } }, (res) => {
          console.log('Triggered. Status:', res.statusCode);
       });
     } else {
       console.log('No healthy log found at all in the last 100 entries!');
       logs.slice(0, 10).forEach(l => console.log(`${l.created_at}: ${l.message}`));
     }
  } catch (e) {
    console.log('CRITICAL ERROR:', e.message);
  }
}
restore();
