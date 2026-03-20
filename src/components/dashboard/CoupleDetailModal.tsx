import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { validateCoupleCategory } from "@/lib/category-validation";
import { isEventAllowedForCouple } from "@/lib/enrollment-utils";

interface Athlete {
    id: string;
    code: string;
    first_name: string;
    last_name: string;
    gender?: string | null;
    birth_date?: string | null;
    instructor_id?: string | null;
    responsabili?: string[] | null;
}

interface CompetitionEntry {
    id: string;
    couple_id: string;
    status: string;
    created_at: string;
    is_paid: boolean;
    couples: {
        id: string;
        category: string;
        class: string;
        disciplines?: string[];
        responsabili?: string[];
        athlete1_id: string;
        athlete2_id: string;
        athlete1?: Athlete;
        athlete2?: Athlete;
    };
    event_type_ids: string[];
}

interface EventType {
    id: string;
    event_name: string;
    allowed_classes: string[];
    min_age: number | null;
    max_age: number | null;
}

interface CoupleDetailModalProps {
    entry: CompetitionEntry | null;
    eventTypes: EventType[];
    onClose: () => void;
}

export default function CoupleDetailModal({
    entry,
    eventTypes,
    onClose,
}: CoupleDetailModalProps) {
    const { role } = useUserRole();
    const { toast } = useToast();
    const [isDeactivating, setIsDeactivating] = useState(false);

    if (!entry || !entry.couples) return null;

    const couple = entry.couples;
    let athlete1 = couple.athlete1;
    let athlete2 = couple.athlete2;

    // Ensure Male is in the First Position (Cavaliere)
    if (athlete2?.gender === 'M' && athlete1?.gender !== 'M') {
        [athlete1, athlete2] = [athlete2, athlete1];
    } else if (athlete1?.gender === 'F' && athlete2?.gender === 'M') {
        [athlete1, athlete2] = [athlete2, athlete1];
    }

    const enrolledEventIds = entry.event_type_ids || [];
    const enrolledEvents = enrolledEventIds
        .map(id => eventTypes.find(et => et.id === id)?.event_name)
        .filter(Boolean);

    const missingEvents = eventTypes
        .filter(et => !enrolledEventIds.includes(et.id))
        .filter(et => isEventAllowedForCouple(et, couple))
        .map(et => et.event_name);

    // Check for category anomalies
    const categoryCheck = validateCoupleCategory({
        storedCategory: couple.category,
        athlete1BirthDateISO: athlete1?.birth_date ?? null,
        athlete2BirthDateISO: athlete2?.birth_date ?? null,
    });

    // Use couple's responsabili field directly
    const responsabiliArray = couple.responsabili || [];

    return (
        <Dialog open={!!entry} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl sm:max-h-[90vh] w-full h-full sm:h-auto overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Dettagli Coppia</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Athletes Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 bg-muted/10 p-3 rounded-lg sm:bg-transparent sm:p-0">
                            <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Cavaliere</h3>
                            <div className="space-y-1">
                                <p className="font-bold sm:font-medium text-lg sm:text-base">{athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "-"}</p>
                                <p className="text-sm text-muted-foreground">Codice: {athlete1?.code || "-"}</p>
                            </div>
                        </div>
                        <div className="space-y-2 bg-muted/10 p-3 rounded-lg sm:bg-transparent sm:p-0">
                            <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Dama</h3>
                            <div className="space-y-1">
                                <p className="font-bold sm:font-medium text-lg sm:text-base">{athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "-"}</p>
                                <p className="text-sm text-muted-foreground">Codice: {athlete2?.code || "-"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Category and Class */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Categoria e Classe</h3>
                        <div className="flex items-center gap-2 bg-[#dcfce7] p-3 rounded-lg border border-[#bbf7d0]">
                            <span className="font-bold text-[#166534]">{couple.category}</span>
                            <span className="text-[#166534]/50">/</span>
                            <span className="font-bold text-[#166534]">Classe {couple.class}</span>
                        </div>
                    </div>

                    {/* Responsabili */}
                    {responsabiliArray.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Responsabili</h3>
                            <div className="flex flex-wrap gap-2">
                                {responsabiliArray.map(resp => (
                                    <Badge key={resp} variant="secondary" className="px-3 py-1">{resp}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Disciplines */}
                    {couple.disciplines && couple.disciplines.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Discipline</h3>
                            <div className="flex flex-wrap gap-2">
                                {couple.disciplines.map(disc => (
                                    <Badge key={disc} variant="outline" className="px-3 py-1">{disc}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enrolled Events */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">Gare Selezionate</h3>
                        {(enrolledEvents.length > 0 || missingEvents.length > 0) ? (
                            <div className="flex flex-wrap gap-2">
                                {enrolledEvents.map(event => (
                                    <Badge key={`enrolled-${event}`} className="bg-primary/10 text-primary border-primary/20">
                                        {event}
                                    </Badge>
                                ))}
                                {missingEvents.map(event => (
                                    <Badge key={`missing-${event}`} variant="outline" className="bg-gray-50 border-gray-300 text-black line-through">
                                        {event}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">-</p>
                        )}
                    </div>

                    {/* Anomalies */}
                    {!categoryCheck.ok && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-warning" />
                                Anomalie
                            </h3>
                            <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
                                <p className="text-sm text-warning-foreground">
                                    {"reason" in categoryCheck ? categoryCheck.reason : "Errore non specificato"}
                                </p>
                            </div>
                        </div>
                    )}

                    {categoryCheck.ok && (
                        <div className="flex items-center gap-2 text-success">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">Nessuna anomalia rilevata</span>
                        </div>
                    )}

                    {/* Payment Status */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">Stato Pagamento</h3>
                        <Badge
                            variant="secondary"
                            className={`px-3 py-1 font-semibold ${entry.is_paid
                                ? "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]"
                                : "bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]"}`}
                        >
                            {entry.is_paid ? "Pagato" : "Da Pagare"}
                        </Badge>
                    </div>

                    {/* Deactivation Button (Admin Only) */}
                    {role === "admin" && (
                        <div className="pt-6 mt-4 border-t border-destructive/10">
                            <button
                                onClick={async () => {
                                    if (!confirm("Sei sicuro di voler disattivare questa coppia? Verrà spostata nella sezione 'Coppie Disattivate'.")) return;
                                    setIsDeactivating(true);
                                    try {
                                        const { error } = await supabase
                                            .from("couples")
                                            .update({ is_active: false } as any)
                                            .eq("id", couple.id);
                                        
                                        if (error) throw error;
                                        
                                        toast({ title: "Coppia disattivata", description: "La coppia è stata spostata tra quelle disattivate." });
                                        onClose();
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
                                {isDeactivating ? "Disattivazione..." : "Disattiva Coppia"}
                            </button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
