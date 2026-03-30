import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Mail, 
  Calendar, 
  IdCard, 
  Crosshair, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { formatCategoryDisplay, getSportsAge } from "@/lib/category-validation";
import { getBestClass } from "@/lib/class-utils";
import { resolveDisciplineClass, normalizeClassDisplay } from "@/lib/discipline-utils";

import { Athlete, Couple } from "@/types/dashboard";
import { isCidAndCategorySwapped } from "@/lib/athlete-utils";

interface AthleteDetailModalProps {
  athlete: Athlete | null;
  allAthletes?: Athlete[];
  couples?: Couple[];
  onClose: () => void;
}

export default function AthleteDetailModal({ athlete, allAthletes = [], couples = [], onClose }: AthleteDetailModalProps) {
  const { role } = useUserRole();
  const { toast } = useToast();
  const [isDeactivating, setIsDeactivating] = useState(false);

  if (!athlete) return null;

  // We use the same 'bacino' (pool) of data: we check the athlete first,
  // and then fallback to the couples they belong to (just like the couples list does)
  const getDisciplineClass = (couple: Couple, key: string) => {
    // We can't easily use resolveDisciplineClass here because we only have one couple 
    // at a time in the loop, but we want the athlete info to be considered.
    // However, resolveDisciplineClass handles exactly this.
    const a1 = couple.athlete1_id === athlete.id ? athlete : null;
    const a2 = couple.athlete2_id === athlete.id ? athlete : null;
    return resolveDisciplineClass(key, a1, a2, couple);
  };

  // RESOLUTION LOGIC: Merge data from all possible sources (pool of data)
  // Apply swap heuristic for display
  const isSwapped = isCidAndCategorySwapped(athlete.code, athlete.category);
  const displayCode = isSwapped ? athlete.category : athlete.code;
  const rawCategory = isSwapped ? athlete.code : athlete.category;

  const relatedAthletes = allAthletes.filter(a => a.code === athlete.code);
  const relatedAthleteIds = new Set(relatedAthletes.map(a => a.id));
  relatedAthleteIds.add(athlete.id);

  let derivedCategory = rawCategory;

  // 1. Accumulate discipline info from all related records (dynamic keys)
  const derivedDisciplineInfo: Record<string, string> = {};

  const mergeInfo = (info: Record<string, string> | null | undefined) => {
    if (!info) return;
    Object.entries(info).forEach(([key, cls]) => {
      if (cls && cls !== "-") {
        derivedDisciplineInfo[key] = derivedDisciplineInfo[key] ? getBestClass(derivedDisciplineInfo[key], cls) : cls;
      }
    });
  };

  // Start with current athlete's info
  mergeInfo(athlete.discipline_info);

  // Merge from related athletes (duplicates/backups)
  relatedAthletes.forEach(a => mergeInfo(a.discipline_info));

  // Merge from couples
  if (couples.length > 0) {
    const athleteCouples = couples.filter(c => 
      relatedAthleteIds.has(c.athlete1_id) || relatedAthleteIds.has(c.athlete2_id)
    );
    
    const disciplinesToDisplay = ["latino", "standard", "combinata", "show_dance_sa", "show_dance_classic"];
    
    athleteCouples.forEach(c => {
      if (c.category) derivedCategory = c.category;
      disciplinesToDisplay.forEach(d => {
        const cls = getDisciplineClass(c, d);
        if (cls && cls !== "-") {
          derivedDisciplineInfo[d] = derivedDisciplineInfo[d] ? getBestClass(derivedDisciplineInfo[d], cls) : cls;
        }
      });
    });
  }

  // FINAL FALLBACK: If we still don't have basic disciplines, use the athlete's 'class' property
  // This handles athletes (singles or couples) that only have the general 'class' saved (legacy)
  if (athlete.class) {
    if (!derivedDisciplineInfo.latino && !derivedDisciplineInfo.standard && !derivedDisciplineInfo.combinata) {
      ["latino", "standard", "combinata"].forEach(d => {
        if (!derivedDisciplineInfo[d] || derivedDisciplineInfo[d] === "-") {
          derivedDisciplineInfo[d] = athlete.class;
        }
      });
    }
  }

  // Apply final normalization for display
  Object.keys(derivedDisciplineInfo).forEach(key => {
    derivedDisciplineInfo[key] = normalizeClassDisplay(derivedDisciplineInfo[key]);
  });

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const getCertificateStatusState = (expiry: string | null) => {
    if (!expiry) return { 
      label: "Mancante", 
      class: "bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]" 
    };
    
    const expiryDate = new Date(expiry);
    const isExpired = expiryDate < new Date();
    
    return isExpired
      ? { label: "Scaduto", class: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]" }
      : { label: "Valido", class: "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]" };
  };

  const certStatus = getCertificateStatusState(athlete.medical_certificate_expiry);
  const age = athlete.birth_date ? getSportsAge(athlete.birth_date, new Date()) : null;

  return (
    <Dialog open={!!athlete} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl sm:max-h-[90vh] w-full h-full sm:h-auto overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Dettagli Atleta</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Athlete Info */}
          <div className="space-y-2 bg-muted/10 p-4 rounded-lg">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Anagrafica</h3>
            <div className="space-y-1">
              <p className="font-bold text-xl">{athlete.first_name} {athlete.last_name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5" />
                  CID: {displayCode}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  Sesso: {athlete.gender === 'M' ? 'Maschio' : athlete.gender === 'F' ? 'Femmina' : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Categoria e Classe - Multi-discipline layout */}
          <div className="space-y-2">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Inquadramento</h3>
            <div className="bg-muted/10 p-4 rounded-lg border border-border/50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center justify-between lg:justify-start lg:gap-4 flex-1">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Categoria</span>
                <span className="font-bold text-primary text-lg">{formatCategoryDisplay(derivedCategory as any)}</span>
              </div>
              
              <div className="flex items-center justify-between lg:justify-end lg:gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-border/50">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Classi</span>
                <div className="flex flex-wrap gap-2 justify-end">
                  {/* Latini */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center font-bold text-orange-700 shadow-sm text-sm sm:text-base">
                      {derivedDisciplineInfo.latino || "-"}
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-orange-600/70 tracking-tighter">LAT</span>
                  </div>
                  
                  {/* Standard */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 shadow-sm text-sm sm:text-base">
                      {derivedDisciplineInfo.standard || "-"}
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-blue-600/70 tracking-tighter">STD</span>
                  </div>
                  
                  {/* Combinata */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-100 border border-border/50 flex items-center justify-center font-bold text-purple-700 shadow-sm text-sm sm:text-base">
                      {derivedDisciplineInfo.combinata || "-"}
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-purple-700 tracking-tighter">CMB</span>
                  </div>

                  {/* Show Dance SA */}
                  {(derivedDisciplineInfo.show_dance_sa || derivedDisciplineInfo.show_dance) && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-pink-100 border border-pink-200 flex items-center justify-center font-bold text-pink-700 shadow-sm text-sm sm:text-base">
                        {derivedDisciplineInfo.show_dance_sa || derivedDisciplineInfo.show_dance || "-"}
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-pink-600/70 tracking-tighter">SA</span>
                    </div>
                  )}

                  {/* Show Dance Classic */}
                  {derivedDisciplineInfo.show_dance_classic && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center font-bold text-teal-700 shadow-sm text-sm sm:text-base">
                        {derivedDisciplineInfo.show_dance_classic || "-"}
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-teal-600/70 tracking-tighter">CL</span>
                    </div>
                  )}

                  {/* Mostra la classe generale solo se non c'è nessuna info sulle discipline principali */}
                  {(!derivedDisciplineInfo.latino && !derivedDisciplineInfo.standard && !derivedDisciplineInfo.combinata && !derivedDisciplineInfo.show_dance_sa && !derivedDisciplineInfo.show_dance_classic) && athlete.class && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-700 shadow-sm text-sm sm:text-base">
                        {athlete.class}
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-gray-600/70 tracking-tighter">BASE</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Nascita ed Età */}
          <div className="space-y-2">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Data di Nascita</h3>
            <div className="bg-muted/10 p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{formatDate(athlete.birth_date)}</span>
              </div>
              {age !== null && (
                <Badge variant="outline" className="bg-white border-primary/20 text-primary">
                  Età Sportiva: {age} anni
                </Badge>
              )}
            </div>
          </div>

          {/* Certificato Medico */}
          <div className="space-y-2">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Certificato Medico</h3>
            <div className={`flex items-center justify-between p-3 rounded-lg ${certStatus.class}`}>
              <div className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" />
                {certStatus.label}
              </div>
              <span className="text-xs font-medium">Scadenza: {formatDate(athlete.medical_certificate_expiry)}</span>
            </div>
          </div>

          {/* Contatti */}
          {athlete.email && (
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Email</h3>
              <a 
                href={`mailto:${athlete.email}`} 
                className="flex items-center gap-2 bg-muted/10 p-3 rounded-lg text-sm hover:bg-primary/5 hover:text-primary transition-colors group"
              >
                <Mail className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                <span className="font-medium">{athlete.email}</span>
              </a>
            </div>
          )}

          {/* Responsabili */}
          {athlete.responsabili && athlete.responsabili.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Responsabili</h3>
              <div className="flex flex-wrap gap-2">
                {athlete.responsabili.map(resp => (
                  <Badge key={resp} variant="secondary" className="px-3 py-1 flex items-center gap-1.5">
                    <Users className="w-3 h-3 opacity-60" />
                    {resp}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Deactivation Button (Admin Only) */}
          {role === "admin" && !athlete.is_deleted && (
            <div className="pt-6 mt-4 border-t border-destructive/10">
              <button
                onClick={async () => {
                  if (!confirm("Sei sicuro di voler disattivare questo atleta? Verrà spostato nella sezione 'Atleti Disattivati'.")) return;
                  setIsDeactivating(true);
                  try {
                    const { error } = await supabase
                      .from("athletes")
                      .update({ is_deleted: true } as any)
                      .eq("id", athlete.id);
                    
                    if (error) throw error;
                    
                    toast({ title: "Atleta disattivato", description: "L'atleta è stato spostato tra quelli disattivati." });
                    onClose();
                    // Reloader logic would naturally be handled by real-time or page refresh if needed, 
                    // but for now we close and assume the parent will refresh if it has listeners.
                    window.location.reload(); 
                  } catch (err: any) {
                    toast({ title: "Errore", description: err.message, variant: "destructive" });
                  } finally {
                    setIsDeactivating(false);
                  }
                }}
                disabled={isDeactivating}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-destructive/5 text-destructive border border-destructive/20 hover:bg-destructive/10 transition-all font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                {isDeactivating ? "Disattivazione..." : "Disattiva Atleta"}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
