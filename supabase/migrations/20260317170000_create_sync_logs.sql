-- Create sync_logs table for real-time notifications
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL,
    message TEXT,
    results JSONB
);

-- Enable Realtime for sync_logs
ALTER PUBLICATION supabase_realtime ADD TABLE sync_logs;

-- Allow authenticated users to read logs (for notifications)
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated to read sync logs" ON public.sync_logs
    FOR SELECT TO authenticated USING (true);
