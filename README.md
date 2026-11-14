# MSFS Airport Scout — Desktop-Version

Web-Tool zum Filtern und Routenplanen fuer den Microsoft Flight Simulator (MSFS 2020). Der Scout verarbeitet 36.779 Flughafenplaetze weltweit: einen vollstaendigen MakeRwys-Scan der eigenen MSFS-Installation (5.132 Plaetze mit Pisten, ILS, Frequenzen, Hoehenprofil) ergaenzt um OurAirports-Daten, mit Qualitaetsstufen (AI Generated, Asobo, 3rd-Party) und Hoehenraestern aus Terrarium und ETOPO. Die komplette Anwendung liegt als einzige HTML-Datei vor: kein Server, keine Installation, kein Build beim Anwender, laeuft direkt vom Dateisystem.

## Anwendung

MSFS_Airport_Scout.html herunterladen und im Browser oeffnen (Doppelklick, file://). Alle Daten sind in der Datei eingebettet, das Tool arbeitet komplett offline. Nur die optionalen Wetter-Layer (Regen NASA GPM IMERG, Wind Open-Meteo GFS 250 hPa) laden einmalig Daten aus dem Netz. Einstellungen, Packages-Kategorien, eigene Flugzeuge und Routen-Vorgaben bleiben lokal im Browser (localStorage, Export und Import ueber die 💾-Funktion). Alternativ zur Einzeldatei gibt es die identische Live-Version unter https://z33r0-one.github.io/Airport-Scout/ (Repo Airport-Scout).

## Funktionen

- Airport-Filter: Freitextsuche, Region/Auswahl, Laengen- und Breitengrade, Pistenlaenge und -untergrund, ILS, PAPI, Beleuchtung, gesperrte Pisten, Treibstoff, Landeanflug, Wasserplaetze, SimBrief-Radius um einen Zielflughafen.
- Kategorien: AI Generated, Asobo, 3rd-Party; Zuordnung optional korrigierbar ueber den Packages-Import (ohne Import zaehlen Navigraph-ueberdeckte Plaetze als AI Generated).
- Route-Modi: aus, ab Startflughafen, aus Paaren, Weltumrundung; je Modus eigene Optionen (Reroll, Laender meiden, AI-Prio, Start-Piste, Flugzeit-Modell mit KTAS, 0,35 h/140 km Overhead, +10 %/+15 min Reserve, HQ- und Mindestens-1x-Filter).
- SimBrief: Abholen eines aktuellen Briefings und Umkreisfilter um dessen Zielflughafen.
- Karte: Weltkarte mit Hoehenraster, Zoomstufen 23x und 30x, Wetter-Layer Regen und Wind, Auswahl per Klick oder Tap.
- Flughistorie: Protokoll der besuchten Flughafen mit Export als CSV.
- Datenexport: alle Einstellungen und Korrekturen als Datei sichern und auf anderen Geraeten importieren.

## Aufbau dieses Repositories

- MSFS_Airport_Scout.html — fertige Anwendung (wird vom Build-Workflow automatisch committet, nicht manuell aendern).
- src/template.html — Quellcode: HTML, CSS und JavaScript mit den Markern /*__DATA__*/ und /*__GEO__*/.
- src/data/ — Datenbasis (MakeRwys-Scan, OurAirports, Hoehenraester) in 25 Teildateien, aendert sich nicht.
- src/geo/ — Geometrien (Kuestenlinien, Laenderumrisse) in 3 Teildateien, aendert sich nicht.
- build.js — setzt Teildateien und Template zur Einzeldatei zusammen.
- test_headless.js — 290 automatische Pruefungen gegen die gebaute Datei (Filter, Route, Karte, Mobile-Layout).
- .github/workflows/build.yml — baut bei jedem Push, testet und committet die Einzeldatei als github-actions[bot].

## Installation und Pflege

Beim Anwender genuegt das Herunterladen der Einzeldatei. Fuer die Weiterentwicklung: template.html oder test_headless.js aendern, dann pushen. Der Workflow baut die Einzeldatei neu und committet sie nur, wenn alle 290 Pruefungen gruen sind. Vor dem Push empfiehlt sich der lokale Durchlauf: node build.js und node test_headless.js.

## Projektstand und Roadmap

Stand November 2026 (Version asc-2026-11-15b): Filter, Kategorien mit Packages-Import, alle vier Route-Modi, SimBrief, Wetter-Layer, Flughistorie und eine fuer Touchbedienung optimierte Mobile-Ansicht sind fertig. Roadmap: gefuehrter Filter-Fragebogen, der die haeufigsten Filter als einfache Ja/Nein-Abfragen nacheinander abfragt, statt das komplette Filterpanel oeffnen zu muessen.

## Rechte

Alle Inhalte dieses Repositories sind geistiges Eigentum des Autors. Es ist keine Open-Source-Lizenz erteilt; Nutzung, Veroeffentlichung oder Weitergabe ausserhalb dieses Repositories nur mit ausdruecklicher Zustimmung des Autors.