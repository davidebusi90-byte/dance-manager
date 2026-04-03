import { useState, useEffect, useRef } from "react";
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
import { ShieldCheck } from "lucide-react";

interface PrivacyConsentModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isReviewMode?: boolean;
}

export function PrivacyConsentModal({ isOpen, onClose, isReviewMode = false }: PrivacyConsentModalProps) {
  const { hasConsented, loading, saveConsent } = usePrivacyConsent('privacy_policy', '1.0');
  const [internalOpen, setInternalOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAcceptingRef = useRef(false);

  const open = isOpen !== undefined ? isOpen : internalOpen;

  useEffect(() => {
    if (!loading && hasConsented === false && !isReviewMode) {
      setInternalOpen(true);
    }
  }, [hasConsented, loading, isReviewMode]);

  useEffect(() => {
    if (hasConsented === true) {
      setAccepted(true);
    }
  }, [hasConsented]);

  const handleAccept = async (e?: React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!accepted) return;
    setIsSubmitting(true);
    isAcceptingRef.current = true;
    await saveConsent(true);
    setIsSubmitting(false);
    if (onClose) onClose();
    setInternalOpen(false);
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isAcceptingRef.current) return;
    
    if (isReviewMode) {
      if (onClose) onClose();
      setInternalOpen(false);
    } else {
      window.location.href = '/auth';
    }
  };

  if (loading && !isReviewMode) return null;
  // If not in review mode and already consented, don't show automatically
  if (hasConsented === true && !isReviewMode && isOpen === undefined) return null;

  return (
    <AlertDialog open={open} onOpenChange={(val) => {
      if (!val) handleCancel();
    }}>
      <AlertDialogContent className="max-w-2xl bg-white border-sky-100 overflow-hidden p-0">
        <div className="bg-sky-600 p-6 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-display font-bold flex items-center gap-2 text-white">
              <ShieldCheck className="w-6 h-6" />
              Informativa sulla Privacy e GDPR
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sky-100 italic">
              {isReviewMode 
                ? "Stai visualizzando la versione corrente dell'informativa."
                : "Per continuare a utilizzare Dance Manager, è necessario leggere e accettare la nostra informativa sul trattamento dei dati personali."}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="p-6 pt-4">
          <ScrollArea className="h-[350px] w-full rounded-lg border border-sky-100 p-6 bg-slate-50/50 text-sm leading-relaxed text-slate-700">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">1</div>
                  <h4 className="font-bold text-sky-900">Titolare del Trattamento</h4>
                </div>
                <p className="pl-8">Il titolare del trattamento dei dati è l'Associazione Sportiva / Gestore del sistema Dance Manager.</p>
              </section>
              
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">2</div>
                  <h4 className="font-bold text-sky-900">Tipologia di Dati Trattati</h4>
                </div>
                <p className="pl-8">Raccogliamo dati identificativi degli atleti (nome, cognome, data di nascita, codice atleta), dati di contatto (email, telefono) e dati relativi alla salute (scadenza certificato medico agonistico) necessari per la partecipazione alle competizioni di danza sportiva.</p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">3</div>
                  <h4 className="font-bold text-sky-900">Finalità del Trattamento</h4>
                </div>
                <p className="pl-8">I dati vengono trattati esclusivamente per la gestione delle iscrizioni alle gare, la verifica dell'idoneità sportiva e la comunicazione di informazioni tecniche relative agli eventi.</p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">4</div>
                  <h4 className="font-bold text-sky-900">Sicurezza e Row Level Security</h4>
                </div>
                <p className="pl-8">Il sistema utilizza tecnologie avanzate di protezione (Supabase RLS) per garantire che i dati degli atleti siano visibili solo ai rispettivi istruttori autorizzati e agli amministratori di sistema.</p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">5</div>
                  <h4 className="font-bold text-sky-900">Diritti dell'Interessato</h4>
                </div>
                <p className="pl-8">Ai sensi del GDPR, hai il diritto di accedere ai tuoi dati, chiederne la rettifica o la cancellazione ("diritto all'oblio") inviando una richiesta tramite il sistema o contattando l'amministratore.</p>
              </section>
            </div>
          </ScrollArea>

          <div className="flex items-center space-x-3 py-6 px-2">
            <Checkbox 
              id="terms" 
              checked={accepted} 
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
              className="w-5 h-5 border-sky-300 data-[state=checked]:bg-sky-600 transition-colors"
              disabled={isReviewMode && hasConsented === true}
            />
            <Label htmlFor="terms" className="text-sm font-medium leading-tight cursor-pointer text-slate-700">
              Dichiaro di aver letto l'informativa e acconsento al trattamento dei dati personali.
            </Label>
          </div>

          <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t border-sky-50">
            <AlertDialogCancel 
              onClick={handleCancel} 
              className="border-sky-200 hover:bg-sky-50 transition-all"
            >
              {isReviewMode ? "Chiudi" : "Esci"}
            </AlertDialogCancel>
            {!isReviewMode && (
              <AlertDialogAction 
                onClick={handleAccept} 
                disabled={!accepted || isSubmitting}
                className="bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-200 transition-all px-8"
              >
                {isSubmitting ? "Salvataggio..." : "Accetta e Continua"}
              </AlertDialogAction>
            )}
            {isReviewMode && !hasConsented && (
               <AlertDialogAction 
                  onClick={handleAccept} 
                  disabled={!accepted || isSubmitting}
                  className="bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-200 transition-all px-8"
               >
                 {isSubmitting ? "Salvando..." : "Accetta e Salva"}
               </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

