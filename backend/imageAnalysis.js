const Anthropic = require('@anthropic-ai/sdk');

const bildErkennungsRegeln = {
  DACH: {
    erkennungsZiele: [
      "Dachform (Satteldach, Walmdach, Pultdach, Flachdach, Mansarddach, Tonnendach)",
      "Dachneigung in Grad (flach <10°, gering 10-22°, normal 22-45°, steil >45°)",
      "Eindeckungsmaterial (Ziegel, Betondachsteine, Schiefer, Metall, Bitumen, Reet)",
      "Farbe und Oberflächenbeschaffenheit der Eindeckung",
      "Anzahl und Position von Dachflächenfenstern",
      "Anzahl, Typ und Größe von Gauben (Schleppgaube, Satteldachgaube, Walmgaube)",
      "Schornsteine (Anzahl, Material, Zustand)",
      "Dachrinnen und Fallrohre (Material: Kupfer, Zink, Kunststoff)",
      "First, Grat, Kehlen (Ausführung, Zustand)",
      "Schneefanggitter vorhanden ja/nein",
      "Solaranlagen oder Satellitenschüsseln",
      "Sichtbare Schäden (fehlende Ziegel, Moosbefall, Durchbiegungen)",
      "Geschätzte Dachfläche basierend auf Gebäudeproportionen",
      "Dachüberstände und Traufausbildung",
      "Dachdurchdringungen (Lüftungsrohre, Antennen)",
      "Dachfenster (Typ, Anzahl, Größe)",
      "Ortgang-Ausführung",
      "Attika-Höhe bei Flachdach"
    ]
  },
  
  FASS: {
    erkennungsZiele: [
      "Fassadenmaterial (Putz, Klinker, Holz, Naturstein, Metall, WDVS)",
      "Putzstruktur (Glattputz, Rauputz, Kratzputz, Rillenputz, Scheibenputz)",
      "Farbe und Farbzustand der Fassade (RAL-Farben wenn möglich)",
      "Anzahl der Geschosse und geschätzte Geschosshöhe",
      "Geschätzte Fassadenfläche pro Himmelsrichtung",
      "Sockelbereich (Material, Höhe in cm, Zustand)",
      "Fenster und Türen (Anzahl, Anordnung, geschätzte Größen)",
      "Balkone, Loggien, Erker (Anzahl, Größe in m²)",
      "Gesimse, Stuck, Verzierungen (Art und Umfang)",
      "Sichtbare Schäden (Risse >0,5mm, Abplatzungen, Verfärbungen, Feuchtigkeit)",
      "Graffiti oder Verschmutzungen (Fläche in m²)",
      "Außenjalousien oder Markisen",
      "Eingangsbereiche und Vordächer",
      "Kellerlichtschächte (Anzahl und Zustand)",
      "Wärmebrücken erkennbar (z.B. an Balkonen)",
      "Bestehende Dämmung erkennbar",
      "Fassadengliederung (horizontal/vertikal)"
    ]
  },
  
  FEN: {
    erkennungsZiele: [
      "Gesamtanzahl der Fenster nach Geschossen",
      "Gruppierung nach Größen (klein <1m², mittel 1-2m², groß >2m²)",
      "Fensterformen (rechteckig, Rundbogen, dreieckig, rund, Stichbogen)",
      "Rahmenmaterial (Holz, Kunststoff, Aluminium, Holz-Alu)",
      "Farbe der Rahmen (weiß, braun, anthrazit, andere)",
      "Verglasung (Einfach-, Zweifach-, Dreifachverglasung erkennbar an Reflexion)",
      "Sprossen (echt, aufgeklebt, im Scheibenzwischenraum)",
      "Öffnungsarten soweit erkennbar (Dreh, Kipp, Dreh-Kipp)",
      "Fensterbänke außen (Material: Alu, Naturstein, Kunststoff)",
      "Rollläden oder Jalousien (Material und Zustand)",
      "Zustand der Dichtungen und Beschläge",
      "Besondere Fenster (Panorama, bodentief, Oberlichter)",
      "Haustüren (Material, Verglasung, Seitenteil)",
      "Nebeneingangstüren",
      "Geschätzte Einzelmaße der Fenster",
      "Fensterlaibungen (Tiefe, Zustand)",
      "Fensterbank innen (Material, Breite)"
    ]
  },
  
  GER: {
    erkennungsZiele: [
      "Gebäudehöhe in Metern (geschätzt)",
      "Anzahl der Geschosse",
      "Fassadentyp für Gerüstplanung (glatt, strukturiert, mit Vorsprüngen)",
      "Hindernisse (Bäume, Carports, Zäune, Vordächer)",
      "Bodenbeschaffenheit (Pflaster, Rasen, Kies, Beton)",
      "Platzverhältnisse um das Gebäude (Abstände in Metern)",
      "Nachbarbebauung und Grenzabstände",
      "Straßennähe (Gehwegüberbrückung nötig?)",
      "Dachüberstand in cm",
      "Besondere Gebäudeformen (Erker, Türme, Gauben)",
      "Zugänglichkeit für LKW (Einfahrtbreite)",
      "Gefälle oder Hanglage",
      "Stromleitungen in der Nähe"
    ]
  },
  
  ZIMM: {
    erkennungsZiele: [
      "Sichtbare Holzkonstruktionen außen",
      "Dachstuhltyp (Sparrendach, Pfettendach, Kehlbalkendach)",
      "Sichtbare Balken, Sparren, Pfetten",
      "Holzverschalungen oder Verkleidungen",
      "Carports oder Holzüberdachungen (Größe)",
      "Holzbalkone oder Pergolen",
      "Zustand des sichtbaren Holzes (Verfärbung, Risse)",
      "Holzschutz erkennbar (Farbe, Lasur, unbehandelt)",
      "Schädlingsbefall-Anzeichen (Löcher, Fraßspuren)",
      "Verzogene oder durchhängende Bauteile",
      "Holzart wenn erkennbar (Fichte, Lärche, Eiche)",
      "Verbindungen (traditionell, modern)",
      "Gauben-Holzkonstruktionen",
      "Sichtbare Holzbalkendecken innen",
      "Holzständerwände (Fachwerk)",
      "Holztreppen (Konstruktion, Zustand)"
    ]
  },
  
  ROH: {
    erkennungsZiele: [
      "Mauerwerksart (Ziegel, Kalksandstein, Beton, Porenbeton)",
      "Steinformat und Verband",
      "Sichtbare Risse (Breite, Verlauf, Stufenrisse)",
      "Fundamentsichtbarkeit und -zustand",
      "Kellerfenster und Lichtschächte",
      "Außentreppen (Material, Stufen, Zustand)",
      "Stützmauern oder Böschungen",
      "Gebäudesockel (Höhe, Material, Abdichtung)",
      "Durchbrüche oder zugemauerte Öffnungen",
      "Anbauten und deren Anbindung",
      "Setzungsschäden (schiefe Fenster/Türen)",
      "Ausblühungen oder Salzbelastung",
      "Betonschäden (Abplatzungen, Rostfahnen)",
      "Tragende Wände innen (Stärke, Material)",
      "Decken (Typ, Spannweite, Höhe)",
      "Stützen und Unterzüge"
    ]
  },
  
  MAL: {
    erkennungsZiele: [
      // AUSSEN
      "Aktuelle Fassadenfarben (Hauptfarbe, Akzentfarben)",
      "Anzahl der unterschiedlichen Farbtöne außen",
      "Abblätternde Farbe außen (geschätzte m²)",
      "Algenbewuchs oder Verschmutzung",
      "Besondere Gestaltungselemente (Bordüren, Muster)",
      "Graffiti-Fläche",
      "Sockelfarbgebung",
      "Fensterlaibungen Farbzustand außen",
      "Dachuntersichten (Material und Zustand)",
      "Holzbauteile außen die zu streichen sind",
      "Metallbauteile außen (Geländer, Gitter)",
      
      // INNEN - NEU
      "Wandfarben innen (Räume, Flure, Treppenhaus)",
      "Deckenfarben und -zustand",
      "Tapeten (Art, Zustand, Muster)",
      "Putzqualität Wände (Q1-Q4 erkennbar)",
      "Putzqualität Decken",
      "Risse in Wänden/Decken (Anzahl, Länge, Breite)",
      "Feuchteschäden (Verfärbungen, Abplatzungen)",
      "Schimmelbefall (Stellen, Größe in m²)",
      "Nikotinverfärbungen",
      "Abgeplatzter Putz (Fläche in m²)",
      "Stuckarbeiten (vorhanden, Zustand)",
      "Zierleisten, Stuck, Rosetten",
      "Wandverkleidungen (Holz, Paneele)",
      "Türzargen Farbzustand",
      "Fensterlaibungen innen (Farbe, Zustand)",
      "Heizkörpernischen",
      "Anschlüsse Boden-Wand (Zustand)",
      "Deckenhöhe (geschätzt)",
      "Raumgröße (geschätzte m²)",
      "Anzahl Räume sichtbar",
      "Besondere Bereiche (Treppenhaus, Galerie)"
    ]
  },
  
  SAN: {
    erkennungsZiele: [
      // AUSSEN
      "Sichtbare Sanitärinstallationen außen",
      "Regenfallrohre (Material, Durchmesser, Anzahl)",
      "Außenwasserhähne (Anzahl, Zustand)",
      "Kanalanschlüsse/Revisionsschächte",
      "Klimageräte Außeneinheiten",
      "Lüftungsauslässe",
      "Sichtbare Rohrleitungen außen",
      "Wasserzähler-Position",
      
      // INNEN - NEU
      "Vorhandene Sanitärobjekte (WC, Waschbecken, Dusche, Badewanne, Bidet)",
      "Anzahl Bäder/WCs",
      "WC-Typ (Wand-WC, Stand-WC, Tiefspüler, Flachspüler)",
      "Waschbecken (Größe, Typ, Anzahl)",
      "Duschen (Typ: Duschwanne, bodengleich, Größe)",
      "Badewannen (freistehend, eingebaut, Größe)",
      "Armaturen (Typ, Zustand, Ein-/Zweihebel)",
      "Duschtrennwände (Glas, Kunststoff)",
      "Badmöbel (Waschtischunterschrank, Spiegelschrank)",
      "Handtuchheizkörper (Anzahl, Art)",
      "Fliesen Bad (bis welche Höhe, Zustand)",
      "Sanitärinstallation Unterputz/Aufputz",
      "Spülkasten (Unterputz, Aufputz)",
      "Vorwandinstallation erkennbar",
      "Bodenablauf vorhanden",
      "Lüftung Bad (Fenster, mechanisch)",
      "Zustand Silikonfugen",
      "Wasserschäden sichtbar",
      "Spiegel (Größe, Beleuchtung)",
      "Küche: Spüle (Einbau, Unterbau, Material)",
      "Küche: Armatur (Typ)",
      "Küche: Geschirrspüler-Anschluss erkennbar"
    ]
  },
  
  HEI: {
    erkennungsZiele: [
      // AUSSEN
      "Schornsteine (Anzahl, Material, Höhe)",
      "Außeneinheiten von Wärmepumpen",
      "Öltank-Einfüllstutzen",
      "Gasanschluss/Gaszähler Position",
      "Solarthermie-Kollektoren (Anzahl, Größe)",
      "Heizungsrohre außen",
      "Abgasrohre",
      
      // INNEN - NEU
      "Heizungsart erkennbar (Gas, Öl, Wärmepumpe, Fernwärme)",
      "Heizkessel (Typ, Alter, Hersteller wenn erkennbar)",
      "Heizkörper (Typ, Anzahl pro Raum)",
      "Heizkörper-Größe (geschätzt in cm)",
      "Heizkörper-Material (Stahl, Aluminium, Guss)",
      "Thermostatventile (Art, Zustand)",
      "Fußbodenheizung erkennbar (Verteiler sichtbar)",
      "FBH-Verteiler (Anzahl Kreise)",
      "Heizungsrohre sichtbar (Material, Dämmung)",
      "Ausdehnungsgefäß",
      "Umwälzpumpe",
      "Warmwasserspeicher (Größe in Liter)",
      "Heizungskeller/-raum (Größe, Zugang)",
      "Schornstein innen (Zustand)",
      "Abgasführung (Edelstahlrohr, gemauert)",
      "Brennstofflager (Öltank, Pelletlager)",
      "Vorlauftemperatur erkennbar",
      "Smart-Home Heizungssteuerung",
      "Raumthermostate (Anzahl, Typ)",
      "Handtuchheizkörper Bad (elektrisch/Warmwasser)"
    ]
  },
  
  ELEKT: {
    erkennungsZiele: [
      // AUSSEN
      "Hausanschlusskasten Position",
      "Zählerschrank außen",
      "Außenbeleuchtung (Anzahl, Typ)",
      "Bewegungsmelder",
      "Klingel-/Sprechanlage",
      "E-Auto Ladestation/Wallbox",
      "Photovoltaik-Module (Anzahl, geschätzte kWp)",
      "Wechselrichter Position",
      "Satellitenanlage",
      "Blitzschutzanlage",
      "Außensteckdosen",
      "Kabelführungen außen",
      
      // INNEN - NEU
      "Zählerschrank innen (Position, Größe)",
      "Sicherungskasten (Anzahl Reihen, Typ)",
      "Steckdosen pro Raum (Anzahl, Position)",
      "Steckdosen-Typ (Schuko, USB, etc.)",
      "Lichtschalter (Anzahl, Typ, Position)",
      "Wechselschalter erkennbar",
      "Kreuzschalter erkennbar",
      "Dimmer vorhanden",
      "Steckdosen Küche (Anzahl Herd, normale)",
      "Starkstromanschluss (Herd, Backofen)",
      "Deckenauslässe Beleuchtung",
      "Wandleuchten-Anschlüsse",
      "Spots/Einbaustrahler (Anzahl)",
      "Unterputz/Aufputz Installation",
      "Leerrohre sichtbar",
      "Kabelkanäle",
      "Netzwerkdosen (Anzahl, Position)",
      "TV-/SAT-Dosen",
      "Telefonanschlüsse",
      "Smart-Home Installation (Bus-System erkennbar)",
      "Alarmanlage (Bewegungsmelder, Zentrale)",
      "Rauchmelder (Anzahl)",
      "Türsprechanlage innen",
      "Klingeltaster",
      "Bad: FI-Schutzschalter erkennbar",
      "Bad: Potentialausgleich",
      "Verlegeart Leitungen (Schlitze, Rohre)"
    ]
  },
  
  FLI: {
    erkennungsZiele: [
      // AUSSEN
      "Balkon-/Terrassenbelag (Material)",
      "Außentreppen Belag",
      "Sockelfliesen",
      "Pool-/Schwimmbadbereich",
      
      // INNEN - NEU
      "Geflieste Bereiche (Bad, Küche, Flur, WC)",
      "Fliesenformat (z.B. 30x60cm, 60x60cm, Mosaikfliesen)",
      "Fliesenart (Feinsteinzeug, Steingut, Naturstein)",
      "Fliesenmuster (einfarbig, gemustert, Holzoptik, Betonoptik)",
      "Fliesenfarbe",
      "Verlegemuster (gerade, diagonal, Fischgrät, Wilder Verband)",
      "Wandfliesen Höhe (z.B. halbhoch 120cm, raumhoch)",
      "Sockel-/Randfliesen (vorhanden, Höhe in cm)",
      "Bodenfliesen (Fläche in m²)",
      "Wandfliesen (Fläche in m²)",
      "Fugenfarbe (weiß, grau, farblich passend)",
      "Fugenbreite (geschätzt in mm)",
      "Fugenzustand (sauber, verfärbt, Schimmel)",
      "Silikonfugen (Anzahl Meter, Zustand)",
      "Fliesenqualität (Standard, gehoben, Premium)",
      "Besondere Fliesen (Bordüren, Dekorstreifen)",
      "Fliesenspiegel Küche (Höhe, Länge)",
      "Nischen gefliest",
      "Abdichtung erkennbar (Duschecken, Wannenrand)",
      "Bodengleiche Dusche (Größe, Ablauf-Position)",
      "Duschrinne vorhanden",
      "Gefälle erkennbar",
      "Fehlende/beschädigte Fliesen (Anzahl)",
      "Risse in Fliesen",
      "Hohlstellen (klingt hohl beim Klopfen)",
      "Treppenbelag gefliest",
      "Podest gefliest"
    ]
  },
  
  TIS: {
    erkennungsZiele: [
      // AUSSEN
      "Haustür (Material, Breite, Höhe)",
      "Nebeneingangstüren",
      "Garagentore (Anzahl, Typ, Größe)",
      "Kellertüren außen",
      
      // INNEN - NEU
      "Innentüren (Anzahl pro Raum/Bereich)",
      "Türblatt-Material (Weißlack, Echtholz, CPL, furniert)",
      "Türmaße (Standard 86cm, 96cm oder Sondermaße)",
      "Türhöhe (198,5cm, 211cm oder Sonderhöhe)",
      "Zargentyp (Blockzarge, Eckzarge, Umfassungszarge)",
      "Zargenmaterial (Holz, MDF, Stahl)",
      "Zargenfarbe",
      "Türanschlag (DIN links/rechts erkennbar)",
      "Türdrücker/Türklinken (Typ, Material)",
      "Schlösser (Buntbart, Profilzylinder)",
      "Türbänder (Anzahl, Typ)",
      "Glaseinsätze in Türen (Lichtausschnitt, Größe)",
      "Schiebetüren (Anzahl, System)",
      "Falttüren",
      "Pendeltüren",
      "Türzustand (Schäden, Kratzer, Dellen)",
      "Wohnungseingangstür (Sicherheitsklasse erkennbar)",
      "Schallschutztüren erkennbar",
      "Brandschutztüren (T30/T90 Kennzeichnung)",
      "Türschwellen (vorhanden, barrierefrei)",
      "Türdichtungen (Zustand)",
      "Einbauschränke (Anzahl, Größe)",
      "Schiebetürenschränke",
      "Regale fest eingebaut",
      "Küchenzeile (Länge in Metern)",
      "Oberschränke Küche (Länge)",
      "Arbeitsfläche Küche (Material, Länge)",
      "Holztreppen innen (Stufen, Material)",
      "Treppengeländer Holz",
      "Handlauf Material",
      "Wandverkleidungen Holz",
      "Deckenverkleidungen Holz",
      "Fenster- und Türlaibungen verkleidet"
    ]
  },
  
  TRO: {
    erkennungsZiele: [
      // INNEN
      "Trockenbauwände vorhanden (Anzahl, Position)",
      "Wandstärke geschätzt (z.B. 10cm, 12,5cm)",
      "Wandhöhe bis Decke",
      "Wandlänge (geschätzt in Metern)",
      "Ständerwerk erkennbar (Metall, Holz)",
      "Beplankung (Gipskarton, Gipsfaser, OSB)",
      "Beplankung einfach/doppelt beidseitig",
      "Dämmung in Wand erkennbar",
      "Türöffnungen in Trockenbauwand (Anzahl)",
      "Abgehängte Decken (Fläche in m²)",
      "Deckenabhängung (Höhe in cm)",
      "Deckenkonstruktion (Direktabhänger, CD-Profile)",
      "Revisionsklappen (Anzahl, Größe)",
      "Installationsebene erkennbar",
      "Vorwandinstallationen Bad (Anzahl, Typ)",
      "Vorwand-Tiefe (geschätzt in cm)",
      "Nischen/Ablagen in Vorwand",
      "Lichtvouten",
      "Schächte verkleidet (Größe)",
      "Dachschrägen verkleidet (m²)",
      "Kehlbalken-Verkleidungen",
      "Kniestöcke verkleidet",
      "Schalldämmung erkennbar (doppelte Beplankung)",
      "Brandschutz erkennbar (F-Platten)",
      "Feuchtraumplatten (grüne Platten im Bad)",
      "Spachtelung (Q1-Q4 erkennbar)",
      "Ecken/Kanten verspachtelt",
      "Stöße verspachtelt",
      "Risse in Verspachtelung",
      "Metallprofile sichtbar (bei Renovierung)",
      "Anschlüsse an Massivwände",
      "Bodenprofil vorhanden",
      "Deckenprofil vorhanden"
    ]
  },
  
  ESTR: {
    erkennungsZiele: [
      // INNEN
      "Estrichart erkennbar (Zement, Anhydrit, Trockenestrich)",
      "Estrichzustand (Risse, Unebenheiten)",
      "Estrichstärke geschätzt (z.B. 5cm, 6cm)",
      "Dämmung unter Estrich erkennbar",
      "Trittschalldämmung (Art, Stärke)",
      "Randdämmstreifen sichtbar",
      "Fußbodenheizung verlegt erkennbar",
      "FBH-Rohre sichtbar",
      "FBH-Verteiler sichtbar",
      "Estrichfläche pro Raum (geschätzte m²)",
      "Höhenniveau Estrich (zu Oberkante Rohdecke)",
      "Gefälle-Estrich (z.B. in Dusche)",
      "Estrich geschliffen (Sichtestrich)",
      "Heizestrich auf FBH",
      "Trockenestrich-Elemente (Fermacell, etc.)",
      "Verlegung schwimmend/verbunden",
      "Dehnfugen vorhanden (Position, Breite)",
      "Bewegungsfugen",
      "Bodenablauf eingearbeitet",
      "Einbauteile im Estrich (Leerrohre, Dosen)",
      "Estrich fertig zum Belegen",
      "Oberflächenqualität",
      "Restfeuchte erkennbar (Verfärbungen)",
      "Hohlstellen (klingt hohl)"
    ]
  },
  
  BOD: {
    erkennungsZiele: [
      // INNEN
      "Bodenbelag-Art (Parkett, Laminat, Vinyl, Teppich, PVC, Linoleum)",
      "Parkett-Art (Massivparkett, Fertigparkett, Dielen)",
      "Holzart Parkett (Eiche, Buche, Nussbaum, etc.)",
      "Parkettmuster (Schiffsboden, Fischgrät, englischer Verband)",
      "Dielenbreite (schmal <10cm, mittel 10-15cm, breit >15cm)",
      "Oberflächenbehandlung (geölt, lackiert, gewachst)",
      "Farbe des Bodens (hell, mittel, dunkel)",
      "Laminat-Dekor (Holzoptik, Fliesenoptik, etc.)",
      "Laminat-Qualität (Nutzungsklasse NK21-NK33 erkennbar)",
      "Vinylboden-Typ (Klick, Klebevinyl, loses Vinyl)",
      "Vinyl-Stärke geschätzt",
      "Teppichboden-Art (Auslegeware, Teppichfliesen)",
      "Teppich-Flor (Kurzflor, Hochflor)",
      "PVC-Belag (Bahnenware, Fliesen)",
      "Linoleum-Farbe und Muster",
      "Verlegeart (schwimmend, verklebt, vernagelt)",
      "Unterlagsmaterial erkennbar",
      "Trittschalldämmung unter Belag",
      "Dampfsperre vorhanden",
      "Sockelleisten (Material, Höhe, Farbe)",
      "Übergangsprofile (zwischen Räumen, Materialien)",
      "Abschlussprofile (zu Fliesen, Türen)",
      "Dehnfugen im Belag",
      "Bodenzustand (Kratzer, Dellen, Flecken)",
      "Abnutzung (Laufstraßen erkennbar)",
      "Wasserschäden (Aufquellungen)",
      "Verlegefehler erkennbar (Wellen, Fugen)",
      "Fußleisten lose/beschädigt",
      "Fläche pro Raum (geschätzte m²)",
      "Treppen-Bodenbelag",
      "Treppenkantenprofile"
    ]
  },
  
  ABBR: {
    erkennungsZiele: [
      // AUSSEN
      "Abzubrechende Bauteile außen (Schuppen, Garagen, Anbauten)",
      "Größe der Abbruchobjekte",
      "Material der Abbruchobjekte",
      "Zugänglichkeit für Abbruch",
      "Entsorgungsmöglichkeiten",
      
      // INNEN - NEU
      "Abzubrechende Wände (Anzahl, Material)",
      "Wandstärke (geschätzt in cm)",
      "Wandhöhe bis Decke",
      "Wandlänge (geschätzt in Metern)",
      "Wandmaterial (Mauerwerk, Gipskarton, Holz)",
      "Tragende Wand erkennbar (dicker, massiver)",
      "Durchbrüche (Anzahl, geschätzte Größe)",
      "Türöffnungen die vergrößert werden",
      "Fensteröffnungen die verändert werden",
      "Abzubrechende Decken (m²)",
      "Deckentyp (Massiv, Holzbalken, Gipskarton)",
      "Estrich zu entfernen (m²)",
      "Bodenbeläge zu entfernen (Art, m²)",
      "Fliesen zu entfernen (m², Höhe Wand)",
      "Sanitärobjekte zu demontieren (Anzahl)",
      "Heizkörper zu demontieren (Anzahl)",
      "Einbauschränke zu entfernen (Anzahl)",
      "Küche zu demontieren (Länge in Metern)",
      "Innentüren zu entfernen (Anzahl)",
      "Zargen zu entfernen (Anzahl)",
      "Leitungen zu entfernen (erkennbar)",
      "Elektroleitungen/Dosen abbauen",
      "Sanitärleitungen abbauen",
      "Putz abschlagen (Fläche in m²)",
      "Tapete entfernen (Fläche in m²)",
      "Deckenpaneele entfernen",
      "Wandverkleidungen entfernen",
      "Schuttmenge geschätzt (m³)",
      "Entsorgungsweg (Fenster, Tür, Treppe)",
      "Container-Stellplatz verfügbar",
      "Schuttrutsche möglich",
      "Asbest-Verdacht (alte Bodenbeläge, Platten)"
    ]
  },
  
  SCHL: {
    erkennungsZiele: [
      // AUSSEN
      "Geländer außen (Material, Länge, Höhe)",
      "Handläufe außen",
      "Brüstungen",
      "Französische Balkone",
      "Treppengeländer außen",
      "Einfriedungen/Zäune",
      
      // INNEN - NEU
      "Treppengeländer innen (Material, Länge)",
      "Handlauf Material (Edelstahl, Holz, Kunststoff)",
      "Geländerhöhe (Standard 90-100cm)",
      "Geländer-Füllung (Stäbe, Glas, Holz, Draht)",
      "Stababstand (z.B. 12cm)",
      "Pfosten (Anzahl, Material, Abstand)",
      "Handlaufbefestigung (direkt Wand, auf Geländer)",
      "Wandhandläufe (Länge in Metern)",
      "Geländer-Zustand (Rost, Lackschäden)",
      "Geländer bodenmontiert oder wandmontiert",
      "Balkongeländer innen (bei Maisonette, Galerie)",
      "Absturzsicherungen (Höhe, Länge)",
      "Galeriegeländer",
      "Brüstungsgeländer",
      "Kindersicherungen (engere Stäbe)",
      "Edelstahl-Ausführung (gebürstet, poliert)",
      "Holzgeländer (Holzart, Behandlung)",
      "Glasgeländer (Glasstärke, Beschläge)",
      "Seilgeländer (Anzahl Seile, Spannung)",
      "Designgeländer (Modern, Klassisch)",
      "Treppen (Anzahl Stufen, Steigungshöhe)",
      "Treppenbreite (geschätzt in cm)",
      "Podeste vorhanden (Größe)",
      "Treppenauge vorhanden"
    ]
  },
  
  PV: {
    erkennungsZiele: [
      // AUSSEN
      "Dachfläche verfügbar (m², Ausrichtung)",
      "Dachneigung (Grad)",
      "Verschattung (Bäume, Gebäude, Schornstein)",
      "Dacheindeckung (Material, Zustand)",
      "Dachkonstruktion erkennbar (Sparrenabstand)",
      "Vorhandene Dachdurchdringungen",
      "Platz für Wechselrichter",
      "Zählerschrank-Position",
      "Kabelweg Dach-Zähler (geschätzte Länge)",
      "Potentieller Speicherplatz (Keller, Garage)",
      "Wallbox-Position möglich",
      "Stromanschluss Stärke erkennbar",
      
      // INNEN
      "Hausanschluss/Sicherungskasten",
      "Platz für Wechselrichter innen (Wand, Raum)",
      "Speicherplatz (für Batterie, falls gewünscht)",
      "Kabelführung möglich (vertikal durchs Haus)",
      "Zählerplatz (für Einspeise-/Bezugszähler)",
      "Smart-Meter vorhanden",
      "Unterverteilung vorhanden",
      "Potentialausgleich erkennbar"
     ]
  },

KLIMA: {
    erkennungsZiele: [
      // AUSSEN
      "Klimagerät-Außeneinheiten (Anzahl, Position)",
      "Split-Klimaanlagen erkennbar",
      "Lüftungsauslässe an Fassade",
      "Luftwärmepumpen-Außeneinheiten",
      "Kältemittelleitungen sichtbar außen",
      "Kondensatablauf außen",
      
      // INNEN
      "Klimagerät-Inneneinheiten (Anzahl, Typ)",
      "Wandgeräte (Position, Größe)",
      "Deckengeräte (Kassetten, Unterbau)",
      "Truhengeräte erkennbar",
      "Kanalgeräte mit Luftauslässen",
      "Lüftungsgitter (Anzahl, Größe)",
      "Luftauslässe Decke/Wand",
      "Lufteinlässe",
      "Zentrale Lüftungsanlage erkennbar",
      "Lüftungskanäle sichtbar",
      "Wärmerückgewinnung erkennbar",
      "Luftfilter sichtbar",
      "Steuereinheiten/Bedienelemente",
      "Fernbedienungen für Klimageräte",
      "Kondensatpumpe sichtbar",
      "Schalldämpfer in Lüftung",
      "Brandschutzklappen erkennbar",
      "Volumenstromregler",
      "Luftqualitätssensoren",
      "Kältemittelleitungen innen (isoliert/unisoliert)"
    ]
  },
  
  AUSS: {
    erkennungsZiele: [
      // AUSSENANLAGEN ALLGEMEIN
      "Grundstücksgröße geschätzt (m²)",
      "Topografie (eben, Hanglage, Gefälle)",
      "Geländemodellierung vorhanden",
      
      // WEGE UND ZUFAHRTEN
      "Zufahrt (Material, Breite, Länge)",
      "Pflasterflächen (m², Material, Verlegemuster)",
      "Gehwege (Material, Breite)",
      "Garagenzufahrt",
      "Stellplätze (Anzahl, Größe, Belag)",
      "Terrassenflächen (m², Material, Höhe)",
      
      // GRÜNFLÄCHEN
      "Rasenflächen (geschätzte m²)",
      "Beete und Rabatten",
      "Bepflanzung (Sträucher, Hecken)",
      "Bäume (Anzahl, Art, Größe)",
      "Ziergarten oder Nutzgarten erkennbar",
      
      // EINFRIEDUNGEN
      "Zäune (Material, Höhe, Länge)",
      "Hecken als Grundstücksgrenze (Höhe)",
      "Mauern (Material, Höhe, Länge)",
      "Tore und Türen (Anzahl, Material)",
      "Briefkastenanlage",
      
      // ENTWÄSSERUNG
      "Regenwasserableitung erkennbar",
      "Drainage sichtbar",
      "Versickerungsflächen",
      "Rigolen vorhanden",
      "Oberflächenwasser-Abfluss",
      "Gullys und Sinkkästen (Anzahl)",
      
      // BELEUCHTUNG AUSSEN
      "Außenbeleuchtung (Anzahl Leuchten)",
      "Wegebeleuchtung",
      "Fassadenbeleuchtung",
      "Spots im Garten",
      "Pollerleuchten",
      
      // AUSSTATTUNG
      "Gartenhäuser/Geräteschuppen (Größe)",
      "Carports (Anzahl, Größe)",
      "Pergolen oder Lauben",
      "Mülltonnenbox",
      "Fahrradunterstand",
      "Spielgeräte",
      "Pool oder Teich (Größe)",
      "Grillplatz",
      "Gartenmöbel-Stellplätze",
      
      // TECHNISCHE ANLAGEN AUSSEN
      "Regenwassertank oberirdisch",
      "Zisterne (Zugang sichtbar)",
      "Außenwasserhähne (Anzahl)",
      "Bewässerungssystem erkennbar",
      "Kabelschächte/Verteilerkästen",
      
      // SONSTIGES
      "Böschungen (Höhe, Länge, Befestigung)",
      "Stützmauern (Material, Höhe)",
      "Treppen außen (Stufen, Material)",
      "Rampen (Neigung, Material)",
      "Höhenunterschiede im Gelände",
      "Barrierefreiheit erkennbar"
    ]
  },
  
INTAKE: {
    erkennungsZiele: [
      // ZUGÄNGLICHKEIT & LOGISTIK
      "Zufahrt für LKW (Breite, Hindernisse, Tor)",
      "Straßenbreite und Parkmöglichkeiten",
      "Einfahrt/Hofeinfahrt (Breite, Untergrund)",
      "Wendmöglichkeit für Fahrzeuge",
      "Platzverhältnisse für Container",
      "Lagerplätze für Material (Fläche, Untergrund)",
      "Abstand zur Straße (für Gerüst/Kran)",
      "Gehweg vorhanden (Breite, Überbrückung nötig)",
      
      // GEBÄUDE ALLGEMEIN
      "Gebäudetyp (EFH, MFH, RH, DHH)",
      "Anzahl Geschosse/Etagen",
      "Geschätzte Gebäudehöhe",
      "Geschätzte Grundfläche",
      "Baustil/Baujahr erkennbar",
      "Dachform (für Gerüstplanung)",
      "Nachbarbebauung (Abstände)",
      
      // HINDERNISSE & SCHUTZ
      "Bäume nahe am Gebäude",
      "Büsche/Hecken die stören könnten",
      "Gartenhäuser/Schuppen",
      "Carports/Überdachungen",
      "Zäune/Tore",
      "Stromleitungen/Freileitungen",
      "Telefonleitungen",
      
      // UNTERGRUND
      "Bodenbeschaffenheit (Pflaster, Rasen, Kies, Erde)",
      "Gefälle/Hanglage",
      "Befestigte Flächen für Gerüst",
      "Rasenflächen die geschützt werden müssen",
      
      // ANSCHLÜSSE
      "Hausanschlusskasten sichtbar (Strom)",
      "Wasseranschluss außen erkennbar",
      "Außenwasserhahn vorhanden",
      "Schacht/Kanaldeckel (für Entsorgung)",
      
      // SICHERHEIT
      "Öffentlicher Bereich (Gehweg/Straße)",
      "Spielplatz in der Nähe",
      "Schulweg",
      "Nachbargrundstücke betroffen",
      
      // BESONDERHEITEN
      "Denkmalschutz erkennbar (Fachwerk, Stuck)",
      "Gewerbliche Nutzung erkennbar",
      "Besondere Architektur",
      "Sichtbare Schäden am Gebäude",
      "Bewohnt/unbewohnt erkennbar",
      
      // TRANSPORT
      "Treppenhaus von außen erkennbar",
      "Aufzug erkennbar (bei MFH)",
      "Balkone (für Materialtransport)",
      "Fenster groß genug für Transport",
      "Dachboden-Zugang erkennbar"
    ]
  },
  
  INT: {
    erkennungsZiele: [
      // Verweis auf INTAKE
      "Siehe INTAKE-Regeln"
    ]
  }
};

