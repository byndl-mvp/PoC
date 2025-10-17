const xlsx = require('xlsx');

/**
 * Intelligenter Excel-Parser für ALLE Gewerke
 * Erkennt automatisch den Inhalt und strukturiert die Daten
 */
function parseSpreadsheetContent(workbook, tradeCode, questionText) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  
  if (!data || data.length === 0) {
    return {
      text: 'Leere Tabelle - keine auswertbaren Daten gefunden',
      structured: { 
        type: 'empty',
        items: [],
        error: 'Keine Daten in Tabelle'
      }
    };
  }
  
  const columns = Object.keys(data[0]);
  const lowerColumns = columns.map(c => c.toLowerCase());
  
  console.log(`[EXCEL-PARSER] Trade: ${tradeCode}, Columns: ${columns.join(', ')}`);
  console.log(`[EXCEL-PARSER] Question context: ${questionText?.substring(0, 100)}`);
  
  let result = detectAndParse(data, lowerColumns, tradeCode, questionText);
  
  // Validierung und Qualitätsprüfung
  result = validateParsedData(result, tradeCode);
  
  return {
    text: result.answer,
    structured: result,
    metadata: {
      rowCount: data.length,
      columnCount: columns.length,
      detectedType: result.type,
      tradeCode: tradeCode,
      quality: calculateDataQuality(result)
    }
  };
}

/**
 * Automatische Erkennung des Tabellentyps und Parsing
 */
function detectAndParse(data, lowerColumns, tradeCode, questionText) {
  // PRIORITÄT 1: Trade-spezifische Erkennung
  const tradeParser = getTradeSpecificParser(tradeCode);
  if (tradeParser) {
    const result = tradeParser(data, lowerColumns, questionText);
    if (result && result.items.length > 0) {
      console.log(`[EXCEL-PARSER] ✓ Trade-specific parser used: ${result.type}`);
      return result;
    }
  }
  
  // PRIORITÄT 2: Kontext-basierte Erkennung
  const contextResult = parseByQuestionContext(data, lowerColumns, questionText);
  if (contextResult && contextResult.items.length > 0) {
    console.log(`[EXCEL-PARSER] ✓ Context-based parser used: ${contextResult.type}`);
    return contextResult;
  }
  
  // PRIORITÄT 3: Spalten-basierte Erkennung
  const columnResult = parseByColumns(data, lowerColumns);
  if (columnResult && columnResult.items.length > 0) {
    console.log(`[EXCEL-PARSER] ✓ Column-based parser used: ${columnResult.type}`);
    return columnResult;
  }
  
  // FALLBACK: Generisches Parsing
  console.log(`[EXCEL-PARSER] ⚠ Using generic parser`);
  return parseGeneric(data, lowerColumns);
}

/**
 * Trade-spezifische Parser
 */
function getTradeSpecificParser(tradeCode) {
  const parsers = {
    'FEN': parseFensterListe,
    'TIS': parseTuerenListe,
    'SAN': parseSanitaerListe,
    'HEI': parseHeizkoerperListe,
    'ELEKT': parseElektroListe,
    'FLI': parseFliesenListe,
    'BOD': parseBodenListe,
    'MAL': parseMalerListe,
    'DACH': parseDachListe,
    'FASS': parseFassadeListe,
    'TRO': parseTrockenbauListe,
    'ESTR': parseEstrichListe,
    'ROH': parseRohbauListe,
    'ZIMM': parseZimmererListe,
    'GER': parseGeruestListe,
    'SCHL': parseSchlosserListe,
    'ABBR': parseAbbruchListe,
    'PV': parsePVListe,
    'KEL': parseKellerListe
  };
  
  return parsers[tradeCode];
}

/**
 * FENSTER-LISTE Parser
 */
function parseFensterListe(data, lowerColumns, questionText) {
  // Prüfe ob Fenster-relevante Spalten vorhanden
  const hasFensterColumns = 
    lowerColumns.some(c => c.includes('fenster') || c.includes('window')) ||
    (lowerColumns.some(c => c.includes('breite') || c.includes('width')) &&
     lowerColumns.some(c => c.includes('höhe') || c.includes('height')));
  
  if (!hasFensterColumns) return null;
  
  const items = data.map((row, idx) => {
    const item = {
      nr: idx + 1,
      bezeichnung: findValue(row, [
        'Bezeichnung', 'Name', 'Raum', 'Position', 'Fenster', 'Typ', 
        'Ort', 'Lage', 'Beschreibung', 'Window', 'Description'
      ]) || `Fenster ${idx + 1}`,
      breite: parseNumber(findValue(row, [
        'Breite', 'B', 'Breite cm', 'Breite (cm)', 'Width', 'W', 'b'
      ])),
      hoehe: parseNumber(findValue(row, [
        'Höhe', 'H', 'Höhe cm', 'Höhe (cm)', 'Height', 'h'
      ])),
      anzahl: parseInt(findValue(row, [
        'Anzahl', 'Stück', 'Stk', 'Menge', 'Quantity', 'Qty', 'Anz'
      ])) || 1,
      material: findValue(row, [
        'Material', 'Rahmen', 'Rahmenmaterial', 'Ausführung', 'Frame'
      ]) || 'Kunststoff',
      oeffnungsart: findValue(row, [
        'Öffnung', 'Öffnungsart', 'Typ', 'Art', 'Funktion', 'Opening'
      ]) || 'Dreh-Kipp',
      verglasung: findValue(row, [
        'Verglasung', 'Glas', 'Glasart', 'Isolierung', 'Glazing'
      ]) || '2-fach',
      farbe: findValue(row, [
        'Farbe', 'Color', 'Farbton', 'RAL'
      ]) || 'weiß',
      rolladen: findValue(row, [
        'Rolladen', 'Rollladen', 'Jalousie', 'Shutter'
      ]) || '',
      anmerkungen: findValue(row, [
        'Anmerkungen', 'Bemerkungen', 'Hinweise', 'Notes', 'Sonstiges'
      ]) || ''
    };
    
    // Validierung
    if (item.breite === 0 || item.hoehe === 0) {
      console.warn(`[EXCEL-PARSER] Fenster ${idx + 1}: Keine gültigen Maße`);
    }
    
    return item;
  }).filter(item => item.breite > 0 && item.hoehe > 0); // Nur gültige Fenster
  
  if (items.length === 0) return null;
  
  // Gruppiere gleiche Fenster
  const grouped = groupIdenticalItems(items, ['breite', 'hoehe', 'material', 'oeffnungsart']);
  
  const totalFenster = items.reduce((sum, item) => sum + item.anzahl, 0);
  const uniqueTypes = grouped.length;
  
  const details = grouped.map(group => 
    `${group.anzahl}x ${group.breite}x${group.hoehe}cm ${group.material} ${group.oeffnungsart}`
  ).join(', ');
  
  return {
    type: 'fenster_liste',
    items: items,
    grouped: grouped,
    answer: `${totalFenster} Fenster in ${uniqueTypes} verschiedenen Ausführungen: ${details}`,
    summary: `Excel mit ${totalFenster} Fenstern importiert`,
    statistics: {
      total: totalFenster,
      uniqueTypes: uniqueTypes,
      averageSize: calculateAverageWindowSize(items),
      materials: getUniqueMaterials(items, 'material'),
      openingTypes: getUniqueMaterials(items, 'oeffnungsart')
    }
  };
}

/**
 * TÜREN-LISTE Parser
 */
