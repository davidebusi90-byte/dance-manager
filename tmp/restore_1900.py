import requests
import json

url = 'https://kymoxuucjfgotjlhkfua.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc'

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}

# Find logs around 19:00 (17:00 UTC)
r = requests.get(f"{url}/rest/v1/sync_logs?select=id,created_at,message&order=created_at.desc&limit=20", headers=headers)
logs = r.json()

print("--- RECENT LOGS ---")
for l in logs:
    print(f"{l['id']} | {l['created_at']} | {l['message']}")

# Find the one closest to 17:00 UTC (19:00 local)
# Or just find the last one with 119/117 athletes before my mess
target = None
for l in logs:
    if "119" in l['message'] or "117" in l['message']:
        # If it's before the mess (which started around 18:40 UTC/19:40 local)
        if "17:00" in l['created_at'] or "16:" in l['created_at'] or "15:" in l['created_at']:
             target = l['id']
             break

if target:
    print(f"\nFOUND TARGET ID: {target}")
    # Trigger resync
    # Note: Trigger-resync requires GET with action=trigger-resync and log_id
    resync_url = f"{url}/functions/v1/import-competitors?action=trigger-resync&log_id={target}"
    r2 = requests.get(resync_url, headers=headers)
    print("RESTORATION RESULT:", r2.text)
else:
    print("\nNO VALID 19:00 LOG FOUND!")
