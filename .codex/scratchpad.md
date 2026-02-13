# Background and Motivation

L'utente vuole importare automaticamente le transazioni dalle email Gmail inviate da `comunicazioni@isybank.com`, estraendo importo/esercente/data e aggiornando l'app.

# Project Status Board

- ID: T1
- Goal: Implementare sincronizzazione Gmail -> transazioni SpendWise
- Success Criteria:
  - Connessione Gmail via OAuth lato client
  - Lettura email filtrate per mittente Isybank
  - Parsing importo/esercente/data
  - Deduplica e inserimento su IndexedDB
  - Controlli UI in Impostazioni per sync manuale e stato
- Test Case:
  - Unit test parser email
  - Unit test dedup hash e conversione in transazione
- Status: done
- ID: T2
- Goal: Correggere parser merchant Gmail e deduplica su import automatico
- Success Criteria:
  - Nome esercente estratto correttamente dai template email Isybank reali
  - Niente duplicati quando merchant non viene estratto e resta generico
  - Deduplica forte per `gmail-msg:<id>` e deduplica morbida per data+importo
- Test Case:
  - Parser merchant con formato `Esercente:`
  - Parser merchant da subject breve (`Pagamento carta ...`)
  - Deduplica su merchant generico/specifico
- Status: done
- ID: T3
- Goal: Aggiungere bottone UI per pulizia duplicati Gmail già presenti
- Success Criteria:
  - Bottone in Impostazioni -> sezione Gmail
  - Pulizia conservativa dei duplicati storici
  - Refresh UI dopo pulizia
- Test Case:
  - test helper duplicate finder (message-id e generic-vs-specific)
- Status: done
- ID: T4
- Goal: Rendere la pulizia duplicati più aggressiva per i "Transazione carta" residui
- Success Criteria:
  - Pulizia anche senza tag Gmail
  - Pulizia robusta con drift data fino a 24h
- Test Case:
  - generic + specific senza tag gmail -> elimina generic
  - generic + specific con 1 giorno di drift -> elimina generic
- Status: done
- ID: T5
- Goal: Leggere davvero il contenuto email Gmail quando è nel MIME attachment part
- Success Criteria:
  - Sync estrae testo da `attachmentId` oltre che da `body.data`
  - Parser riceve Subject + contenuto reale + snippet
- Test Case:
  - payload con `text/plain` via `attachmentId` -> testo estratto correttamente
- Status: done
- ID: T6
- Goal: Aggiornare automaticamente le vecchie transazioni Gmail generiche durante la sync
- Success Criteria:
  - Se message-id già importato con `Transazione carta`, la sync prova a riparsare e aggiornare merchant
  - Se esiste già controparte specifica, la sync rimuove la riga generica
- Test Case:
  - test attachment body già presente + regressione sync util
- Status: done
- ID: T7
- Goal: Deduplicare anche merchant specifici ma simili tra CSV e Gmail
- Success Criteria:
  - Rimozione duplicati tipo `CAREGGI ...` vs `Careggi ... Vial`
  - Rimozione duplicati tipo `PAYPAL *FLIXBUS` vs `Paypal *flixbus 30300137300`
- Test Case:
  - due test espliciti su `findLikelyDuplicateTransactionIds`
- Status: done
- ID: T8
- Goal: Correggere i "Very low contrast" in light mode segnalati da WebAIM/WAVE
- Success Criteria:
  - `.text-muted` non usa più `opacity` per "muted", ma un colore dedicato con contrasto adeguato
  - In light mode WAVE non segnala più "Very low contrast" per version tag, label tema, empty states principali
- Test Case:
  - test unit su `src/index.css` che verifica `.text-muted` usa `var(--text-muted)` e non contiene `opacity: 0.5`
- Status: done
- ID: T9
- Goal: Dare un nome accessibile (stable) ai bottoni solo-icona principali
- Success Criteria:
  - I pulsanti mese precedente/successivo e altri icon-only hanno `aria-label` (non solo `title`)
  - WAVE non segnala "button has no text" (se presente) per questi controlli
- Test Case:
  - test RTL che verifica `aria-label` sui pulsanti mese precedente/successivo nella Dashboard
- Status: done

# Current Status

Implementazione completata:
- Nuovo parser email Isybank (`src/services/isybankEmailParser.ts`)
- Nuovo servizio Gmail sync (`src/services/gmailSync.ts`)
- Nuova UI in Impostazioni per collegare Gmail e sincronizzare
- Refresh automatico viste transazioni dopo import Gmail/manuale
- Hardening parser merchant + deduplica anti-duplicati da Gmail
- Bottone "Pulisci duplicati Gmail" con cleanup storici
- Cleanup esteso per casi senza tag gmail e drift timezone
- Lettura contenuto email via attachmentId (MIME part)
- Sync che aggiorna/rimuove righe Gmail già esistenti e generiche

