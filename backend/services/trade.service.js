const { llmWithPolicy } = require('./llm.service');
const db = require('./database.service');

/**
 * Trade Service - Gewerke-Erkennung und Verwaltung
 */
class TradeService {
  
  /**
   * Gewerke-Erkennung mit LLM
   */
  async detectTrades(project) {
    console.log('[DETECT] Starting trade detection for project:', project);
    
    const masterPrompt = await db.getPromptByName('master');
    
    // VALIDIERE Masterprompt
    if (!masterPrompt) {
      console.error('[DETECT] CRITICAL: Master prompt missing!');
      throw new Error('Master-Prompt fehlt in der Datenbank - Gewerke-Erkennung nicht möglich');
    }
    
    if (masterPrompt.length < 500) {
      console.warn(`[DETECT] WARNING: Master prompt suspiciously short: ${masterPrompt.length} chars`);
    }
    
    // DEBUG: Prüfe ob wichtige Regeln im Masterprompt sind
    const criticalRules = [
      'DACHARBEITEN',
      'ABBRUCH-GEWERK',
      'GERÜST',
      'FENSTER/TÜREN',
      'SANITÄR/HEIZUNG/ELEKTRO',
      'FASSADE vs. PUTZ/MALER',
      'GEWERKEABGRENZUNG'
    ];
    
    const missingRules = criticalRules.filter(rule => 
      !masterPrompt.includes(rule)
    );
    
    if (missingRules.length > 0) {
      console.warn('[DETECT] Master prompt missing critical rules:', missingRules);
      console.warn('[DETECT] This may lead to incorrect trade detection!');
    }
    
    console.log(`[DETECT] Master prompt loaded: ${masterPrompt.length} chars, ${criticalRules.length - missingRules.length}/${criticalRules.length} critical rules found`);
    
    const availableTrades = await db.getAvailableTrades();
    
    if (availableTrades.length === 0) {
      throw new Error('No trades available in database');
    }
    
    const tradeList = availableTrades
      .filter(t => t.code !== 'INT')
      .map(t => `- ${t.code}: ${t.name}`)
      .join('\n');
    
    const systemPrompt = `${masterPrompt}

Du bist ein erfahrener Baukoordinator für die BYNDL-Plattform.
Analysiere die Projektbeschreibung und erkenne NUR die tatsächlich benötigten Gewerke.

KRITISCHE GEWERKE-ABGRENZUNGEN (IMMER EINHALTEN):

1. DACHARBEITEN:
   - Dachdecker (DACH) übernimmt ALLES am Dach:
     * Rückbau alte Eindeckung und Entsorgung
     * Neue Eindeckung und Abdichtung
     * ALLE Klempnerarbeiten (Rinnen, Fallrohre, Bleche, Kehlen)
     * Dachfenster-Einbau (Abdichtung)
     * Schneefangsysteme
   - NIEMALS Abbruch (ABBR) für Dacharbeiten!
   - NIEMALS Fassade (FASS) für Dachrinnen!
   - NIEMALS Rohbau (ROH) für Rückbauarbeiten am Dach!
   - NIEMALS Schlosser/Metallbau (SCHL) für Dachrinnen und Fallrohre!
   - NIEMALS Fenster/Türen (FEN) für Innentüren! 

2. ABBRUCH-GEWERK (ABBR) - NUR HINZUFÜGEN WENN:
   - Umfangreiche Sanierung mit 3+ anderen Gewerken (Komplettmodernisierung)
   - Schadstoffe wie Asbest erwähnt/vermutet werden (Spezialentsorgung)
   - Komplette Entkernung oder Teilentkernung geplant
   - Mehrere Wände entfernt werden
   - NICHT bei einzelnen Gewerken (Bad, Küche, Dach allein)
   - NICHT wenn nur 1-2 andere Gewerke beteiligt sind

3. SANITÄR/HEIZUNG/ELEKTRO:
   - Sanitär (SAN): Wasser, Abwasser, Sanitärobjekte, eigene Wanddurchbrüche (Kernbohrungen), Rückbau alter Installationen
   - Heizung (HEI): Wärmeerzeugung, Heizkörper, Fußbodenheizung, Rückbau alter Heizungsanlagen
   - Elektro (ELEKT): Strom, Schalter, Smart Home, eigene Schlitze, KOMPLETTER Rückbau alter Elektroinstallationen (Kabel, Dosen, Verteiler)
   - Lüftung/Klima (KLIMA): Lüftungsanlagen, Klimageräte, Luftkanäle, Wärmerückgewinnung, Luftqualität
   - Jedes Gewerk macht EIGENE Rückbauarbeiten, Schlitze und Durchbrüche!
   - KEIN separates Abbruch-Gewerk für TGA-Rückbau!

4. FASSADE vs. PUTZ/MALER:
   - Fassade (FASS): NUR Außen-WDVS, Klinker, vorgehängte Fassaden
   - Maler (MAL): Innenputz, Innenanstriche, einfache Fassadenanstriche
   - Bei reinem Fassadenanstrich: NUR Maler, NICHT Fassade

5. ROHBAU vs. ABBRUCH:
   - Rohbau (ROH): Neue Wände, Decken, Fundamente
   - Abbruch (ABBR): NUR bei Abriss oder (Teil-)Entkernung
   - Wanddurchbrüche: Immer Rohbau (ROH) wegen statischem Eingriff

6. TROCKENBAU vs. TISCHLER:
   - Trockenbau (TRO): Rigips- bzw. Gipskartonwände, abgehängte Decken, Vorsatzschalen
   - Tischler (TIS): Türen, Zargen, Holzverkleidungen, Einbaumöbel
   - NIEMALS Türen im Trockenbau!

7. FLIESEN vs. BODENBELAG:
   - Fliesen (FLI): ALLE Fliesenarbeiten, Naturstein in Bad/Küche
   - Bodenbelag (BOD): Parkett, Laminat, Vinyl, Teppich - NIEMALS Fliesen!

8. GERÜSTBAU:
   - Wenn Gerüst (GER) erforderlich immer als eigenes Gewerk → KEINE Gerüstpositionen in anderen Gewerken

9. ESTRICH:
   - Estrich (ESTR): Alle Estricharten, Dämmung unter Estrich
   - NICHT: Oberbeläge (gehören zu FLI oder BOD)

10. FENSTER/TÜREN:
   - Fenster (FEN): Außenfenster, Fenstertüren, Rollläden
   - Tischler (TIS): Innentüren, Zargen
   - Dachdecker (DACH): Dachfenster-Abdichtung

11. AUSSENANLAGEN:
    - Garten (AUSS): Pflaster, Zäune, Terrassen, Gartenbau
    - NICHT Balkonsanierung (gehört zu DACH oder FASS je nach Abdichtung)

GENERELLE REGELN:
- Qualität vor Quantität - lieber weniger richtige Gewerke
- Bei Unsicherheit: Hauptgewerk übernimmt Nebenleistungen
- Spezialisierte Gewerke haben Vorrang
- NIEMALS "INT" zurückgeben
- Maximal 7-9 Gewerke pro Projekt (außer Großprojekte)

VERFÜGBARE GEWERKE (NUR DIESE VERWENDEN!):
${tradeList}

OUTPUT FORMAT (NUR valides JSON):
{
  "trades": [
    {"code": "SAN", "name": "Sanitärinstallation"},
    {"code": "ELEKT", "name": "Elektroinstallation"}
  ],
  "confidence": 0.95,
  "reasoning": "Kurze Begründung der Auswahl",
  "projectInfo": {
    "type": "Wohnung/EFH/MFH/Gewerbe",
    "scope": "Neubau/Sanierung/Modernisierung",
    "estimatedDuration": "4-6 Wochen",
    "criticalTrades": ["SAN", "ELEKT"]
  }
}`;

    const userPrompt = `PROJEKTDATEN:
Kategorie: ${project.category || 'Nicht angegeben'}
Unterkategorie: ${project.subCategory || 'Nicht angegeben'}
Beschreibung: ${project.description || 'Keine Beschreibung'}
Zeitrahmen: ${project.timeframe || 'Nicht angegeben'}
Budget: ${project.budget || 'Nicht angegeben'}

Analysiere diese Daten und gib die benötigten Gewerke als JSON zurück.`;

    try {
      const llmResponse = await llmWithPolicy('detect', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { 
        maxTokens: 3000,
        temperature: 0.3,
        jsonMode: true 
      });
      
      const cleanedResponse = llmResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const parsedResponse = JSON.parse(cleanedResponse);
      
      if (!parsedResponse.trades || !Array.isArray(parsedResponse.trades)) {
        throw new Error('Invalid response structure');
      }
      
      const detectedTrades = [];
      const usedIds = new Set();
      
      for (const trade of parsedResponse.trades) {
        if (trade.code === 'INT') continue;
        
        const dbTrade = availableTrades.find(t => 
          t.code === trade.code || 
          t.name.toLowerCase() === trade.name?.toLowerCase()
        );
        
        if (dbTrade && !usedIds.has(dbTrade.id)) {
          usedIds.add(dbTrade.id);
          detectedTrades.push({
            id: dbTrade.id,
            code: dbTrade.code,
            name: dbTrade.name
          });
        }
      }
      
      if (detectedTrades.length === 0) {
        throw new Error('No valid trades detected');
      }
      
      // Automatisch Gerüst hinzufügen wenn nötig
      const needsScaffolding = detectedTrades.some(t => 
        ['DACH', 'FASS', 'FEN'].includes(t.code)
      );
      
      const extractedNeedsScaffolding = project.extractedData?.specificDetails?.needsScaffolding;
      
      if ((needsScaffolding || extractedNeedsScaffolding) && 
          !detectedTrades.some(t => t.code === 'GER')) {
        
        const scaffoldTrade = availableTrades.find(t => t.code === 'GER');
        if (scaffoldTrade && !usedIds.has(scaffoldTrade.id)) {
          console.log('[DETECT] Auto-adding Gerüstbau for Dach/Fassade/Fenster work');
          detectedTrades.push({
            id: scaffoldTrade.id,
            code: scaffoldTrade.code,
            name: scaffoldTrade.name
          });
        }
      }
      
      // Automatisch PV erkennen
      const needsPV = project.description?.toLowerCase().includes('pv') || 
                       project.description?.toLowerCase().includes('photovoltaik') ||
                       project.description?.toLowerCase().includes('solar') ||
                       project.description?.toLowerCase().includes('solaranlage');
      
      if (needsPV && !detectedTrades.some(t => t.code === 'PV')) {
        const pvTrade = availableTrades.find(t => t.code === 'PV');
        if (pvTrade && !usedIds.has(pvTrade.id)) {
          console.log('[DETECT] Auto-adding PV for solar/photovoltaik keywords');
          detectedTrades.push({
            id: pvTrade.id,
            code: pvTrade.code,
            name: pvTrade.name
          });
        }
      }
      
      console.log('[DETECT] Successfully detected trades:', detectedTrades);
      return detectedTrades;
      
    } catch (err) {
      console.error('[DETECT] Trade detection failed:', err);
      throw new Error('Gewerke-Erkennung fehlgeschlagen');
    }
  }
}

module.exports = TradeService();
