/* CTM Assessment message catalogue: ui. Edit the JSON only (scripts/check-locales.py).
 * Reveals' default titles and the lecture/reading switch (lua/ui.lua writes
 * them into the page). The status texts are the courses' texts (nb, en). */
CTMLocales.add("ui",
/*BEGIN-JSON*/
{
  "$languages": [
    "en",
    "de",
    "nb",
    "nn"
  ],
  "en": {
    "readingStep": "Go deeper",
    "solution": "Solution",
    "hint": "Hint",
    "details": "Details",
    "modesLabel": "Choose reading mode",
    "modeLecture": "Explore",
    "modeReading": "Go deeper",
    "statusLecture": "Explore: experiment and discuss. Open explanations when needed.",
    "statusReading": "Go deeper: try it yourself, then follow the explanations step by step.",
    "savingLabel": "Saved answers",
    "savingNotice": "Your answers are saved only in this browser.",
    "clearPage": "Delete answers on this page",
    "clearCourse": "Delete all your answers in this course",
    "saveOff": "Do not save on this device",
    "saveOn": "Save again",
    "confirmSaveOff": "This deletes all saved answers in this course and stops saving.",
    "confirmClearCourse": "Delete all your saved answers in this course?",
    "storageUnavailable": "Saving is unavailable. Your answers are kept in memory for this page only.",
    "recordTooLarge": "This answer is too large to save. Copy it before leaving the page.",
    "sourceChanged": "The exercise has changed since you answered.",
    "showSaved": "Show your saved answer",
    "outdated": "Outdated",
    "variantChanged": "This variant has changed.",
    "variantWithdrawn": "This variant has been withdrawn.",
    "statusCorrect": "correct",
    "statusPartial": "partly correct",
    "statusWrong": "wrong",
    "statusInvalid": "invalid",
    "confirmNewVariant": "Replace your filled answers with a new variant?",
    "lastChecked": {
      "$args": [
        "date",
        "status",
        "percent"
      ],
      "$t": "Last checked {date}: {status} ({percent} %)"
    },
    "progressTitle": "Page progress",
    "exercise": "Exercise",
    "correct": "✓ correct",
    "partial": "½ partly correct",
    "wrong": "✗ wrong",
    "unattempted": "– not attempted",
    "total": "{score} of {count}",
    "copied": "Copied",
    "copyText": "Copy text",
    "copyClose": "Close",
    "copyHint": "Select the text and press {keys}.",
    "copyAnswer": "Copy answer",
    "copyAnswerLabel": {
      "$args": [
        "id"
      ],
      "$t": "Copy the answer in exercise {id}"
    },
    "exportTitle": "Export my answers",
    "copyAll": "Copy all",
    "downloadMarkdown": "Download .md",
    "downloadHTML": "Download .html",
    "exportClose": "Close",
    "savingDisabled": "Saving is off for this page.",
    "savingOffNotice": "Saving is off on this device for this course.",
    "clearFailed": "Browser storage could not be cleared or updated. Use your browser settings to remove this course data.",
    "lastResult": "Last result",
    "copyOutput": "Copy output",
    "downloadPlot": "Download figure (PNG)",
    "figureLabel": {
      "$args": [
        "n"
      ],
      "$t": "Figure {n}"
    },
    "settings": "Settings",
    "answersStorage": "Answers & storage",
    "savingLocal": "Saving in this browser",
    "savedLocal": "Saved in this browser",
    "notSaving": "Answers aren’t being saved",
    "answered": "Answered, not graded",
    "confirmClearPage": "Delete all saved answers on this page?"
  },
  "de": {
    "readingStep": "Vertiefung",
    "solution": "Lösungsvorschlag",
    "hint": "Hinweis",
    "details": "Details",
    "modesLabel": "Lesemodus wählen",
    "modeLecture": "Vortrag",
    "modeReading": "Vertiefung",
    "statusLecture": "Vortrag: Experimente und Diskussion. Vertiefungen bei Bedarf öffnen.",
    "statusReading": "Vertiefung: selbst ausprobieren und den Erklärungen Schritt für Schritt folgen.",
    "savingLabel": "Gespeicherte Antworten",
    "savingNotice": "Ihre Antworten werden nur in diesem Browser gespeichert.",
    "clearPage": "Antworten auf dieser Seite löschen",
    "clearCourse": "Alle Antworten in diesem Kurs löschen",
    "saveOff": "Auf diesem Gerät nicht speichern",
    "saveOn": "Wieder speichern",
    "confirmSaveOff": "Alle gespeicherten Antworten dieses Kurses werden gelöscht und die Speicherung beendet.",
    "confirmClearCourse": "Alle gespeicherten Antworten in diesem Kurs löschen?",
    "storageUnavailable": "Speichern ist nicht verfügbar. Ihre Antworten bleiben nur im Arbeitsspeicher dieser Seite.",
    "recordTooLarge": "Diese Antwort ist zum Speichern zu groß. Kopieren Sie sie, bevor Sie die Seite verlassen.",
    "sourceChanged": "Die Aufgabe wurde seit Ihrer Antwort geändert.",
    "showSaved": "Gespeicherte Antwort anzeigen",
    "outdated": "Veraltet",
    "variantChanged": "Diese Variante wurde geändert.",
    "variantWithdrawn": "Diese Variante wurde zurückgezogen.",
    "statusCorrect": "richtig",
    "statusPartial": "teilweise richtig",
    "statusWrong": "falsch",
    "statusInvalid": "ungültig",
    "confirmNewVariant": "Die ausgefüllten Antworten durch eine neue Variante ersetzen?",
    "lastChecked": {
      "$args": [
        "date",
        "status",
        "percent"
      ],
      "$t": "Zuletzt geprüft am {date}: {status} ({percent} %)"
    },
    "progressTitle": "Fortschritt auf dieser Seite",
    "exercise": "Aufgabe",
    "correct": "✓ richtig",
    "partial": "½ teilweise",
    "wrong": "✗ falsch",
    "unattempted": "– nicht versucht",
    "total": "{score} von {count}",
    "copied": "Kopiert",
    "copyText": "Text kopieren",
    "copyClose": "Schließen",
    "copyHint": "Wählen Sie den Text und drücken Sie {keys}.",
    "copyAnswer": "Antwort kopieren",
    "copyAnswerLabel": {
      "$args": [
        "id"
      ],
      "$t": "Antwort in Aufgabe {id} kopieren"
    },
    "exportTitle": "Meine Antworten exportieren",
    "copyAll": "Alles kopieren",
    "downloadMarkdown": ".md herunterladen",
    "downloadHTML": ".html herunterladen",
    "exportClose": "Schließen",
    "savingDisabled": "Speichern ist für diese Seite ausgeschaltet.",
    "savingOffNotice": "Speichern ist auf diesem Gerät für diesen Kurs ausgeschaltet.",
    "clearFailed": "Der Browserspeicher konnte nicht gelöscht oder aktualisiert werden. Entfernen Sie die Kursdaten in den Browsereinstellungen.",
    "lastResult": "Letztes Ergebnis",
    "copyOutput": "Ausgabe kopieren",
    "downloadPlot": "Abbildung herunterladen (PNG)",
    "figureLabel": {
      "$args": [
        "n"
      ],
      "$t": "Abbildung {n}"
    },
    "settings": "Einstellungen",
    "answersStorage": "Antworten & Speicherung",
    "savingLocal": "Speichern in diesem Browser",
    "savedLocal": "In diesem Browser gespeichert",
    "notSaving": "Antworten werden nicht gespeichert",
    "answered": "Beantwortet, noch nicht bewertet",
    "confirmClearPage": "Alle gespeicherten Antworten auf dieser Seite löschen?"
  },
  "nb": {
    "readingStep": "Gå i dybden",
    "solution": "Løsningsforslag",
    "hint": "Hint",
    "details": "Detaljer",
    "modesLabel": "Velg lesemodus",
    "modeLecture": "Forelesning",
    "modeReading": "Gå i dybden",
    "statusLecture": "Forelesning: eksperimenter og diskusjon. Åpne utdypningene ved behov.",
    "statusReading": "Gå i dybden: prøv selv, og følg forklaringene steg for steg.",
    "savingLabel": "Lagrede svar",
    "savingNotice": "Svarene dine lagres bare i denne nettleseren.",
    "clearPage": "Slett svarene på denne siden",
    "clearCourse": "Slett alle svarene dine i dette emnet",
    "saveOff": "Ikke lagre på denne enheten",
    "saveOn": "Lagre igjen",
    "confirmSaveOff": "Dette sletter alle lagrede svar i dette emnet og slutter å lagre.",
    "confirmClearCourse": "Slett alle de lagrede svarene dine i dette emnet?",
    "storageUnavailable": "Lagring er ikke tilgjengelig. Svarene dine beholdes bare i minnet på denne siden.",
    "recordTooLarge": "Dette svaret er for stort til å lagres. Kopier det før du forlater siden.",
    "sourceChanged": "Oppgaven er endret siden du svarte.",
    "showSaved": "Vis svaret ditt",
    "outdated": "Utdatert",
    "variantChanged": "Denne varianten er endret.",
    "variantWithdrawn": "Denne varianten er trukket tilbake.",
    "statusCorrect": "riktig",
    "statusPartial": "delvis riktig",
    "statusWrong": "feil",
    "statusInvalid": "ugyldig",
    "confirmNewVariant": "Erstatt svarene du har fylt ut med en ny variant?",
    "lastChecked": {
      "$args": [
        "date",
        "status",
        "percent"
      ],
      "$t": "Sist sjekket {date}: {status} ({percent} %)"
    },
    "progressTitle": "Fremdrift på siden",
    "exercise": "Oppgave",
    "correct": "✓ riktig",
    "partial": "½ delvis",
    "wrong": "✗ feil",
    "unattempted": "– ikke prøvd",
    "total": "{score} av {count}",
    "copied": "Kopiert",
    "copyText": "Kopier tekst",
    "copyClose": "Lukk",
    "copyHint": "Velg teksten og trykk {keys}.",
    "copyAnswer": "Kopier svaret",
    "copyAnswerLabel": {
      "$args": [
        "id"
      ],
      "$t": "Kopier svaret i oppgave {id}"
    },
    "exportTitle": "Eksporter svarene mine",
    "copyAll": "Kopier alt",
    "downloadMarkdown": "Last ned .md",
    "downloadHTML": "Last ned .html",
    "exportClose": "Lukk",
    "savingDisabled": "Lagring er slått av for denne siden.",
    "savingOffNotice": "Lagring er slått av på denne enheten for dette emnet.",
    "clearFailed": "Nettleserlagringen kunne ikke slettes eller oppdateres. Fjern emnedataene i nettleserinnstillingene.",
    "lastResult": "Siste resultat",
    "copyOutput": "Kopier utskrift",
    "downloadPlot": "Last ned figur (PNG)",
    "figureLabel": {
      "$args": [
        "n"
      ],
      "$t": "Figur {n}"
    },
    "settings": "Innstillinger",
    "answersStorage": "Svar og lagring",
    "savingLocal": "Lagrer i denne nettleseren",
    "savedLocal": "Lagret i denne nettleseren",
    "notSaving": "Svar blir ikke lagret",
    "answered": "Besvart, ikke vurdert",
    "confirmClearPage": "Slett alle lagrede svar på denne siden?"
  },
  "nn": {
    "readingStep": "Gå i djupna",
    "solution": "Løysingsforslag",
    "hint": "Hint",
    "details": "Detaljar",
    "modesLabel": "Vel lesemodus",
    "modeLecture": "Førelesing",
    "modeReading": "Gå i djupna",
    "statusLecture": "Førelesing: eksperiment og diskusjon. Opne utdjupingane ved behov.",
    "statusReading": "Gå i djupna: prøv sjølv, og følg forklaringane steg for steg.",
    "savingLabel": "Lagra svar",
    "savingNotice": "Svara dine blir berre lagra i denne nettlesaren.",
    "clearPage": "Slett svara på denne sida",
    "clearCourse": "Slett alle svara dine i dette emnet",
    "saveOff": "Ikkje lagre på denne eininga",
    "saveOn": "Lagre igjen",
    "confirmSaveOff": "Dette slettar alle lagra svar i dette emnet og sluttar å lagre.",
    "confirmClearCourse": "Slett alle dei lagra svara dine i dette emnet?",
    "storageUnavailable": "Lagring er ikkje tilgjengeleg. Svara dine blir berre haldne i minnet på denne sida.",
    "recordTooLarge": "Dette svaret er for stort til å lagrast. Kopier det før du forlèt sida.",
    "sourceChanged": "Oppgåva er endra sidan du svarte.",
    "showSaved": "Vis svaret ditt",
    "outdated": "Utdatert",
    "variantChanged": "Denne varianten er endra.",
    "variantWithdrawn": "Denne varianten er trekt tilbake.",
    "statusCorrect": "rett",
    "statusPartial": "delvis rett",
    "statusWrong": "feil",
    "statusInvalid": "ugyldig",
    "confirmNewVariant": "Byt ut svara du har fylt ut med ein ny variant?",
    "lastChecked": {
      "$args": [
        "date",
        "status",
        "percent"
      ],
      "$t": "Sist sjekka {date}: {status} ({percent} %)"
    },
    "progressTitle": "Framdrift på sida",
    "exercise": "Oppgåve",
    "correct": "✓ rett",
    "partial": "½ delvis",
    "wrong": "✗ feil",
    "unattempted": "– ikkje prøvd",
    "total": "{score} av {count}",
    "copied": "Kopiert",
    "copyText": "Kopier tekst",
    "copyClose": "Lukk",
    "copyHint": "Vel teksten og trykk {keys}.",
    "copyAnswer": "Kopier svaret",
    "copyAnswerLabel": {
      "$args": [
        "id"
      ],
      "$t": "Kopier svaret i oppgåve {id}"
    },
    "exportTitle": "Eksporter svara mine",
    "copyAll": "Kopier alt",
    "downloadMarkdown": "Last ned .md",
    "downloadHTML": "Last ned .html",
    "exportClose": "Lukk",
    "savingDisabled": "Lagring er slått av for denne sida.",
    "savingOffNotice": "Lagring er slått av på denne eininga for dette emnet.",
    "clearFailed": "Nettlesarlagringa kunne ikkje slettast eller oppdaterast. Fjern emnedata i nettlesarinnstillingane.",
    "lastResult": "Siste resultat",
    "copyOutput": "Kopier utskrift",
    "downloadPlot": "Last ned figur (PNG)",
    "figureLabel": {
      "$args": [
        "n"
      ],
      "$t": "Figur {n}"
    },
    "settings": "Innstillingar",
    "answersStorage": "Svar og lagring",
    "savingLocal": "Lagrar i denne nettlesaren",
    "savedLocal": "Lagra i denne nettlesaren",
    "notSaving": "Svar blir ikkje lagra",
    "answered": "Svart på, ikkje vurdert",
    "confirmClearPage": "Slett alle lagra svar på denne sida?"
  }
}
/*END-JSON*/
);
