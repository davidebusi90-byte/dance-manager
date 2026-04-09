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
    if (!accepted || isAcceptingRef.current) return;
    
    setIsSubmitting(true);
    isAcceptingRef.current = true;
    try {
      await saveConsent(true);
      setInternalOpen(false);
      if (onClose) onClose();
    } catch (error) {
      console.error("Error saving consent:", error);
    } finally {
      setIsSubmitting(false);
      isAcceptingRef.current = false;
    }
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
  if (hasConsented === true && !isReviewMode && isOpen === undefined) return null;

  return (
    <AlertDialog open={open} onOpenChange={(val) => {
      if (!val) handleCancel();
    }}>
      <AlertDialogContent className="max-w-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 overflow-hidden p-0 rounded-[2.5rem] shadow-2xl">
        <div className="bg-primary p-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="w-24 h-24" />
          </div>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-display font-black tracking-tight flex items-center gap-3 text-white uppercase">
              <ShieldCheck className="w-8 h-8" />
              Privacy & GDPR
            </AlertDialogTitle>
            <AlertDialogDescription className="text-primary-foreground/80 font-medium text-base">
              {isReviewMode 
                ? "Revisione dell'informativa corrente."
                : "Per procedere è necessario accettare il trattamento dei dati personali."}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="p-8">
          <ScrollArea className="h-[350px] w-full rounded-3xl border border-neutral-100 dark:border-neutral-800 p-6 bg-neutral-50/50 dark:bg-black/20 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">1</div>
                  <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-xs">Titolare del Trattamento</h4>
                </div>
                <p className="pl-10">Il titolare del trattamento dei dati è l'Associazione Sportiva / Gestore del sistema Dance Manager.</p>
              </section>
              
              <section>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">2</div>
                  <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-xs">Tipologia di Dati Trattati</h4>
                </div>
                <p className="pl-10">Raccogliamo dati identificativi degli atleti (nome, cognome, data di nascita, codice atleta), dati di contatto (email, telefono) e dati relativi alla salute (scadenza certificato medico agonistico) necessari per la partecipazione alle competizioni di danza sportiva.</p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">3</div>
                  <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-xs">Finalità del Trattamento</h4>
                </div>
                <p className="pl-10">I dati vengono trattati esclusivamente per la gestione delle iscrizioni alle gare, la verifica dell'idoneità sportiva e la comunicazione di informazioni tecniche relative agli eventi.</p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">4</div>
                  <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-xs">Sicurezza (Supabase RLS)</h4>
                </div>
                <p className="pl-10">Il sistema utilizza tecnologie avanzate di protezione (Supabase Row Level Security) per garantire che i dati degli atleti siano visibili solo ai rispettivi istruttori autorizzati e agli amministratori di sistema.</p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">5</div>
                  <h4 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-xs">I Tuoi Diritti</h4>
                </div>
                <p className="pl-10">Ai sensi del GDPR, hai il diritto di accedere ai tuoi dati, chiederne la rettifica o la cancellazione ("diritto all'oblio") inviando una richiesta tramite il sistema o contattando l'amministratore.</p>
              </section>
            </div>
          </ScrollArea>

          <div className="flex items-center space-x-4 py-8 px-2">
            <Checkbox 
              id="terms" 
              checked={accepted} 
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
              className="w-6 h-6 border-neutral-300 data-[state=checked]:bg-primary transition-all rounded-lg"
              disabled={isReviewMode && hasConsented === true}
            />
            <Label htmlFor="terms" className="text-sm font-bold leading-tight cursor-pointer text-neutral-700 dark:text-neutral-300">
              Dichiaro di aver letto l'informativa e acconsento al trattamento dei dati personali.
            </Label>
          </div>

          <AlertDialogFooter className="bg-neutral-50 dark:bg-black/20 -mx-8 -mb-8 p-8 border-t border-neutral-100 dark:border-neutral-800">
            <AlertDialogCancel 
              onClick={handleCancel} 
              className="border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 transition-all rounded-xl h-12 px-6 font-bold"
            >
              {isReviewMode ? "Chiudi" : "Esci"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAccept} 
              disabled={!accepted || isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all px-10 h-12 rounded-xl font-bold"
            >
              {isSubmitting ? "Salvataggio..." : (isReviewMode && hasConsented ? "Conferma" : "Accetta e Continua")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
