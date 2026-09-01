import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { useUserRole } from "@/hooks/use-user-role";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, FileWarning, Trophy, ClipboardList, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { validateCoupleCategory } from "@/lib/category-validation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// Utility per calcolare la stagione (Settembre - Agosto)
const getSeason = (dateString: string | Date | null) => {
  if (!dateString) return "Sconosciuta";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, 8 is September
  if (month >= 8) {
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
};

const getCurrentSeason = () => getSeason(new Date());

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function Statistics() {
  const { role, userId } = useUserRole();
  const { athletes, couples, competitions, profiles, loading: dashboardLoading } = useDashboardData(role, userId);
  
  const [entries, setEntries] = useState<any[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  
  // Filters
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

  // Compute available seasons from competitions and couples
  const availableSeasons = useMemo(() => {
    const seasons = new Set<string>();
    competitions.forEach(c => {
      if (c.date) seasons.add(getSeason(c.date));
    });
    couples.forEach(c => {
      if (c.created_at) seasons.add(getSeason(c.created_at));
    });
    seasons.add(getCurrentSeason());
    return Array.from(seasons).filter(s => s !== "Sconosciuta").sort((a, b) => b.localeCompare(a));
  }, [competitions, couples]);

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(couples.map(c => c.class).filter(Boolean))).sort();
  }, [couples]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(couples.map(c => c.category).filter(Boolean))).sort();
  }, [couples]);

  // Apply filters
  const filteredCouples = useMemo(() => {
    return couples.filter(couple => {
      if (selectedInstructor !== "all" && couple.instructor_id !== selectedInstructor) return false;
      if (selectedClass !== "all" && couple.class !== selectedClass) return false;
      if (selectedCategory !== "all" && couple.category !== selectedCategory) return false;
      if (selectedSeason !== "all") {
        // A couple is part of a season if it was created in that season or has entries in that season.
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

  // KPIs
  const totalCouples = filteredCouples.length;
  const totalEntries = filteredEntries.length;

  const certificateStats = useMemo(() => {
    let valid = 0;
    let expired = 0;
    let missing = 0;
    const today = new Date();

    const checkedAthletes = new Set<string>();

    filteredCouples.forEach(c => {
      [c.athlete1, c.athlete2].forEach(a => {
        if (!a || checkedAthletes.has(a.id)) return;
        checkedAthletes.add(a.id);
        
        if (!a.medical_certificate_expiry) {
          missing++;
        } else if (new Date(a.medical_certificate_expiry) < today) {
          expired++;
        } else {
          valid++;
        }
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
        if (!a.medical_certificate_expiry || new Date(a.medical_certificate_expiry) < today) {
          hasAnomaly = true;
        }
      });

      if (hasAnomaly) count++;
    });
    return count;
  }, [filteredCouples]);

  // Chart Data
  const entriesByCompetitionData = useMemo(() => {
    const compCounts: Record<string, number> = {};
    filteredEntries.forEach(e => {
      const comp = competitions.find(c => c.id === e.competition_id);
      if (comp) {
        compCounts[comp.name] = (compCounts[comp.name] || 0) + 1;
      }
    });
    
    return Object.entries(compCounts)
      .map(([name, count]) => ({ name, iscrizioni: count }))
      .sort((a, b) => b.iscrizioni - a.iscrizioni)
      .slice(0, 10); // Top 10
  }, [filteredEntries, competitions]);

  const certPieData = [
    { name: 'Validi', value: certificateStats.valid, color: '#10b981' },
    { name: 'Scaduti', value: certificateStats.expired, color: '#ef4444' },
    { name: 'Mancanti', value: certificateStats.missing, color: '#f59e0b' },
  ].filter(d => d.value > 0);

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
      <div className="mb-8">
        <h1 className="text-4xl font-display font-black tracking-tight uppercase">Statistiche</h1>
        <p className="text-muted-foreground font-medium mt-1">
          Analisi e incroci dati per stagione, categorie e gare.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-8 border-none shadow-sm bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stagione</label>
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger>
                <SelectValue placeholder="Tutte le stagioni" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le stagioni</SelectItem>
                {availableSeasons.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(role === "admin" || role === "supervisor") && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Istruttore</label>
              <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti gli istruttori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli istruttori</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.full_name}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classe</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Tutte le classi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le classi</SelectItem>
                {uniqueClasses.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Tutte le categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {uniqueCategories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
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
              <h3 className="text-3xl font-black">{totalCouples}</h3>
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
              <h3 className="text-3xl font-black">{totalEntries}</h3>
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
          <CardHeader>
            <CardTitle>Top 10 Gare per Partecipazioni (Filtro Attivo)</CardTitle>
          </CardHeader>
          <CardContent>
            {entriesByCompetitionData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={entriesByCompetitionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }} 
                      tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                    />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="iscrizioni" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nessun dato disponibile con i filtri attuali.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
          <CardHeader>
            <CardTitle>Stato Certificati (Atleti Filtrati)</CardTitle>
          </CardHeader>
          <CardContent>
            {certPieData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={certPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {certPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nessun dato disponibile.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </Layout>
  );
}
