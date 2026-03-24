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
      "category": "Over 16",
      "class": "A",
      "resp1": "Giuseppe Verdi",
      "partner_code": "CSEN-54321",
      "disc1": "Danze Latino Americane",
      "class1": "A",
      "disc2": "Danze Standard",
      "class2": "B1"
    }
  ]
}
```

### Dettaglio dei Campi:

| Campo | Tipo | Obbligo | Descrizione |
|---|---|---|---|
| `code` | `string` | **Sì***| Codice univoco dell'atleta (CID). *Se assente, il sistema userà il `fiscal_code` / `codice_fiscale`. Se manca, ne creerà uno (es. XX0001). |
| `first_name` | `string` | **Sì** | Nome dell'atleta. |
| `last_name` | `string` | **Sì** | Cognome dell'atleta. |
| `category` | `string` | **Sì** | Categoria di appartenenza (Es. "19/34"). |
| `fiscal_code` | `string` | No | Codice Fiscale (anche `codice_fiscale`). Usato come fallback se `code` è assente. |
| `birth_date` | `string` | No | Data di nascita (formato YYYY-MM-DD). |
| `gender` | `string` | No | Sesso ("M", "F"). |
| `email` | `string` | No | Indirizzo email. |
| `resp1` | `string` | No | Nome insegnante/responsabile 1. |
| `resp2` | `string` | No | Nome insegnante/responsabile 2. |
| `resp3` | `string` | No | Nome insegnante/responsabile 3. |
| `resp4` | `string` | No | Nome insegnante/responsabile 4. |
| `qr_code` | `string` | No | URL o valore per il codice QR dell'atleta. |
| `partner_code` | `string` | No | CID del partner per la creazione automatica della coppia. |
| `disc1` | `string` | No | Nome disciplina alternativa 1. |
| `Disc2` | `string` | No | Nome disciplina alternativa 2. |
| `Disc3` | `string` | No | Nome disciplina alternativa 3. |
| `Disc4` | `string` | No | Nome disciplina alternativa 4. |
| `Disc5` | `string` | No | Nome disciplina alternativa 5. |
| `Disc6` | `string` | No | Nome disciplina alternativa 6. |
| `class1` | `string` | No | Classe specifica per disciplina 1. |
| `class2` | `string` | No | Classe specifica per disciplina 2. |
| `class3` | `string` | No | Classe specifica per disciplina 3. |
| `class4` | `string` | No | Classe specifica per disciplina 4. |
| `class5` | `string` | No | Classe specifica per disciplina 5. |
| `class6` | `string` | No | Classe specifica per disciplina 6. |

### Note Tecniche:
- **Calcolo Classe**: Il sistema calcolerà automaticamente la classe generale dell'atleta e della coppia derivandola dalla migliore tra le classi specificate (`class1-6`). Se non viene fornita alcuna classe, il sistema imposterà il valore predefinito "D".
- **Case Sensitivity**: L'API accetta i nomi dei campi sia in minuscolo che con l'iniziale maiuscola (es. `Disc2` o `disc2`) per massima compatibilità.

### Note sull'Integrazione Coppie:
Inviando `partner_code` e i campi delle discipline (`disc1`, `class1`, etc.), il sistema creerà o aggiornerà automaticamente la **Coppia** associata. 
**Importante**: Ogni disciplina può avere la propria classe specifica (es. Classe C per `disc1` e Classe B2 per `disc2`). Il sistema gestirà correttamente i requisiti di iscrizione per ogni singola gara in base a queste informazioni.


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
