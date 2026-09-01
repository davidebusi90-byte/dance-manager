import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomChart, ChartType, ChartMetric, ChartGroupBy } from "@/types/statistics";

interface ChartBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (chart: CustomChart) => void;
}

export default function ChartBuilder({ isOpen, onClose, onSave }: ChartBuilderProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ChartType>("bar");
  const [metric, setMetric] = useState<ChartMetric>("couples");
  const [groupBy, setGroupBy] = useState<ChartGroupBy>("class");

  const handleSave = () => {
    if (!title.trim()) return;
    
    const newChart: CustomChart = {
      id: crypto.randomUUID(),
      title,
      type,
      metric,
      groupBy,
    };
    
    onSave(newChart);
    setTitle(""); // Reset for next use
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Grafico</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titolo del Grafico</label>
            <Input 
              placeholder="es. Coppie per Classe" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo di Grafico</label>
            <Select value={type} onValueChange={(val: ChartType) => setType(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Colonne (Bar Chart)</SelectItem>
                <SelectItem value="pie">Torta (Pie Chart)</SelectItem>
                <SelectItem value="line">Linee (Line Chart)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Metrica (Cosa mostrare)</label>
            <Select value={metric} onValueChange={(val: ChartMetric) => setMetric(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona metrica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="couples">Numero di Coppie</SelectItem>
                <SelectItem value="entries">Partecipazioni Gare</SelectItem>
                <SelectItem value="anomalies">Numero di Anomalie</SelectItem>
                <SelectItem value="athletes">Numero di Atleti</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Raggruppamento (Asse X)</label>
            <Select value={groupBy} onValueChange={(val: ChartGroupBy) => setGroupBy(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona raggruppamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Per Classe</SelectItem>
                <SelectItem value="category">Per Categoria</SelectItem>
                <SelectItem value="season">Per Stagione</SelectItem>
                <SelectItem value="instructor">Per Istruttore</SelectItem>
                <SelectItem value="competition">Per Competizione</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>Crea Grafico</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
