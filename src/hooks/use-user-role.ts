import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "supervisor" | "instructor" | "loading" | null;

export function useUserRole() {
    const [role, setRole] = useState<UserRole>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchRole = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.user) {
                    if (mounted) {
                        setRole(null);
                        setUserId(null);
                    }
                    return;
                }

                if (mounted) setUserId(session.user.id);

                // Check for admin role first
                const { data: isAdmin } = await supabase.rpc("has_role", {
                    _user_id: session.user.id,
                    _role: "admin",
                });

                if (isAdmin) {
                    if (mounted) setRole("admin");
                    return;
                }

                // Check for supervisor role
                const { data: isSupervisor } = await supabase.rpc("has_role", {
                    _user_id: session.user.id,
                    _role: "supervisor",
                });

                if (isSupervisor) {
                    if (mounted) setRole("supervisor");
                    return;
                }

                // Check for instructor role
                const { data: isInstructor } = await supabase.rpc("has_role", {
                    _user_id: session.user.id,
                    _role: "instructor",
                });

                if (mounted) setRole(isInstructor ? "instructor" : null);
            } catch (error) {
                console.error("Error fetching user role:", error);
                if (mounted) setRole(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchRole();

        return () => {
            mounted = false;
        };
    }, []);

    return { role, userId, loading };
}
