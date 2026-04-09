import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Trophy, Search, LogOut, Settings, ClipboardList, FileWarning, ExternalLink, Menu, Calendar } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import StatCard from "@/components/dashboard/StatCard";
import AthletesList from "@/components/dashboard/AthletesList";
import CouplesList from "@/components/dashboard/CouplesList";
import CompetitionsList from "@/components/dashboard/CompetitionsList";
import { useUserRole } from "@/hooks/use-user-role";
import { motion, AnimatePresence } from "framer-motion";
import { Athlete } from "@/types/dashboard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";

import AthleteEnrollment from "./AthleteEnrollment";
import Anomalies from "./Anomalies";
import Instructors from "./Instructors";

type ActiveView = "none" | "athletes" | "couples" | "competitions";
type ActiveSubView = "none" | "enroll" | "anomalies" | "instructors";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("athletes");
  const [activeSubView, setActiveSubView] = useState<ActiveSubView>("none");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [removedAthletes, setRemovedAthletes] = useState<{ code: string, first_name: string, last_name: string }[]>([]);
  const navigate = useNavigate();

  const { role, userId, userEmail } = useUserRole();
  const {
    athletes,
    deactivatedAthletes,
    allAthletes,
    couples,
    deactivatedCouples,
    competitions,
    profiles,
    loading,
    refresh
  } = useDashboardData(role, userId);

  const [searchResults, setSearchResults] = useState<Athlete[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchAthletes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_athletes_server', {
        search_term: query
      });
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err: any) {
      toast.error(err.message || "Errore nella ricerca");
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });

    const fetchLastSync = async () => {
      const { data, error } = await (supabase
        .from("sync_logs" as any)
        .select("created_at, results")
        .in("status", ["success", "warning"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      
      if (!error && data) {
        setLastSyncTime(new Date(data.created_at));
        if (data.results?.removed) {
          setRemovedAthletes(data.results.removed);
        }
      }
    };

    fetchLastSync();

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchAthletes(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchAthletes]);

  useEffect(() => {
    const channel = supabase
      .channel('sync-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sync_logs',
        },
        (payload) => {
          const newLog = payload.new;
          if (newLog.status === 'success' || newLog.status === 'warning') {
            toast.success("Sincronizzazione API", {
              description: newLog.message,
              duration: 5000,
            });
            setLastSyncTime(new Date(newLog.created_at));
            if (newLog.results?.removed) {
              setRemovedAthletes(newLog.results.removed);
            } else {
              setRemovedAthletes([]);
            }
            refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const handleStatClick = (view: ActiveView) => {
    setActiveSubView("none");
    setActiveView(activeView === view ? "none" : view);
  };

  const handleNavigation = (path: string) => {
    if (path === "/dashboard") {
      setActiveSubView("none");
      setActiveView("athletes");
    } else if (path === "/enroll") {
      setActiveSubView("enroll");
      setActiveView("none");
    } else if (path === "/anomalies") {
      setActiveSubView("anomalies");
      setActiveView("none");
    } else if (path === "/instructors") {
      setActiveSubView("instructors");
      setActiveView("none");
    } else if (path === "/settings") {
      navigate("/settings");
    }
  };

  const getActivePath = () => {
    if (activeSubView === "enroll") return "/enroll";
    if (activeSubView === "anomalies") return "/anomalies";
    if (activeSubView === "instructors") return "/instructors";
    return "/dashboard";
  };

  if (loading) {
    return (
      <Layout onNavigate={handleNavigation} activePath={getActivePath()}>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"
          >
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </motion.div>
          <p className="text-muted-foreground font-medium animate-pulse">Preparazione Dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={handleNavigation} activePath={getActivePath()}>
      {/* Search Header (Only on Home/Main) */}
      {activeSubView === "none" && (
        <div className="mb-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-display font-black tracking-tight uppercase">Dashboard</h1>
              <p className="text-muted-foreground font-medium mt-1">
                {athletes.length} atleti gestiti • {couples.length} coppie attive
              </p>
            </div>
            
            <div className="relative group w-full md:w-[400px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Cerca atleti, codici o categorie..."
                className="pl-12 h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm group-focus-within:ring-2 group-focus-within:ring-primary/20 transition-all font-medium text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards Grid */}
      <AnimatePresence>
        {activeSubView === "none" && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            <StatCard
              icon={Users}
              value={athletes.length}
              label="Atleti"
              colorClass="bg-blue-500/10 text-blue-600"
              onClick={() => handleStatClick("athletes")}
              isActive={activeView === "athletes"}
            />
            <StatCard
              icon={UserCheck}
              value={couples.length}
              label="Coppie attive"
              colorClass="bg-green-500/10 text-green-600"
              onClick={() => handleStatClick("couples")}
              isActive={activeView === "couples"}
            />
            <div
               onClick={() => handleNavigation("/enroll")}
               className="cursor-pointer group"
            >
              <div className="h-full p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-black">Iscrizioni</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Gestisci Gare</p>
                  </div>
                </div>
              </div>
            </div>
            <StatCard
              icon={Trophy}
              value={competitions.length}
              label="Competizioni"
              colorClass="bg-amber-500/10 text-amber-600"
              onClick={() => handleStatClick("competitions")}
              isActive={activeView === "competitions"}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="space-y-8">
        {/* Integrated SubViews */}
        <AnimatePresence mode="wait">
          {activeSubView === "enroll" && (
            <motion.div 
              key="enroll"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
               <AthleteEnrollment isEmbedded={true} />
            </motion.div>
          )}
          
          {activeSubView === "anomalies" && (
            <motion.div 
              key="anomalies"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Anomalies isEmbedded={true} />
            </motion.div>
          )}

          {activeSubView === "instructors" && (
            <motion.div 
              key="instructors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Instructors isEmbedded={true} />
            </motion.div>
          )}

          {/* Standard Lists */}
          {activeSubView === "none" && activeView === "athletes" && (
            <motion.div 
              key="athletes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <AthletesList
                athletes={searchQuery.trim() ? searchResults : athletes}
                deactivatedAthletes={deactivatedAthletes}
                allAthletes={allAthletes}
                couples={couples}
                profiles={profiles}
                lastSyncTime={lastSyncTime}
                onClose={() => setActiveView("none")}
              />
            </motion.div>
          )}

          {activeSubView === "none" && activeView === "couples" && (
            <motion.div 
              key="couples"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <CouplesList
                couples={couples}
                deactivatedCouples={deactivatedCouples}
                athletes={allAthletes}
                profiles={profiles}
                lastSyncTime={lastSyncTime}
                onClose={() => setActiveView("none")}
              />
            </motion.div>
          )}

          {activeSubView === "none" && activeView === "competitions" && (
            <motion.div 
              key="competitions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <CompetitionsList
                competitions={competitions}
                athletes={allAthletes}
                couples={couples}
                profiles={profiles}
                lastSyncTime={lastSyncTime}
                onClose={() => setActiveView("none")}
                onRefresh={refresh}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Notifications (When on Home) */}
        {activeSubView === "none" && activeView === "none" && (
          <div className="space-y-6">
            {removedAthletes.length > 0 && (
              <Card className="rounded-3xl border-orange-200 bg-orange-50/30 dark:bg-orange-950/20 overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 text-orange-700 dark:text-orange-400">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <FileWarning className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-xl font-display font-bold">Atleti rimossi nell'ultima sincronizzazione</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {removedAthletes.map((a) => (
                      <div key={a.code} className="flex items-center gap-3 p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-orange-100 dark:border-orange-900/40">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-[10px] font-black">{a.code}</div>
                        <span className="font-bold text-orange-900 dark:text-orange-100 capitalize">{a.first_name} {a.last_name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
               <Card className="rounded-[2.5rem] overflow-hidden border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm">
                 <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <LayoutDashboard className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">Benvenuto nel Dance Manager</h3>
                      <p className="text-muted-foreground mt-2 font-medium">Seleziona una categoria sopra per iniziare l'analisi dei dati.</p>
                    </div>
                 </CardContent>
               </Card>
               
               <Card className="rounded-[2.5rem] overflow-hidden border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm">
                 <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
                      <Calendar className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">Stato Sincronizzazione</h3>
                      <p className="text-muted-foreground mt-2 font-medium">
                        Ultimo aggiornamento: {lastSyncTime ? lastSyncTime.toLocaleString() : "Mai"}
                      </p>
                    </div>
                 </CardContent>
               </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// Support items
const LayoutDashboard = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);
