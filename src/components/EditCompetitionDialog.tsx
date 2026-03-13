import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Loader2 } from "lucide-react";

interface Competition {
    id: string;
    name: string;
    date: string;
    end_date?: string | null;
    location?: string | null;
    registration_deadline?: string | null;
    late_fee_deadline?: string | null;
    description?: string | null;
}

interface EditCompetitionDialogProps {
    competition: Competition;
    onSuccess: () => void;
}

interface CompetitionFormValues {
    name: string;
    date: string;
    end_date: string;
    location: string;
    registration_deadline: string;
    late_fee_deadline: string;
    description: string;
}

export default function EditCompetitionDialog({ competition, onSuccess }: EditCompetitionDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CompetitionFormValues>({
        defaultValues: {
            name: competition.name,
            date: competition.date,
            end_date: competition.end_date || "",
            location: competition.location || "",
            registration_deadline: competition.registration_deadline || "",
            late_fee_deadline: competition.late_fee_deadline || "",
            description: competition.description || "",
        }
    });

    // Reset form when competition prop changes or dialog opens
    useEffect(() => {
        if (isOpen) {
            reset({
                name: competition.name,
                date: competition.date,
                end_date: competition.end_date || "",
                location: competition.location || "",
                registration_deadline: competition.registration_deadline || "",
                late_fee_deadline: competition.late_fee_deadline || "",
                description: competition.description || "",
            });
        }
    }, [competition, isOpen, reset]);

    const onSubmit = async (values: CompetitionFormValues) => {
        setSaving(true);
        try {
            const { error } = await supabase.from("competitions").update({
                name: values.name,
                date: values.date,
                end_date: values.end_date || null,
                location: values.location || null,
                registration_deadline: values.registration_deadline || null,
                late_fee_deadline: values.late_fee_deadline || null,
                description: values.description || null,
            }).eq("id", competition.id);

            if (error) throw error;

            toast({
                title: "Competizione aggiornata",
                description: "I dati della competizione sono stati aggiornati correttamente.",
            });
            setIsOpen(false);
            onSuccess();
        } catch (error: any) {
            console.error("Error updating competition:", error);
            toast({
                title: "Errore",
                description: error.message || "Impossibile aggiornare la competizione.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsOpen(true); }} className="h-8 w-8 text-muted-foreground hover:text-accent">
                <Pencil className="w-4 h-4" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="w-5 h-5 text-accent" />
                            Modifica Competizione
                        </DialogTitle>
                        <DialogDescription>
                            Aggiorna i dettagli della competizione.
                        </DialogDescription>
                    </DialogHeader>

                    <form id={`edit-competition-form-${competition.id}`} onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome Competizione *</Label>
                            <Input
                                id="name"
                                {...register("name", { required: "Il nome è obbligatorio" })}
                                placeholder="Es. Campionato Italiano 2026"
                            />
                            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="date">Data Inizio *</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    {...register("date", { required: "La data di inizio è obbligatoria" })}
                                />
                                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="end_date">Data Fine</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    {...register("end_date")}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="location">Luogo</Label>
                            <Input
                                id="location"
                                {...register("location")}
                                placeholder="Es. Rimini"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="registration_deadline">Scadenza Iscrizioni</Label>
                                <Input
                                    id="registration_deadline"
                                    type="date"
                                    {...register("registration_deadline")}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="late_fee_deadline">Aumento Quota (Mora)</Label>
                                <Input
                                    id="late_fee_deadline"
                                    type="date"
                                    {...register("late_fee_deadline")}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Descrizione / Note</Label>
                            <Textarea
                                id="description"
                                {...register("description")}
                                placeholder="Dettagli aggiuntivi..."
                                rows={3}
                            />
                        </div>
                    </form>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
                            Annulla
                        </Button>
                        <Button type="submit" form={`edit-competition-form-${competition.id}`} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Aggiorna Competizione
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
