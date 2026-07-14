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
  existingEvent?: {
    id: string;
    event_name: string;
    allowed_classes: string[];
    min_age: number | null;
    max_age: number | null;
  };
  trigger?: React.ReactNode;
}

const AVAILABLE_CLASSES = ["D", "C", "B3", "B2", "B1", "A", "A2", "A1", "AS", "MASTER"];

export default function AddCustomEventDialog({ competitionId, onSuccess, existingEvent, trigger }: AddCustomEventDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [discipline, setDiscipline] = useState<string>("Danze Standard");
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [eventName, setEventName] = useState(existingEvent?.event_name || "");
  const [minAge, setMinAge] = useState<string>(existingEvent?.min_age ? existingEvent.min_age.toString() : "");
  const [maxAge, setMaxAge] = useState<string>(existingEvent?.max_age ? existingEvent.max_age.toString() : "");
  const [allowedClasses, setAllowedClasses] = useState<Set<string>>(new Set(existingEvent?.allowed_classes || []));
  const [titlePrefix, setTitlePrefix] = useState<string>("Nessuno");
  const [createMultiple, setCreateMultiple] = useState({
    standard: true,
    latin: false,
    combinata: false
  });

  // Sync initial checkboxes with selected discipline
  useEffect(() => {
    if (!existingEvent) {
      setCreateMultiple({
        standard: discipline === "Danze Standard",
        latin: discipline === "Danze Latino Americane",
        combinata: discipline === "Combinata"
      });
    }
  }, [discipline, existingEvent]);

  useEffect(() => {
    if (existingEvent) {
      setEventName(existingEvent.event_name);
      setMinAge(existingEvent.min_age ? existingEvent.min_age.toString() : "");
      setMaxAge(existingEvent.max_age ? existingEvent.max_age.toString() : "");
      setAllowedClasses(new Set(existingEvent.allowed_classes || []));
      
      const evtLower = existingEvent.event_name.toLowerCase();
      if (evtLower.includes("combinata") || evtLower.includes("show")) {
        setDiscipline(evtLower.includes("show") ? "Show Dance" : "Combinata");
      } else if (evtLower.includes("latin")) {
        setDiscipline("Danze Latino Americane");
      } else {
        setDiscipline("Danze Standard");
      }
    }
  }, [existingEvent]);

  // Sync single preset selection
  useEffect(() => {
    if (!existingEvent) {
      if (selectedPresets.size === 1) {
        const presetName = Array.from(selectedPresets)[0];
        const preset = getEventsForDiscipline(discipline).find(p => p.name === presetName);
        if (preset) {
          setEventName(`${discipline} - ${preset.name}`);
          setMinAge(preset.minAge ? preset.minAge.toString() : "");
          setMaxAge(preset.maxAge ? preset.maxAge.toString() : "");
          setAllowedClasses(new Set(preset.classes));
        }
      } else if (selectedPresets.size > 1) {
        // Clear classes so it uses the preset defaults unless the user manually selects them
        setAllowedClasses(new Set());
      }
    }
  }, [selectedPresets, discipline, existingEvent]);

  const handleClassToggle = (cls: string) => {
    setAllowedClasses(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const handleSave = async () => {
    if (existingEvent || selectedPresets.size <= 1) {
      if (!eventName.trim()) {
        toast({ title: "Errore", description: "Inserisci il nome della gara", variant: "destructive" });
        return;
      }
      if (allowedClasses.size === 0) {
        toast({ title: "Errore", description: "Seleziona almeno una classe", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const basePayload = {
        competition_id: competitionId,
        allowed_classes: Array.from(allowedClasses),
        min_age: minAge ? parseInt(minAge) : null,
        max_age: maxAge ? parseInt(maxAge) : null,
      };

      let error;
      if (existingEvent) {
        const { error: updateError } = await supabase.from("competition_event_types").update({
          ...basePayload,
          event_name: eventName.trim(),
        }).eq("id", existingEvent.id);
        error = updateError;
      } else {
        const selectedDiscs = Object.entries(createMultiple).filter(([_, v]) => v).map(([k]) => k);
        if (selectedDiscs.length === 0) {
          toast({ title: "Errore", description: "Seleziona almeno una disciplina da creare", variant: "destructive" });
          setSaving(false);
          return;
        }

        const presetsList = getEventsForDiscipline(discipline);
        let toInsert: any[] = [];

        if (selectedPresets.size > 1) {
          // Bulk creation across multiple presets AND disciplines
          Array.from(selectedPresets).forEach(presetName => {
            const preset = presetsList.find(p => p.name === presetName);
            if (!preset) return;

            // If user selected classes, override. Otherwise use default preset classes.
            const classesToUse = allowedClasses.size > 0 ? Array.from(allowedClasses) : preset.classes;

            selectedDiscs.forEach(discKey => {
              let discName = "Danze Standard";
              if (discKey === "latin") discName = "Danze Latino Americane";
              if (discKey === "combinata") discName = "Combinata";

              let finalName = `${discName} - ${preset.name}`;
              if (titlePrefix !== "Nessuno") {
                finalName = `${titlePrefix} ${finalName}`;
              }

              toInsert.push({
                competition_id: competitionId,
                event_name: finalName,
                allowed_classes: classesToUse,
                min_age: preset.minAge || null,
                max_age: preset.maxAge || null,
              });
            });
          });
        } else {
          toInsert = selectedDiscs.map(discKey => {
            let discName = "Danze Standard";
            if (discKey === "latin") discName = "Danze Latino Americane";
            if (discKey === "combinata") discName = "Combinata";

            let nameToInsert = eventName.trim();
            if (discipline !== discName && nameToInsert.includes(discipline)) {
               nameToInsert = nameToInsert.replace(discipline, discName);
            } else if (discipline !== discName && !nameToInsert.includes(discName)) {
               nameToInsert = `${discName} - ${nameToInsert.replace(/^(Danze Standard|Danze Latino Americane|Combinata)\s*-\s*/, '')}`;
            }

            if (titlePrefix !== "Nessuno") {
               nameToInsert = `${titlePrefix} ${nameToInsert}`;
            }

            return { ...basePayload, event_name: nameToInsert };
          });
        }

        const { error: insertError } = await supabase.from("competition_event_types").insert(toInsert);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Successo", description: existingEvent ? "Gara aggiornata correttamente" : "Gara aggiunta correttamente" });
      setOpen(false);
      onSuccess();
      
      if (!existingEvent) {
        // Reset form
        setSelectedPresets(new Set());
        setEventName("");
        setMinAge("");
        setMaxAge("");
        setAllowedClasses(new Set());
        setTitlePrefix("Nessuno");
      }
    } catch (error) {
      console.error("Error adding/updating event:", error);
      toast({ title: "Errore", description: "Impossibile salvare la gara", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <Plus className="w-4 h-4" /> Aggiungi Gara
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{existingEvent ? "Modifica Gara" : "Aggiungi Gara"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Disciplina Base</Label>
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
            
            {!existingEvent && (
              <div className="space-y-2">
                <Label>Aggiungi Titolo (Prefisso)</Label>
                <Select value={titlePrefix} onValueChange={setTitlePrefix}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nessuno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nessuno">-- Nessuno --</SelectItem>
                    <SelectItem value="World Cup">World Cup</SelectItem>
                    <SelectItem value="World Championship">World Championship</SelectItem>
                    <SelectItem value="European Championship">European Championship</SelectItem>
                    <SelectItem value="Italian Championship">Italian Championship</SelectItem>
                    <SelectItem value="Coppa Italia">Coppa Italia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!existingEvent && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="space-y-2">
                <Label>Età / Modelli (selezionane uno o più)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 border rounded-md max-h-[160px] overflow-y-auto bg-black/5 dark:bg-white/5">
                  {getEventsForDiscipline(discipline).map(preset => (
                    <div key={preset.name} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`preset-${preset.name}`} 
                        checked={selectedPresets.has(preset.name)}
                        onCheckedChange={(checked) => {
                          setSelectedPresets(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(preset.name);
                            else next.delete(preset.name);
                            return next;
                          });
                        }}
                      />
                      <label htmlFor={`preset-${preset.name}`} className="text-xs font-medium leading-none cursor-pointer">
                        {preset.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3 p-3 rounded-md border bg-black/5 dark:bg-white/5">
                <Label className="text-muted-foreground">Crea contemporaneamente per:</Label>
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="multi-std" 
                      checked={createMultiple.standard} 
                      onCheckedChange={(c) => setCreateMultiple(p => ({ ...p, standard: !!c }))}
                    />
                    <label htmlFor="multi-std" className="text-sm font-medium leading-none cursor-pointer whitespace-nowrap">Standard</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="multi-lat" 
                      checked={createMultiple.latin} 
                      onCheckedChange={(c) => setCreateMultiple(p => ({ ...p, latin: !!c }))}
                    />
                    <label htmlFor="multi-lat" className="text-sm font-medium leading-none cursor-pointer whitespace-nowrap">Latini</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="multi-comb" 
                      checked={createMultiple.combinata} 
                      onCheckedChange={(c) => setCreateMultiple(p => ({ ...p, combinata: !!c }))}
                    />
                    <label htmlFor="multi-comb" className="text-sm font-medium leading-none cursor-pointer whitespace-nowrap">Combinata</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedPresets.size > 1 ? (
            <div className="col-span-2 p-4 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium text-center">
              Modalità Creazione Multipla Attiva.<br/>
              Verranno create <strong>{selectedPresets.size} gare</strong> per ogni disciplina selezionata.<br/>
              I nomi e le età saranno generati in automatico dai modelli. 
              {allowedClasses.size === 0 ? " Verranno usate le classi standard di ciascun modello." : " Le classi standard verranno sovrascritte con quelle selezionate qui sotto."}
            </div>
          ) : (
            <>
              <div className="space-y-2 col-span-2">
                <Label>Nome Gara</Label>
                <Input 
                  placeholder="Es. IDSF International Open Latin" 
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 col-span-2">
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
            </>
          )}

          <div className="space-y-3 col-span-2">
            <Label>Classi Ammesse {selectedPresets.size > 1 && "(Opzionale: sovrascrive le classi standard)"}</Label>
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
