import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Trophy, Search, LogOut, Settings, ClipboardList, FileWarning, RefreshCw, ExternalLink, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { importCompetitors, importCompetitions } from "@/lib/import-utils";
import { filterAthletesByInstructor } from "@/lib/instructor-utils";
import StatCard from "@/components/dashboard/StatCard";
import AthletesList from "@/components/dashboard/AthletesList";
import CouplesList from "@/components/dashboard/CouplesList";
import CompetitionsList from "@/components/dashboard/CompetitionsList";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUserRole } from "@/hooks/use-user-role";

interface Athlete {
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

interface Couple {
  id: string;
  category: string;
  class: string;
  disciplines: string[];
  athlete1_id: string;
  athlete2_id: string;
  discipline_info: Record<string, string> | null;
}

interface Competition {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string | null;
  registration_deadline: string | null;
  late_fee_deadline: string | null;
  description: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

type ActiveView = "none" | "athletes" | "couples" | "competitions";

export default function Dashboard() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("none");
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  useIsAdmin();
  const { role, userId } = useUserRole();

  const fetchData = useCallback(async () => {
    if (role === "loading") return;

    setLoading(true);
    try {
      const [athletesRes, couplesRes, competitionsRes, profilesRes] = await Promise.all([
        supabase.from("athletes").select("*"),
        supabase.from("couples").select("*").eq("is_active", true),
        supabase.from("competitions").select("*").order("date", { ascending: true }),
        supabase.from("profiles").select("id, user_id, full_name"),
      ]);

      if (athletesRes.error) throw athletesRes.error;
      if (couplesRes.error) throw couplesRes.error;
      if (competitionsRes.error) throw competitionsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const rawAthletes = athletesRes.data || [];
      const rawCouples = (couplesRes.data as any) || [];

      let fetchedAthletes = [...rawAthletes];
      let fetchedCouples = [...rawCouples];

      // Filtro di sicurezza restrittivo: solo l'Admin vede tutto.
      if (role !== "admin") {
        const currentUserProfile = profilesRes.data?.find(p => p.user_id === userId);

        if (currentUserProfile) {
          // Use shared utility function for consistent filtering
          fetchedAthletes = filterAthletesByInstructor(rawAthletes, currentUserProfile);
          fetchedCouples = rawCouples;
        } else {
          console.warn("[Dashboard] Profilo non trovato per l'utente loggato.");
          fetchedAthletes = [];
          // Anche se il profilo non è trovato, potremmo voler mostrare le coppie se non dipendono dal profilo per la visibilità,
          // ma per sicurezza se non c'è profilo, manteniamo vuoto o mostriamo tutto? 
          // La logica precedente svuotava tutto. Se l'utente è loggato ma non ha profilo, è un caso strano.
          // Manteniamo il comportamento di sicurezza: se non c'è corrispondenza profilo, non mostrare nulla.
          fetchedCouples = [];
        }
      }

      setAllAthletes(rawAthletes);
      setAthletes(fetchedAthletes);
      setCouples(fetchedCouples);
      setCompetitions(competitionsRes.data || []);
      setProfiles(profilesRes.data || []);
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
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      fetchData();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });

    checkAuth();
    return () => subscription.unsubscribe();
  }, [navigate, role, userId, fetchData]);