function parseTuerenListe(data, lowerColumns, questionText) {
  const hasTuerColumns = 
    lowerColumns.some(c => c.includes('tür') || c.includes('door') || c.includes('zarge')) ||
    (lowerColumns.some(c => c.includes('breite') || c.includes('din')));
  
  if (!hasTuerColumns) return null;
  
  const items = data.map((row, idx) => {
    const item = {
      nr: idx + 1,
      bezeichnung: findValue(row, [
        'Bezeichnung', 'Raum', 'Position', 'Tür', 'Door', 'Name', 'Ort'
      ]) || `Tür ${idx + 1}`,
      breite: parseNumber(findValue(row, [
        'Breite', 'B', 'Breite cm', 'Width', 'Türbreite'
      ])) || 86,
      hoehe: parseNumber(findValue(row, [
        'Höhe', 'H', 'Höhe cm', 'Height', 'Türhöhe'
      ])) || 198.5,
      anzahl: parseInt(findValue(row, [
        'Anzahl', 'Stück', 'Stk', 'Menge', 'Quantity'
      ])) || 1,
      material: findValue(row, [
        'Material', 'Ausführung', 'Oberfläche', 'Typ'
      ]) || 'Weißlack',
      anschlag: findValue(row, [
        'Anschlag', 'DIN', 'Öffnung', 'Opening'
      ]) || 'DIN links',
      zarge: findValue(row, [
        'Zarge', 'Zargentyp', 'Zargen', 'Frame'
      ]) || 'Blockzarge',
      glas: findValue(row, [
        'Glas', 'Verglasung', 'Lichtausschnitt', 'Glass'
      ]) || '',
      beschlag: findValue(row, [
        'Beschlag', 'Schloss', 'Drücker', 'Hardware'
      ]) || 'Standard',
      anmerkungen: findValue(row, [
        'Anmerkungen', 'Bemerkungen', 'Notes'
      ]) || ''
    };
    
    return item;
  }).filter(item => item.breite > 0 && item.hoehe > 0);
  
  if (items.length === 0) return null;
  
  const grouped = groupIdenticalItems(items, ['breite', 'hoehe', 'material']);
  const totalTueren = items.reduce((sum, item) => sum + item.anzahl, 0);
  
  const standardMasse = items.filter(item => 
    (item.breite === 86 || item.breite === 96) && 
    (item.hoehe === 198.5 || item.hoehe === 211)
  ).length;
  
  const sondermasse = items.length - standardMasse;
  
  return {
    type: 'tueren_liste',
    items: items,
    grouped: grouped,
    answer: `${totalTueren} Türen: ${standardMasse} Standardmaße, ${sondermasse} Sondermaße`,
    summary: `Excel mit ${totalTueren} Türen in ${grouped.length} Ausführungen`,
    statistics: {
      total: totalTueren,
      standardSizes: standardMasse,
      customSizes: sondermasse,
      materials: getUniqueMaterials(items, 'material'),
      widths: [...new Set(items.map(i => i.breite))].sort((a, b) => a - b)
    }
  };
}

/**
 * SANITÄR-LISTE Parser
 */
