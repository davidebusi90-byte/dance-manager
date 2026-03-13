# Documentazione Integrazione API - Sync Atleti

Questa documentazione fornisce le linee guida per invocare l'endpoint di integrazione che permette di sincronizzare/insertire massivamente gli Atleti (Competitors) nel database di **Dance Manager**.

## 1. Dettagli Endpoint

- **URL Principale:** `https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/import-competitors`
- **Metodo HTTP consentito:** `POST`
- **Autenticazione:** Tramite header custom (`x-api-key`)
- **Body Type:** `application/json`

## 2. Headers Richiesti

| Chiave | Valore | Note |
|---|---|---|
| `Content-Type` | `application/json` | Obbligatorio per decodificare il corpo del payload. |
| `x-api-key` | *[Da concordare/Fornito dall'amministratore]* | Obbligatorio. Questa è la chiave segreta (impostata tramite la variabile d'ambiente `IMPORT_API_KEY` in Supabase) e non deve essere esposta pubblicamente. |

## 3. Struttura del Payload JSON

L'endpoint si aspetta un oggetto JSON contenente un array di oggetti sotto la chiave principale `athletes`. 
Il sistema utilizza la logica **Upsert** basata sulla chiave primaria `code`: se il codice non esiste l'atleta verrà creato, se il codice esiste le sue informazioni verranno aggiornate.

### Formato di Esempio:
```json
{
  "athletes": [
    {
      "code": "CSEN-12345",
      "first_name": "Mario",
      "last_name": "Rossi",
      "birth_date": "1990-05-15",
      "gender": "M",
      "email": "mario.rossi@example.com",
      "phone": "+393331234567",
      "category": "Over 16",
      "class": "A",
      "medical_certificate_expiry": "2024-12-31",
      "notes": "Allergia alla polvere",
      "responsabili": ["Giuseppe Verdi", "Anna Bianchi"],
      "qr_code": "https://api.qrserver.com/v1/create-qr-code/?data=CSEN-12345"
    }
  ]
}
```

### Dettaglio dei Campi:

| Campo | Tipo | Obbligatorietà | Descrizione |
|---|---|---|---|
| `code` | `string` | **Obbligatorio** | Codice univoco dell'atleta (Es. matricola). Usato come chiave di Upsert. |
| `first_name` | `string` | **Obbligatorio** | Nome dell'atleta. |
| `last_name` | `string` | **Obbligatorio** | Cognome dell'atleta. |
| `category` | `string` | **Obbligatorio** | Categoria di appartenenza (Es. "Under 15"). |
| `class` | `string` | **Obbligatorio** | Classe di competenza (Es. "A", "B", "C"). |
| `birth_date` | `string` (YYYY-MM-DD) | Opzionale | Data di nascita formattata secondo standard ISO. |
| `gender` | `string` | Opzionale | Sesso (Es. "M", "F", "ND"). |
| `email` | `string` | Opzionale | Indirizzo email dell'atleta. |
| `phone` | `string` | Opzionale | Numero di telefono. |
| `medical_certificate_expiry`| `string` (YYYY-MM-DD)| Opzionale | Data di scadenza del certificato medico. |
| `responsabili` | `array of strings` | Opzionale | Lista dei nomi dei maestri/insegnanti responsabili della coppia. Es: `["Nome Cognome"]`. |
| `notes` | `string` | Opzionale | Qualsiasi tipologia di nota accessoria. |
| `qr_code` | `string` | Opzionale | Stringa con URL o valenze personalizzate per il codice QR univoco dell'atleta. |

### Campi Ignorati (Non elaborati dal DB):
Benché l'interfaccia possa storicamente tollerare nel payload chiavi come `partner_first_name`, `partner_last_name`, e `disciplines`, queste chiavi vengono scartate durante la fase di salvataggio. Non è necessario provvedere al loro invio.

## 4. Risposte (HTTP Status Codes)

- **200 OK:** La richiesta è stata validata. Nel corpo JSON troverai le statistiche di completamento:
  ```json
  {
    "message": "Import process completed.",
    "results": {
      "successful": 150,
      "failed": 2,
      "errors": [
        { "code": "CSEN-999", "error": "Missing required fields..." }
      ]
    }
  }
  ```
- **400 Bad Request:** Payload malformato, l'array `athletes` è assente o ci sono tipi di dati non validi.
- **401 Unauthorized:** Manca l'autenticazione tramite Header `x-api-key` oppure la chiave è sbagliata.
- **405 Method Not Allowed:** È stato usato un metodo diverso da `POST`.
- **500 Internal Server Error:** Configurazione backend mancante (Supabase URL/Service Role Key) o errore di inserimento fatale sul DB.

## 5. Limitazione del Traffico (Rate Limiting)
A protezione dell'infrastruttura, l'endpoint espone un limite di chiamate:
- **Limite:** 10 chiamate massime ogni ora per singolo IP esterno sorgente.
- Le chiamate in esubero restituiranno l'errore `429 Too Many Requests`.
- Si consiglia al sistema esterno di raccogliere i dati e inviarli in lotti (batching) con un unico POST strutturato piuttosto che eseguire richieste singole continue.
