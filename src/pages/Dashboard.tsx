import { useEffect, useState, useMemo } from "react";
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
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUserRole } from "@/hooks/use-user-role";
import { useDashboardData } from "@/hooks/useDashboardData";
import { toast } from "sonner";
import { Athlete, Couple, Profile } from "@/types/dashboard";
import { isCidAndCategorySwapped } from "@/lib/athlete-utils";

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
  } = useDashboardData(role, userId);

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
    let list = athletes;
    if (searchQuery) {
      const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      list = athletes.filter((a) => {
        const first = (a.first_name || "").toLowerCase();
        const last = (a.last_name || "").toLowerCase();
        const code = (a.code || "").toLowerCase();
        return queryWords.every(word =>
          first.includes(word) ||
          last.includes(word) ||
          code.includes(word)
        );
      });
    }

    // Deduplicate by code
    const unique = new Map();
    list.forEach(a => {
      if (!unique.has(a.code)) unique.set(a.code, a);
    });
    return Array.from(unique.values());
  }, [athletes, searchQuery]);

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/logo.png" alt="Dance Manager Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-display font-bold">Dance Manager</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {role === "admin" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2 bg-sky-100 border-sky-300 text-sky-700 hover:bg-sky-200 hover:border-sky-400"
                  title="Apri pagina iscrizione istruttore"
                >
                  <a href={`${window.location.origin}/auth?register=instructor`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                    Accesso
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2 bg-yellow-100 border-yellow-300 text-yellow-700 hover:bg-yellow-200 hover:border-yellow-400"
                  title="Apri pagina iscrizione gare"
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
              size="sm"
              onClick={() => navigate("/anomalies")}
              className="gap-2 bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200 hover:border-orange-400"
            >
              <FileWarning className="w-4 h-4" />
              Anomalie
            </Button>

            {role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/instructors")}
                aria-label="Gestione istruttori"
                title="Istruttori"
                className="gap-2 bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400"
              >
                <Users className="w-4 h-4" />
                Istruttori
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
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
            icon={Trophy}
            value={competitions.length}
            label="Competizioni"
            colorClass="bg-accent/10 text-accent"
            onClick={() => handleStatClick("competitions")}
            isActive={activeView === "competitions"}
          />
        </div>

        {activeView === "athletes" && (
          <AthletesList
            athletes={athletes}
            deactivatedAthletes={deactivatedAthletes}
            allAthletes={allAthletes}
            couples={couples}
            profiles={profiles}
            lastSyncTime={lastSyncTime}
            onClose={() => setActiveView("none")}
          />
        )}

        {activeView === "couples" && (
          <CouplesList
            couples={couples}
            deactivatedCouples={deactivatedCouples}
            athletes={allAthletes}
            profiles={profiles}
            lastSyncTime={lastSyncTime}
            onClose={() => setActiveView("none")}
          />
        )}

        {activeView === "competitions" && (
          <CompetitionsList
            competitions={competitions}
            athletes={allAthletes}
            couples={couples}
            profiles={profiles}
            lastSyncTime={lastSyncTime}
            onClose={() => setActiveView("none")}
            onRefresh={refresh}
          />
        )}

        {activeView === "none" && (
          <>
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
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <CardTitle className="text-lg">Cerca Atleta</CardTitle>
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
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca per nome, cognome o codice..."
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
                            <th>Codice</th>
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
          </>
        )}
      </main>
    </div>
  );
}
