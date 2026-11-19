Neugestaltung der Räume des Instituts für Marketing Management (IMM, ZHAW): 2D-Grundriss mit Inventar-Editor und schnellem 3D-Betrachter

- Fach: Other
- Start: 2026-11-19
- Status: aktiv
- Hinweis: Das Institut heisst **IMM**, nicht EMM. Ordner und Fundus-Slug werden noch umbenannt (`projects-move` → `26_IMM-Space`).

## Editor
- Code öffentlich: https://github.com/falkue/imm-space (ohne Pläne, Fotos, Auftrag – siehe `.gitignore`).
- Zusammenarbeit mit Claude Code und Fable (Brainstorm, Prüfen, Anzeigen) und Projektdateien `*.imm.json`: `ZUSAMMENARBEIT.md`.
- Offline-Fassung für Kolleginnen und Kollegen (eine HTML-Datei, Doppelklick): `dist/imm-raumplaner.html`.
- Live (privat): https://claude.ai/artifact/1ot2JpSnj6C5Nz8rCWyHj8 – „IMM Raumplaner“, läuft im Browser (auch iPad), ohne Installation.
- Quelle: `app/src/index.src.html` + `app/geom.js`, gebaut mit `node skripte/build.mjs` zu `app/index.html` (SVG-2D, three.js 0.160, jsPDF).
- Veröffentlicht mit den Daten als Begleitdateien: `daten/raum.json` ← `raum/raeume.json`, `daten/katalog.json` ← `inventar/katalog.json`,
  `daten/beispiel.json` ← `varianten/v00-beispiel.json`.
- Varianten liegen in der Artifact-Datenbank, Sammlung `varianten` (ein Dokument je Variante). Claude liest und schreibt sie mit `ArtifactData`.
  Export und Import als JSON über das Menü „Export“.

## Datenmodell (Meter, x rechts, y unten, Ursprung oben links)
- `raum/raeume.json` – feste Geometrie: Wände (Achse a→b, Dicke mittig), Öffnungen (Tür/Fenster an einer Wand, `pos` ab Wandanfang),
  Stützen, Zonen. Jeder Wert mit `herkunft`: gemessen | plan | geschaetzt. Alte Fassungen nach `raum/fassungen/`.
- `inventar/katalog.json` – Stücke mit `b` × `t` × `h` (lokale Vorderseite +y), Farbe, Material, Anzahl, Bild (`bilder/…`), Herkunft der Masse.
- Variante – `platzierungen: [{uid, stueck, x, y, rot}]` (Mittelpunkt, Drehung in Grad im Uhrzeigersinn).

## Ordner
- `plaene/` Grundrisse und Originalzeichnung · `inventar/fotos-original/` Inventarfotos · `inventar/bilder/` Vorschauausschnitte
- `varianten/` exportierte Varianten (versioniert) · `skripte/` Hilfsskripte
