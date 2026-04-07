import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Trophy, Search, LogOut, Settings, ClipboardList, FileWarning, ExternalLink, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import StatCard from "@/components/dashboard/StatCard";
import AthletesList from "@/components/dashboard/AthletesList";
import CouplesList from "@/components/dashboard/CouplesList";
import CompetitionsList from "@/components/dashboard/CompetitionsList";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUserRole } from "@/hooks/use-user-role";
import { motion, AnimatePresence } from "framer-motion";
import { Athlete } from "@/types/dashboard";
import { useDashboardSummary } from "@/hooks/use-queries";
import { toast } from "sonner";
import { isCidAndCategorySwapped } from "@/lib/athlete-utils";
import { PrivacyConsentModal } from "@/components/PrivacyConsentModal";

type ActiveView = "none" | "athletes" | "couples" | "competitions";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("none");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [removedAthletes, setRemovedAthletes] = useState<{ code: string, first_name: string, last_name: string }[]>([]);
  const navigate = useNavigate();

  useIsAdmin();
  const { role, userId } = useUserRole();
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
  } = useDashboardSummary(role, userId);

  const [searchResults, setSearchResults] = useState<Athlete[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchAthletes = async (query: string) => {
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
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });

    const fetchLastSync = async () => {
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("sync_logs" as any)
        .select("created_at, results")
        .in("status", ["success", "warning"])
        .order("created_at", { ascending: false })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Handle server-side search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAthletes(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchAthletes]);

  // Listen for real-time sync notifications
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
            // Auto-refresh dashboard data
            refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredAthletes = useMemo(() => {
    // If there is a search query, prioritize server-side results
    if (searchQuery.trim()) {
      return searchResults;
    }
    
    // Otherwise show the high-level list (my athletes or snippet)
    const list = athletes;
    
    // Deduplicate by code
    const unique = new Map();
    list.forEach(a => {
      if (!unique.has(a.code)) unique.set(a.code, a);
    });
    return Array.from(unique.values());
  }, [athletes, searchResults, searchQuery]);

  const handleStatClick = (view: ActiveView) => {
    setActiveView(activeView === view ? "none" : view);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <PrivacyConsentModal />
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 print:hidden"
        >
          <StatCard
            icon={Users}
            value={athletes.length}
            label="Atleti"
            colorClass="bg-primary/10 text-primary"
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
          {role === "admin" && (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/competition-enrollments")}
              className="stat-card cursor-pointer group relative overflow-hidden bg-card hover:shadow-lg transition-all"
            >
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-accent blur-3xl opacity-5 group-hover:opacity-10 transition-opacity" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-accent/10 border border-accent/20 transition-all duration-300 group-hover:rotate-6">
                  <ClipboardList className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">Classi</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Iscrizioni Gara</p>
                </div>
              </div>
            </motion.div>
          )}
          <StatCard
            icon={Trophy}
            value={competitions.length}
            label="Competizioni"
            colorClass="bg-blue-500/10 text-blue-600"
            onClick={() => handleStatClick("competitions")}
            isActive={activeView === "competitions"}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {activeView === "athletes" && (
            <motion.div
              key="athletes-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <AthletesList
                athletes={athletes}
                deactivatedAthletes={deactivatedAthletes}
                allAthletes={allAthletes}
                couples={couples}
                profiles={profiles}
                lastSyncTime={lastSyncTime}
                onClose={() => setActiveView("none")}
              />
            </motion.div>
          )}

          {activeView === "couples" && (
            <motion.div
              key="couples-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
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

          {activeView === "competitions" && (
            <motion.div
              key="competitions-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
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

          {activeView === "none" && (
            <motion.div
              key="main-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
            {removedAthletes.length > 0 && (
              <Card className="mb-8 border-orange-200 bg-orange-50/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-orange-700">
                    <FileWarning className="w-5 h-5" />
                    <CardTitle className="text-lg">Atleti rimossi nell'ultima sincronizzazione</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-600 mb-3">
                    I seguenti atleti non sono presenti nel caricamento API e sono stati segnati come eliminati:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {removedAthletes.map((a) => (
                      <div key={a.code} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium border border-orange-200">
                        {a.first_name} {a.last_name} ({a.code})
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-4 text-orange-700 hover:text-orange-800 hover:bg-orange-100"
                    onClick={() => setRemovedAthletes([])}
                  >
                    Nascondi avviso
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <CardTitle className="text-lg">Cerca Atleta</CardTitle>
                <div className="flex items-center gap-4">
                  {isSearching && <div className="text-xs text-sky-600 animate-pulse font-medium">Ricerca in corso...</div>}
                  {lastSyncTime && (
                    <div className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                      Sincronizzato: {new Intl.DateTimeFormat('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(lastSyncTime)}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca per nome, cognome o CID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {searchQuery && (
              <Card className="mb-8 animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-lg">Risultati ricerca ({filteredAthletes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAthletes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nessun atleta trovato</p>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>CID</th>
                            <th>Nome</th>
                            <th>Categoria</th>
                            <th>Classe</th>
                            <th>Certificato</th>
                            <th>Istruttori</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAthletes.map((athlete) => {
                            const isOrphan = !couples.some(c => c.athlete1_id === athlete.id || c.athlete2_id === athlete.id);
                            const isFemale = athlete.gender === 'F';
                            const isMale = athlete.gender === 'M';

                            // Apply swap heuristic for display
                            const isSwapped = isCidAndCategorySwapped(athlete.code, athlete.category);
                            const displayCode = isSwapped ? athlete.category : athlete.code;
                            const displayCategory = isSwapped ? athlete.code : athlete.category;

                            let rowColor = "";
                            if (isOrphan) {
                              if (isFemale) rowColor = "bg-[#FFD9B3] hover:bg-[#FFE0C2]";
                              else if (isMale) rowColor = "bg-[#CCE5FF] hover:bg-[#D6EAFF]";
                              else rowColor = "bg-warning/10 hover:bg-warning/20";
                            } else {
                              rowColor = "hover:bg-gray-800";
                            }

                            return (
                              <tr key={athlete.id} className={`${rowColor} transition-colors duration-300`}>
                                <td className="font-mono text-sm">{displayCode}</td>
                                <td className="font-medium">{athlete.first_name} {athlete.last_name}</td>
                                <td>{displayCategory}</td>
                                <td>{athlete.class}</td>
                                <td>
                                  {athlete.medical_certificate_expiry ? (
                                    new Date(athlete.medical_certificate_expiry) < new Date() ? (
                                      <span className="status-badge status-badge-error">Scaduto</span>
                                    ) : (
                                      <span className="status-badge status-badge-success">Valido</span>
                                    )
                                  ) : (
                                    <span className="status-badge status-badge-warning">Mancante</span>
                                  )}
                                </td>
                                <td className="text-sm">
                                  {athlete.responsabili && athlete.responsabili.length > 0
                                    ? athlete.responsabili.join(", ")
                                    : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
              {athletes.length === 0 && !searchQuery && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nessun atleta registrato</h3>
                    <p className="text-muted-foreground mb-4">Importa i dati dal tuo file Excel per iniziare</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
