import { useState, useEffect, useMemo } from "react";
import { isInstructorResponsibleForCouple, isInstructorResponsibleForCoupleByResponsabili } from "@/lib/instructor-utils";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { useUserRole } from "@/hooks/use-user-role";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, FileWarning, Trophy, Activity, Plus, X, BarChartIcon } from "lucide-react";
import { validateCoupleCategory } from "@/lib/category-validation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

// New components & types
import ChartBuilder from "@/components/statistics/ChartBuilder";
import CustomDashboard from "@/components/statistics/CustomDashboard";
import { CustomTab, CustomChart, StatisticsPreferences } from "@/types/statistics";

const getSeason = (dateString: string | Date | null) => {
  if (!dateString) return "Sconosciuta";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth(); 
  if (month >= 8) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
};

const getCurrentSeason = () => getSeason(new Date());

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function Statistics() {
  const { role, userId } = useUserRole();
  const { athletes, couples, competitions, profiles, loading: dashboardLoading } = useDashboardData(role, userId);
  
  const [entries, setEntries] = useState<any[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  
  // Custom Dashboard State
  const [activeTab, setActiveTab] = useState("overview");
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Filters for Overview
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const fetchEntries = async () => {
      setEntriesLoading(true);
      try {
        const { data, error } = await supabase.from("competition_entries").select("*");
        if (error) throw error;
        setEntries(data || []);
      } catch (error) {
        console.error("Error fetching entries:", error);
      } finally {
        setEntriesLoading(false);
      }
    };
    fetchEntries();
  }, []);

  // Load preferences
  useEffect(() => {
    if (userId && profiles.length > 0) {
      const myProfile = profiles.find(p => p.user_id === userId);
      if (myProfile && myProfile.preferences) {
        const prefs = myProfile.preferences as StatisticsPreferences;
        if (prefs.tabs && Array.isArray(prefs.tabs)) {
          setCustomTabs(prefs.tabs);
        }
      }
    }
  }, [userId, profiles]);

  // Save preferences
  const savePreferences = async (newTabs: CustomTab[]) => {
    if (!userId) return;
    setSavingPrefs(true);
    setCustomTabs(newTabs);
    try {
      const myProfile = profiles.find(p => p.user_id === userId);
      if (myProfile) {
        const newPrefs = { ...myProfile.preferences, tabs: newTabs };
        await supabase.from("profiles").update({ preferences: newPrefs }).eq("id", myProfile.id);
      }
    } catch (error) {
      console.error("Error saving preferences", error);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleAddTab = () => {
    const name = prompt("Nome della nuova scheda:");
    if (!name || !name.trim()) return;
    const newTab: CustomTab = { id: crypto.randomUUID(), name, charts: [] };
    const newTabs = [...customTabs, newTab];
    savePreferences(newTabs);
    setActiveTab(newTab.id);
  };

  const handleDeleteTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Sei sicuro di voler eliminare questa scheda?")) return;
    const newTabs = customTabs.filter(t => t.id !== id);
    savePreferences(newTabs);
    if (activeTab === id) setActiveTab("overview");
  };

  const handleAddChart = (chart: CustomChart) => {
    const newTabs = customTabs.map(t => {
      if (t.id === activeTab) {
        return { ...t, charts: [...t.charts, chart] };
      }
      return t;
    });
    savePreferences(newTabs);
    setIsBuilderOpen(false);
  };

  const handleDeleteChart = (chartId: string) => {
    const newTabs = customTabs.map(t => {
      if (t.id === activeTab) {
        return { ...t, charts: t.charts.filter(c => c.id !== chartId) };
      }
      return t;
    });
    savePreferences(newTabs);
  };


  // Compute available seasons
  const availableSeasons = useMemo(() => {
    const seasons = new Set<string>();
    competitions.forEach(c => { if (c.date) seasons.add(getSeason(c.date)); });
    couples.forEach(c => { if (c.created_at) seasons.add(getSeason(c.created_at)); });
    seasons.add(getCurrentSeason());
    return Array.from(seasons).filter(s => s !== "Sconosciuta").sort((a, b) => b.localeCompare(a));
  }, [competitions, couples]);

  const uniqueClasses = useMemo(() => Array.from(new Set(couples.map(c => c.class).filter(Boolean))).sort(), [couples]);
  const uniqueCategories = useMemo(() => Array.from(new Set(couples.map(c => c.category).filter(Boolean))).sort(), [couples]);

  // Overview Filters logic
  const filteredCouples = useMemo(() => {
    return couples.filter(couple => {
      if (selectedInstructor !== "all") {
        const prof = profiles.find(p => p.id === selectedInstructor);
        if (prof) {
          const isResponsible = couple.instructor_id === prof.id || 
                                isInstructorResponsibleForCouple(couple.athlete1, couple.athlete2, prof) ||
                                isInstructorResponsibleForCoupleByResponsabili(prof.full_name, couple.responsabili || []);
          if (!isResponsible) return false;
        } else {
          return false;
        }
      }
      if (selectedClass !== "all" && couple.class !== selectedClass) return false;
      if (selectedCategory !== "all" && couple.category !== selectedCategory) return false;
      if (selectedSeason !== "all") {
        const coupleEntries = entries.filter(e => e.couple_id === couple.id);
        if (coupleEntries.length > 0) {
          const hasEntryInSeason = coupleEntries.some(e => {
            const comp = competitions.find(c => c.id === e.competition_id);
            return comp && getSeason(comp.date) === selectedSeason;
          });
          if (!hasEntryInSeason) return false;
        } else {
          if (getSeason(couple.created_at) !== selectedSeason) return false;
        }
      }
      return true;
    });
  }, [couples, selectedInstructor, selectedClass, selectedCategory, selectedSeason, entries, competitions]);

  const filteredEntries = useMemo(() => {
    const coupleIds = new Set(filteredCouples.map(c => c.id));
    return entries.filter(e => {
      if (!coupleIds.has(e.couple_id)) return false;
      if (selectedSeason !== "all") {
        const comp = competitions.find(c => c.id === e.competition_id);
        if (!comp || getSeason(comp.date) !== selectedSeason) return false;
      }
      return true;
    });
  }, [entries, filteredCouples, selectedSeason, competitions]);

  // Overview KPIs
  const certificateStats = useMemo(() => {
    let valid = 0, expired = 0, missing = 0;
    const today = new Date();
    const checkedAthletes = new Set<string>();
    filteredCouples.forEach(c => {
      [c.athlete1, c.athlete2].forEach(a => {
        if (!a || checkedAthletes.has(a.id)) return;
        checkedAthletes.add(a.id);
        if (!a.medical_certificate_expiry) missing++;
        else if (new Date(a.medical_certificate_expiry) < today) expired++;
        else valid++;
      });
    });
    return { valid, expired, missing };
  }, [filteredCouples]);

  const totalAnomalies = useMemo(() => {
    let count = 0;
    const today = new Date();
    filteredCouples.forEach(couple => {
      if (!couple.athlete1 || !couple.athlete2) return;
      const validation = validateCoupleCategory({
        storedCategory: couple.category,
        athlete1BirthDateISO: couple.athlete1.birth_date,
        athlete2BirthDateISO: couple.athlete2.birth_date,
        onDate: today,
      });
      let hasAnomaly = !validation.ok;
      [couple.athlete1, couple.athlete2].forEach(a => {
        if (!a.medical_certificate_expiry || new Date(a.medical_certificate_expiry) < today) hasAnomaly = true;
      });
      if (hasAnomaly) count++;
    });
    return count;
  }, [filteredCouples]);

  const entriesByCompetitionData = useMemo(() => {
    const compCounts: Record<string, number> = {};
    filteredEntries.forEach(e => {
      const comp = competitions.find(c => c.id === e.competition_id);
      if (comp) compCounts[comp.name] = (compCounts[comp.name] || 0) + 1;
    });
    return Object.entries(compCounts).map(([name, count]) => ({ name, iscrizioni: count })).sort((a, b) => b.iscrizioni - a.iscrizioni).slice(0, 10);
  }, [filteredEntries, competitions]);

  const certPieData = [
    { name: 'Validi', value: certificateStats.valid, color: '#10b981' },
    { name: 'Scaduti', value: certificateStats.expired, color: '#ef4444' },
    { name: 'Mancanti', value: certificateStats.missing, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // --- NEW ADMIN/SUPERVISOR KPIs ---
  // KPI 1: Allievi per istruttore
  const athletesPerInstructor = useMemo(() => {
    if (role !== "admin" && role !== "supervisor") return [];
    const instructorCounts: Record<string, Set<string>> = {};
    profiles.forEach(p => instructorCounts[p.full_name] = new Set());
    
    filteredCouples.forEach(c => {
       const resp = c.responsabili || [];
       const coupleInstructors = profiles.filter(p => 
           c.instructor_id === p.id || 
           isInstructorResponsibleForCouple(c.athlete1, c.athlete2, p) ||
           isInstructorResponsibleForCoupleByResponsabili(p.full_name, resp)
       );
       coupleInstructors.forEach(instructor => {
         if (c.athlete1) instructorCounts[instructor.full_name].add(c.athlete1.id);
         if (c.athlete2) instructorCounts[instructor.full_name].add(c.athlete2.id);
       });
    });
    return Object.entries(instructorCounts)
      .map(([name, athletesSet]) => ({ name, allievi: athletesSet.size }))
      .filter(item => item.allievi > 0)
      .sort((a, b) => b.allievi - a.allievi);
  }, [filteredCouples, profiles, role]);

  // KPI 2: Coppie per gara per istruttore
  const entriesPerCompPerInst = useMemo(() => {
    if (role !== "admin" && role !== "supervisor") return { data: [], instructors: [] };
    const compsMap: Record<string, Record<string, number>> = {};
    const usedInstructors = new Set<string>();
    
    filteredEntries.forEach(e => {
       const comp = competitions.find(c => c.id === e.competition_id);
       if (!comp) return;
       const cName = comp.name;
       if (!compsMap[cName]) compsMap[cName] = {};
       
       const couple = filteredCouples.find(c => c.id === e.couple_id);
       if (!couple) return;
       
       const resp = couple.responsabili || [];
       const coupleInstructors = profiles.filter(p => 
           couple.instructor_id === p.id || 
           isInstructorResponsibleForCouple(couple.athlete1, couple.athlete2, p) ||
           isInstructorResponsibleForCoupleByResponsabili(p.full_name, resp)
       );
       
       if (coupleInstructors.length === 0) {
           compsMap[cName]['Nessun Istruttore'] = (compsMap[cName]['Nessun Istruttore'] || 0) + 1;
           usedInstructors.add('Nessun Istruttore');
       } else {
           coupleInstructors.forEach(instructor => {
               compsMap[cName][instructor.full_name] = (compsMap[cName][instructor.full_name] || 0) + 1;
               usedInstructors.add(instructor.full_name);
           });
       }
    });
    
    const data = Object.keys(compsMap).map(cName => ({ name: cName, ...compsMap[cName] }));
    data.sort((a, b) => {
        const totalA = Object.keys(a).filter(k => k !== 'name').reduce((sum, k) => sum + (a[k] as number), 0);
        const totalB = Object.keys(b).filter(k => k !== 'name').reduce((sum, k) => sum + (b[k] as number), 0);
        return totalB - totalA;
    });
    return { data, instructors: Array.from(usedInstructors) };
  }, [filteredEntries, filteredCouples, competitions, profiles, role]);

  // KPI 3: Anomalie per istruttore
  const anomaliesPerInstructor = useMemo(() => {
    if (role !== "admin" && role !== "supervisor") return [];
    const instructorCounts: Record<string, number> = {};
    const today = new Date();
    
    filteredCouples.forEach(couple => {
       if (!couple.athlete1 || !couple.athlete2) return;
       const validation = validateCoupleCategory({
         storedCategory: couple.category,
         athlete1BirthDateISO: couple.athlete1.birth_date,
         athlete2BirthDateISO: couple.athlete2.birth_date,
         onDate: today,
       });
       let hasAnomaly = !validation.ok;
       [couple.athlete1, couple.athlete2].forEach(a => {
         if (!a.medical_certificate_expiry || new Date(a.medical_certificate_expiry) < today) hasAnomaly = true;
       });
       
       if (hasAnomaly) {
           const resp = couple.responsabili || [];
           const coupleInstructors = profiles.filter(p => 
               couple.instructor_id === p.id || 
               isInstructorResponsibleForCouple(couple.athlete1, couple.athlete2, p) ||
               isInstructorResponsibleForCoupleByResponsabili(p.full_name, resp)
           );
           coupleInstructors.forEach(instructor => {
               instructorCounts[instructor.full_name] = (instructorCounts[instructor.full_name] || 0) + 1;
           });
       }
    });
    return Object.entries(instructorCounts)
      .map(([name, anomalie]) => ({ name, anomalie }))
      .sort((a, b) => b.anomalie - a.anomalie);
  }, [filteredCouples, profiles, role]);

  // KPI 4: Storico Gara
  const [selectedHistoricalComp, setSelectedHistoricalComp] = useState<string>("");
  const uniqueCompetitionNames = useMemo(() => Array.from(new Set(competitions.map(c => c.name))).sort(), [competitions]);
  
  useEffect(() => {
     if (uniqueCompetitionNames.length > 0 && !selectedHistoricalComp) {
         setSelectedHistoricalComp(uniqueCompetitionNames[0]);
     }
  }, [uniqueCompetitionNames, selectedHistoricalComp]);
  
  const historicalCompData = useMemo(() => {
      if (role !== "admin" && role !== "supervisor") return { data: [], instructors: [] };
      if (!selectedHistoricalComp) return { data: [], instructors: [] };
      
      const compEntries = entries.filter(e => {
          const c = competitions.find(comp => comp.id === e.competition_id);
          return c && c.name === selectedHistoricalComp;
      });
      
      const yearlyData: Record<string, Record<string, number>> = {};
      const usedInstructors = new Set<string>();
      
      compEntries.forEach(e => {
          const comp = competitions.find(c => c.id === e.competition_id);
          if (!comp) return;
          const season = getSeason(comp.date);
          if (!yearlyData[season]) yearlyData[season] = {};
          
          const couple = couples.find(c => c.id === e.couple_id);
          if (!couple) return;
          
          const resp = couple.responsabili || [];
          const coupleInstructors = profiles.filter(p => 
               couple.instructor_id === p.id || 
               isInstructorResponsibleForCouple(couple.athlete1, couple.athlete2, p) ||
               isInstructorResponsibleForCoupleByResponsabili(p.full_name, resp)
          );
          
          coupleInstructors.forEach(instructor => {
               yearlyData[season][instructor.full_name] = (yearlyData[season][instructor.full_name] || 0) + 1;
               usedInstructors.add(instructor.full_name);
          });
      });
      
      const data = Object.keys(yearlyData).sort().map(season => ({ name: season, ...yearlyData[season] }));
      return { data, instructors: Array.from(usedInstructors) };
  }, [selectedHistoricalComp, entries, couples, competitions, profiles, role]);


  if (dashboardLoading || entriesLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Caricamento statistiche...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black tracking-tight uppercase">Statistiche</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Analisi, incroci dati e dashboard personalizzate.
          </p>
        </div>
        {activeTab !== "overview" && (
          <Button onClick={() => setIsBuilderOpen(true)} className="rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all">
            <BarChartIcon className="w-4 h-4 mr-2" />
            Aggiungi Grafico
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-2xl h-12 p-1">
            <TabsTrigger value="overview" className="rounded-xl font-bold px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm">
              Overview
            </TabsTrigger>
            {customTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="rounded-xl font-bold px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm group flex items-center gap-2">
                {tab.name}
                <X className="w-3 h-3 opacity-50 hover:opacity-100 hover:text-destructive transition-colors" onClick={(e) => handleDeleteTab(tab.id, e)} />
              </TabsTrigger>
            ))}
          </TabsList>
          
          <Button variant="ghost" size="icon" onClick={handleAddTab} className="ml-2 h-12 w-12 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-primary hover:text-primary transition-colors text-muted-foreground shrink-0">
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        <TabsContent value="overview" className="mt-0 outline-none">
          {/* Filters */}
          <Card className="mb-8 border-none shadow-sm bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stagione</label>
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger><SelectValue placeholder="Tutte le stagioni" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le stagioni</SelectItem>
                    {availableSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {(role === "admin" || role === "supervisor") && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Istruttore</label>
                  <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                    <SelectTrigger><SelectValue placeholder="Tutti gli istruttori" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti gli istruttori</SelectItem>
                      {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classe</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger><SelectValue placeholder="Tutte le classi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le classi</SelectItem>
                    {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger><SelectValue placeholder="Tutte le categorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le categorie</SelectItem>
                    {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-none shadow-sm bg-blue-500/5">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase">Coppie Filtrate</p>
                  <h3 className="text-3xl font-black">{filteredCouples.length}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-indigo-500/5">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase">Partecipazioni</p>
                  <h3 className="text-3xl font-black">{filteredEntries.length}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-green-500/5">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase">Certificati Validi</p>
                  <h3 className="text-3xl font-black">{certificateStats.valid}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-rose-500/5">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                  <FileWarning className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase">Anomalie Riscontrate</p>
                  <h3 className="text-3xl font-black">{totalAnomalies}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="lg:col-span-2 shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
              <CardHeader><CardTitle>Top 10 Gare per Partecipazioni (Filtro Attivo)</CardTitle></CardHeader>
              <CardContent>
                {entriesByCompetitionData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={entriesByCompetitionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} />
                        <YAxis allowDecimals={false} />
                        <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="iscrizioni" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Nessun dato disponibile.</div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
              <CardHeader><CardTitle>Stato Certificati</CardTitle></CardHeader>
              <CardContent>
                {certPieData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={certPieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                          {certPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Nessun dato disponibile.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ADMIN/SUPERVISOR KPIs */}
          {(role === "admin" || role === "supervisor") && (
            <div className="space-y-6 mb-8 border-t border-neutral-200 dark:border-neutral-800 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-black uppercase tracking-tight">Statistiche Staff</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* KPI 1: Allievi per istruttore */}
                <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
                  <CardHeader><CardTitle>Allievi Tesserati per Istruttore</CardTitle></CardHeader>
                  <CardContent>
                    {athletesPerInstructor.length > 0 ? (
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={athletesPerInstructor} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                            <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="allievi" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-muted-foreground">Nessun dato.</div>
                    )}
                  </CardContent>
                </Card>

                {/* KPI 3: Anomalie per istruttore */}
                <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
                  <CardHeader><CardTitle>Anomalie da Risolvere (Per Istruttore)</CardTitle></CardHeader>
                  <CardContent>
                    {anomaliesPerInstructor.length > 0 ? (
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={anomaliesPerInstructor} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                            <Bar dataKey="anomalie" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-green-600 font-bold">Nessuna anomalia riscontrata! 🎉</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* KPI 2: Coppie per gara per istruttore */}
              <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
                <CardHeader><CardTitle>Coppie Iscritte alle Gare (Divise per Istruttore)</CardTitle></CardHeader>
                <CardContent>
                  {entriesPerCompPerInst.data.length > 0 ? (
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={entriesPerCompPerInst.data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                          <Legend verticalAlign="top" height={36} />
                          {entriesPerCompPerInst.instructors.map((instructor, idx) => (
                             <Bar key={instructor} dataKey={instructor} stackId="a" fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">Nessun dato.</div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 4: Storico Gara */}
              <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle>Storico Partecipazioni a Specifica Gara</CardTitle>
                  <Select value={selectedHistoricalComp} onValueChange={setSelectedHistoricalComp}>
                    <SelectTrigger className="w-full sm:w-[300px]"><SelectValue placeholder="Seleziona una competizione..." /></SelectTrigger>
                    <SelectContent>
                      {uniqueCompetitionNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {historicalCompData.data.length > 0 ? (
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historicalCompData.data} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                          <Legend verticalAlign="top" height={36} />
                          {historicalCompData.instructors.map((instructor, idx) => (
                             <Line key={instructor} type="monotone" dataKey={instructor} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                       {selectedHistoricalComp ? "Nessun dato storico per questa gara." : "Seleziona una gara per visualizzare i trend."}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}
        </TabsContent>

        {customTabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0 outline-none">
            <CustomDashboard 
              charts={tab.charts}
              athletes={athletes}
              couples={couples}
              competitions={competitions}
              entries={entries}
              profiles={profiles}
              onDeleteChart={handleDeleteChart}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ChartBuilder 
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSave={handleAddChart}
      />
    </Layout>
  );
}
