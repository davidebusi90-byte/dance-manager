import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  medical_certificate_expiry: string | null;
}

interface ExpiredCertificatesListProps {
  athletes: Athlete[];
  onClose: () => void;
}

export default function ExpiredCertificatesList({ athletes, onClose }: ExpiredCertificatesListProps) {
  const expiredAthletes = athletes.filter((a) => {
    if (!a.medical_certificate_expiry) return true;
    return new Date(a.medical_certificate_expiry) < new Date();
  });

  const formatDate = (date: string | null) => {
    if (!date) return "Mancante";
    return new Date(date).toLocaleDateString("it-IT");
  };

  return (
    <Card className="animate-fade-in border-warning/50 bg-warning/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2 text-warning">
          <AlertTriangle className="w-5 h-5" />
          Certificati Scaduti o Mancanti ({expiredAthletes.length})
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {expiredAthletes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Tutti i certificati sono in regola! 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Nome e Cognome</th>
                  <th>Stato Certificato</th>
                  <th>Data Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {expiredAthletes.map((athlete) => {
                  const isMissing = !athlete.medical_certificate_expiry;
                  return (
                    <tr key={athlete.id}>
                      <td className="font-mono text-sm">{athlete.code}</td>
                      <td className="font-medium">{athlete.first_name} {athlete.last_name}</td>
                      <td>
                        <span className={`status-badge ${isMissing ? "status-badge-warning" : "status-badge-error"}`}>
                          {isMissing ? "Mancante" : "Scaduto"}
                        </span>
                      </td>
                      <td>{formatDate(athlete.medical_certificate_expiry)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
