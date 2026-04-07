import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Users, Calendar, UserMinus, UserCheck } from "lucide-react";
import { validateCoupleCategory, getSportsAge } from "@/lib/category-validation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { Athlete, Couple, Profile } from "@/types/dashboard";
import { motion, AnimatePresence } from "framer-motion";

interface CoupleAnomaly {
  couple: Couple;
  athlete1: Athlete;
  athlete2: Athlete;
  categoryIssue: string | null;
  certificateIssues: string[];
}

interface AthleteAnomaly {
  athlete: Athlete;
  issue: string;
  type: "duplicate" | "isolated" | "certificate";
}

export default function Anomalies() {
  const [coupleAnomalies, setCoupleAnomalies] = useState<CoupleAnomaly[]>([]);
  const [athleteAnomalies, setAthleteAnomalies] = useState<AthleteAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, userId } = useUserRole();

  const fetchAnomalies = useCallback(async () => {
    if (role === "loading") return;

    setLoading(true);
    try {
      const [couplesRes, athletesRes, profilesRes] = await Promise.all([
        supabase.from("couples").select("*").eq("is_active", true),
        supabase.from("athletes").select("*").eq("is_deleted", false),
        supabase.from("profiles").select("id, user_id, full_name"),
      ]);

      if (couplesRes.error) throw couplesRes.error;
      if (athletesRes.error) throw athletesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const rawAthletes = (athletesRes.data || []) as Athlete[];
      const rawCouples = (couplesRes.data || []) as Couple[];
      const rawProfiles = (profilesRes.data || []) as Profile[];

      const today = new Date();
      const foundCoupleAnomalies: CoupleAnomaly[] = [];
      const foundAthleteAnomalies: AthleteAnomaly[] = [];

      // 1. ATHLETE ANOMALIES
      // 1a. Duplicates (Same Name + Birth Date)
      const nameKeyMap = new Map<string, Athlete[]>();
      rawAthletes.forEach(a => {
        if (!a.birth_date) return;
        const key = `${a.first_name.trim().toLowerCase()}|${a.last_name.trim().toLowerCase()}|${a.birth_date}`;
        if (!nameKeyMap.has(key)) nameKeyMap.set(key, []);
        nameKeyMap.get(key)!.push(a);
      });

      nameKeyMap.forEach((athletes, key) => {
        if (athletes.length > 1) {
          athletes.forEach(a => {
            foundAthleteAnomalies.push({
              athlete: a,
              issue: `Sospetto duplicato: altri ${athletes.length - 1} atleti con stesso nome e data di nascita`,
              type: "duplicate"
            });
          });
        }
      });

      // 1b. Isolated (No Instructor)
      rawAthletes.forEach(a => {
        if (!a.instructor_id && (!a.responsabili || a.responsabili.length === 0)) {
          foundAthleteAnomalies.push({
            athlete: a,
            issue: "Atleta isolato: nessun istruttore o responsabile assegnato",
            type: "isolated"
          });
        }
      });

      // 1c. Athlete Certificates (Independent of couples)
      rawAthletes.forEach(a => {
        if (!a.medical_certificate_expiry) {
           foundAthleteAnomalies.push({ athlete: a, issue: "Certificato medico mancante", type: "certificate" });
        } else if (new Date(a.medical_certificate_expiry) < today) {
           foundAthleteAnomalies.push({ athlete: a, issue: `Certificato medico scaduto il ${new Date(a.medical_certificate_expiry).toLocaleDateString('it-IT')}`, type: "certificate" });
        }
      });

      // 2. COUPLE ANOMALIES
      const athletesMap = new Map(rawAthletes.map(a => [a.id, a]));
      for (const couple of rawCouples) {
        const athlete1 = athletesMap.get(couple.athlete1_id);
        const athlete2 = athletesMap.get(couple.athlete2_id);

        if (!athlete1 || !athlete2) continue;

        const validation = validateCoupleCategory({
          storedCategory: couple.category,
          athlete1BirthDateISO: athlete1.birth_date,
          athlete2BirthDateISO: athlete2.birth_date,
          onDate: today,
        });

        const categoryIssue = validation.ok ? null : (validation as { reason: string }).reason;
        const certificateIssues: string[] = [];

        const checkCert = (athlete: Athlete, label: string) => {
          if (!athlete.medical_certificate_expiry) {
            certificateIssues.push(`${label}: Certificato mancante`);
          } else if (new Date(athlete.medical_certificate_expiry) < today) {
            certificateIssues.push(`${label}: Certificato scaduto`);
          }
        };

        checkCert(athlete1, "Atleta 1");
        checkCert(athlete2, "Atleta 2");

        if (categoryIssue || certificateIssues.length > 0) {
          foundCoupleAnomalies.push({
            couple,
            athlete1,
            athlete2,
            categoryIssue,
            certificateIssues,
          });
        }
      }

      // Filter by role if not admin
      let finalCouples = foundCoupleAnomalies;
      let finalAthletes = foundAthleteAnomalies;

      if (role !== "admin" && role !== "supervisor") {
        const profile = rawProfiles.find(p => p.user_id === userId);
        if (profile) {
           finalCouples = foundCoupleAnomalies.filter(ca => ca.couple.instructor_id === profile.id);
           finalAthletes = foundAthleteAnomalies.filter(aa => aa.athlete.instructor_id === profile.id);
        } else {
           finalCouples = [];
           finalAthletes = [];
        }
      }

      setCoupleAnomalies(finalCouples);
      setAthleteAnomalies(finalAthletes);
    } catch (error: any) {
      console.error("fetchAnomalies error:", error);
      toast({ title: "Errore nel caricamento", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [role, userId, toast]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Caricamento...</div>;
  }

  const athleteDuplicates = athleteAnomalies.filter(a => a.type === "duplicate");
  const athleteIsolated = athleteAnomalies.filter(a => a.type === "isolated");

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-amber-500/10 dark:bg-amber-500/20 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Integrità Dati & Anomalie</h1>
              <p className="text-muted-foreground font-medium">Monitoraggio automatico della coerenza dei dati</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="px-6 py-3 glass rounded-2xl flex flex-col items-center min-w-[120px]"
            >
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] mb-1">Coppie</span>
              <span className="text-2xl font-display font-bold text-rose-700 dark:text-rose-300">{coupleAnomalies.length}</span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="px-6 py-3 glass rounded-2xl flex flex-col items-center min-w-[120px]"
            >
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mb-1">Atleti</span>
              <span className="text-2xl font-display font-bold text-neutral-700 dark:text-neutral-300">{athleteAnomalies.length}</span>
            </motion.div>
          </div>
        </motion.div>

        <Tabs defaultValue="couples" className="space-y-8">
          <TabsList className="glass p-1 border-white/10">
            <TabsTrigger value="couples" className="px-6 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm">
              Anomalie Coppie ({coupleAnomalies.length})
            </TabsTrigger>
            <TabsTrigger value="athletes" className="px-6 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm">
              Anomalie Atleti ({athleteAnomalies.length})
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="couples" key="couples" className="outline-none">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {coupleAnomalies.length === 0 ? (
                  <div className="col-span-full py-20 text-center glass rounded-3xl">
                    <p className="text-muted-foreground font-medium">Tutte le coppie sono conformi.</p>
                  </div>
                ) : (
                  coupleAnomalies.map((ca, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="h-full border-l-4 border-l-destructive hover:shadow-xl transition-all glass-card group overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Users className="w-12 h-12 rotate-12" />
                        </div>
                        <CardHeader className="py-4">
                          <CardTitle className="text-base font-bold flex items-center gap-3">
                            <span className="p-2 bg-sky-500/10 rounded-xl">
                              <Users className="w-5 h-5 text-sky-600" />
                            </span>
                            <span className="truncate">
                              {ca.athlete1.first_name} {ca.athlete1.last_name} & {ca.athlete2.first_name} {ca.athlete2.last_name}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pb-6">
                          {ca.categoryIssue && (
                            <div className="p-3 bg-destructive/5 dark:bg-destructive/10 rounded-xl border border-destructive/10">
                              <p className="text-destructive text-sm font-semibold flex items-start gap-2">
                                <span className="mt-0.5">⚠️</span> 
                                {ca.categoryIssue}
                              </p>
                            </div>
                          )}
                          {ca.certificateIssues.map((ci, j) => (
                            <div key={j} className="p-3 bg-orange-500/5 dark:bg-orange-500/10 rounded-xl border border-orange-500/10">
                              <p className="text-orange-600 dark:text-orange-400 text-sm font-medium flex items-start gap-2">
                                <span className="mt-0.5">📋</span> 
                                {ci}
                              </p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="athletes" key="athletes" className="outline-none">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-orange-800 dark:text-orange-400 px-1">
                    <UserMinus className="w-5 h-5" />
                    Sospetti Duplicati ({athleteDuplicates.length})
                  </h3>
                  <div className="space-y-3">
                    {athleteDuplicates.length === 0 ? (
                      <div className="p-8 text-center glass rounded-2xl">
                        <p className="text-sm text-muted-foreground">Nessun duplicato sospetto.</p>
                      </div>
                    ) : (
                      athleteDuplicates.map((a, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="p-4 glass-card rounded-2xl border-orange-200/20 group hover:bg-orange-500/5 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm">{a.athlete.first_name} {a.athlete.last_name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono bg-orange-500/5 border-orange-500/20">
                              CID: {a.athlete.code}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                            {a.issue}
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-400 px-1">
                    <UserCheck className="w-5 h-5" />
                    Atleti Isolati ({athleteIsolated.length})
                  </h3>
                  <div className="space-y-3">
                    {athleteIsolated.length === 0 ? (
                      <div className="p-8 text-center glass rounded-2xl">
                        <p className="text-sm text-muted-foreground">Nessun atleta isolato.</p>
                      </div>
                    ) : (
                      athleteIsolated.map((a, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="p-4 glass-card rounded-2xl border-slate-200/20 group hover:bg-sky-500/5 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm">{a.athlete.first_name} {a.athlete.last_name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono bg-slate-500/5 border-slate-500/20">
                              CID: {a.athlete.code}
                            </Badge>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>
    </>
  );
}