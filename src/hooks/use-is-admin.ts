import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) {
            setIsAdmin(false);
            setIsSupervisor(false);
          }
          return;
        }

        // Check for admin role
        const { data: adminData } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });

        // Check for supervisor role
        const { data: supervisorData } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "supervisor",
        });

        if (mounted) {
          setIsAdmin(Boolean(adminData));
          setIsSupervisor(Boolean(supervisorData));
        }
      } catch {
        if (mounted) {
          setIsAdmin(false);
          setIsSupervisor(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  return {
    isAdmin,
    isSupervisor,
    isAnyAdmin: isAdmin || isSupervisor,
    loading
  };
}