async function analyzeImageWithClaude(base64Image, questionContext, tradeCode, questionId) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  // INTAKE und INT gleich behandeln
  const actualTradeCode = (tradeCode === 'INT' || tradeCode === 'INTAKE') ? 'INTAKE' : tradeCode;
  const rules = bildErkennungsRegeln[actualTradeCode] || { erkennungsZiele: [] };
  
  // Spezieller Prompt für INTAKE oder normale Gewerke
  let systemPrompt;
  
  if (actualTradeCode === 'INTAKE') {
    systemPrompt = `Du bist ein Experte für Baustellenplanung und Logistik.
Analysiere das Bild im Hinblick auf BAUSTELLENBEDINGUNGEN und LOGISTIK.

FOKUS BEI INTAKE/BAUSTELLENANALYSE:
${rules.erkennungsZiele.map((ziel, i) => `${i+1}. ${ziel}`).join('\n')}

WICHTIG bei Intake-Bildern:
- Fokus auf ZUGÄNGLICHKEIT und PLATZVERHÄLTNISSE
- Erkenne HINDERNISSE für Gerüst, Kran, Container
- Beurteile LAGERUNGSMÖGLICHKEITEN für Material
- Schätze ABSTÄNDE und BREITEN für Fahrzeuge
- Identifiziere SCHUTZNOTWENDIGKEITEN (Rasen, Nachbarn)
- Erkenne ANSCHLÜSSE (Strom, Wasser) für Baustelle`;
  } else {
    systemPrompt = `Du bist ein Experte für Bauanalyse und ${actualTradeCode}-Arbeiten.
Analysiere das Bild präzise im Kontext der gestellten Frage.

ERKENNUNGSZIELE für ${actualTradeCode}:
${rules.erkennungsZiele.map((ziel, i) => `${i+1}. ${ziel}`).join('\n')}

WICHTIG:
- Gib konkrete Zahlen und Maße wo möglich
- Schätze Größen basierend auf Standard-Proportionen (Geschosshöhe ~2.8-3m, Fenster ~1.5m hoch, Türen ~2m)
- Unterscheide klar zwischen "sicher erkannt" und "geschätzt"
- Strukturiere deine Antwort als präzise Antwort auf die gestellte Frage
- Wenn nach Anzahl gefragt: Zähle genau
- Wenn nach Maßen gefragt: Schätze basierend auf Referenzgrößen
- Wenn nach Material gefragt: Identifiziere anhand visueller Merkmale`;
  }
  
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: base64Image
          }
        },
        {
          type: "text",
          text: `Frage: ${questionContext}

Analysiere das Bild und gib eine DIREKTE ANTWORT die in das Antwortfeld übernommen werden kann.
Beispiel: Bei Frage "Wie viele Fenster?" antworte "12 Fenster (4 im EG, 4 im 1.OG, 4 im DG)"
Vermeide lange Erklärungen. Sei präzise und konkret.`
        }
      ]
    }],
    system: systemPrompt
  });
  
  return {
    answer: response.content[0].text,
    confidence: 0.85
  };
}

module.exports = { analyzeImageWithClaude, bildErkennungsRegeln };
