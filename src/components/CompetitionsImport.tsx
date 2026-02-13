import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Upload, Trophy, Check, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { importCompetitions } from "@/lib/import-utils";

interface CompetitionsImportProps {
  onImportComplete: () => void;
}

export default function CompetitionsImport({ onImportComplete }: CompetitionsImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await importCompetitions(arrayBuffer);

      if (result.success) {
        toast({
          title: "Importazione completata",
          description: `Create: ${result.created}, Aggiornate: ${result.updated}`,
        });
        setIsOpen(false);
        onImportComplete();
      } else {
        toast({
          title: "Errore durante l'importazione",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante il caricamento.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
        <Trophy className="w-4 h-4" />
        Importa Competizioni
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Importa Competizioni
            </DialogTitle>
            <DialogDescription>
              Seleziona il file Excel (xlsx/xls) con le competizioni.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {uploading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-lg font-medium">Importazione in corso...</p>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Clicca per selezionare il file</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />

            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">Colonne richieste:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Nome</strong>, <strong>Data</strong> (obbligatorie)</li>
                  <li>• Luogo, Scadenza, Data Aumento Quota</li>
                  <li>• Data Fine, Descrizione</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
