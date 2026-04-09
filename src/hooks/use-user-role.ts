import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "supervisor" | "instructor" | "loading" | null;

export function useUserRole() {
    const [role, setRole] = useState<UserRole>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchRole = async () => {
            console.log("useUserRole: Checking session...");
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.user) {
                    console.log("useUserRole: No session found");
                    if (mounted) {
                        setRole(null);
                        setUserId(null);
                        setUserEmail(null);
                    }
                } else {
                    console.log("useUserRole: Session found for", session.user.email);
                    if (mounted) {
                        setUserId(session.user.id);
                        setUserEmail(session.user.email || null);
                    }

                    // Check for admin role first
                    const { data: isAdmin } = await supabase.rpc("has_role", {
                        _user_id: session.user.id,
                        _role: "admin",
                    });

                    if (isAdmin) {
                        console.log("useUserRole: Role is admin");
                        if (mounted) setRole("admin");
                    } else {
                        // Check for supervisor role
                        const { data: isSupervisor } = await supabase.rpc("has_role", {
                            _user_id: session.user.id,
                            _role: "supervisor",
                        });

                        if (isSupervisor) {
                            console.log("useUserRole: Role is supervisor");
                            if (mounted) setRole("supervisor");
                        } else {
                            // Check for instructor role
                            const { data: isInstructor } = await supabase.rpc("has_role", {
                                _user_id: session.user.id,
                                _role: "instructor",
                            });
                            console.log("useUserRole: Role is instructor?", isInstructor);
                            if (mounted) setRole(isInstructor ? "instructor" : null);
                        }
                    }
                }
            } catch (error) {
                console.error("useUserRole: Error fetching user role:", error);
                if (mounted) setRole(null);
            } finally {
                console.log("useUserRole: Loading complete");
                if (mounted) setLoading(false);
            }
        };

        fetchRole();

        return () => {
            mounted = false;
        };
    }, []);

    return { role, userId, userEmail, loading };
}
