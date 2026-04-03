import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePrivacyConsent } from "@/hooks/usePrivacyConsent";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PrivacyConsentModal() {
  const { hasConsented, loading, saveConsent } = usePrivacyConsent('privacy_policy', '1.0');
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && hasConsented === false) {
      setOpen(true);
    }
  }, [hasConsented, loading]);

  const handleAccept = async () => {
    if (!accepted) return;
    setIsSubmitting(true);
    await saveConsent(true);
    setIsSubmitting(false);
    setOpen(false);
  };

  if (loading || hasConsented === true) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-2xl bg-white border-sky-100">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-display text-sky-900 flex items-center gap-2">
            Informativa sulla Privacy e GDPR
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sky-800/70">
            Per continuare a utilizzare Dance Manager, è necessario leggere e accettare la nostra informativa sul trattamento dei dati personali.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-sky-50/30 text-sm leading-relaxed text-slate-700">
          <div className="space-y-4">
            <section>
              <h4 className="font-bold text-sky-900 mb-1">1. Titolare del Trattamento</h4>
              <p>Il titolare del trattamento dei dati è l'Associazione Sportiva / Gestore del sistema Dance Manager.</p>
            </section>
            
            <section>
              <h4 className="font-bold text-sky-900 mb-1">2. Tipologia di Dati Trattati</h4>
              <p>Raccogliamo dati identificativi degli atleti (nome, cognome, data di nascita, codice atleta), dati di contatto (email, telefono) e dati relativi alla salute (scadenza certificato medico agonistico) necessari per la partecipazione alle competizioni di danza sportiva.</p>
            </section>

            <section>
              <h4 className="font-bold text-sky-900 mb-1">3. Finalità del Trattamento</h4>
              <p>I dati vengono trattati esclusivamente per la gestione delle iscrizioni alle gare, la verifica dell'idoneità sportiva e la comunicazione di informazioni tecniche relative agli eventi.</p>
            </section>

            <section>
              <h4 className="font-bold text-sky-900 mb-1">4. Sicurezza e Row Level Security</h4>
              <p>Il sistema utilizza tecnologie avanzate di protezione (Supabase RLS) per garantire che i dati degli atleti siano visibili solo ai rispettivi istruttori autorizzati e agli amministratori di sistema.</p>
            </section>

            <section>
              <h4 className="font-bold text-sky-900 mb-1">5. Diritti dell'Interessato</h4>
              <p>Ai sensi del GDPR, hai il diritto di accedere ai tuoi dati, chiederne la rettifica o la cancellazione ("diritto all'oblio") inviando una richiesta tramite il sistema o contattando l'amministratore.</p>
            </section>
          </div>
        </ScrollArea>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox 
            id="terms" 
            checked={accepted} 
            onCheckedChange={(checked) => setAccepted(checked as boolean)}
            className="border-sky-300 data-[state=checked]:bg-sky-600"
          />
          <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700">
            Dichiaro di aver letto l'informativa e acconsento al trattamento dei dati personali.
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => window.location.href = '/auth'} className="border-sky-200">Esci</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleAccept} 
            disabled={!accepted || isSubmitting}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {isSubmitting ? "Salvataggio..." : "Accetta e Continua"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