function parseSanitaerListe(data, lowerColumns, questionText) {
  const hasSanitaerColumns = 
    lowerColumns.some(c => 
      c.includes('wc') || c.includes('wasch') || c.includes('dusch') || 
      c.includes('bad') || c.includes('toilette') || c.includes('sanitär')
    );
  
  if (!hasSanitaerColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    typ: findValue(row, [
      'Typ', 'Objekt', 'Gegenstand', 'Sanitärobjekt', 'Art', 'Type'
    ]) || 'Sanitärobjekt',
    bezeichnung: findValue(row, [
      'Bezeichnung', 'Name', 'Beschreibung', 'Raum', 'Position'
    ]) || `Objekt ${idx + 1}`,
    anzahl: parseInt(findValue(row, [
      'Anzahl', 'Stück', 'Stk', 'Menge'
    ])) || 1,
    ausfuehrung: findValue(row, [
      'Ausführung', 'Modell', 'Serie', 'Variante'
    ]) || 'Standard',
    masse: findValue(row, [
      'Maße', 'Größe', 'Abmessungen', 'Size'
    ]) || '',
    hersteller: findValue(row, [
      'Hersteller', 'Marke', 'Fabrikat', 'Brand'
    ]) || '',
    farbe: findValue(row, [
      'Farbe', 'Color', 'Oberfläche'
    ]) || 'weiß',
    armatur: findValue(row, [
      'Armatur', 'Mischbatterie', 'Fittings'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Bemerkungen', 'Notes', 'Sonstiges'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  // Gruppiere nach Typ
  const byType = {};
  items.forEach(item => {
    const type = item.typ.toLowerCase();
    if (!byType[type]) byType[type] = [];
    byType[type].push(item);
  });
  
  const summary = Object.entries(byType).map(([type, items]) => {
    const count = items.reduce((sum, item) => sum + item.anzahl, 0);
    return `${count}x ${type}`;
  }).join(', ');
  
  const totalObjekte = items.reduce((sum, item) => sum + item.anzahl, 0);
  
  return {
    type: 'sanitaer_liste',
    items: items,
    byType: byType,
    answer: `${totalObjekte} Sanitärobjekte: ${summary}`,
    summary: `Excel mit ${items.length} Sanitärpositionen`,
    statistics: {
      total: totalObjekte,
      types: Object.keys(byType).length,
      breakdown: Object.entries(byType).map(([type, items]) => ({
        type,
        count: items.reduce((sum, item) => sum + item.anzahl, 0)
      }))
    }
  };
}

/**
 * HEIZKÖRPER-LISTE Parser
 */
function parseHeizkoerperListe(data, lowerColumns, questionText) {
  const hasHeizColumns = 
    lowerColumns.some(c => 
      c.includes('heiz') || c.includes('radiator') || 
      c.includes('watt') || c.includes('leistung')
    );
  
  if (!hasHeizColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    raum: findValue(row, [
      'Raum', 'Zimmer', 'Position', 'Ort', 'Bezeichnung', 'Room'
    ]) || `Raum ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Heizkörpertyp', 'Type'
    ]) || 'Plattenheizkörper',
    leistung: parseNumber(findValue(row, [
      'Leistung', 'Watt', 'W', 'Power', 'kW'
    ])),
    breite: parseNumber(findValue(row, [
      'Breite', 'B', 'Länge', 'L', 'Width'
    ])),
    hoehe: parseNumber(findValue(row, [
      'Höhe', 'H', 'Height'
    ])),
    tiefe: parseNumber(findValue(row, [
      'Tiefe', 'T', 'Depth', 'Bautiefe'
    ])),
    anzahl: parseInt(findValue(row, [
      'Anzahl', 'Stück', 'Stk', 'Menge'
    ])) || 1,
    ventil: findValue(row, [
      'Ventil', 'Thermostatventil', 'Anschluss'
    ]) || 'Thermostatventil',
    anschluss: findValue(row, [
      'Anschluss', 'Anschlussart', 'Connection'
    ]) || 'Seitenanschluss',
    farbe: findValue(row, [
      'Farbe', 'Color', 'RAL'
    ]) || 'weiß',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Bemerkungen', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalLeistung = items.reduce((sum, item) => 
    sum + (item.leistung * item.anzahl), 0
  );
  const totalAnzahl = items.reduce((sum, item) => sum + item.anzahl, 0);
  
  return {
    type: 'heizkoerper_liste',
    items: items,
    answer: `${totalAnzahl} Heizkörper mit insgesamt ${Math.round(totalLeistung)} Watt Heizleistung`,
    summary: `Excel mit ${items.length} Heizkörperpositionen`,
    statistics: {
      total: totalAnzahl,
      totalPower: Math.round(totalLeistung),
      averagePower: Math.round(totalLeistung / totalAnzahl),
      types: getUniqueMaterials(items, 'typ')
    }
  };
}

/**
 * ELEKTRO-LISTE Parser
 */
function parseElektroListe(data, lowerColumns, questionText) {
  const hasElektroColumns = 
    lowerColumns.some(c => 
      c.includes('steckdose') || c.includes('schalter') || c.includes('leuchte') ||
      c.includes('socket') || c.includes('switch') || c.includes('elektro')
    );
  
  if (!hasElektroColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    raum: findValue(row, [
      'Raum', 'Zimmer', 'Position', 'Ort', 'Room'
    ]) || `Raum ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Gegenstand', 'Type', 'Item'
    ]) || '',
    steckdosen: parseInt(findValue(row, [
      'Steckdosen', 'Steckdose', 'SD', 'Sockets'
    ])) || 0,
    schalter: parseInt(findValue(row, [
      'Schalter', 'Lichtschalter', 'LS', 'Switches'
    ])) || 0,
    leuchten: parseInt(findValue(row, [
      'Leuchten', 'Lampen', 'Deckenleuchten', 'Lights'
    ])) || 0,
    dosen: parseInt(findValue(row, [
      'Dosen', 'Anschlussdosen', 'Abzweigdosen'
    ])) || 0,
    netzwerk: parseInt(findValue(row, [
      'Netzwerk', 'LAN', 'CAT', 'Datendose'
    ])) || 0,
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes', 'Sonstiges'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totals = {
    steckdosen: items.reduce((sum, item) => sum + item.steckdosen, 0),
    schalter: items.reduce((sum, item) => sum + item.schalter, 0),
    leuchten: items.reduce((sum, item) => sum + item.leuchten, 0),
    netzwerk: items.reduce((sum, item) => sum + item.netzwerk, 0)
  };
  
  const summary = Object.entries(totals)
    .filter(([key, val]) => val > 0)
    .map(([key, val]) => `${val}x ${key}`)
    .join(', ');
  
  return {
    type: 'elektro_liste',
    items: items,
    answer: `Elektroausstattung für ${items.length} Räume: ${summary}`,
    summary: `Excel mit Elektroplanung für ${items.length} Räume`,
    statistics: {
      rooms: items.length,
      ...totals,
      totalItems: Object.values(totals).reduce((a, b) => a + b, 0)
    }
  };
}

/**
 * FLIESEN-LISTE Parser
 */
function parseFliesenListe(data, lowerColumns, questionText) {
  const hasFliesenColumns = 
    lowerColumns.some(c => 
      c.includes('fliese') || c.includes('tile') || c.includes('format')
    );
  
  if (!hasFliesenColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    raum: findValue(row, [
      'Raum', 'Bereich', 'Position', 'Ort', 'Room'
    ]) || `Bereich ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Fliesenart', 'Type'
    ]) || 'Bodenfliesen',
    format: findValue(row, [
      'Format', 'Größe', 'Maße', 'Size'
    ]) || '30x60cm',
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm', 'Area', 'Quadratmeter'
    ])),
    farbe: findValue(row, [
      'Farbe', 'Color', 'Farbton'
    ]) || '',
    oberfläche: findValue(row, [
      'Oberfläche', 'Optik', 'Struktur', 'Surface'
    ]) || '',
    hersteller: findValue(row, [
      'Hersteller', 'Marke', 'Brand'
    ]) || '',
    artikelnr: findValue(row, [
      'Artikel', 'Artikelnummer', 'Art.Nr.', 'SKU'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Bemerkungen', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + item.flaeche, 0);
  const uniqueFormats = [...new Set(items.map(i => i.format))];
  
  return {
    type: 'fliesen_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(1)}m² Fliesen in ${uniqueFormats.length} verschiedenen Formaten`,
    summary: `Excel mit ${items.length} Fliesenbereichen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      areas: items.length,
      formats: uniqueFormats,
      types: getUniqueMaterials(items, 'typ')
    }
  };
}

/**
 * BODEN-LISTE Parser
 */
function parseBodenListe(data, lowerColumns, questionText) {
  const hasBodenColumns = 
    lowerColumns.some(c => 
      c.includes('boden') || c.includes('parkett') || c.includes('laminat') ||
      c.includes('vinyl') || c.includes('floor')
    );
  
  if (!hasBodenColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    raum: findValue(row, [
      'Raum', 'Zimmer', 'Bereich', 'Room'
    ]) || `Raum ${idx + 1}`,
    belagsart: findValue(row, [
      'Belagsart', 'Material', 'Bodenbelag', 'Typ', 'Type'
    ]) || 'Laminat',
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm', 'Area'
    ])),
    dekorkorbez: findValue(row, [
      'Dekor', 'Farbe', 'Bezeichnung', 'Optik'
    ]) || '',
    hersteller: findValue(row, [
      'Hersteller', 'Marke', 'Brand'
    ]) || '',
    artikelnr: findValue(row, [
      'Artikel', 'Artikelnummer', 'Art.Nr.'
    ]) || '',
    sockelleiste: findValue(row, [
      'Sockelleiste', 'Sockel', 'Leiste'
    ]) || 'passend',
    unterlage: findValue(row, [
      'Unterlage', 'Trittschalldämmung', 'Dämmung'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Bemerkungen', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + item.flaeche, 0);
  const byType = {};
  items.forEach(item => {
    const type = item.belagsart;
    byType[type] = (byType[type] || 0) + item.flaeche;
  });
  
  const breakdown = Object.entries(byType)
    .map(([type, area]) => `${type}: ${area.toFixed(1)}m²`)
    .join(', ');
  
  return {
    type: 'boden_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(1)}m² Bodenbelag - ${breakdown}`,
    summary: `Excel mit ${items.length} Bodenbereichen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      rooms: items.length,
      types: Object.keys(byType),
      breakdown: byType
    }
  };
}

/**
 * MALER-LISTE Parser (Räume/Flächen)
 */
function parseMalerListe(data, lowerColumns, questionText) {
  const hasMalerColumns = 
    lowerColumns.some(c => 
      c.includes('wand') || c.includes('decke') || c.includes('farbe') ||
      c.includes('tapete') || c.includes('anstrich')
    );
  
  if (!hasMalerColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    raum: findValue(row, [
      'Raum', 'Zimmer', 'Bereich', 'Room'
    ]) || `Raum ${idx + 1}`,
    bodenflaeche: parseNumber(findValue(row, [
      'Bodenfläche', 'Grundfläche', 'qm', 'm²'
    ])),
    wandflaeche: parseNumber(findValue(row, [
      'Wandfläche', 'Wände', 'Wandfläche m²'
    ])),
    deckenflaeche: parseNumber(findValue(row, [
      'Deckenfläche', 'Decke', 'Deckenfläche m²'
    ])),
    raumhoehe: parseNumber(findValue(row, [
      'Raumhöhe', 'Höhe', 'Höhe m'
    ])) || 2.5,
    wandfarbe: findValue(row, [
      'Wandfarbe', 'Farbe Wand', 'Wände Farbe'
    ]) || 'weiß',
    deckenfarbe: findValue(row, [
      'Deckenfarbe', 'Farbe Decke', 'Decke Farbe'
    ]) || 'weiß',
    tapete: findValue(row, [
      'Tapete', 'Tapezieren', 'Tapete ja/nein'
    ]) || 'nein',
    qualitaet: findValue(row, [
      'Qualität', 'Q-Stufe', 'Spachtelqualität', 'Q1-Q4'
    ]) || 'Q2',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  // Berechne fehlende Werte
  items.forEach(item => {
    if (!item.wandflaeche && item.bodenflaeche && item.raumhoehe) {
      // Schätze Wandfläche: Umfang × Höhe (Annahme: quadratischer Raum)
      const umfang = 4 * Math.sqrt(item.bodenflaeche);
      item.wandflaeche = umfang * item.raumhoehe;
      item.wandflaeche_geschaetzt = true;
    }
    if (!item.deckenflaeche && item.bodenflaeche) {
      item.deckenflaeche = item.bodenflaeche;
      item.deckenflaeche_geschaetzt = true;
    }
  });
  
  if (items.length === 0) return null;
  
  const totalWand = items.reduce((sum, item) => sum + (item.wandflaeche || 0), 0);
  const totalDecke = items.reduce((sum, item) => sum + (item.deckenflaeche || 0), 0);
  
  return {
    type: 'maler_liste',
    items: items,
    answer: `${items.length} Räume: ${totalWand.toFixed(0)}m² Wände, ${totalDecke.toFixed(0)}m² Decken`,
    summary: `Excel mit Malerarbeiten für ${items.length} Räume`,
    statistics: {
      rooms: items.length,
      totalWallArea: totalWand.toFixed(1),
      totalCeilingArea: totalDecke.toFixed(1),
      totalArea: (totalWand + totalDecke).toFixed(1)
    }
  };
}

/**
 * DACH-LISTE Parser
 */
function parseDachListe(data, lowerColumns, questionText) {
  const hasDachColumns = 
    lowerColumns.some(c => 
      c.includes('dach') || c.includes('ziegel') || c.includes('roof')
    );
  
  if (!hasDachColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    bereich: findValue(row, [
      'Bereich', 'Dachfläche', 'Position', 'Area'
    ]) || `Dachfläche ${idx + 1}`,
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm', 'Dachfläche m²'
    ])),
    neigung: parseNumber(findValue(row, [
      'Neigung', 'Grad', '°', 'Dachneigung'
    ])),
    material: findValue(row, [
      'Material', 'Eindeckung', 'Ziegel', 'Type'
    ]) || '',
    farbe: findValue(row, [
      'Farbe', 'Farbton', 'Color'
    ]) || '',
    daemmung: parseNumber(findValue(row, [
      'Dämmung', 'Dämmstärke', 'cm', 'Dämmung cm'
    ])),
    dachfenster: parseInt(findValue(row, [
      'Dachfenster', 'Fenster', 'Anzahl Fenster'
    ])) || 0,
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + item.flaeche, 0);
  const totalDachfenster = items.reduce((sum, item) => sum + item.dachfenster, 0);
  
  return {
    type: 'dach_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(0)}m² Dachfläche${totalDachfenster > 0 ? `, ${totalDachfenster} Dachfenster` : ''}`,
    summary: `Excel mit ${items.length} Dachbereichen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      areas: items.length,
      windows: totalDachfenster,
      materials: getUniqueMaterials(items, 'material')
    }
  };
}

/**
 * FASSADE-LISTE Parser
 */
function parseFassadeListe(data, lowerColumns, questionText) {
  const hasFassadeColumns = 
    lowerColumns.some(c => 
      c.includes('fassade') || c.includes('wdvs') || c.includes('dämmung') ||
      c.includes('facade') || c.includes('außenwand')
    );
  
  if (!hasFassadeColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    seite: findValue(row, [
      'Seite', 'Fassadenseite', 'Himmelsrichtung', 'Position'
    ]) || `Fassade ${idx + 1}`,
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm', 'Fassadenfläche'
    ])),
    daemmstaerke: parseNumber(findValue(row, [
      'Dämmstärke', 'Dämmung', 'cm', 'WDVS Stärke'
    ])),
    daemmmaterial: findValue(row, [
      'Dämmmaterial', 'Material', 'EPS', 'Dämmstoff'
    ]) || 'EPS',
    putzart: findValue(row, [
      'Putzart', 'Putz', 'Oberputz', 'Struktur'
    ]) || '',
    farbe: findValue(row, [
      'Farbe', 'Farbton', 'RAL', 'Color'
    ]) || '',
    fenster: parseInt(findValue(row, [
      'Fenster', 'Anzahl Fenster', 'Fensteranzahl'
    ])) || 0,
    tueren: parseInt(findValue(row, [
      'Türen', 'Anzahl Türen', 'Türenanzahl'
    ])) || 0,
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + item.flaeche, 0);
  const avgDaemmstaerke = items.reduce((sum, item) => sum + item.daemmstaerke, 0) / items.length;
  
  return {
    type: 'fassade_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(0)}m² Fassadenfläche, durchschnittlich ${avgDaemmstaerke.toFixed(0)}cm Dämmung`,
    summary: `Excel mit ${items.length} Fassadenbereichen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      sides: items.length,
      averageInsulation: avgDaemmstaerke.toFixed(1),
      materials: getUniqueMaterials(items, 'daemmmaterial')
    }
  };
}

/**
 * TROCKENBAU-LISTE Parser
 */
function parseTrockenbauListe(data, lowerColumns, questionText) {
  const hasTrockenbauColumns = 
    lowerColumns.some(c => 
      c.includes('wand') || c.includes('decke') || c.includes('rigips') ||
      c.includes('gipskarton') || c.includes('trockenbau')
    );
  
  if (!hasTrockenbauColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    position: findValue(row, [
      'Position', 'Bereich', 'Raum', 'Bezeichnung'
    ]) || `Position ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Wandtyp', 'Type'
    ]) || 'Trockenbauwand',
    laenge: parseNumber(findValue(row, [
      'Länge', 'L', 'm', 'Länge m'
    ])),
    hoehe: parseNumber(findValue(row, [
      'Höhe', 'H', 'Höhe m'
    ])) || 2.5,
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm'
    ])),
    wandstaerke: parseNumber(findValue(row, [
      'Wandstärke', 'Stärke', 'cm', 'Dicke'
    ])) || 10,
    beplankung: findValue(row, [
      'Beplankung', 'Platten', 'Material'
    ]) || 'einfach beidseitig',
    daemmung: findValue(row, [
      'Dämmung', 'Dämmstoff', 'Isolierung'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  // Berechne Fläche wenn nicht angegeben
  items.forEach(item => {
    if (!item.flaeche && item.laenge && item.hoehe) {
      item.flaeche = item.laenge * item.hoehe;
      item.flaeche_berechnet = true;
    }
  });
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + (item.flaeche || 0), 0);
  
  return {
    type: 'trockenbau_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(1)}m² Trockenbau in ${items.length} Positionen`,
    summary: `Excel mit ${items.length} Trockenbau-Elementen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      positions: items.length,
      types: getUniqueMaterials(items, 'typ')
    }
  };
}

/**
 * ESTRICH-LISTE Parser
 */
function parseEstrichListe(data, lowerColumns, questionText) {
  const hasEstrichColumns = 
    lowerColumns.some(c => 
      c.includes('estrich') || c.includes('boden') || c.includes('fläche')
    );
  
  if (!hasEstrichColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    raum: findValue(row, [
      'Raum', 'Bereich', 'Position', 'Room'
    ]) || `Raum ${idx + 1}`,
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm', 'Bodenfläche'
    ])),
    estrichart: findValue(row, [
      'Estrichart', 'Art', 'Typ', 'Material'
    ]) || 'Zementestrich',
    staerke: parseNumber(findValue(row, [
      'Stärke', 'Dicke', 'cm', 'Estrichstärke'
    ])) || 5,
    daemmung: findValue(row, [
      'Dämmung', 'Dämmstoff', 'Trittschalldämmung'
    ]) || '',
    fbh: findValue(row, [
      'FBH', 'Fußbodenheizung', 'Heizung'
    ]) || 'nein',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + item.flaeche, 0);
  const mitFBH = items.filter(item => 
    item.fbh.toLowerCase() === 'ja' || item.fbh.toLowerCase() === 'yes'
  ).length;
  
  return {
    type: 'estrich_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(1)}m² Estrich in ${items.length} Räumen${mitFBH > 0 ? `, ${mitFBH} mit FBH` : ''}`,
    summary: `Excel mit ${items.length} Estrichbereichen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      rooms: items.length,
      withHeating: mitFBH,
      types: getUniqueMaterials(items, 'estrichart')
    }
  };
}

/**
 * ROHBAU-LISTE Parser
 */
function parseRohbauListe(data, lowerColumns, questionText) {
  const hasRohbauColumns = 
    lowerColumns.some(c => 
      c.includes('wand') || c.includes('decke') || c.includes('mauerwerk') ||
      c.includes('beton') || c.includes('durchbruch')
    );
  
  if (!hasRohbauColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    position: findValue(row, [
      'Position', 'Bezeichnung', 'Wand', 'Bereich'
    ]) || `Position ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Leistung', 'Type'
    ]) || '',
    material: findValue(row, [
      'Material', 'Mauerwerk', 'Werkstoff'
    ]) || '',
    laenge: parseNumber(findValue(row, [
      'Länge', 'L', 'm', 'Länge m'
    ])),
    hoehe: parseNumber(findValue(row, [
      'Höhe', 'H', 'Höhe m'
    ])),
    dicke: parseNumber(findValue(row, [
      'Dicke', 'Stärke', 'cm', 'Wandstärke'
    ])),
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm'
    ])),
    volumen: parseNumber(findValue(row, [
      'Volumen', 'm³', 'cbm'
    ])),
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  return {
    type: 'rohbau_liste',
    items: items,
    answer: `${items.length} Rohbaupositionen`,
    summary: `Excel mit ${items.length} Rohbau-Elementen`,
    statistics: {
      positions: items.length,
      types: getUniqueMaterials(items, 'typ'),
      materials: getUniqueMaterials(items, 'material')
    }
  };
}