  const handleRefresh = async () => {
    setRefreshing(true);

    // Auto-import logic
    try {
      // Import Athletes
      try {
        const resp = await fetch("/files/Competitori_ok.xls");
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          const result = await importCompetitors(blob);
          if (result.success) {
            toast({ title: "Import Atleti", description: `Processati: ${result.count}` });
          } else {
            console.error("Import atleti failed:", result.message);
            toast({ title: "Errore Import Atleti", description: result.message || "Errore sconosciuto", variant: "destructive" });
          }
        } else {
          console.warn("File Competitori_ok.xls non trovato");
        }
      } catch (e) { console.error("Auto-import athletes error", e); }

      // Import Competitions
      try {
        // Add timestamp to prevent caching
        const resp = await fetch(`/files/Competizioni.xlsx?t=${new Date().getTime()}`);
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          const result = await importCompetitions(blob);
          if (result.success) {
            toast({ title: "Import Competizioni", description: `Nuove: ${result.created}, Aggiornate: ${result.updated}` });
          } else {
            // If error, show specific message
            console.error("Auto-import competitions failed:", result.message);
            toast({ title: "Errore Import Competizioni", description: result.message || "Errore sconosciuto", variant: "destructive" });
          }
        } else {
          console.warn(`File Competizioni.xlsx non trovato (Status: ${resp.status})`);
        }
      } catch (e: any) {
        console.error("Auto-import competitions error", e);
        toast({ title: "Errore Import Competizioni", description: e.message || "Errore di rete", variant: "destructive" });
      }
    } catch (globalError) {
      console.error("Global auto-import error", globalError);
    }

    await fetchData();
    setRefreshing(false);
    toast({
      title: "Sistema aggiornato",
      description: "Dati ricaricati e sincronizzati con i file Excel locali.",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredAthletes = athletes.filter((a) =>
    `${a.first_name} ${a.last_name} ${a.code}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
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
                  onClick={() => window.open(`${window.location.origin}/auth?register=instructor`, '_blank')}
                  className="gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                  title="Apri pagina iscrizione istruttore"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apri Istruttore
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`${window.location.origin}/enroll`, '_blank')}
                  className="gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                  title="Apri pagina iscrizione gare"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apri Iscrizione
                </Button>
              </>
            )}


            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/anomalies")}
              className="gap-2"
            >
              <FileWarning className="w-4 h-4" />
              Anomalie
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
            {role === "admin" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/instructors")}
                aria-label="Gestione istruttori"
                title="Istruttori"
              >
                <Users className="w-4 h-4" />
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
                <Button variant="ghost" size="icon">
                  <Menu className="w-6 h-6" />
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
                        className="w-full justify-start gap-2"
                        onClick={() => window.open(`${window.location.origin}/auth?register=instructor`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Iscrizione Istruttore
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => window.open(`${window.location.origin}/enroll`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Iscrizione Gare
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate("/anomalies")}
                  >
                    <FileWarning className="w-4 h-4" />
                    Anomalie
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Aggiorna Dati
                  </Button>

                  {role === "admin" && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2"
                      onClick={() => navigate("/instructors")}
                    >
                      <Users className="w-4 h-4" />
                      Gestione Istruttori
                    </Button>
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
        {/* Stats - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
          <div
            onClick={() => navigate("/competition-enrollments")}
            className="cursor-pointer hover:scale-[1.02] transition-transform"
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
          <StatCard
            icon={Trophy}
            value={competitions.length}
            label="Competizioni"
            colorClass="bg-accent/10 text-accent"
            onClick={() => handleStatClick("competitions")}
            isActive={activeView === "competitions"}
          />
        </div>

        {/* Dynamic List Views */}
        {activeView === "athletes" && (
          <AthletesList
            athletes={athletes}
            couples={couples}
            profiles={profiles}
            onClose={() => setActiveView("none")}
          />
        )}

        {activeView === "couples" && (
          <CouplesList
            couples={couples}
            athletes={allAthletes}
            profiles={profiles}
            onClose={() => setActiveView("none")}
          />
        )}

        {activeView === "competitions" && (
          <CompetitionsList
            competitions={competitions}
            athletes={allAthletes}
            profiles={profiles}
            onClose={() => setActiveView("none")}
            onRefresh={fetchData}
          />
        )}

        {/* Search - Only show when no view is active */}
        {activeView === "none" && (
          <>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Cerca Atleta</CardTitle>
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

            {/* Search Results */}
            {searchQuery && (
              <Card className="mb-8 animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-lg">Risultati ricerca ({filteredAthletes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAthletes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nessun atleta trovato</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Codice</th>
                            <th>Nome</th>
                            <th>Categoria</th>
                            <th>Classe</th>
                            <th>Certificato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAthletes.map((athlete) => {
                            const isOrphan = !couples.some(c => c.athlete1_id === athlete.id || c.athlete2_id === athlete.id);
                            const isFemale = athlete.gender === 'F';
                            const isMale = athlete.gender === 'M';

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
                                <td className="font-mono text-sm">{athlete.code}</td>
                                <td className="font-medium">{athlete.first_name} {athlete.last_name}</td>
                                <td>{athlete.category}</td>
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

            {/* Empty State */}
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
