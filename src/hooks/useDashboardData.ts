import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { filterAthletesByInstructor } from "@/lib/instructor-utils";

export interface Athlete {
    id: string;
    code: string;
    first_name: string;
    last_name: string;
    category: string;
    class: string;
    birth_date: string | null;
    medical_certificate_expiry: string | null;
    instructor_id: string | null;
    responsabili: string[] | null;
    gender?: string | null;
}

export interface Couple {
    id: string;
    category: string;
    class: string;
    disciplines: string[];
    athlete1_id: string;
    athlete2_id: string;
    discipline_info: Record<string, string> | null;
}

export interface Competition {
    id: string;
    name: string;
    date: string;
    end_date: string | null;
    location: string | null;
    registration_deadline: string | null;
    late_fee_deadline: string | null;
    description: string | null;
    is_completed: boolean;
}

export interface Profile {
    id: string;
    user_id: string;
    full_name: string;
}

export function useDashboardData(role: string, userId: string | null) {
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
    const [couples, setCouples] = useState<Couple[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        if (role === "loading") return;

        setLoading(true);
        try {
            const [athletesRes, couplesRes, competitionsRes, profilesRes] = await Promise.all([
                supabase.from("athletes").select("*").eq("is_deleted", false) as any,
                supabase.from("couples").select("*").eq("is_active", true) as any,
                supabase.from("competitions").select("*").eq("is_deleted", false).order("date", { ascending: true }) as any,
                supabase.from("profiles").select("id, user_id, full_name") as any,
            ]);

            if (athletesRes.error) throw athletesRes.error;
            if (couplesRes.error) throw couplesRes.error;
            if (competitionsRes.error) throw competitionsRes.error;
            if (profilesRes.error) throw profilesRes.error;

            const rawAthletes = (athletesRes.data || []) as Athlete[];
            const rawCouples = (couplesRes.data || []) as unknown as Couple[];
            const rawProfiles = (profilesRes.data || []) as Profile[];

            // Deduplicate athletes by CID (code)
            const uniqueAthletesMap = new Map<string, Athlete>();
            rawAthletes.forEach((a) => {
                if (!uniqueAthletesMap.has(a.code)) {
                    uniqueAthletesMap.set(a.code, a);
                }
            });
            const uniqueRawAthletes = Array.from(uniqueAthletesMap.values());

            let fetchedAthletes = [...uniqueRawAthletes];
            let fetchedCouples = [...rawCouples];

            if (role !== "admin" && role !== "supervisor") {
                const currentUserProfile = rawProfiles.find(p => p.user_id === userId);
                if (currentUserProfile) {
                    fetchedAthletes = filterAthletesByInstructor(uniqueRawAthletes, currentUserProfile);
                    fetchedCouples = rawCouples; // Note: Current logic keeps all couples, check if this is intended
                } else {
                    console.warn("[DashboardData] Profile not found for logged user.");
                    fetchedAthletes = [];
                    fetchedCouples = [];
                }
            }

            setAllAthletes(uniqueRawAthletes);
            setAthletes(fetchedAthletes);
            setCouples(fetchedCouples);

            // Deduplicate competitions by name and date
            const uniqueCompetitionsMap = new Map();
            (competitionsRes.data || []).forEach((c: any) => {
                const key = `${c.name.toLowerCase()}-${c.date}`;
                if (!uniqueCompetitionsMap.has(key)) {
                    uniqueCompetitionsMap.set(key, c);
                }
            });
            setCompetitions(Array.from(uniqueCompetitionsMap.values()));
            setProfiles(rawProfiles);
        } catch (error: any) {
            console.error("fetchData error:", error);
            toast({
                title: "Errore nel caricamento",
                description: error.message || "Impossibile caricare i dati della dashboard.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [role, userId, toast]);

    useEffect(() => {
        if (role !== "loading") {
            fetchData();
        }
    }, [role, userId, fetchData]);

    return {
        athletes,
        allAthletes,
        couples,
        competitions,
        profiles,
        loading,
        refresh: fetchData
    };
}