Prossimo lavoro pianificato:
- Accessibility pass su light mode (contrasto e nomi accessibili icon-only)

# Lessons

- Riutilizzare logica esistente di classificazione e deduplica minimizza regressioni.
- Con OAuth Gmail lato client è necessario gestire scadenza token e stato connessione in UI.
- Il lint globale attuale include `.venv` e produce errori estranei alle modifiche.
- In caso di merchant generico, deduplicare su data+importo evita duplicati con import Excel/manuale.

# Executor's Feedback

Integrazione realizzata interamente client-side per mantenere privacy e coerenza con architettura attuale.

## TDD Evidence

- RED:
  - `npm test -- src/services/isybankEmailParser.test.ts` (fallito: modulo parser non esistente)
  - `npm test -- src/services/gmailSync.test.ts` (fallito: modulo gmailSync non esistente)
- GREEN:
  - `npm test -- src/services/isybankEmailParser.test.ts` (4 test passati)
  - `npm test -- src/services/gmailSync.test.ts` (3 test passati)
  - `npx vitest run` (21 test passati)
  - `npm run build` (build produzione OK)
- REFACTOR:
  - N/A

## TDD Evidence (T3)

- RED:
  - `npm test -- src/services/gmailSync.test.ts`
  - fallimenti attesi su `findLikelyDuplicateTransactionIds` non implementata
- GREEN:
  - `npm test -- src/services/gmailSync.test.ts` (9 test passati)
  - `npx vitest run` (29 test passati)
  - `npm run build` (OK)
  - `npx eslint src/components/Settings.tsx src/services/gmailSync.ts src/services/gmailSync.test.ts` (OK)
- REFACTOR:
  - N/A

## TDD Evidence (T4)

- RED:
  - `npm test -- src/services/gmailSync.test.ts`
  - fallimenti su casi "senza tag gmail" e "timezone drift"
- GREEN:
  - `npm test -- src/services/gmailSync.test.ts` (11 test passati)
  - `npx vitest run` (31 test passati)
  - `npm run build` (OK)
  - `npx eslint src/components/Settings.tsx src/services/gmailSync.ts src/services/gmailSync.test.ts` (OK)
- REFACTOR:
  - N/A

## TDD Evidence (T5)

- RED:
  - (test nuovo su attachment body, inizialmente non implementato)
- GREEN:
  - `npm test -- src/services/gmailSync.test.ts` (12 test passati)
  - `npx vitest run` (32 test passati)
  - `npm run build` (OK)
  - `npx eslint src/services/gmailSync.ts src/services/gmailSync.test.ts` (OK)
- REFACTOR:
  - N/A

## TDD Evidence (T6)

- RED:
  - regressione funzionale osservata su dati reali: message-id già presente bloccava il re-parse
- GREEN:
  - `npm test -- src/services/gmailSync.test.ts` (12 test passati)
  - `npx vitest run` (32 test passati)
  - `npm run build` (OK)
  - `npx eslint src/components/Settings.tsx src/services/gmailSync.ts src/services/gmailSync.test.ts` (OK)
- REFACTOR:
  - N/A

## TDD Evidence (T2)

- RED:
  - `npm test -- src/services/isybankEmailParser.test.ts src/services/gmailSync.test.ts`
  - fallimenti attesi su parser merchant (merchant = `Transazione carta`) e helper dedup mancanti
- GREEN:
  - `npm test -- src/services/isybankEmailParser.test.ts src/services/gmailSync.test.ts` (12 test passati)
  - `npx vitest run` (26 test passati)
  - `npm run build` (build produzione OK)
  - `npx eslint src/services/isybankEmailParser.ts src/services/isybankEmailParser.test.ts src/services/gmailSync.ts src/services/gmailSync.test.ts` (OK)
- REFACTOR:
  - N/A

## TDD Evidence (T8)

- RED:
  - `npx vitest run src/Accessibility.test.tsx`
  - fallito: `.text-muted` usava `opacity: 0.5` e `color: var(--text-ink)` invece di `var(--text-muted)`
- GREEN:
  - `npx vitest run src/Accessibility.test.tsx` (4 test passati)
- REFACTOR:
  - N/A

## TDD Evidence (T9)

- RED:
  - `npx vitest run src/Accessibility.test.tsx`
  - fallito: bottoni mese precedente/successivo non avevano `aria-label`
- GREEN:
  - `npx vitest run src/Accessibility.test.tsx` (5 test passati)
- REFACTOR:
  - N/A
