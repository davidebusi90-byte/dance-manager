import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { validateCoupleCategory } from "@/lib/category-validation";

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

    // Get enrolled event names
    const enrolledEvents = (entry.event_type_ids || [])
        .map(id => eventTypes.find(et => et.id === id)?.event_name)
        .filter(Boolean);

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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">Dettagli Coppia</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Athletes Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground">Cavaliere</h3>
                            <div className="space-y-1">
                                <p className="font-medium">{athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "-"}</p>
                                <p className="text-sm text-muted-foreground">Codice: {athlete1?.code || "-"}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground">Dama</h3>
                            <div className="space-y-1">
                                <p className="font-medium">{athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "-"}</p>
                                <p className="text-sm text-muted-foreground">Codice: {athlete2?.code || "-"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Category and Class */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">Categoria e Classe</h3>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{couple.category}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="font-medium">Classe {couple.class}</span>
                        </div>
                    </div>

                    {/* Responsabili */}
                    {responsabiliArray.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground">Responsabili</h3>
                            <div className="flex flex-wrap gap-2">
                                {responsabiliArray.map(resp => (
                                    <Badge key={resp} variant="secondary">{resp}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Disciplines */}
                    {couple.disciplines && couple.disciplines.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground">Discipline</h3>
                            <div className="flex flex-wrap gap-2">
                                {couple.disciplines.map(disc => (
                                    <Badge key={disc} variant="outline">{disc}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enrolled Events */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">Gare Iscritte</h3>
                        {enrolledEvents.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {enrolledEvents.map(event => (
                                    <Badge key={event} className="bg-primary/10 text-primary border-primary/20">
                                        {event}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">Nessuna gara selezionata</p>
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
                        <Badge className={entry.is_paid ? "bg-success text-success-foreground" : "bg-secondary"}>
                            {entry.is_paid ? "Pagato" : "Da Pagare"}
                        </Badge>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
