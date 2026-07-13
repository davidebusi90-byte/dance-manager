import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, Loader2 } from "lucide-react";

interface QrCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export function QrCodeScanner({ isOpen, onClose, onScanSuccess }: QrCodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-element";

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    let isMounted = true;

    // Small delay to ensure the Dialog overlay and DOM elements are rendered
    const timer = setTimeout(() => {
      if (!isMounted) return;

      try {
        const html5Qrcode = new Html5Qrcode(containerId);
        html5QrcodeRef.current = html5Qrcode;

        html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            onScanSuccess(decodedText);
            onClose();
          },
          () => {
            // Silence verbose debug errors
          }
        )
        .then(() => {
          if (isMounted) setLoading(false);
        })
        .catch((err) => {
          console.error("Camera access error:", err);
          if (isMounted) {
            setError("Impossibile accedere alla fotocamera. Assicurati di aver concesso i permessi.");
            setLoading(false);
          }
        });
      } catch (err) {
        console.error("Scanner initialization error:", err);
        if (isMounted) {
          setError("Errore durante l'inizializzazione dello scanner.");
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      
      const html5Qrcode = html5QrcodeRef.current;
      if (html5Qrcode) {
        if (html5Qrcode.isScanning) {
          html5Qrcode.stop()
            .then(() => {
              html5Qrcode.clear();
            })
            .catch((err) => console.error("Error stopping qr scanner:", err));
        } else {
          try {
            html5Qrcode.clear();
          } catch (e) {
            // Ignore if not rendered
          }
        }
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-white/10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Camera className="w-5 h-5" />
            </div>
            Scansiona QR Code
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            Inquadra il QR code per accedere all'iscrizione.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex flex-col items-center justify-center aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-3xl border border-white/10 bg-black shadow-inner my-4">
          <div id={containerId} className="w-full h-full object-cover" />
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Avvio fotocamera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 p-6 text-center gap-4">
              <p className="text-sm font-medium px-4">{error}</p>
              <Button onClick={() => {
                setError(null);
                setLoading(true);
                onClose();
                setTimeout(() => onClose(), 100);
              }} variant="outline" className="rounded-xl">
                Riprova
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
