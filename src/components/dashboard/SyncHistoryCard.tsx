import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  RotateCcw, 
  ChevronRight, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SyncLog {
  id: string;
  created_at: string;
  status: string;
  message: string;
  results: any;
  raw_payload: any;
}

export default function SyncHistoryCard() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("sync_logs" as any) as any)
      .select("*")
      .not("raw_payload", "is", null) // Only show logs with archived data
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare la cronologia",
        variant: "destructive",
      });
    } else {
      setLogs(data as unknown as SyncLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleResync = async (logId: string) => {
    setSyncingId(logId);
    try {
      // Correct invocation: append query params to the function name string
      const { data, error } = await supabase.functions.invoke(`import-competitors?action=trigger-resync&log_id=${logId}`, {
        method: "POST"
      });

      if (error) throw error;

      toast({
        title: "Sincronizzazione completata",
        description: "Il database è stato aggiornato con i dati archiviati.",
      });
      fetchLogs(); // Refresh list to see the new log
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Errore durante la risincronizzazione",
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Successo</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-orange-500 border-orange-500/20 gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Warning</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
        <CardHeader className="p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-display font-bold flex items-center gap-3">
                <History className="w-5 h-5 text-primary" />
                Cronologia Sincronizzazioni
              </CardTitle>
              <CardDescription>Visualizza e ripristina i dati inviati dall'API</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchLogs} 
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <RotateCcw className="w-4 h-4 text-primary" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="space-y-3">
            {loading && logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">
                Caricamento cronologia...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic bg-white/5 rounded-3xl border border-dashed border-white/10">
                Nessun record archiviato trovato.
              </div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className="group flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{formatDate(log.created_at)}</span>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[300px]">
                        {log.message}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedLog(log)}
                      className="rounded-xl text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Dettagli <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={syncingId === log.id}
                      onClick={() => handleResync(log.id)}
                      className="rounded-xl text-xs gap-1.5 border-primary/20 hover:border-primary hover:bg-primary/5"
                    >
                      {syncingId === log.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Risincronizza
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] glass border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-primary" />
              Dettagli Sincronizzazione
            </DialogTitle>
            <DialogDescription>
              Payload inviato il {selectedLog ? formatDate(selectedLog.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <ScrollArea className="h-[400px] rounded-2xl border border-white/10 p-4 bg-black/20">
              <pre className="text-[10px] sm:text-xs font-mono text-primary/80">
                {selectedLog ? JSON.stringify(selectedLog.raw_payload, null, 2) : ""}
              </pre>
            </ScrollArea>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button 
              className="rounded-xl gap-2 px-8"
              onClick={() => {
                if (selectedLog) handleResync(selectedLog.id);
                setSelectedLog(null);
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Esegui Sincronizzazione con questi dati
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
