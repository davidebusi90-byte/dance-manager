import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Copy } from "lucide-react";
import { DISCIPLINES, getEventsForDiscipline } from "@/lib/event-presets";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddCustomEventDialogProps {
  competitionId: string;
  onSuccess: () => void;
}

const AVAILABLE_CLASSES = ["D", "C", "B3", "B2", "B1", "A", "A2", "A1", "AS", "MASTER"];

export default function AddCustomEventDialog({ competitionId, onSuccess }: AddCustomEventDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [discipline, setDiscipline] = useState<string>("Danze Standard");
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [eventName, setEventName] = useState("");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [allowedClasses, setAllowedClasses] = useState<Set<string>>(new Set());

  // Handle preset selection
  useEffect(() => {
    if (selectedPreset && selectedPreset !== "custom") {
      const presets = getEventsForDiscipline(discipline);
      const preset = presets.find(p => p.name === selectedPreset);
      if (preset) {
        setEventName(`${discipline} - ${preset.name}`);
        setMinAge(preset.minAge ? preset.minAge.toString() : "");
        setMaxAge(preset.maxAge ? preset.maxAge.toString() : "");
        setAllowedClasses(new Set(preset.classes));
      }
    }
  }, [selectedPreset, discipline]);

  const handleClassToggle = (cls: string) => {
    setAllowedClasses(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const handleSave = async () => {
    if (!eventName.trim()) {
      toast({ title: "Errore", description: "Inserisci il nome della gara", variant: "destructive" });
      return;
    }
    if (allowedClasses.size === 0) {
      toast({ title: "Errore", description: "Seleziona almeno una classe", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("competition_event_types").insert({
        competition_id: competitionId,
        event_name: eventName.trim(),
        allowed_classes: Array.from(allowedClasses),
        min_age: minAge ? parseInt(minAge) : null,
        max_age: maxAge ? parseInt(maxAge) : null,
      });

      if (error) throw error;

      toast({ title: "Successo", description: "Gara aggiunta correttamente" });
      setOpen(false);
      onSuccess();
      
      // Reset form
      setSelectedPreset("custom");
      setEventName("");
      setMinAge("");
      setMaxAge("");
      setAllowedClasses(new Set());
    } catch (error) {
      console.error("Error adding event:", error);
      toast({ title: "Errore", description: "Impossibile aggiungere la gara", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <Plus className="w-4 h-4" /> Aggiungi Gara
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Gara</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select value={discipline} onValueChange={(v) => { setDiscipline(v); setSelectedPreset("custom"); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Pre-compila da Modello</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli un modello (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">-- Vuoto (Personalizzato) --</SelectItem>
                  {getEventsForDiscipline(discipline).map(preset => (
                    <SelectItem key={preset.name} value={preset.name}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome Gara</Label>
            <Input 
              placeholder="Es. WDSF International Open Latin" 
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Età Minima (opzionale)</Label>
              <Input 
                type="number" 
                placeholder="Es. 16" 
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Età Massima (opzionale)</Label>
              <Input 
                type="number" 
                placeholder="Es. 34" 
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Classi Ammesse</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_CLASSES.map(cls => (
                <Button
                  key={cls}
                  type="button"
                  variant={allowedClasses.has(cls) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleClassToggle(cls)}
                  className="font-mono text-xs"
                >
                  {cls}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva Gara"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
