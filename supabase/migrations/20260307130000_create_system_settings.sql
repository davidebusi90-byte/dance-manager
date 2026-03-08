-- Create table for global system settings
CREATE TABLE public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    email_notifications_athletes BOOLEAN NOT NULL DEFAULT true,
    email_notifications_instructors BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT one_row CHECK (id = 'global')
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings
CREATE POLICY "Anyone can read system settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can update system settings
CREATE POLICY "Admins can update system settings"
ON public.system_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert the default row if it doesn't exist
INSERT INTO public.system_settings (id, email_notifications_athletes, email_notifications_instructors)
VALUES ('global', true, true)
ON CONFLICT (id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON public.system_settings 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
