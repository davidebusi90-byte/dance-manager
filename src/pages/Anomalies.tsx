import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Users } from "lucide-react";
import { validateCoupleCategory } from "@/lib/category-validation";
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

export default function Anomalies({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [coupleAnomalies, setCoupleAnomalies] = useState<CoupleAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
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

      // 1. COUPLE ANOMALIES (Includes Certificate and Category Checks)
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
            certificateIssues.push(`${label}: Certificato medico mancante`);
          } else if (new Date(athlete.medical_certificate_expiry) < today) {
            const expiryDate = new Date(athlete.medical_certificate_expiry).toLocaleDateString('it-IT');
            certificateIssues.push(`${label}: Certificato medico scaduto il ${expiryDate}`);
          }
        };

        checkCert(athlete1, athlete1.first_name + " " + athlete1.last_name);
        checkCert(athlete2, athlete2.first_name + " " + athlete2.last_name);

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

      if (role !== "admin" && role !== "supervisor") {
        const profile = rawProfiles.find(p => p.user_id === userId);
        if (profile) {
           finalCouples = foundCoupleAnomalies.filter(ca => ca.couple.instructor_id === profile.id);
        } else {
           finalCouples = [];
        }
      }

      setCoupleAnomalies(finalCouples);
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
    return <div className={`${isEmbedded ? 'py-20' : 'min-h-screen flex items-center justify-center bg-background'} text-muted-foreground`}>Caricamento...</div>;
  }

  return (
    <div className={isEmbedded ? "" : "min-h-screen bg-neutral-50/50 dark:bg-neutral-950/50"}>
      <main className={isEmbedded ? "" : "container mx-auto px-4 py-8"}>
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
              <p className="text-muted-foreground font-medium">Situazioni critiche che richiedono attenzione</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="px-6 py-3 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col items-center min-w-[150px]"
            >
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] mb-1">Coppie da Verificare</span>
              <span className="text-2xl font-display font-bold text-rose-700 dark:text-rose-300">{coupleAnomalies.length}</span>
            </motion.div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {coupleAnomalies.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white/50 dark:bg-black/20 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <p className="text-muted-foreground font-medium text-lg">Ottimo lavoro! Tutte le coppie sono conformi.</p>
              </div>
            ) : (
              coupleAnomalies.map((ca, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full border-l-4 border-l-rose-500 hover:shadow-xl transition-all bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm group overflow-hidden rounded-3xl border-neutral-200 dark:border-neutral-800">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Users className="w-12 h-12 rotate-12" />
                    </div>
                    <CardHeader className="py-4">
                      <CardTitle className="text-base font-bold flex items-center gap-3">
                        <span className="p-2 bg-blue-500/10 rounded-xl">
                          <Users className="w-5 h-5 text-blue-600" />
                        </span>
                        <span className="truncate">
                          {ca.athlete1.first_name} {ca.athlete1.last_name} & {ca.athlete2.first_name} {ca.athlete2.last_name}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-6">
                      {ca.categoryIssue && (
                        <div className="p-3 bg-red-500/5 dark:bg-red-500/10 rounded-xl border border-red-500/10">
                          <p className="text-red-700 dark:text-red-400 text-sm font-semibold flex items-start gap-2">
                            <span className="mt-0.5 font-bold">⚠️</span> 
                            {ca.categoryIssue}
                          </p>
                        </div>
                      )}
                      {ca.certificateIssues.map((ci, j) => (
                        <div key={j} className="p-3 bg-orange-500/5 dark:bg-orange-500/10 rounded-xl border border-orange-500/10">
                          <p className="text-orange-700 dark:text-orange-400 text-sm font-medium flex items-start gap-2">
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
        </AnimatePresence>
      </main>
    </div>
  );
}