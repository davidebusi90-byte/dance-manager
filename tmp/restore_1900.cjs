const fetch = require('node-fetch');

const url = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc';

const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`
};

async function restore() {
  console.log('--- RECENT LOGS ---');
  const r = await fetch(`${url}/rest/v1/sync_logs?select=id,created_at,message&order=created_at.desc&limit=20`, { headers });
  const logs = await r.json();
  
  logs.forEach(l => console.log(`${l.id} | ${l.created_at} | ${l.message}`));
  
  // Target: One before 17:30 UTC
  const target = logs.find(l => {
    const time = new Date(l.created_at);
    // 19:00 Local is approx 17:00 UTC
    return time.getUTCHours() <= 17 && (l.message.includes('119') || l.message.includes('117'));
  });
  
  if (target) {
    console.log(`\nFOUND TARGET ID: ${target.id} (${target.created_at})`);
    const resyncUrl = `${url}/functions/v1/import-competitors?action=trigger-resync&log_id=${target.id}`;
    const r2 = await fetch(resyncUrl, { headers });
    const text = await r2.text();
    console.log('RESTORATION RESULT:', text);
  } else {
     console.log('\nNO VALID 19:00 LOG FOUND!');
  }
}

restore();
