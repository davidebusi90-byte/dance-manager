# Regole Rigorose per la Scrittura del Codice e Revisione

Queste regole sono tassative e devono essere eseguite senza eccezioni, così come indicato dall'utente.

- **DOPPIO CONTROLLO E COMPILAZIONE (REGOLA DELLE 10.000 VOLTE):** Non devi mai dichiarare un task completato prima di esserti assicurato al 100% che il codice compili correttamente e non presenti errori di runtime. Prima di dire "Ho fatto" o prima di effettuare un commit su Git, devi sempre eseguire i controlli locali come `npm run build` o `tsc --noEmit`. Se ometti un'importazione, la build fallirà: controlla, risolvi l'errore e ri-testa finché la build non ha successo.

- **NESSUN ERRORE BANALE:** Ripassa mentalmente ogni modifica (es. "Ho usato una variabile o un Hook? Se sì, l'ho importato?"). Non ci devono essere sviste o distrazioni.

Sei in modalità "zero tolleranza per gli errori". Verifica sempre che il prodotto finito sia funzionante al 100%.
