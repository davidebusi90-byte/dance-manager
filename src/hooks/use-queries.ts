import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Athlete, Couple, Competition, Profile } from "@/types/dashboard";
import { filterAthletesByInstructor } from "@/lib/instructor-utils";

export function useAthletes() {
  return useQuery({
    queryKey: ["athletes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athletes")
        .select("*")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return (data || []) as Athlete[];
    },
  });
}

export function useCouples() {
  return useQuery({
    queryKey: ["couples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couples")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Couple[];
    },
  });
}

export function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("*")
        .eq("is_deleted", false)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as Competition[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name");
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });
}

export function useSearchAthletes(query: string) {
  return useQuery({
    queryKey: ["athletes-search", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data, error } = await supabase.rpc('search_athletes_server', {
        search_term: query
      });
      if (error) throw error;
      return (data || []) as Athlete[];
    },
    enabled: query.length > 0
  });
}

export function useDashboardSummary(role: string, userId: string | null) {
  const athletesQuery = useAthletes();
  const couplesQuery = useCouples();
  const competitionsQuery = useCompetitions();
  const profilesQuery = useProfiles();
  
  const [searchQuery, setSearchQuery] = import.meta.env.PROD 
    ? [ "" , (_: string) => {} ] // Fallback for types
    : (function() { 
        // This is a bit hacky for a hook, better used outside
        return [ "", (_: string) => {} ];
      })();

  // Actually, searching state should be managed in the component 
  // but for backward compatibility I'll add a placeholder or refactor Dashboard.
  
  const isLoading = athletesQuery.isLoading || couplesQuery.isLoading || competitionsQuery.isLoading || profilesQuery.isLoading;

  const data = {
    athletes: athletesQuery.data || [],
    couples: couplesQuery.data || [],
    competitions: competitionsQuery.data || [],
    profiles: profilesQuery.data || [],
  };

  // Business Logic: Filtering by instructor if not admin/supervisor
  let filteredAthletes = data.athletes.filter(a => !a.is_deleted);
  let deactivatedAthletes = data.athletes.filter(a => a.is_deleted);
  let filteredCouples = data.couples.filter(c => c.is_active !== false);
  let deactivatedCouples = data.couples.filter(c => c.is_active === false);

  if (role !== "admin" && role !== "supervisor" && userId) {
    const profile = data.profiles.find(p => p.user_id === userId);
    if (profile) {
      filteredAthletes = filterAthletesByInstructor(filteredAthletes, profile);
      deactivatedAthletes = filterAthletesByInstructor(deactivatedAthletes, profile);
      // For couples, we assume they are already linked via instructor_id or filtering is done on the fly
    } else {
      filteredAthletes = [];
      deactivatedAthletes = [];
      filteredCouples = [];
      deactivatedCouples = [];
    }
  }

  return {
    athletes: filteredAthletes,
    deactivatedAthletes,
    allAthletes: data.athletes,
    couples: filteredCouples,
    deactivatedCouples,
    competitions: data.competitions,
    profiles: data.profiles,
    loading: isLoading,
    refresh: () => {
      athletesQuery.refetch();
      couplesQuery.refetch();
      competitionsQuery.refetch();
      profilesQuery.refetch();
    }
  };
}
