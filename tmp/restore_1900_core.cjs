const https = require('https');

const url = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjExNzIwNjc5NDUsImV4cCI6MjA4NjA0MTg0NX0.9l9uO7h0_5-1T7y8p76m2N5w6Z9o2rY8q9K9a5j4r4M';

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const fullUrl = path.startsWith('http') ? path : `${url}${path}`;
    const options = {
      method: method,
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    };
    const req = https.request(fullUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function restore() {
  try {
    console.log('--- RECENT LOGS ---');
    const logsStr = await request('/rest/v1/sync_logs?select=id,created_at,message&order=created_at.desc&limit=20');
    const logs = JSON.parse(logsStr);
    
    logs.forEach(l => console.log(`${l.id} | ${l.created_at} | ${l.message}`));
    
    const target = logs.find(l => {
      const time = new Date(l.created_at);
      // 19:00 local is roughly 17:00 UTC
      return time.getUTCHours() <= 17 && (l.message.includes('119') || l.message.includes('117'));
    });
    
    if (target) {
      console.log(`\nFOUND TARGET ID: ${target.id} (${target.created_at})`);
      // Reverting to trigger-resync action
      const resyncUrl = `https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/import-competitors?action=trigger-resync&log_id=${target.id}`;
      const result = await request(resyncUrl);
      console.log('RESTORATION RESULT:', result);
    } else {
      console.log('\nNO VALID 19:00 LOG FOUND!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

restore();
