import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConsentType = 'privacy_policy' | 'terms_of_service' | 'marketing' | 'third_party_sharing';

export function usePrivacyConsent(consentType: ConsentType = 'privacy_policy', version: string = '1.0') {
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConsent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // First get the profile for this user to filter consent specifically for them
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("No profile found for user, cannot check privacy consent");
      setHasConsented(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_consents')
      .select('is_accepted')
      .eq('profile_id', profile.id)
      .eq('consent_type', consentType)
      .eq('version', version)
      .maybeSingle();

    if (error) {
      console.error("Error checking privacy consent:", error);
    } else if (data) {
      setHasConsented(data.is_accepted);
    } else {
      setHasConsented(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkConsent();

    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener(`consent-changed-${consentType}`, handleConsentChange);
    return () => window.removeEventListener(`consent-changed-${consentType}`, handleConsentChange);
  }, [consentType, version]);

  const saveConsent = async (accepted: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "User not authenticated" };

    // Find profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    const { error } = await supabase
      .from('user_consents')
      .upsert({
        profile_id: profile.id,
        consent_type: consentType,
        version: version,
        is_accepted: accepted,
        accepted_at: new Date().toISOString()
      }, { onConflict: 'profile_id,consent_type,version' });

    if (!error) {
      setHasConsented(accepted);
      // Notify other instances of this hook (like the one in Settings)
      window.dispatchEvent(new Event(`consent-changed-${consentType}`));
    }
    return { error };
  };

  return { hasConsented, loading, saveConsent, checkConsent };
}
