# Layouts mit Claude Code und Fable entwickeln

## Projektdateien weitergeben (`*.imm.json`)
Eine Projektdatei enthält alles: Raum (Wände, Türen, Fenster, Stützen, optional der eingescannte Plan als Unterlage),
Inventar samt Fotos und alle Varianten. Sie lässt sich wie ein Dokument per Mail, Teams oder Laufwerk weitergeben.
- **Im Tool:** „Datei → Projekt speichern“ bzw. „Projekt öffnen …“, oder die Datei einfach ins Fenster ziehen. Solange eine
  Projektdatei offen ist, zeigt die Statuszeile „ungesicherte Änderungen“, bis wieder gespeichert wurde. Mit „Zurück zu IMM-Räume“
  geht es zum gemeinsamen Projekt.
- **Ohne Claude-Konto:** `dist/imm-raumplaner.html` ist das ganze Tool in einer Datei (three.js und jsPDF eingebettet). Per
  Doppelklick im Browser öffnen, läuft ohne Internet und ohne Installation; Projektdatei hineinziehen.
- **Mit Claude Code:** `node skripte/imm-layout.mjs pruefen --projekt datei.imm.json @alle` prüft alle Varianten einer Datei,
  `entpacken` zerlegt sie in `raum.json`, `katalog.json`, `varianten/`, `packen -o neu.imm.json` baut wieder eine.

Der Raumplaner und Claude Code arbeiten mit denselben Daten. Varianten liegen in der Datenbank des Artifacts (Sammlung `varianten`).
Die Seite zeigt neue Varianten sofort an, mit einem Hinweis „Neue Variante: … von Fable“. Mit ◀ ▶ (oder `[` `]`) blätterst du
durch alle Varianten, „Varianten“ öffnet die Galerie mit Vorschau, Kennzahlen und Begründung.

## Ablauf
1. **Lage erfassen** – `node skripte/imm-layout.mjs raum` und `… katalog` geben Raum (Zonen, Türen mit Schwenkbereich,
   Fenster, Stützen) und Inventar (IDs, Masse, Bestand) als Text aus. Aktuellen Stand der Varianten holen:
   `ArtifactData list` der Sammlung `varianten` mit `out_dir: varianten/db`.
2. **Brainstorm** – Fable-Agenten (parallel, je ein Leitgedanke, z. B. „Fensterband für Arbeitsplätze“, „offene Mitte für
   Workshops“, „ruhige Nische“) schreiben je eine Datei `varianten/entwuerfe/<id>.json` (Format unten).
3. **Prüfen** – jeder Agent prüft seinen Entwurf selbst, bis er sauber ist:
   `node skripte/imm-layout.mjs pruefen varianten/entwuerfe/<id>.json` (Exit 0 = keine Überschneidung, nichts ausserhalb,
   Bestand eingehalten; enge Durchgänge unter 80 cm werden als Hinweis genannt) und
   `node skripte/imm-layout.mjs bild varianten/entwuerfe/<id>.json --png` (Planbild zum Ansehen).
4. **Anzeigen** – Claude wählt aus, `node skripte/imm-layout.mjs db varianten/entwuerfe/*.json --autor Fable` schreibt die
   Datenbank-Dokumente nach `varianten/db/`, dann `ArtifactData batch` (collection `varianten`, `doc_id` = id, `file_path`).
5. **Weiterarbeiten** – Falk verschiebt im Tool, Claude liest die geänderte Variante zurück und optimiert weiter
   (neue Variante mit `basis` = Ausgangs-ID, statt die alte zu überschreiben).

## Format einer Variante
```json
{
  "id": "f-fensterband",
  "name": "F1 Fensterband",
  "autor": "Fable",
  "begruendung": "Alle Arbeitsplätze am Fensterband, Besprechung zur Tür hin, Mitte frei für Workshops.",
  "tags": ["Brainstorm", "Arbeitsplätze"],
  "basis": null,
  "platzierungen": [ { "uid": "p1", "stueck": "ph-schreibtisch-160", "x": 1.3, "y": 0.5, "rot": 180 } ]
}
```
Koordinaten in Metern, Ursprung oben links, x nach rechts, y nach unten. `x`, `y` = Mittelpunkt des Stücks, `rot` in Grad im
Uhrzeigersinn. Die Vorderseite eines Stücks (wo man sitzt oder es öffnet) zeigt bei `rot: 0` nach unten (+y), bei 180 nach oben.
Stühle dürfen unter Tische ragen; alles andere darf sich nicht überschneiden, auch nicht mit Wänden, Stützen und Türschwenk.

## Technik
- `app/geom.js` – die gemeinsame Geometrie (Raum, Kollisionen, Einrasten, Bewertung, Planzeichnung) für Seite und Kommandozeile.
- `app/src/index.src.html` – Quelle der Seite; `node skripte/build.mjs` baut daraus `app/index.html` (bettet `geom.js` ein).
- Nach jeder Änderung: `node skripte/build.mjs` (und `--offline` für `dist/`), Artifact mit `app/index.html` neu veröffentlichen.
- `vendor/` – eingebettete Bibliotheken für die Offline-Fassung (MIT-Lizenzen, siehe `vendor/README.md`).
