import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { filterAthletesByInstructor } from "@/lib/instructor-utils";
import { Athlete, Couple, Competition, Profile } from "@/types/dashboard";

export type { Athlete, Couple, Competition, Profile };

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
                (supabase.from("athletes").select("*").eq("is_deleted", false) as any),
                (supabase.from("couples").select("*").eq("is_active", true) as any),
                (supabase.from("competitions").select("*").eq("is_deleted", false).order("date", { ascending: true }) as any),
                (supabase.from("profiles").select("id, user_id, full_name") as any),
            ]);

            if (athletesRes.error) throw athletesRes.error;
            if (couplesRes.error) throw couplesRes.error;
            if (competitionsRes.error) throw competitionsRes.error;
            if (profilesRes.error) throw profilesRes.error;

            const rawAthletes = (athletesRes.data || []) as Athlete[];
            const rawCouples = (couplesRes.data || []) as Couple[];
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

            setAllAthletes(rawAthletes);
            setAthletes(fetchedAthletes);
            setCouples(fetchedCouples);

            // Deduplicate competitions by name and date
            const uniqueCompetitionsMap = new Map();
            (competitionsRes.data || []).forEach((c: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                const key = `${c.name.toLowerCase()}-${c.date}`;
                if (!uniqueCompetitionsMap.has(key)) {
                    uniqueCompetitionsMap.set(key, c);
                }
            });
            setCompetitions(Array.from(uniqueCompetitionsMap.values()));
            setProfiles(rawProfiles);
        } catch (error: unknown) {
            console.error("fetchData error:", error);
            toast({
                title: "Errore nel caricamento",
                description: (error instanceof Error ? error.message : String(error)) || "Impossibile caricare i dati della dashboard.",
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
