/* CTM Assessment message catalogue: ctm-stack. AGPL-3.0-or-later.
 * English preserves the existing card texts; all six languages are complete. */
CTMLocales.add("ctm-stack",
/*BEGIN-JSON*/
{
  "$languages": [
    "en",
    "nb",
    "nn",
    "de",
    "sv",
    "da"
  ],
  "en": {
    "variantLabel": "Variant ",
    "variantChoice": {
      "$t": "Variant {n}",
      "$args": [
        "n"
      ]
    },
    "variantAriaLabel": "Question variant",
    "validateButton": "Validate answers",
    "checkButton": "Check answer",
    "testsButton": "Run question tests",
    "unsupportedQuestion": "Unsupported STACK question",
    "resetButton": "Reset answers",
    "feedbackButton": "Feedback",
    "needAnswerFirst": "Enter an answer before requesting feedback.",
    "checkInput": "Check the input and try again.",
    "correct": "Correct.",
    "partial": {
      "$t": "Partially correct ({pct}%).",
      "$args": [
        "pct"
      ]
    },
    "retry": "Not quite. Try again.",
    "validationReady": "Your answer is ready to check. Review the preview first.",
    "validationInvalid": "Please correct the marked input and validate again.",
    "interpretedAs": {
      "$t": "Interpreted as \\({latex}\\)",
      "$args": [
        "latex"
      ]
    },
    "testsPassed": "All question tests passed.",
    "testsFailed": "Some question tests failed.",
    "testPass": "Pass",
    "testFail": "Fail",
    "testCase": {
      "$t": "{testcase} (seed {seed})",
      "$args": [
        "testcase",
        "seed"
      ]
    },
    "questionDataError": "Question data could not be read.",
    "matrixMissing": "The shared matrix input could not load.",
    "errorCheck": {
      "$t": "Could not check this answer: {reason}",
      "$args": [
        "reason"
      ]
    },
    "validateFirst": "Validate the current inputs before checking.",
    "checking": {
      "$t": "Checking with {backend}…",
      "$args": [
        "backend"
      ]
    },
    "parsing": "Parsing your inputs…",
    "runningTests": "Running authored tests…",
    "matrixRows": "Rows",
    "matrixColumns": "Columns",
    "matrixAddRow": "Add row",
    "matrixRemoveRow": "Remove row",
    "matrixAddColumn": "Add column",
    "matrixRemoveColumn": "Remove column",
    "emptyMatrix": "Empty matrix",
    "matrixSizeControls": "Matrix size controls",
    "matrixCell": {
      "$t": "{name}, Rows {row}, Columns {column}",
      "$args": [
        "name",
        "row",
        "column"
      ]
    },
    "previousCheck": "Previous answer check",
    "feedbackAnswer": {
      "$t": "Answer {name}",
      "$args": [
        "name"
      ]
    },
    "slowCheck": "The calculation is still running.",
    "slowLoad": "Python is still loading.",
    "stop": "Stop",
    "stoppedInterrupted": "Stopped.",
    "stoppedRestarted": "Stopped. The grading session was restarted.",
    "graderMissing": "The grader is missing on this page.",
    "graderFailed": "The grader failed.",
    "workerFailed": "The grading worker could not start.",
    "loadTimeout": "Python did not finish loading. Try again.",
    "calculationTimeout": "The calculation timed out. Try again.",
    "mathjaxError": "Could not load MathJax.",
    "mathjaxTimeout": "MathJax did not initialize.",
    "mathjaxMissing": "MathJax did not expose a typesetting API.",
    "stack_question_error": {
      "$t": "Question {question}, {location}: {reason}",
      "$args": [
        "question",
        "location",
        "reason"
      ]
    },
    "stack_input_invalid": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "stack_validated": "Review the parsed answers",
    "stack_invalid_answers": "Correct invalid answers before grading",
    "stack_check_answers": "Check your answers before grading",
    "stack_enter_answer": "Enter an answer",
    "stack_answer_feedback": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "ATSets_duplicates": "Repeated elements were removed from the set.",
    "ATSets_wrongentries": {
      "$t": "Extra elements: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "ATSets_missingentries": {
      "$t": "Missing elements: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "showSource": "Show source",
    "showStackSource": "Show STACK source",
    "retryButton": "Retry",
    "authorError": {
      "$t": "This question has an error: {reason}",
      "$args": [
        "reason"
      ]
    },
    "newVariant": "New variant",
    "unapprovedVariant": "Not approved",
    "variantProposal": "Proposed variant",
    "confirmNewVariant": "Replace your filled answers with a new variant?",
    "savedVariantUnavailable": "This saved variant is no longer available. Your previous answers are shown below. Choose a new variant to continue."
  },
  "nb": {
    "variantLabel": "Variant ",
    "variantChoice": {
      "$t": "Variant {n}",
      "$args": [
        "n"
      ]
    },
    "variantAriaLabel": "Oppgavevariant",
    "validateButton": "Valider svar",
    "checkButton": "Sjekk svar",
    "testsButton": "Kjør oppgavetester",
    "unsupportedQuestion": "STACK-oppgaven støttes ikke",
    "resetButton": "Nullstill svar",
    "feedbackButton": "Tilbakemelding",
    "needAnswerFirst": "Skriv inn et svar før du ber om tilbakemelding.",
    "checkInput": "Sjekk inntastingen og prøv igjen.",
    "correct": "Riktig.",
    "partial": {
      "$t": "Delvis riktig ({pct} %).",
      "$args": [
        "pct"
      ]
    },
    "retry": "Ikke helt. Prøv igjen.",
    "validationReady": "Svaret kan sjekkes. Se gjennom forhåndsvisningen først.",
    "validationInvalid": "Rett den markerte inntastingen og valider igjen.",
    "interpretedAs": {
      "$t": "Tolket som \\({latex}\\)",
      "$args": [
        "latex"
      ]
    },
    "testsPassed": "Alle oppgavetestene besto.",
    "testsFailed": "Noen oppgavetester feilet.",
    "testPass": "Bestått",
    "testFail": "Feilet",
    "testCase": {
      "$t": "{testcase} (frø {seed})",
      "$args": [
        "testcase",
        "seed"
      ]
    },
    "questionDataError": "Oppgavedata kunne ikke leses.",
    "matrixMissing": "Den delte matriseeditoren kunne ikke lastes.",
    "errorCheck": {
      "$t": "Kunne ikke sjekke svaret: {reason}",
      "$args": [
        "reason"
      ]
    },
    "validateFirst": "Valider gjeldende inntasting før du sjekker.",
    "checking": {
      "$t": "Sjekker med {backend}…",
      "$args": [
        "backend"
      ]
    },
    "parsing": "Tolker inntastingen…",
    "runningTests": "Kjører forfatterens tester…",
    "matrixRows": "Rader",
    "matrixColumns": "Kolonner",
    "matrixAddRow": "Legg til rad",
    "matrixRemoveRow": "Fjern rad",
    "matrixAddColumn": "Legg til kolonne",
    "matrixRemoveColumn": "Fjern kolonne",
    "emptyMatrix": "Tom matrise",
    "matrixSizeControls": "Kontroller for matrisestørrelse",
    "matrixCell": {
      "$t": "{name}, rad {row}, kolonne {column}",
      "$args": [
        "name",
        "row",
        "column"
      ]
    },
    "previousCheck": "Forrige svarvurdering",
    "feedbackAnswer": {
      "$t": "Svar {name}",
      "$args": [
        "name"
      ]
    },
    "slowCheck": "Beregningen pågår fortsatt.",
    "slowLoad": "Python lastes fortsatt inn.",
    "stop": "Avbryt",
    "stoppedInterrupted": "Avbrutt.",
    "stoppedRestarted": "Avbrutt. Vurderingsøkten ble startet på nytt.",
    "graderMissing": "Vurderingsmotoren mangler på siden.",
    "graderFailed": "Vurderingen feilet.",
    "workerFailed": "Vurderingsarbeideren kunne ikke starte.",
    "loadTimeout": "Python ble ikke ferdig lastet. Prøv igjen.",
    "calculationTimeout": "Beregningen tok for lang tid. Prøv igjen.",
    "mathjaxError": "Kunne ikke laste MathJax.",
    "mathjaxTimeout": "MathJax ble ikke startet.",
    "mathjaxMissing": "MathJax mangler et grensesnitt for formatering.",
    "stack_question_error": {
      "$t": "Oppgave {question}, {location}: {reason}",
      "$args": [
        "question",
        "location",
        "reason"
      ]
    },
    "stack_input_invalid": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "stack_validated": "Se gjennom de tolkede svarene",
    "stack_invalid_answers": "Rett ugyldige svar før vurdering",
    "stack_check_answers": "Sjekk svarene før vurdering",
    "stack_enter_answer": "Skriv inn et svar",
    "stack_answer_feedback": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "ATSets_duplicates": "Gjentatte elementer ble fjernet fra mengden.",
    "ATSets_wrongentries": {
      "$t": "Ekstra elementer: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "ATSets_missingentries": {
      "$t": "Manglende elementer: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "showSource": "Vis kilde",
    "showStackSource": "Vis STACK-kilde",
    "retryButton": "Prøv igjen",
    "authorError": {
      "$t": "Denne oppgaven har en feil: {reason}",
      "$args": [
        "reason"
      ]
    },
    "newVariant": "Ny variant",
    "unapprovedVariant": "Ikke godkjent",
    "variantProposal": "Foreslått variant",
    "confirmNewVariant": "Erstatt svarene du har fylt ut med en ny variant?",
    "savedVariantUnavailable": "Den lagrede varianten er ikke lenger tilgjengelig. De tidligere svarene dine vises nedenfor. Velg en ny variant for å fortsette."
  },
  "nn": {
    "variantLabel": "Variant ",
    "variantChoice": {
      "$t": "Variant {n}",
      "$args": [
        "n"
      ]
    },
    "variantAriaLabel": "Oppgåvevariant",
    "validateButton": "Valider svar",
    "checkButton": "Sjekk svar",
    "testsButton": "Køyr oppgåvetestar",
    "unsupportedQuestion": "STACK-oppgåva er ikkje støtta",
    "resetButton": "Nullstill svar",
    "feedbackButton": "Tilbakemelding",
    "needAnswerFirst": "Skriv inn eit svar før du ber om tilbakemelding.",
    "checkInput": "Sjekk inntastinga og prøv igjen.",
    "correct": "Rett.",
    "partial": {
      "$t": "Delvis rett ({pct} %).",
      "$args": [
        "pct"
      ]
    },
    "retry": "Ikkje heilt. Prøv igjen.",
    "validationReady": "Svaret kan sjekkast. Sjå gjennom førehandsvisinga først.",
    "validationInvalid": "Rett den markerte inntastinga og valider igjen.",
    "interpretedAs": {
      "$t": "Tolka som \\({latex}\\)",
      "$args": [
        "latex"
      ]
    },
    "testsPassed": "Alle oppgåvetestane bestod.",
    "testsFailed": "Nokre oppgåvetestar feila.",
    "testPass": "Bestått",
    "testFail": "Feila",
    "testCase": {
      "$t": "{testcase} (frø {seed})",
      "$args": [
        "testcase",
        "seed"
      ]
    },
    "questionDataError": "Oppgåvedata kunne ikkje lesast.",
    "matrixMissing": "Den delte matriseeditoren kunne ikkje lastast.",
    "errorCheck": {
      "$t": "Kunne ikkje sjekke svaret: {reason}",
      "$args": [
        "reason"
      ]
    },
    "validateFirst": "Valider gjeldande inntasting før du sjekkar.",
    "checking": {
      "$t": "Sjekkar med {backend}…",
      "$args": [
        "backend"
      ]
    },
    "parsing": "Tolkar inntastinga…",
    "runningTests": "Køyrer forfattaren sine testar…",
    "matrixRows": "Rader",
    "matrixColumns": "Kolonnar",
    "matrixAddRow": "Legg til rad",
    "matrixRemoveRow": "Fjern rad",
    "matrixAddColumn": "Legg til kolonne",
    "matrixRemoveColumn": "Fjern kolonne",
    "emptyMatrix": "Tom matrise",
    "matrixSizeControls": "Kontrollar for matrisestorleik",
    "matrixCell": {
      "$t": "{name}, rad {row}, kolonne {column}",
      "$args": [
        "name",
        "row",
        "column"
      ]
    },
    "previousCheck": "Førre svarvurdering",
    "feedbackAnswer": {
      "$t": "Svar {name}",
      "$args": [
        "name"
      ]
    },
    "slowCheck": "Utrekninga går framleis.",
    "slowLoad": "Python lastar framleis.",
    "stop": "Avbryt",
    "stoppedInterrupted": "Avbroten.",
    "stoppedRestarted": "Avbroten. Vurderingsøkta vart starta på nytt.",
    "graderMissing": "Vurderingsmotoren manglar på sida.",
    "graderFailed": "Vurderinga feila.",
    "workerFailed": "Vurderingsarbeidaren kunne ikkje starte.",
    "loadTimeout": "Python vart ikkje ferdig lasta. Prøv igjen.",
    "calculationTimeout": "Utrekninga tok for lang tid. Prøv igjen.",
    "mathjaxError": "Kunne ikkje laste MathJax.",
    "mathjaxTimeout": "MathJax vart ikkje starta.",
    "mathjaxMissing": "MathJax manglar eit grensesnitt for formatering.",
    "stack_question_error": {
      "$t": "Oppgåve {question}, {location}: {reason}",
      "$args": [
        "question",
        "location",
        "reason"
      ]
    },
    "stack_input_invalid": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "stack_validated": "Sjå gjennom dei tolka svara",
    "stack_invalid_answers": "Rett ugyldige svar før vurdering",
    "stack_check_answers": "Sjekk svara før vurdering",
    "stack_enter_answer": "Skriv inn eit svar",
    "stack_answer_feedback": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "ATSets_duplicates": "Gjentekne element vart fjerna frå mengda.",
    "ATSets_wrongentries": {
      "$t": "Ekstra element: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "ATSets_missingentries": {
      "$t": "Manglande element: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "showSource": "Vis kjelde",
    "showStackSource": "Vis STACK-kjelde",
    "retryButton": "Prøv igjen",
    "authorError": {
      "$t": "Denne oppgåva har ein feil: {reason}",
      "$args": [
        "reason"
      ]
    },
    "newVariant": "Ny variant",
    "unapprovedVariant": "Ikkje godkjend",
    "variantProposal": "Føreslått variant",
    "confirmNewVariant": "Byt ut svara du har fylt ut med ein ny variant?",
    "savedVariantUnavailable": "Den lagra varianten er ikkje lenger tilgjengeleg. Dei tidlegare svara dine er viste nedanfor. Vel ein ny variant for å halde fram."
  },
  "de": {
    "variantLabel": "Variante ",
    "variantChoice": {
      "$t": "Variante {n}",
      "$args": [
        "n"
      ]
    },
    "variantAriaLabel": "Aufgabenvariante",
    "validateButton": "Antworten validieren",
    "checkButton": "Antwort prüfen",
    "testsButton": "Aufgabentests ausführen",
    "unsupportedQuestion": "Nicht unterstützte STACK-Aufgabe",
    "resetButton": "Antworten zurücksetzen",
    "feedbackButton": "Feedback",
    "needAnswerFirst": "Gib eine Antwort ein, bevor du Feedback anforderst.",
    "checkInput": "Prüfe die Eingabe und versuche es erneut.",
    "correct": "Richtig.",
    "partial": {
      "$t": "Teilweise richtig ({pct} %).",
      "$args": [
        "pct"
      ]
    },
    "retry": "Noch nicht ganz. Versuche es erneut.",
    "validationReady": "Deine Antwort kann geprüft werden. Sieh zuerst die Vorschau an.",
    "validationInvalid": "Korrigiere die markierte Eingabe und validiere erneut.",
    "interpretedAs": {
      "$t": "Interpretiert als \\({latex}\\)",
      "$args": [
        "latex"
      ]
    },
    "testsPassed": "Alle Aufgabentests bestanden.",
    "testsFailed": "Einige Aufgabentests fehlgeschlagen.",
    "testPass": "Bestanden",
    "testFail": "Fehlgeschlagen",
    "testCase": {
      "$t": "{testcase} (Startwert {seed})",
      "$args": [
        "testcase",
        "seed"
      ]
    },
    "questionDataError": "Aufgabendaten konnten nicht gelesen werden.",
    "matrixMissing": "Der gemeinsame Matrixeditor konnte nicht geladen werden.",
    "errorCheck": {
      "$t": "Diese Antwort konnte nicht geprüft werden: {reason}",
      "$args": [
        "reason"
      ]
    },
    "validateFirst": "Validiere die aktuellen Eingaben vor dem Prüfen.",
    "checking": {
      "$t": "Prüfung mit {backend}…",
      "$args": [
        "backend"
      ]
    },
    "parsing": "Eingaben werden gelesen…",
    "runningTests": "Autorentests werden ausgeführt…",
    "matrixRows": "Zeilen",
    "matrixColumns": "Spalten",
    "matrixAddRow": "Zeile hinzufügen",
    "matrixRemoveRow": "Zeile entfernen",
    "matrixAddColumn": "Spalte hinzufügen",
    "matrixRemoveColumn": "Spalte entfernen",
    "emptyMatrix": "Leere Matrix",
    "matrixSizeControls": "Matrixgrößensteuerung",
    "matrixCell": {
      "$t": "{name}, Zeile {row}, Spalte {column}",
      "$args": [
        "name",
        "row",
        "column"
      ]
    },
    "previousCheck": "Vorherige Antwortprüfung",
    "feedbackAnswer": {
      "$t": "Antwort {name}",
      "$args": [
        "name"
      ]
    },
    "slowCheck": "Die Berechnung läuft noch.",
    "slowLoad": "Python wird noch geladen.",
    "stop": "Abbrechen",
    "stoppedInterrupted": "Abgebrochen.",
    "stoppedRestarted": "Abgebrochen. Die Bewertungssitzung wurde neu gestartet.",
    "graderMissing": "Der Bewertungsdienst fehlt auf dieser Seite.",
    "graderFailed": "Die Bewertung ist fehlgeschlagen.",
    "workerFailed": "Der Bewertungsprozess konnte nicht starten.",
    "loadTimeout": "Python wurde nicht vollständig geladen. Versuche es erneut.",
    "calculationTimeout": "Die Berechnung hat zu lange gedauert. Versuche es erneut.",
    "mathjaxError": "MathJax konnte nicht geladen werden.",
    "mathjaxTimeout": "MathJax wurde nicht initialisiert.",
    "mathjaxMissing": "MathJax stellt keine Formatierungsschnittstelle bereit.",
    "stack_question_error": {
      "$t": "Aufgabe {question}, {location}: {reason}",
      "$args": [
        "question",
        "location",
        "reason"
      ]
    },
    "stack_input_invalid": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "stack_validated": "Prüfe die gelesenen Antworten",
    "stack_invalid_answers": "Korrigiere ungültige Antworten vor der Bewertung",
    "stack_check_answers": "Prüfe deine Antworten vor der Bewertung",
    "stack_enter_answer": "Gib eine Antwort ein",
    "stack_answer_feedback": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "ATSets_duplicates": "Wiederholte Elemente wurden aus der Menge entfernt.",
    "ATSets_wrongentries": {
      "$t": "Zusätzliche Elemente: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "ATSets_missingentries": {
      "$t": "Fehlende Elemente: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "showSource": "Quelltext anzeigen",
    "showStackSource": "STACK-Quelltext anzeigen",
    "retryButton": "Erneut versuchen",
    "authorError": {
      "$t": "Diese Aufgabe enthält einen Fehler: {reason}",
      "$args": [
        "reason"
      ]
    },
    "newVariant": "Neue Variante",
    "unapprovedVariant": "Nicht freigegeben",
    "variantProposal": "Vorgeschlagene Variante",
    "confirmNewVariant": "Die ausgefüllten Antworten durch eine neue Variante ersetzen?",
    "savedVariantUnavailable": "Diese gespeicherte Variante ist nicht mehr verfügbar. Ihre bisherigen Antworten stehen unten. Wählen Sie eine neue Variante, um fortzufahren."
  },
  "sv": {
    "variantLabel": "Variant ",
    "variantChoice": {
      "$t": "Variant {n}",
      "$args": [
        "n"
      ]
    },
    "variantAriaLabel": "Uppgiftsvariant",
    "validateButton": "Validera svar",
    "checkButton": "Kontrollera svar",
    "testsButton": "Kör uppgiftstester",
    "unsupportedQuestion": "STACK-uppgiften stöds inte",
    "resetButton": "Återställ svar",
    "feedbackButton": "Återkoppling",
    "needAnswerFirst": "Skriv ett svar innan du ber om återkoppling.",
    "checkInput": "Kontrollera inmatningen och försök igen.",
    "correct": "Rätt.",
    "partial": {
      "$t": "Delvis rätt ({pct} %).",
      "$args": [
        "pct"
      ]
    },
    "retry": "Inte riktigt. Försök igen.",
    "validationReady": "Ditt svar kan kontrolleras. Granska förhandsvisningen först.",
    "validationInvalid": "Rätta den markerade inmatningen och validera igen.",
    "interpretedAs": {
      "$t": "Tolkat som \\({latex}\\)",
      "$args": [
        "latex"
      ]
    },
    "testsPassed": "Alla uppgiftstester godkändes.",
    "testsFailed": "Några uppgiftstester misslyckades.",
    "testPass": "Godkänd",
    "testFail": "Misslyckad",
    "testCase": {
      "$t": "{testcase} (frö {seed})",
      "$args": [
        "testcase",
        "seed"
      ]
    },
    "questionDataError": "Uppgiftsdata kunde inte läsas.",
    "matrixMissing": "Den delade matrisredigeraren kunde inte laddas.",
    "errorCheck": {
      "$t": "Svaret kunde inte kontrolleras: {reason}",
      "$args": [
        "reason"
      ]
    },
    "validateFirst": "Validera de aktuella inmatningarna före kontroll.",
    "checking": {
      "$t": "Kontrollerar med {backend}…",
      "$args": [
        "backend"
      ]
    },
    "parsing": "Tolkar inmatningen…",
    "runningTests": "Kör författarens tester…",
    "matrixRows": "Rader",
    "matrixColumns": "Kolumner",
    "matrixAddRow": "Lägg till rad",
    "matrixRemoveRow": "Ta bort rad",
    "matrixAddColumn": "Lägg till kolumn",
    "matrixRemoveColumn": "Ta bort kolumn",
    "emptyMatrix": "Tom matris",
    "matrixSizeControls": "Kontroller för matrisstorlek",
    "matrixCell": {
      "$t": "{name}, rad {row}, kolumn {column}",
      "$args": [
        "name",
        "row",
        "column"
      ]
    },
    "previousCheck": "Föregående svarkontroll",
    "feedbackAnswer": {
      "$t": "Svar {name}",
      "$args": [
        "name"
      ]
    },
    "slowCheck": "Beräkningen pågår fortfarande.",
    "slowLoad": "Python laddas fortfarande.",
    "stop": "Avbryt",
    "stoppedInterrupted": "Avbruten.",
    "stoppedRestarted": "Avbruten. Bedömningssessionen startades om.",
    "graderMissing": "Bedömningsmotorn saknas på sidan.",
    "graderFailed": "Bedömningen misslyckades.",
    "workerFailed": "Bedömningsprocessen kunde inte starta.",
    "loadTimeout": "Python laddades inte klart. Försök igen.",
    "calculationTimeout": "Beräkningen tog för lång tid. Försök igen.",
    "mathjaxError": "MathJax kunde inte laddas.",
    "mathjaxTimeout": "MathJax startade inte.",
    "mathjaxMissing": "MathJax saknar ett gränssnitt för formatering.",
    "stack_question_error": {
      "$t": "Uppgift {question}, {location}: {reason}",
      "$args": [
        "question",
        "location",
        "reason"
      ]
    },
    "stack_input_invalid": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "stack_validated": "Granska de tolkade svaren",
    "stack_invalid_answers": "Rätta ogiltiga svar före bedömning",
    "stack_check_answers": "Kontrollera svaren före bedömning",
    "stack_enter_answer": "Skriv ett svar",
    "stack_answer_feedback": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "ATSets_duplicates": "Upprepade element togs bort från mängden.",
    "ATSets_wrongentries": {
      "$t": "Extra element: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "ATSets_missingentries": {
      "$t": "Saknade element: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "showSource": "Visa källa",
    "showStackSource": "Visa STACK-källa",
    "retryButton": "Försök igen",
    "authorError": {
      "$t": "Den här uppgiften innehåller ett fel: {reason}",
      "$args": [
        "reason"
      ]
    },
    "newVariant": "Ny variant",
    "unapprovedVariant": "Inte godkänd",
    "variantProposal": "Föreslagen variant",
    "confirmNewVariant": "Ersätt dina ifyllda svar med en ny variant?",
    "savedVariantUnavailable": "Den sparade varianten är inte längre tillgänglig. Dina tidigare svar visas nedan. Välj en ny variant för att fortsätta."
  },
  "da": {
    "variantLabel": "Variant ",
    "variantChoice": {
      "$t": "Variant {n}",
      "$args": [
        "n"
      ]
    },
    "variantAriaLabel": "Opgavevariant",
    "validateButton": "Valider svar",
    "checkButton": "Tjek svar",
    "testsButton": "Kør opgavetest",
    "unsupportedQuestion": "STACK-opgaven understøttes ikke",
    "resetButton": "Nulstil svar",
    "feedbackButton": "Feedback",
    "needAnswerFirst": "Indtast et svar, før du beder om feedback.",
    "checkInput": "Tjek indtastningen, og prøv igen.",
    "correct": "Korrekt.",
    "partial": {
      "$t": "Delvist korrekt ({pct} %).",
      "$args": [
        "pct"
      ]
    },
    "retry": "Ikke helt. Prøv igen.",
    "validationReady": "Dit svar kan tjekkes. Gennemgå forhåndsvisningen først.",
    "validationInvalid": "Ret den markerede indtastning, og valider igen.",
    "interpretedAs": {
      "$t": "Fortolket som \\({latex}\\)",
      "$args": [
        "latex"
      ]
    },
    "testsPassed": "Alle opgavetest bestod.",
    "testsFailed": "Nogle opgavetest fejlede.",
    "testPass": "Bestået",
    "testFail": "Fejlet",
    "testCase": {
      "$t": "{testcase} (frø {seed})",
      "$args": [
        "testcase",
        "seed"
      ]
    },
    "questionDataError": "Opgavedata kunne ikke læses.",
    "matrixMissing": "Den delte matrixeditor kunne ikke indlæses.",
    "errorCheck": {
      "$t": "Svaret kunne ikke tjekkes: {reason}",
      "$args": [
        "reason"
      ]
    },
    "validateFirst": "Valider de aktuelle indtastninger før tjek.",
    "checking": {
      "$t": "Tjekker med {backend}…",
      "$args": [
        "backend"
      ]
    },
    "parsing": "Fortolker indtastningen…",
    "runningTests": "Kører forfatterens test…",
    "matrixRows": "Rækker",
    "matrixColumns": "Kolonner",
    "matrixAddRow": "Tilføj række",
    "matrixRemoveRow": "Fjern række",
    "matrixAddColumn": "Tilføj kolonne",
    "matrixRemoveColumn": "Fjern kolonne",
    "emptyMatrix": "Tom matrix",
    "matrixSizeControls": "Kontroller til matrixstørrelse",
    "matrixCell": {
      "$t": "{name}, række {row}, kolonne {column}",
      "$args": [
        "name",
        "row",
        "column"
      ]
    },
    "previousCheck": "Forrige svartjek",
    "feedbackAnswer": {
      "$t": "Svar {name}",
      "$args": [
        "name"
      ]
    },
    "slowCheck": "Beregningen kører stadig.",
    "slowLoad": "Python indlæses stadig.",
    "stop": "Stop",
    "stoppedInterrupted": "Stoppet.",
    "stoppedRestarted": "Stoppet. Bedømmelsessessionen blev genstartet.",
    "graderMissing": "Bedømmelsesmotoren mangler på siden.",
    "graderFailed": "Bedømmelsen fejlede.",
    "workerFailed": "Bedømmelsesprocessen kunne ikke starte.",
    "loadTimeout": "Python blev ikke færdig med at indlæse. Prøv igen.",
    "calculationTimeout": "Beregningen tog for lang tid. Prøv igen.",
    "mathjaxError": "MathJax kunne ikke indlæses.",
    "mathjaxTimeout": "MathJax blev ikke startet.",
    "mathjaxMissing": "MathJax mangler et grænseflade til formatering.",
    "stack_question_error": {
      "$t": "Opgave {question}, {location}: {reason}",
      "$args": [
        "question",
        "location",
        "reason"
      ]
    },
    "stack_input_invalid": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "stack_validated": "Gennemgå de fortolkede svar",
    "stack_invalid_answers": "Ret ugyldige svar før bedømmelse",
    "stack_check_answers": "Tjek svarene før bedømmelse",
    "stack_enter_answer": "Indtast et svar",
    "stack_answer_feedback": {
      "$t": "{text}",
      "$args": [
        "text"
      ]
    },
    "ATSets_duplicates": "Gentagne elementer blev fjernet fra mængden.",
    "ATSets_wrongentries": {
      "$t": "Ekstra elementer: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "ATSets_missingentries": {
      "$t": "Manglende elementer: {elements}.",
      "$args": [
        "elements"
      ]
    },
    "showSource": "Vis kilde",
    "showStackSource": "Vis STACK-kilde",
    "retryButton": "Prøv igen",
    "authorError": {
      "$t": "Denne opgave har en fejl: {reason}",
      "$args": [
        "reason"
      ]
    },
    "newVariant": "Ny variant",
    "unapprovedVariant": "Ikke godkendt",
    "variantProposal": "Foreslået variant",
    "confirmNewVariant": "Erstat dine udfyldte svar med en ny variant?",
    "savedVariantUnavailable": "Den gemte variant er ikke længere tilgængelig. Dine tidligere svar vises nedenfor. Vælg en ny variant for at fortsætte."
  }
}
/*END-JSON*/
);
