import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
<<<<<<< HEAD
import { Users, UserCheck, Trophy, Search, LogOut, Settings, ClipboardList, FileWarning, ExternalLink, Menu } from "lucide-react";
=======
import { Users, Trophy, Search, LogOut, Settings, ClipboardList, FileWarning, ExternalLink, Menu, Calendar } from "lucide-react";
>>>>>>> 58f4189 (feat: All-in-One Dashboard (SPA) integration & UI refinements)
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
import { formatCategoryDisplay } from "@/lib/category-validation";
import { toast } from "sonner";
import { isCidAndCategorySwapped, detectFieldType, smartRemapAthlete } from "@/lib/athlete-utils";

import AthleteEnrollment from "./AthleteEnrollment";
import Anomalies from "./Anomalies";
import Instructors from "./Instructors";
import { Badge } from "@/components/ui/badge";
import { User, UserCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

type ActiveView = "none" | "athletes" | "couples" | "competitions";
type ActiveSubView = "none" | "enroll" | "anomalies" | "instructors";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("athletes");
  const [activeSubView, setActiveSubView] = useState<ActiveSubView>("none");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [removedAthletes, setRemovedAthletes] = useState<{ code: string, first_name: string, last_name: string }[]>([]);
  const navigate = useNavigate();

  useIsAdmin();
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

  console.log("Dashboard: Data state", { role, activeView, activeSubView, loading, athletesCount: athletes?.length });

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

  const handleSubViewChange = (v: ActiveSubView) => {
    setActiveSubView(activeSubView === v ? "none" : v);
    setActiveView("none"); // Close list overlays
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground flex flex-col items-center gap-4">
          <img src="/logo.png" alt="Loading" className="w-12 h-12 grayscale opacity-50 dark:hidden" />
          <img src="/logo-white.png" alt="Loading" className="w-12 h-12 grayscale opacity-50 hidden dark:block" />
          <div className="font-display font-medium">Preparazione Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <>
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
              onClick={() => navigate("/enroll")}
              className="stat-card cursor-pointer group relative overflow-hidden bg-card hover:shadow-lg transition-all"
            >
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-accent blur-3xl opacity-5 group-hover:opacity-10 transition-opacity" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-accent/10 border border-accent/20 transition-all duration-300 group-hover:rotate-6">
                  <ClipboardList className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">Gestione Classi</p>
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
=======
    <div className="min-h-screen bg-background selection:bg-accent/30 selection:text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 print:hidden transition-all duration-500">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => { setActiveSubView("none"); setActiveView("none"); }}>
            <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
              <img src="/logo.png" alt="Dance Manager Logo" className="w-full h-full object-contain dark:hidden" />
              <img src="/logo-white.png" alt="Dance Manager Logo" className="w-full h-full object-contain hidden dark:block" />
            </div>
            <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">Dance Manager</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
             {role === "admin" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubViewChange("enroll")}
                  className={`rounded-full gap-2 transition-all duration-300 ${
                    activeSubView === "enroll" 
                      ? "bg-yellow-500 text-white border-yellow-500" 
                      : "bg-yellow-500/5 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500 hover:text-white"
                  }`}
                  title="IscrizionI Gara"
                >
                  <ExternalLink className="w-4 h-4" />
                  Iscrizioni
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubViewChange("anomalies")}
              className={`rounded-full gap-2 transition-all duration-300 ${
                activeSubView === "anomalies"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-orange-500/5 border-orange-500/30 text-orange-600 hover:bg-orange-500 hover:text-white"
              }`}
            >
              <FileWarning className="w-4 h-4" />
              Anomalie
            </Button>

            {role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubViewChange("instructors")}
                aria-label="Gestione istruttori"
                title="Istruttori"
                className={`rounded-full gap-2 transition-all duration-300 ${
                  activeSubView === "instructors"
                    ? "bg-primary text-white border-primary"
                    : "bg-slate-500/5 border-slate-500/30 text-muted-foreground hover:bg-primary hover:text-white"
                }`}
              >
                <Users className="w-4 h-4" />
                Istruttori
              </Button>
            )}
            
            <ThemeToggle />

            <div className="flex items-center gap-4 px-4 py-1.5 bg-card border border-border/50 rounded-full shadow-md ml-2 hover:shadow-lg transition-all duration-300">
              <div className="flex flex-col items-end border-r border-border/50 pr-3">
                <span className="text-[10px] font-medium text-muted-foreground leading-tight">{userEmail || "Utente"}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary leading-tight">
                  {role === "admin" ? "Admin" : role === "supervisor" ? "Admin Sola Lettura" : "Istruttore"}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate("/settings")} 
                  className="w-8 h-8 rounded-full hover:bg-primary/10 transition-colors"
                  title="Impostazioni"
                >
                  <Settings className="w-4 h-4 text-muted-foreground hover:text-primary" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleLogout} 
                  className="w-8 h-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Esci"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>

              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                <User className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="h-12 w-12">
                  <Menu className="w-9 h-9" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[80vw] sm:w-[350px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  {role === "admin" && (
                    <>
                      <Button
                        variant="outline"
                        asChild
                        className="w-full justify-start gap-2 bg-sky-100 border-sky-300 text-sky-700 hover:bg-sky-200 hover:border-sky-400"
                      >
                        <a href={`${window.location.origin}/auth?register=instructor`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                          Accesso
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        asChild
                        className="w-full justify-start gap-2 bg-yellow-100 border-yellow-300 text-yellow-700 hover:bg-yellow-200 hover:border-yellow-400"
                      >
                        <a href={`${window.location.origin}/enroll`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                          Link iscrizioni
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200 hover:border-orange-400"
                    onClick={() => navigate("/anomalies")}
                  >
                    <FileWarning className="w-4 h-4" />
                    Anomalie
                  </Button>

                  {role === "admin" && (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => navigate("/instructors")}
                      >
                        <Users className="w-4 h-4" />
                        Gestione Istruttori
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="w-4 h-4" />
                    Impostazioni
                  </Button>
                  <div className="h-px bg-border my-2" />
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    Esci
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
         {activeSubView === "none" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 print:hidden">
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
              colorClass="bg-success/10 text-success"
              onClick={() => handleStatClick("couples")}
              isActive={activeView === "couples"}
            />
            {role === "admin" && (
              <div
                onClick={() => navigate("/competition-enrollments")}
                className="cursor-pointer hover:-translate-y-0.5 transition-transform duration-200"
              >
                <div className="stat-card flex items-center gap-4 p-6 bg-card border border-border rounded-xl">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10">
                    <ClipboardList className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">Iscrizioni Gara</p>
                    <p className="text-sm text-muted-foreground">Gestisci classi</p>
                  </div>
                </div>
              </div>
            )}
            <StatCard
              icon={ Trophy}
              value={competitions.length}
              label="Competizioni"
              colorClass="bg-accent/10 text-accent"
              onClick={() => handleStatClick("competitions")}
              isActive={activeView === "competitions"}
            />
          </div>
        )}

        {/* Integrated SubViews */}
        {activeSubView === "enroll" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <AthleteEnrollment isEmbedded={true} />
          </div>
        )}
        
        {activeSubView === "anomalies" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Anomalies isEmbedded={true} />
          </div>
        )}

        {activeSubView === "instructors" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Instructors isEmbedded={true} />
          </div>
        )}

        {activeView === "athletes" && (
        <div className="animate-fade-in">
          <AthletesList
            athletes={athletes}
            deactivatedAthletes={deactivatedAthletes}
            allAthletes={allAthletes}
            couples={couples}
            profiles={profiles}
            lastSyncTime={lastSyncTime}
            onClose={() => setActiveView("none")}
          />
        </div>
        )}

        {activeView === "couples" && (
        <div className="animate-fade-in">
          <CouplesList
            couples={couples}
            deactivatedCouples={deactivatedCouples}
            athletes={allAthletes}
            profiles={profiles}
            lastSyncTime={lastSyncTime}
            onClose={() => setActiveView("none")}
          />
        </div>
        )}
>>>>>>> 58f4189 (feat: All-in-One Dashboard (SPA) integration & UI refinements)

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

<<<<<<< HEAD
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

                            const smartData = smartRemapAthlete(athlete);

                            return (
                              <tr key={athlete.id} className={`${rowColor} transition-colors duration-300`}>
                                <td className="py-2 px-4">
                                  <div className="flex flex-col">
                                    {smartData.cid && <span className="font-mono text-sm font-bold text-blue-600">{smartData.cid}</span>}
                                    {smartData.cf && <span className="font-mono text-[9px] text-orange-500 uppercase">{smartData.cf}</span>}
                                    {!smartData.cid && !smartData.cf && <span className="text-muted-foreground/30">-</span>}
                                  </div>
                                </td>
                                <td className="font-medium py-2 px-4">{athlete.first_name} {athlete.last_name}</td>
                                <td className="py-2 px-4">
                                  <div className="flex flex-col">
                                    {smartData.place && <span className="text-emerald-600 font-medium">{smartData.place}</span>}
                                    {smartData.category && <span className="text-sm font-medium text-primary/70">{formatCategoryDisplay(smartData.category)}</span>}
                                    {!smartData.place && !smartData.category && <span className="text-muted-foreground/30">-</span>}
                                  </div>
                                </td>
                                <td className="py-2 px-4">{athlete.class}</td>
                                <td className="py-2 px-4">
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
                                <td className="text-sm py-2 px-4">
                                  <div className="flex flex-col gap-1">
                                    {smartData.instructors.length > 0 && <span>{smartData.instructors.join(", ")}</span>}
                                    {smartData.contacts.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {smartData.contacts.map((c, i) => (
                                          <span key={i} className="text-[9px] text-blue-500/70 border border-blue-100 px-1 rounded bg-blue-50/30">{c}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
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
=======


            {athletes.length === 0 && !searchQuery && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nessun atleta registrato</h3>
                  <p className="text-muted-foreground mb-4">Importa i dati dal tuo file Excel per iniziare</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
>>>>>>> 58f4189 (feat: All-in-One Dashboard (SPA) integration & UI refinements)
      </main>
    </>
  );
}