/**
 * ZIMMERER-LISTE Parser
 */
function parseZimmererListe(data, lowerColumns, questionText) {
  const hasZimmerColumns = 
    lowerColumns.some(c => 
      c.includes('holz') || c.includes('balken') || c.includes('sparren') ||
      c.includes('dachstuhl') || c.includes('konstruktion')
    );
  
  if (!hasZimmerColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    position: findValue(row, [
      'Position', 'Bezeichnung', 'Bauteil', 'Element'
    ]) || `Position ${idx + 1}`,
    holzart: findValue(row, [
      'Holzart', 'Material', 'Holz', 'Wood'
    ]) || 'Fichte',
    querschnitt: findValue(row, [
      'Querschnitt', 'Abmessung', 'Dimension', 'Size'
    ]) || '',
    laenge: parseNumber(findValue(row, [
      'Länge', 'L', 'm', 'Länge m'
    ])),
    anzahl: parseInt(findValue(row, [
      'Anzahl', 'Stück', 'Stk', 'Menge'
    ])) || 1,
    behandlung: findValue(row, [
      'Behandlung', 'Oberflächenbehandlung', 'Schutz'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalElements = items.reduce((sum, item) => sum + item.anzahl, 0);
  
  return {
    type: 'zimmerer_liste',
    items: items,
    answer: `${totalElements} Holzelemente in ${items.length} verschiedenen Ausführungen`,
    summary: `Excel mit ${items.length} Zimmerer-Positionen`,
    statistics: {
      totalElements: totalElements,
      positions: items.length,
      woodTypes: getUniqueMaterials(items, 'holzart')
    }
  };
}

/**
 * GERÜST-LISTE Parser
 */
function parseGeruestListe(data, lowerColumns, questionText) {
  const hasGeruestColumns = 
    lowerColumns.some(c => 
      c.includes('gerüst') || c.includes('scaffold') || c.includes('fassade')
    );
  
  if (!hasGeruestColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    seite: findValue(row, [
      'Seite', 'Fassadenseite', 'Position', 'Bereich'
    ]) || `Seite ${idx + 1}`,
    laenge: parseNumber(findValue(row, [
      'Länge', 'L', 'm', 'Länge m'
    ])),
    hoehe: parseNumber(findValue(row, [
      'Höhe', 'H', 'Höhe m', 'Gerüsthöhe'
    ])),
    flaeche: parseNumber(findValue(row, [
      'Fläche', 'm²', 'qm', 'Gerüstfläche'
    ])),
    typ: findValue(row, [
      'Typ', 'Gerüstart', 'Art'
    ]) || 'Fassadengerüst',
    standzeit: parseInt(findValue(row, [
      'Standzeit', 'Wochen', 'Dauer'
    ])) || 4,
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  // Berechne Fläche wenn nicht angegeben
  items.forEach(item => {
    if (!item.flaeche && item.laenge && item.hoehe) {
      item.flaeche = item.laenge * item.hoehe;
      item.flaeche_berechnet = true;
    }
  });
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + (item.flaeche || 0), 0);
  
  return {
    type: 'geruest_liste',
    items: items,
    answer: `${totalFlaeche.toFixed(0)}m² Gerüstfläche an ${items.length} Seiten`,
    summary: `Excel mit ${items.length} Gerüstbereichen`,
    statistics: {
      totalArea: totalFlaeche.toFixed(1),
      sides: items.length,
      types: getUniqueMaterials(items, 'typ')
    }
  };
}

/**
 * SCHLOSSER-LISTE Parser
 */
function parseSchlosserListe(data, lowerColumns, questionText) {
  const hasSchlosserColumns = 
    lowerColumns.some(c => 
      c.includes('geländer') || c.includes('treppe') || c.includes('metall') ||
      c.includes('stahl') || c.includes('edelstahl')
    );
  
  if (!hasSchlosserColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    bezeichnung: findValue(row, [
      'Bezeichnung', 'Position', 'Bauteil', 'Element'
    ]) || `Element ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Geländertyp', 'Type'
    ]) || '',
    material: findValue(row, [
      'Material', 'Werkstoff', 'Metall'
    ]) || 'Edelstahl',
    laenge: parseNumber(findValue(row, [
      'Länge', 'L', 'm', 'Länge m'
    ])),
    hoehe: parseNumber(findValue(row, [
      'Höhe', 'H', 'cm', 'Höhe cm'
    ])),
    oberfläche: findValue(row, [
      'Oberfläche', 'Behandlung', 'Finish'
    ]) || '',
    anzahl: parseInt(findValue(row, [
      'Anzahl', 'Stück', 'Stk'
    ])) || 1,
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalLaenge = items.reduce((sum, item) => sum + (item.laenge * item.anzahl), 0);
  
  return {
    type: 'schlosser_liste',
    items: items,
    answer: `${totalLaenge.toFixed(1)}m Metallarbeiten in ${items.length} Positionen`,
    summary: `Excel mit ${items.length} Schlosser-Elementen`,
    statistics: {
      totalLength: totalLaenge.toFixed(1),
      positions: items.length,
      materials: getUniqueMaterials(items, 'material')
    }
  };
}

/**
 * ABBRUCH-LISTE Parser
 */
function parseAbbruchListe(data, lowerColumns, questionText) {
  const hasAbbruchColumns = 
    lowerColumns.some(c => 
      c.includes('abbruch') || c.includes('demontage') || c.includes('entkernung') ||
      c.includes('rückbau') || c.includes('entsorgung')
    );
  
  if (!hasAbbruchColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    position: findValue(row, [
      'Position', 'Bauteil', 'Element', 'Bezeichnung'
    ]) || `Position ${idx + 1}`,
    typ: findValue(row, [
      'Typ', 'Art', 'Abbruchart', 'Type'
    ]) || '',
    material: findValue(row, [
      'Material', 'Werkstoff', 'Baustoff'
    ]) || '',
    menge: parseNumber(findValue(row, [
      'Menge', 'Anzahl', 'Quantity'
    ])),
    einheit: findValue(row, [
      'Einheit', 'ME', 'Unit'
    ]) || 'm²',
    entsorgung: findValue(row, [
      'Entsorgung', 'Entsorgungsklasse', 'AVV'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Gefahrstoffe', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  return {
    type: 'abbruch_liste',
    items: items,
    answer: `${items.length} Abbruchpositionen`,
    summary: `Excel mit ${items.length} Abbruch-Elementen`,
    statistics: {
      positions: items.length,
      types: getUniqueMaterials(items, 'typ'),
      materials: getUniqueMaterials(items, 'material')
    }
  };
}

/**
 * PV-LISTE Parser
 */
function parsePVListe(data, lowerColumns, questionText) {
  const hasPVColumns = 
    lowerColumns.some(c => 
      c.includes('pv') || c.includes('photovoltaik') || c.includes('solar') ||
      c.includes('modul') || c.includes('kwp')
    );
  
  if (!hasPVColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    dachflaeche: findValue(row, [
      'Dachfläche', 'Bereich', 'Position', 'Area'
    ]) || `Dachfläche ${idx + 1}`,
    modultyp: findValue(row, [
      'Modultyp', 'Modul', 'Typ', 'Type'
    ]) || '',
    modulleistung: parseNumber(findValue(row, [
      'Modulleistung', 'Wp', 'Watt', 'Power'
    ])),
    anzahlModule: parseInt(findValue(row, [
      'Anzahl Module', 'Module', 'Quantity'
    ])) || 0,
    gesamtleistung: parseNumber(findValue(row, [
      'Gesamtleistung', 'kWp', 'Leistung'
    ])),
    ausrichtung: findValue(row, [
      'Ausrichtung', 'Himmelsrichtung', 'Orientation'
    ]) || '',
    neigung: parseNumber(findValue(row, [
      'Neigung', 'Dachneigung', 'Grad', '°'
    ])),
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Besonderheiten', 'Notes'
    ]) || ''
  }));
  
  // Berechne Gesamtleistung wenn nicht angegeben
  items.forEach(item => {
    if (!item.gesamtleistung && item.modulleistung && item.anzahlModule) {
      item.gesamtleistung = (item.modulleistung * item.anzahlModule) / 1000;
      item.gesamtleistung_berechnet = true;
    }
  });
  
  if (items.length === 0) return null;
  
  const totalLeistung = items.reduce((sum, item) => sum + (item.gesamtleistung || 0), 0);
  const totalModule = items.reduce((sum, item) => sum + item.anzahlModule, 0);
  
  return {
    type: 'pv_liste',
    items: items,
    answer: `${totalLeistung.toFixed(2)} kWp PV-Anlage mit ${totalModule} Modulen`,
    summary: `Excel mit PV-Planung: ${totalLeistung.toFixed(2)} kWp`,
    statistics: {
      totalPower: totalLeistung.toFixed(2),
      totalModules: totalModule,
      areas: items.length
    }
  };
}

/**
 * RAUM-LISTE Parser (Universal für verschiedene Gewerke)
 */
function parseRaumListe(data, lowerColumns) {
  const hasRaumColumns = 
    (lowerColumns.some(c => c.includes('raum') || c.includes('zimmer') || c.includes('room')) &&
     lowerColumns.some(c => c.includes('fläche') || c.includes('m²') || c.includes('qm')));
  
  if (!hasRaumColumns) return null;
  
  const items = data.map((row, idx) => {
    const flaeche = parseNumber(findValue(row, [
      'Fläche', 'Bodenfläche', 'Grundfläche', 'qm', 'm²', 'Größe', 'Area'
    ]));
    
    const hoehe = parseNumber(findValue(row, [
      'Höhe', 'Raumhöhe', 'Höhe m', 'Height'
    ])) || 2.5;
    
    // Berechne Wandfläche wenn nicht angegeben
    let wandflaeche = parseNumber(findValue(row, [
      'Wandfläche', 'Wand m²', 'Wände', 'Wall Area'
    ]));
    
    if (!wandflaeche && flaeche && hoehe) {
      // Schätze Wandfläche: Annahme quadratischer Raum
      const seitenlaenge = Math.sqrt(flaeche);
      const umfang = 4 * seitenlaenge;
      wandflaeche = umfang * hoehe;
    }
    
    return {
      nr: idx + 1,
      raum: findValue(row, [
        'Raum', 'Bezeichnung', 'Name', 'Zimmer', 'Room', 'Space'
      ]) || `Raum ${idx + 1}`,
      flaeche: flaeche,
      hoehe: hoehe,
      wandflaeche: wandflaeche,
      deckenflaeche: flaeche, // Deckenfläche = Bodenfläche
      umfang: wandflaeche ? wandflaeche / hoehe : null,
      typ: findValue(row, [
        'Typ', 'Art', 'Raumart', 'Type'
      ]) || '',
      nutzung: findValue(row, [
        'Nutzung', 'Verwendung', 'Zweck', 'Use'
      ]) || '',
      anmerkungen: findValue(row, [
        'Anmerkungen', 'Bemerkungen', 'Besonderheiten', 'Notes'
      ]) || ''
    };
  }).filter(item => item.flaeche > 0);
  
  if (items.length === 0) return null;
  
  const totalFlaeche = items.reduce((sum, item) => sum + item.flaeche, 0);
  const totalWand = items.reduce((sum, item) => sum + (item.wandflaeche || 0), 0);
  const raumListe = items.map(r => `${r.raum} (${r.flaeche}m²)`).join(', ');
  
  return {
    type: 'raum_liste',
    items: items,
    answer: `${items.length} Räume, ${totalFlaeche.toFixed(0)}m² Bodenfläche, ${totalWand.toFixed(0)}m² Wandfläche. Details: ${raumListe}`,
    summary: `Raumliste mit ${items.length} Räumen`,
    statistics: {
      rooms: items.length,
      totalFloorArea: totalFlaeche.toFixed(1),
      totalWallArea: totalWand.toFixed(1),
      averageRoomSize: (totalFlaeche / items.length).toFixed(1),
      averageHeight: (items.reduce((sum, item) => sum + item.hoehe, 0) / items.length).toFixed(2)
    }
  };
}

/**
 * MATERIAL/PRODUKT-LISTE Parser
 */
function parseMaterialListe(data, lowerColumns) {
  const hasMaterialColumns = 
    lowerColumns.some(c => 
      c.includes('material') || c.includes('produkt') || c.includes('artikel') ||
      c.includes('product') || c.includes('item')
    );
  
  if (!hasMaterialColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    bezeichnung: findValue(row, [
      'Bezeichnung', 'Material', 'Produkt', 'Artikel', 'Name', 'Description'
    ]) || `Material ${idx + 1}`,
    menge: parseNumber(findValue(row, [
      'Menge', 'Anzahl', 'Stück', 'Quantity', 'Amount'
    ])),
    einheit: findValue(row, [
      'Einheit', 'ME', 'Unit', 'Maßeinheit'
    ]) || 'Stk',
    hersteller: findValue(row, [
      'Hersteller', 'Marke', 'Firma', 'Brand', 'Manufacturer'
    ]) || '',
    artikelnr: findValue(row, [
      'Artikelnummer', 'Art.Nr.', 'SKU', 'Artikel-Nr', 'Item No'
    ]) || '',
    typ: findValue(row, [
      'Typ', 'Art', 'Kategorie', 'Type', 'Category'
    ]) || '',
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Bemerkungen', 'Hinweise', 'Notes', 'Comments'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  // Gruppiere nach Einheiten
  const byUnit = {};
  items.forEach(item => {
    const unit = item.einheit || 'Stk';
    if (!byUnit[unit]) byUnit[unit] = [];
    byUnit[unit].push(item);
  });
  
  return {
    type: 'material_liste',
    items: items,
    answer: `Materialliste mit ${items.length} Positionen`,
    summary: `${items.length} Materialien importiert`,
    statistics: {
      totalItems: items.length,
      units: Object.keys(byUnit),
      byUnit: Object.entries(byUnit).map(([unit, items]) => ({
        unit,
        count: items.length
      }))
    }
  };
}

/**
 * MASSE/ABMESSUNGEN Parser
 */
function parseMasseListe(data, lowerColumns) {
  const hasMasseColumns = 
    (lowerColumns.some(c => c.includes('breite') || c.includes('width')) &&
     lowerColumns.some(c => c.includes('höhe') || c.includes('height')));
  
  if (!hasMasseColumns) return null;
  
  const items = data.map((row, idx) => ({
    nr: idx + 1,
    bezeichnung: findValue(row, [
      'Bezeichnung', 'Name', 'Position', 'Element', 'Item'
    ]) || `Element ${idx + 1}`,
    breite: parseNumber(findValue(row, [
      'Breite', 'B', 'Width', 'W', 'Breite cm', 'Breite (cm)'
    ])),
    hoehe: parseNumber(findValue(row, [
      'Höhe', 'H', 'Height', 'Höhe cm', 'Höhe (cm)'
    ])),
    tiefe: parseNumber(findValue(row, [
      'Tiefe', 'T', 'Depth', 'D', 'Tiefe cm'
    ])),
    laenge: parseNumber(findValue(row, [
      'Länge', 'L', 'Length', 'Länge m'
    ])),
    anzahl: parseInt(findValue(row, [
      'Anzahl', 'Stück', 'Stk', 'Menge', 'Quantity'
    ])) || 1,
    anmerkungen: findValue(row, [
      'Anmerkungen', 'Bemerkungen', 'Notes'
    ]) || ''
  }));
  
  if (items.length === 0) return null;
  
  const totalElemente = items.reduce((sum, item) => sum + item.anzahl, 0);
  
  return {
    type: 'masse_liste',
    items: items,
    answer: `${totalElemente} Elemente mit Maßangaben`,
    summary: `${items.length} verschiedene Maße`,
    statistics: {
      totalElements: totalElemente,
      uniqueSizes: items.length
    }
  };
}

/**
 * Kontext-basiertes Parsing (basierend auf Fragentext)
 */
function parseByQuestionContext(data, lowerColumns, questionText) {
  if (!questionText) return null;
  
  const question = questionText.toLowerCase();
  
  // Fenster-Kontext
  if (question.includes('fenster') || question.includes('window')) {
    return parseFensterListe(data, lowerColumns, questionText);
  }
  
  // Türen-Kontext
  if (question.includes('tür') || question.includes('door')) {
    return parseTuerenListe(data, lowerColumns, questionText);
  }
  
  // Raum-Kontext
  if (question.includes('raum') || question.includes('zimmer') || question.includes('room')) {
    return parseRaumListe(data, lowerColumns);
  }
  
  // Flächen-Kontext
  if (question.includes('fläche') || question.includes('m²') || question.includes('qm')) {
    return parseRaumListe(data, lowerColumns) || parseMasseListe(data, lowerColumns);
  }
  
  // Sanitär-Kontext
  if (question.includes('sanitär') || question.includes('bad') || question.includes('wc')) {
    return parseSanitaerListe(data, lowerColumns, questionText);
  }
  
  // Heizung-Kontext
  if (question.includes('heiz') || question.includes('heizkörper')) {
    return parseHeizkoerperListe(data, lowerColumns, questionText);
  }
  
  // Material-Kontext
  if (question.includes('material') || question.includes('produkt')) {
    return parseMaterialListe(data, lowerColumns);
  }
  
  return null;
}

/**
 * Spalten-basiertes Parsing
 */
function parseByColumns(data, lowerColumns) {
  // Versuche verschiedene Parser basierend auf Spalten
  const parsers = [
    parseRaumListe,
    parseMasseListe,
    parseMaterialListe
  ];
  
  for (const parser of parsers) {
    const result = parser(data, lowerColumns);
    if (result && result.items.length > 0) {
      return result;
    }
  }
  
  return null;
}

/**
 * GENERISCHES Parsing als Fallback
 */
function parseGeneric(data, lowerColumns) {
  const columns = Object.keys(data[0]);
  
  // Versuche sinnvolle Spalten zu identifizieren
  const numericColumns = columns.filter(col => {
    return data.some(row => typeof row[col] === 'number' || !isNaN(parseFloat(row[col])));
  });
  
  const textColumns = columns.filter(col => !numericColumns.includes(col));
  
  const summary = [];
  if (textColumns.length > 0) {
    summary.push(`Textspalten: ${textColumns.join(', ')}`);
  }
  if (numericColumns.length > 0) {
    summary.push(`Zahlenspalten: ${numericColumns.join(', ')}`);
  }
  
  return {
    type: 'generic',
    items: data,
    columns: columns,
    numericColumns: numericColumns,
    textColumns: textColumns,
    answer: `Tabelle mit ${data.length} Zeilen und ${columns.length} Spalten importiert. ${summary.join('. ')}`,
    summary: `Generische Daten: ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? '...' : ''}`,
    statistics: {
      rows: data.length,
      columns: columns.length,
      numericColumns: numericColumns.length,
      textColumns: textColumns.length
    }
  };
}

/**
 * Hilfsfunktion: Finde Wert in Row basierend auf möglichen Schlüsseln
 */
function findValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    // Exakte Übereinstimmung (case-insensitive)
    const exactKey = Object.keys(row).find(k => 
      k.toLowerCase().trim() === key.toLowerCase().trim()
    );
    if (exactKey && row[exactKey] !== undefined && row[exactKey] !== '') {
      return row[exactKey];
    }
    
    // Teilweise Übereinstimmung
    const partialKey = Object.keys(row).find(k => 
      k.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(k.toLowerCase())
    );
    if (partialKey && row[partialKey] !== undefined && row[partialKey] !== '') {
      return row[partialKey];
    }
  }
  return null;
}

/**
 * Hilfsfunktion: Parse Nummer (Deutsche und Englische Formate)
 */
function parseNumber(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  
  const str = value.toString().trim();
  if (str === '' || str === '-') return 0;
  
  // Deutsche Zahlen konvertieren (1.234,56 -> 1234.56)
  let cleaned = str;
  
  // Erkenne Format: Komma als Dezimaltrenner (DE) oder Punkt (EN)
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  
  if (hasComma && hasDot) {
    // Beide vorhanden: welches kommt zuletzt?
    const commaPos = cleaned.lastIndexOf(',');
    const dotPos = cleaned.lastIndexOf('.');
    
    if (commaPos > dotPos) {
      // Deutsches Format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Englisches Format: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Nur Komma: könnte DE Dezimal oder EN Tausender sein
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Wahrscheinlich Dezimalkomma: 123,45
      cleaned = cleaned.replace(',', '.');
    } else {
      // Wahrscheinlich Tausenderkomma: 1,234
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  // Nur Punkt wird automatisch korrekt behandelt
  
  // Entferne alle nicht-numerischen Zeichen außer Punkt und Minus
  cleaned = cleaned.replace(/[^\d.-]/g, '');
  
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Gruppiere identische Items (z.B. gleiche Fenster zusammenfassen)
 */
function groupIdenticalItems(items, compareFields) {
  const groups = [];
  
  items.forEach(item => {
    // Suche existierende Gruppe
    const existingGroup = groups.find(group => {
      return compareFields.every(field => 
        group[field] === item[field]
      );
    });
    
    if (existingGroup) {
      existingGroup.anzahl += item.anzahl;
      existingGroup.items.push(item);
    } else {
      groups.push({
        ...item,
        items: [item]
      });
    }
  });
  
  return groups;
}

/**
 * Berechne durchschnittliche Fenstergröße
 */
function calculateAverageWindowSize(items) {
  const total = items.reduce((sum, item) => {
    const size = item.breite * item.hoehe;
    return sum + (size * item.anzahl);
  }, 0);
  
  const count = items.reduce((sum, item) => sum + item.anzahl, 0);
  
  return count > 0 ? (total / count / 10000).toFixed(2) : 0; // in m²
}

/**
 * Extrahiere eindeutige Materialien/Typen
 */
function getUniqueMaterials(items, field) {
  const unique = [...new Set(items.map(item => item[field]).filter(v => v))];
  return unique;
}

/**
 * Validiere geparste Daten
 */
function validateParsedData(result, tradeCode) {
  if (!result || !result.items || result.items.length === 0) {
    console.warn(`[EXCEL-PARSER] Warning: No valid items parsed for ${tradeCode}`);
    return result;
  }
  
  // Trade-spezifische Validierungen
  switch (tradeCode) {
    case 'FEN':
      result.items = result.items.filter(item => {
        if (item.breite <= 0 || item.hoehe <= 0) {
          console.warn(`[EXCEL-PARSER] Invalid window: ${item.bezeichnung} - missing dimensions`);
          return false;
        }
        if (item.breite > 500 || item.hoehe > 500) {
          console.warn(`[EXCEL-PARSER] Unrealistic window size: ${item.bezeichnung} - ${item.breite}x${item.hoehe}cm`);
          return false;
        }
        return true;
      });
      break;
      
    case 'TIS':
      result.items = result.items.filter(item => {
        if (item.breite <= 0 || item.hoehe <= 0) {
          console.warn(`[EXCEL-PARSER] Invalid door: ${item.bezeichnung} - missing dimensions`);
          return false;
        }
        if (item.breite > 300 || item.hoehe > 300) {
          console.warn(`[EXCEL-PARSER] Unrealistic door size: ${item.bezeichnung} - ${item.breite}x${item.hoehe}cm`);
          return false;
        }
        return true;
      });
      break;
      
    case 'HEI':
      result.items = result.items.filter(item => {
        if (item.leistung && (item.leistung < 100 || item.leistung > 10000)) {
          console.warn(`[EXCEL-PARSER] Unrealistic heater power: ${item.raum} - ${item.leistung}W`);
          return false;
        }
        return true;
      });
      break;
  }
  
  // Update statistics
  if (result.items.length === 0) {
    console.error(`[EXCEL-PARSER] Error: All items filtered out during validation`);
    result.answer = 'Fehler: Keine gültigen Daten in der Tabelle gefunden';
    result.summary = 'Validierung fehlgeschlagen';
  }
  
  return result;
}

/**
 * Berechne Datenqualität
 */
function calculateDataQuality(result) {
  if (!result || !result.items || result.items.length === 0) {
    return {
      score: 0,
      completeness: 0,
      accuracy: 0,
      issues: ['Keine Daten']
    };
  }
  
  let completeness = 0;
  let accuracy = 100;
  const issues = [];
  
  // Prüfe Vollständigkeit der Daten
  const totalFields = Object.keys(result.items[0]).length;
  const filledFields = result.items.reduce((sum, item) => {
    const filled = Object.values(item).filter(v => 
      v !== null && v !== undefined && v !== '' && v !== 0
    ).length;
    return sum + filled;
  }, 0);
  
  completeness = (filledFields / (totalFields * result.items.length)) * 100;
  
  // Prüfe auf geschätzte Werte
  const hasEstimates = result.items.some(item => 
    item.flaeche_geschaetzt || 
    item.wandflaeche_geschaetzt || 
    item.flaeche_berechnet
  );
  
  if (hasEstimates) {
    accuracy -= 10;
    issues.push('Enthält geschätzte/berechnete Werte');
  }
  
  // Prüfe auf fehlende kritische Daten
  if (result.type === 'fenster_liste' || result.type === 'tueren_liste') {
    const missingDimensions = result.items.filter(item => 
      !item.breite || !item.hoehe
    ).length;
    
    if (missingDimensions > 0) {
      accuracy -= 20;
      issues.push(`${missingDimensions} Elemente ohne vollständige Maßangaben`);
    }
  }
  
  const score = (completeness * 0.6 + accuracy * 0.4);
  
  return {
    score: Math.round(score),
    completeness: Math.round(completeness),
    accuracy: Math.round(accuracy),
    issues: issues,
    rating: score >= 90 ? 'Ausgezeichnet' : 
            score >= 75 ? 'Gut' : 
            score >= 60 ? 'Akzeptabel' : 
            'Unvollständig'
  };
}

/**
 * Exportiere strukturierte Daten für LV-Generierung
 */
function exportForLV(parsedData, tradeCode) {
  if (!parsedData || !parsedData.structured) {
    return null;
  }
  
  const structured = parsedData.structured;
  const lvData = {
    tradeCode: tradeCode,
    dataType: structured.type,
    items: structured.items,
    summary: structured.summary,
    statistics: structured.statistics,
    quality: parsedData.metadata?.quality
  };
  
  // Trade-spezifische LV-Vorbereitung
  switch (structured.type) {
    case 'fenster_liste':
      lvData.positions = structured.grouped.map((group, idx) => ({
        pos: `${String(idx + 1).padStart(2, '0')}.01`,
        description: `${group.anzahl} Stk. Fenster ${group.material}, ${group.breite}x${group.hoehe}cm, ${group.oeffnungsart}`,
        quantity: group.anzahl,
        unit: 'Stk',
        details: {
          width: group.breite,
          height: group.hoehe,
          material: group.material,
          opening: group.oeffnungsart,
          glazing: group.verglasung
        }
      }));
      break;
      
    case 'tueren_liste':
      lvData.positions = structured.grouped.map((group, idx) => ({
        pos: `${String(idx + 1).padStart(2, '0')}.01`,
        description: `${group.anzahl} Stk. Innentür ${group.material}, ${group.breite}x${group.hoehe}cm inkl. Zarge`,
        quantity: group.anzahl,
        unit: 'Stk',
        details: {
          width: group.breite,
          height: group.hoehe,
          material: group.material,
          frameType: group.zarge
        }
      }));
      break;
      
    case 'raum_liste':
      lvData.positions = structured.items.map((room, idx) => ({
        pos: `${String(idx + 1).padStart(2, '0')}.01`,
        description: `${room.raum}`,
        floorArea: room.flaeche,
        wallArea: room.wandflaeche,
        ceilingArea: room.deckenflaeche,
        height: room.hoehe,
        unit: 'm²'
      }));
      break;
  }
  
  return lvData;
}

module.exports = { 
  parseSpreadsheetContent,
  exportForLV,
  // Exportiere einzelne Parser für Tests
  parseFensterListe,
  parseTuerenListe,
  parseSanitaerListe,
  parseHeizkoerperListe,
  parseRaumListe
};
