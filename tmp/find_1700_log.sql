SELECT id, created_at, message FROM sync_logs WHERE created_at < '2026-04-08 16:00:00' ORDER BY created_at DESC LIMIT 5;
