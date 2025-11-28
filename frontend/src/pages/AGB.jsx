import React from 'react';
import { Link } from 'react-router-dom';

export default function AGB() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="relative z-10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link to="/" className="text-3xl font-bold text-white hover:text-teal-400 transition-colors">
              byndl
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              <span>Zurück zur Startseite</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 md:p-12 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-4">Allgemeine Geschäftsbedingungen (AGB)</h1>
          <p className="text-gray-400 mb-8">der byndl UG (haftungsbeschränkt)</p>
          
          {/* Inhaltsverzeichnis */}
          <nav className="bg-white/5 rounded-xl p-6 mb-10 border border-white/10">
            <h2 className="text-lg font-semibold text-teal-400 mb-4">Inhaltsübersicht</h2>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <a href="#p1" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 1 Geltungsbereich und Vertragsgegenstand</a>
              <a href="#p2" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 2 Registrierung und Vertragsschluss</a>
              <a href="#p3" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 3 Leistungen für Bauherren</a>
              <a href="#p4" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 4 Gebührenmodell für Bauherren</a>
              <a href="#p5" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 5 Leistungen für Handwerker</a>
              <a href="#p6" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 6 Gebührenmodell für Handwerker</a>
              <a href="#p7" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 7 Zweistufige Vergabe</a>
              <a href="#p8" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 8 Umgehungsverbot</a>
              <a href="#p9" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 9 Pflichten der Nutzer</a>
              <a href="#p10" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 10 Haftung und Gewährleistung</a>
              <a href="#p11" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 11 Datenschutz</a>
              <a href="#p12" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 12 Änderungen der AGB</a>
              <a href="#p13" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 13 Laufzeit und Kündigung</a>
              <a href="#p14" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 14 Streitbeilegung</a>
              <a href="#p15" className="text-gray-300 hover:text-teal-400 transition-colors py-1">§ 15 Schlussbestimmungen</a>
            </div>
          </nav>

          <div className="text-gray-200 space-y-10">
            <section>
              <p className="text-sm text-gray-400 mb-6">Stand: Januar 2025</p>
              <p className="mb-4 leading-relaxed">
                Für die Nutzung der Plattform byndl (nachfolgend „Plattform") der byndl UG (haftungsbeschränkt) 
                (nachfolgend „byndl" oder „Betreiber") gelten ausschließlich die nachfolgenden Allgemeinen 
                Geschäftsbedingungen in ihrer zum Zeitpunkt der Nutzung gültigen Fassung.
              </p>
            </section>

            {/* § 1 */}
            <section id="p1">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§1</span>
                Geltungsbereich und Vertragsgegenstand
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.1 Geltungsbereich</h3>
              <p className="mb-4 leading-relaxed">
                Diese AGB gelten für alle Verträge zwischen byndl und den Nutzern der Plattform. Nutzer sind 
                sowohl private Bauherren (nachfolgend „Bauherren" oder „Auftraggeber") als auch Handwerksbetriebe 
                (nachfolgend „Handwerker" oder „Auftragnehmer").
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.2 Rolle von byndl als Vermittler</h3>
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-teal-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  WICHTIG: Reine Vermittlerrolle
                </p>
                <p className="mb-3 leading-relaxed">
                  byndl tritt ausschließlich als Vermittler auf und stellt lediglich eine technische Plattform 
                  zur Verfügung, über die Bauherren und Handwerker zusammengebracht werden. byndl wird zu keinem 
                  Zeitpunkt Vertragspartei der zwischen Bauherren und Handwerkern geschlossenen Werkverträge. 
                  Das Vertragsverhältnis besteht ausschließlich zwischen dem Bauherrn (Auftraggeber) und dem 
                  Handwerker (Auftragnehmer).
                </p>
                <p className="mb-3 leading-relaxed">
                  byndl übernimmt keine Gewährleistung für die Ausführung, Qualität oder Vollständigkeit der 
                  vermittelten Bauleistungen. Ebenso übernimmt byndl keine Gewähr für die Richtigkeit oder 
                  Vollständigkeit der durch KI-Software generierten Leistungsverzeichnisse und Kostenschätzungen, 
                  die lediglich als erste Orientierung dienen.
                </p>
                <p className="text-sm text-gray-300">
                  byndl tritt weder als Bauträger, Generalunternehmer noch als Erfüllungsgehilfe einer der 
                  Vertragsparteien auf. Alle Rechte und Pflichten aus dem Werkvertrag bestehen ausschließlich 
                  zwischen Bauherr und Handwerker.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.3 Leistungen von byndl</h3>
              <p className="mb-3">Die Plattform bietet folgende Leistungen:</p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>KI-gestützte Erfassung und Strukturierung von Bauprojekten</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Automatisierte Erstellung von Leistungsverzeichnissen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>KI-basierte Kostenschätzungen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>KI-basierte Terminplanung</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Vermittlung zwischen Bauherren und registrierten Handwerksbetrieben</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Regionale und zeitliche Bündelung von Projekten</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Digitale Kommunikations- und Projektmanagement-Tools</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Unterstützung bei der Vertragsanbahnung</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.4 Abweichende Bedingungen</h3>
              <p className="mb-4 leading-relaxed">
                Abweichende, entgegenstehende oder ergänzende AGB des Nutzers werden nicht Vertragsbestandteil, 
                es sei denn, byndl stimmt ihrer Geltung ausdrücklich schriftlich zu.
              </p>
            </section>

            {/* § 2 */}
            <section id="p2">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§2</span>
                Registrierung und Vertragsschluss
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">2.1 Registrierung</h3>
              <p className="mb-4 leading-relaxed">
                Die Nutzung der Plattform erfordert eine Registrierung. Mit der Registrierung gibt der Nutzer 
                ein verbindliches Angebot zum Abschluss eines Nutzungsvertrags ab. Der Vertrag kommt durch die 
                Bestätigung der Registrierung durch byndl (Freischaltung des Zugangs) zustande.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">2.2 Voraussetzungen</h3>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Der Nutzer muss volljährig und voll geschäftsfähig sein</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Handwerksbetriebe müssen über eine gültige Gewerbeanmeldung verfügen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Alle Angaben bei der Registrierung müssen wahrheitsgemäß und vollständig sein</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Der Nutzer verpflichtet sich, Änderungen seiner Daten unverzüglich mitzuteilen</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">2.3 Zugangsdaten</h3>
              <p className="mb-4 leading-relaxed">
                Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und vor dem Zugriff Dritter 
                zu schützen. Bei Verdacht auf Missbrauch ist byndl unverzüglich zu informieren.
              </p>
            </section>

            {/* § 3 */}
            <section id="p3">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§3</span>
                Leistungen für Bauherren
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.1 Projekterfassung</h3>
              <p className="mb-4 leading-relaxed">
                Bauherren können ihre Bauprojekte über die Plattform erfassen. Die KI-gestützte Software 
                erstellt auf Basis der Angaben des Bauherrn ein strukturiertes Leistungsverzeichnis und 
                eine Kostenschätzung. Diese dienen ausschließlich der Orientierung und stellen keine 
                verbindliche Zusage dar.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.2 Automatische Gewerkeermittlung</h3>
              <p className="mb-4 leading-relaxed">
                Die KI-Software analysiert das vom Bauherrn beschriebene Projekt und ermittelt automatisch 
                die für die Umsetzung erforderlichen Gewerke. Für jedes ermittelte Gewerk wird ein separates 
                Leistungsverzeichnis (LV) erstellt. Der Bauherr hat vor Freigabe der Ausschreibung die 
                Möglichkeit, die ermittelten Gewerke und Leistungsverzeichnisse zu überprüfen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.3 Ausschreibung</h3>
              <p className="mb-4 leading-relaxed">
                Nach Freigabe durch den Bauherrn wird das Projekt an geeignete, registrierte Handwerksbetriebe 
                vermittelt. Der Bauherr erhält Angebote, die er vergleichen und bewerten kann. Die Entscheidung 
                über die Auftragsvergabe liegt ausschließlich beim Bauherrn.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.4 Haftungsbeschränkung für KI-generierte Inhalte</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  Wichtiger Haftungshinweis
                </p>
                <p className="mb-3 leading-relaxed">
                  Die von byndl bereitgestellten KI-generierten Leistungsverzeichnisse und Kostenschätzungen 
                  werden nach bestem Wissen und auf Grundlage der vom Bauherrn bereitgestellten Informationen 
                  erstellt. Sie dienen jedoch ausschließlich als erste, unverbindliche Orientierungshilfe für 
                  die Vertragsanbahnung und stellen keine Gewährleistung für Richtigkeit, Vollständigkeit oder 
                  Durchführbarkeit dar.
                </p>
                <p className="mb-3 leading-relaxed">
                  Der Bauherr wird ausdrücklich darauf hingewiesen, dass automatisiert erstellte Unterlagen 
                  technisch bedingt Ungenauigkeiten, Abweichungen von tatsächlichen Gegebenheiten oder 
                  unvollständige Erfassungen enthalten können. Der Bauherr ist daher verpflichtet, die 
                  KI-generierten Angaben eigenverantwortlich zu prüfen und bei Bedarf durch Fachleute 
                  (z.B. Architekten, Sachverständige) überprüfen zu lassen.
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-white">Wichtiger Schutzmechanismus:</span> Für das verbindliche 
                  Angebot ist ausschließlich der Handwerker verantwortlich, der im Rahmen der zweistufigen 
                  Vergabe (§ 7) die Pflicht zur eigenständigen Prüfung und Verifizierung der Projektgegebenheiten 
                  hat, bevor er sein finales Angebot bestätigt.
                </p>
              </div>
            </section>

            {/* § 4 - Gebührenmodell Bauherren */}
            <section id="p4">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§4</span>
                Gebührenmodell für Bauherren
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.1 Servicegebühr für Leistungsverzeichnisse</h3>
              <p className="mb-4 leading-relaxed">
                Für die KI-gestützte Erstellung von Leistungsverzeichnissen erhebt byndl eine einmalige 
                Servicegebühr pro erstelltem Leistungsverzeichnis (LV). Die Gebühr richtet sich nach der 
                Gesamtanzahl der für das Projekt ermittelten Gewerke und ist gestaffelt:
              </p>
              
              <div className="bg-gradient-to-br from-teal-900/30 to-blue-900/30 border border-teal-500/30 rounded-xl p-6 mb-6">
                <h4 className="text-white font-semibold mb-4">Gebührenstaffelung pro Leistungsverzeichnis</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <span className="text-white font-medium">1-2 Gewerke im Projekt</span>
                      <p className="text-sm text-gray-400 mt-1">z.B. Malerarbeiten, Bodenbelag</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-teal-400">9,90 €</span>
                      <p className="text-sm text-gray-400">pro LV</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-teal-500/30">
                    <div>
                      <span className="text-white font-medium">3-5 Gewerke im Projekt</span>
                      <p className="text-sm text-gray-400 mt-1">z.B. Badsanierung, Küche</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-teal-400">8,90 €</span>
                      <p className="text-sm text-gray-400">pro LV</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <span className="text-white font-medium">Ab 6 Gewerke im Projekt</span>
                      <p className="text-sm text-gray-400 mt-1">z.B. Kernsanierung, Anbau</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-teal-400">7,90 €</span>
                      <p className="text-sm text-gray-400">pro LV</p>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.2 Berechnung der Gesamtgebühr</h3>
              <p className="mb-4 leading-relaxed">
                Die Gesamtgebühr ergibt sich aus der Anzahl der erstellten Leistungsverzeichnisse multipliziert 
                mit dem jeweiligen Stückpreis gemäß der Staffelung. Maßgeblich für die Einordnung in die 
                Preisstufe ist die Gesamtanzahl der im Projekt ermittelten Gewerke.
              </p>
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-300">
                  <span className="text-teal-400 font-medium">Beispiel:</span> Ein Badsanierungsprojekt erfordert 
                  4 Gewerke (Sanitär, Fliesen, Elektro, Trockenbau). Die Gesamtgebühr beträgt: 4 × 8,90 € = 35,60 €
                </p>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.3 Fälligkeit</h3>
              <p className="mb-4 leading-relaxed">
                Die Servicegebühr wird fällig, bevor die Leistungsverzeichnisse erstellt werden.
                Die Zahlung erfolgt über die in der Plattform angebotenen Zahlungsmethoden.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.4 Keine weiteren Gebühren für Bauherren</h3>
              <p className="mb-4 leading-relaxed">
                Bauherren zahlen ausschließlich die Servicegebühr für die Erstellung der Leistungsverzeichnisse. 
                Es fallen keine Vermittlungsprovisionen, Erfolgsgebühren oder sonstigen Kosten für Bauherren an.
              </p>
            </section>

            {/* § 5 - Leistungen für Handwerker */}
            <section id="p5">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§5</span>
                Leistungen für Handwerker
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">5.1 Profilerstellung</h3>
              <p className="mb-4 leading-relaxed">
                Handwerksbetriebe erstellen ein Profil mit Angaben zu ihren Gewerken, Kapazitäten, 
                Einsatzradius und Referenzen. byndl behält sich vor, die Angaben zu überprüfen und 
                gegebenenfalls Nachweise zu verlangen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">5.2 Projektvermittlung</h3>
              <p className="mb-4 leading-relaxed">
                Handwerker erhalten Benachrichtigungen über passende Ausschreibungen in ihrem Einsatzgebiet. 
                Sie können Angebote abgeben, die den Bauherren zur Verfügung gestellt werden. Es besteht 
                kein Anspruch auf Vermittlung bestimmter oder einer Mindestanzahl von Projekten.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">5.3 Projektbündelung</h3>
              <p className="mb-4 leading-relaxed">
                byndl bietet Handwerkern die Möglichkeit, gebündelte Projekte zu übernehmen. Bei der 
                Projektbündelung werden mehrere ähnliche Projekte in derselben Region zeitlich koordiniert 
                vermittelt, wodurch Handwerker Fahrt- und Rüstzeiten optimieren können.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">5.4 Verifizierungspflicht und Qualitätsstandards</h3>
              <div className="bg-blue-900/30 border-l-4 border-blue-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-blue-300 mb-3">Unternehmerische Sorgfaltspflicht bei Angebotserstellung</p>
                <p className="mb-3 text-sm leading-relaxed">
                  Der Handwerker ist als Unternehmer (§ 14 BGB) verpflichtet, im Rahmen der Stufe 1 der 
                  zweistufigen Vergabe (§ 7) das durch die KI-Software erstellte Leistungsverzeichnis 
                  mit der im Geschäftsverkehr erforderlichen Sorgfalt eigenverantwortlich zu prüfen. 
                  Hierzu hat er insbesondere durch Vor-Ort-Besichtigung, Videocall oder auf anderem geeigneten 
                  Wege die tatsächlichen Gegebenheiten des Projekts zu verifizieren und zu dokumentieren.
                </p>
                <p className="mb-3 text-sm leading-relaxed">
                  Der Handwerker trägt als Fachunternehmer die alleinige Verantwortung dafür, dass sein in 
                  Stufe 2 bestätigtes finales Angebot fachlich korrekt, vollständig, kalkulatorisch richtig 
                  und realisierbar ist.
                </p>
              </div>
              <p className="mb-4 leading-relaxed">
                Handwerker verpflichten sich zur fachgerechten und termingerechten Ausführung der übernommenen 
                Aufträge sowie zur Einhaltung aller gesetzlichen und berufsrechtlichen Vorschriften. Bei 
                wiederholten Beschwerden oder mangelhafter Leistung kann byndl den Nutzer von der Plattform 
                ausschließen.
              </p>
            </section>

            {/* § 6 - Gebührenmodell Handwerker */}
            <section id="p6">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§6</span>
                Gebührenmodell für Handwerker
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.1 Erfolgsprovision</h3>
              <p className="mb-4 leading-relaxed">
                Handwerker zahlen eine Vermittlungsprovision ausschließlich im Erfolgsfall – das heißt nur dann, 
                wenn in Stufe 2 der zweistufigen Vergabe (siehe § 7) beide Parteien die verbindliche Beauftragung 
                bestätigen und der Werkvertrag tatsächlich zustande kommt. Die Registrierung, Profilerstellung 
                und Angebotsabgabe sind für Handwerker kostenlos.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.2 Provisionsstaffelung</h3>
              <p className="mb-4 leading-relaxed">
                Die Höhe der Vermittlungsprovision richtet sich nach der Netto-Auftragssumme und wird wie 
                folgt gestaffelt berechnet:
              </p>
              
              <div className="bg-gradient-to-br from-blue-900/30 to-slate-900/30 border border-blue-500/30 rounded-xl p-6 mb-6">
                <h4 className="text-white font-semibold mb-4">Provisionsstaffelung nach Auftragswert</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <span className="text-white font-medium">Aufträge bis 10.000 € netto</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-400">3,0 %</span>
                      <p className="text-sm text-gray-400">der Auftragssumme</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <span className="text-white font-medium">Aufträge 10.001 € bis 20.000 € netto</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-400">2,0 %</span>
                      <p className="text-sm text-gray-400">der Auftragssumme</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <span className="text-white font-medium">Aufträge ab 20.001 € netto</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-400">1,5 %</span>
                      <p className="text-sm text-gray-400">der Auftragssumme</p>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.3 Berechnungsgrundlage</h3>
              <p className="mb-4 leading-relaxed">
                Die Provision wird ausschließlich auf Basis der im Werkvertrag vereinbarten Gesamtvergütung (netto, ohne 
                Umsatzsteuer) berechnet. Nachträge, die im Verlauf des Projekts vereinbart werden, 
                haben keinen Einfluss auf die Provision.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.4 Fälligkeit und Rechnungsstellung</h3>
              <p className="mb-4 leading-relaxed">
                Die Vermittlungsprovision wird mit Zustandekommen des verbindlichen Werkvertrags (Stufe 2) 
                fällig. byndl stellt dem Handwerker nach Bestätigung der verbindlichen Beauftragung durch 
                beide Parteien eine Rechnung über die Provision. Die Rechnung ist innerhalb von 14 Tagen 
                nach Rechnungsdatum zur Zahlung fällig.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.5 Zahlungsverzug</h3>
              <p className="mb-4 leading-relaxed">
                Bei Zahlungsverzug ist byndl berechtigt, Verzugszinsen in gesetzlicher Höhe zu berechnen. 
                Darüber hinaus kann byndl den Zugang des Handwerkers zur Plattform sperren, bis die 
                offenen Forderungen beglichen sind.
              </p>
            </section>

            {/* § 7 - Zweistufige Vergabe */}
            <section id="p7">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§7</span>
                Zweistufige Vergabe
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.1 Vergabeverfahren</h3>
              <p className="mb-4 leading-relaxed">
                Die Auftragsvergabe erfolgt in einem zweistufigen Verfahren, das sowohl dem Schutz beider 
                Vertragsparteien als auch der rechtlichen Klarstellung der Verantwortlichkeiten dient:
              </p>
              
              <div className="bg-white/5 border border-white/20 rounded-xl p-6 mb-6">
                <div className="mb-6">
                  <p className="font-semibold text-teal-400 mb-3 text-lg">Stufe 1: Vorläufige Beauftragung (Vertragsanbahnung)</p>
                  <p className="mb-3 leading-relaxed">
                    Nach Auswahl eines Angebots durch den Bauherrn werden in Stufe 1 die Kontaktdaten zwischen 
                    Bauherr und Handwerker freigegeben und eine Kennenlern- und Prüfphase eingeleitet. Die 
                    Vermittlung gilt ab diesem Zeitpunkt rechtlich als erfolgt und die Nachwirkfrist von 24 Monaten 
                    greift (siehe § 7.2).
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    Die Vermittlungsprovision gemäß § 6 wird jedoch erst in Stufe 2 bei verbindlicher Beauftragung fällig.
                  </p>
                </div>
                
                <div className="mb-6 p-4 bg-teal-900/20 rounded-lg">
                  <p className="font-semibold text-teal-300 mb-2">Prüf- und Verifizierungsphase</p>
                  <p className="text-sm leading-relaxed">
                    Während der Kennenlernphase sind beide Parteien ausdrücklich aufgefordert, das durch die 
                    KI-gestützte Plattform erstellte Leistungsverzeichnis und die Kostenschätzung eigenverantwortlich 
                    zu überprüfen. Der Handwerker erhält die Möglichkeit und ist verpflichtet, durch eine 
                    Vor-Ort-Besichtigung, einen Videocall oder auf anderem geeigneten Wege die tatsächlichen 
                    Gegebenheiten des Projekts zu prüfen.
                  </p>
                </div>
                
                <div>
                  <p className="font-semibold text-blue-400 mb-3 text-lg">Stufe 2: Verbindliche Beauftragung (Werkvertrag)</p>
                  <p className="mb-3 leading-relaxed">
                    Nach Abschluss der Prüfungsphase bestätigt der Handwerker sein finales, verbindliches Angebot. 
                    Anschließend erteilt der Bauherr durch Klick auf „verbindlich beauftragen" die Auftragserteilung. 
                    Mit diesem Bestätigungsvorgang kommt der Werkvertrag ausschließlich zwischen Bauherr und 
                    Handwerker zustande.
                  </p>
                  <p className="text-sm text-gray-400">
                    Mit Zustandekommen des Werkvertrags wird die Vermittlungsprovision an byndl fällig und die 
                    Premium-Plattform-Features werden freigeschaltet.
                  </p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.2 Nachwirkfrist (24 Monate)</h3>
              <div className="bg-blue-900/30 border-l-4 border-blue-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-blue-300 mb-3">Schutz der Vermittlungsleistung</p>
                <p className="mb-3 leading-relaxed">
                  Ab dem Zeitpunkt der Kontaktfreigabe in Stufe 1 greift eine Nachwirkfrist von 24 Monaten. 
                  Kommt innerhalb dieses Zeitraums ein Vertrag zwischen dem Bauherrn und dem vermittelten 
                  Handwerker zustande – unabhängig davon, ob über die Plattform oder außerhalb – gilt dieser 
                  als durch byndl vermittelt und die Provision bleibt fällig.
                </p>
                <p className="text-sm text-gray-300">
                  Dies gilt für dasselbe Projekt sowie für vergleichbare oder Folgeprojekte zwischen denselben 
                  Vertragsparteien.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.3 Direktes Vertragsverhältnis</h3>
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-teal-300 mb-2">Wichtig</p>
                <p>
                  Der Werkvertrag kommt ausschließlich zwischen Bauherr und Handwerker zustande. byndl ist 
                  nicht Vertragspartei und übernimmt keine Haftung für die Erfüllung, Qualität oder sonstige 
                  Aspekte des Werkvertrags.
                </p>
              </div>
            </section>

            {/* § 8 - Umgehungsverbot */}
            <section id="p8">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§8</span>
                Umgehungsverbot
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">8.1 Verbot der Plattformumgehung</h3>
              <p className="mb-4 leading-relaxed">
                Es ist untersagt, die Plattform zu umgehen, indem Bauherr und Handwerker nach erfolgtem 
                Erstkontakt über byndl direkt außerhalb der Plattform einen Vertrag schließen, um die 
                Vermittlungsprovision zu vermeiden. Die Nachwirkfrist gemäß § 7.2 bleibt in jedem Fall 
                bestehen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">8.2 Vertragsstrafe</h3>
              <div className="bg-red-900/20 border-l-4 border-red-400 p-5 mb-4 rounded-r-lg">
                <p className="mb-3 leading-relaxed">
                  Bei vorsätzlicher Umgehung der Plattform verpflichtet sich der Handwerker zur Zahlung einer 
                  Vertragsstrafe in Höhe der doppelten entgangenen Vermittlungsprovision, mindestens jedoch 
                  2.500 Euro.
                </p>
                <p className="text-sm text-gray-300">
                  Die Geltendmachung weitergehender Schadensersatzansprüche bleibt vorbehalten.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">8.3 Monitoring und Nachweis</h3>
              <p className="mb-4 leading-relaxed">
                byndl behält sich vor, Verstöße gegen das Umgehungsverbot durch technische und organisatorische 
                Maßnahmen zu überwachen. Die Kontaktfreigabe wird protokolliert und beide Parteien erhalten 
                Erinnerungen über ihre Verpflichtungen.
              </p>
            </section>

            {/* § 9 - Pflichten der Nutzer */}
            <section id="p9">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§9</span>
                Pflichten der Nutzer
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">9.1 Allgemeine Pflichten</h3>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Wahrheitsgemäße und vollständige Angaben bei Registrierung und Projekterfassung</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Einhaltung aller gesetzlichen Vorschriften</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Keine missbräuchliche Nutzung der Plattform</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Respektvoller Umgang mit anderen Nutzern</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">9.2 Verbotene Handlungen</h3>
              <p className="mb-3">Untersagt sind insbesondere:</p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Verbreitung rechtswidriger Inhalte</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Verletzung von Rechten Dritter</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Manipulation oder Sabotage der Plattform</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Automatisiertes Auslesen von Daten (Scraping)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Erstellung von Fake-Profilen oder Fake-Projekten</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">9.3 Besondere Pflichten der Handwerker</h3>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Nachweis erforderlicher Qualifikationen und Genehmigungen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Bestehen einer Betriebshaftpflichtversicherung</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Sorgfältige Prüfung der Ausschreibungsunterlagen vor Angebotsabgabe</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Fachgerechte Ausführung übernommener Aufträge</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Einhaltung zugesagter Termine</span>
                </li>
              </ul>
            </section>

            {/* § 10 - Haftung */}
            <section id="p10">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§10</span>
                Haftung und Gewährleistung
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.1 Haftungsbeschränkung</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-amber-300 mb-3">Wichtiger Haftungshinweis</p>
                <p className="mb-3 text-sm leading-relaxed">
                  <span className="font-semibold text-white">a) Unbeschränkte Haftung:</span> byndl haftet unbeschränkt 
                  für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, bei Vorsatz und 
                  grober Fahrlässigkeit sowie bei Ansprüchen nach dem Produkthaftungsgesetz.
                </p>
                <p className="mb-3 text-sm leading-relaxed">
                  <span className="font-semibold text-white">b) Haftung bei Verletzung wesentlicher Vertragspflichten:</span> Bei 
                  leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den 
                  vorhersehbaren, vertragstypischen Schaden begrenzt.
                </p>
                <p className="text-sm leading-relaxed">
                  <span className="font-semibold text-white">c) Ausschluss weiterer Haftung:</span> Im Übrigen ist die 
                  Haftung für leicht fahrlässige Pflichtverletzungen ausgeschlossen.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.2 Keine Haftung für Werkleistungen</h3>
              <p className="mb-4 leading-relaxed">
                byndl übernimmt ausdrücklich keine Haftung für die Qualität, Vollständigkeit, Termintreue 
                oder sonstige Aspekte der von Handwerkern erbrachten Werkleistungen. Alle entsprechenden 
                Ansprüche sind ausschließlich gegenüber dem Handwerker geltend zu machen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.3 Technische Verfügbarkeit</h3>
              <p className="mb-4 leading-relaxed">
                byndl bemüht sich um eine hohe Verfügbarkeit der Plattform, kann diese aber nicht garantieren. 
                Ein Anspruch auf jederzeitige Verfügbarkeit besteht nicht.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.4 Freistellung</h3>
              <p className="mb-4 leading-relaxed">
                Der Nutzer stellt byndl von allen Ansprüchen Dritter frei, die auf einer rechtswidrigen oder 
                vertragswidrigen Nutzung der Plattform durch den Nutzer beruhen.
              </p>
            </section>

            {/* § 11 - Datenschutz */}
            <section id="p11">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§11</span>
                Datenschutz
              </h2>
              
              <p className="mb-4 leading-relaxed">
                byndl verarbeitet personenbezogene Daten im Einklang mit der Datenschutz-Grundverordnung (DSGVO) 
                und dem Bundesdatenschutzgesetz (BDSG). Nähere Informationen sind in der{' '}
                <Link to="/datenschutz" className="text-teal-400 hover:text-teal-300 underline">
                  Datenschutzerklärung
                </Link>{' '}
                zu finden.
              </p>
            </section>

            {/* § 12 - Änderungen */}
            <section id="p12">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§12</span>
                Änderungen der AGB
              </h2>
              
              <p className="mb-4 leading-relaxed">
                byndl behält sich vor, diese AGB mit Wirkung für die Zukunft zu ändern. Registrierte Nutzer 
                werden über Änderungen per E-Mail informiert. Widerspricht der Nutzer der Geltung der neuen 
                AGB nicht innerhalb von vier Wochen nach Zugang der Änderungsmitteilung, gelten die neuen 
                AGB als akzeptiert.
              </p>
            </section>

            {/* § 13 - Laufzeit */}
            <section id="p13">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§13</span>
                Laufzeit und Kündigung
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">13.1 Laufzeit</h3>
              <p className="mb-4 leading-relaxed">
                Der Nutzungsvertrag wird auf unbestimmte Zeit geschlossen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">13.2 Ordentliche Kündigung</h3>
              <p className="mb-4 leading-relaxed">
                Beide Parteien können den Vertrag jederzeit mit einer Frist von 14 Tagen zum Monatsende kündigen. 
                Die Kündigung bedarf der Textform (E-Mail ausreichend).
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">13.3 Außerordentliche Kündigung</h3>
              <p className="mb-4 leading-relaxed">
                Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">13.4 Folgen der Beendigung</h3>
              <p className="mb-4 leading-relaxed">
                Mit Beendigung des Nutzungsvertrags wird der Zugang zur Plattform gesperrt. Bereits begonnene 
                Vermittlungen werden zu Ende geführt. Noch offene Zahlungsverpflichtungen bleiben bestehen.
              </p>
            </section>

            {/* § 14 - Streitbeilegung */}
            <section id="p14">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§14</span>
                Streitbeilegung
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.1 Interne Streitbeilegung</h3>
              <p className="mb-4 leading-relaxed">
                Bei Streitigkeiten zwischen Nutzern bietet byndl ein optionales Schlichtungsverfahren an. 
                Die Teilnahme ist freiwillig.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.2 Online-Streitbeilegung</h3>
              <p className="mb-4 leading-relaxed">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
                <a 
                  href="https://ec.europa.eu/consumers/odr" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-teal-400 hover:text-teal-300 underline"
                >
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.3 Verbraucherschlichtung</h3>
              <p className="mb-4 leading-relaxed">
                byndl ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            {/* § 15 - Schlussbestimmungen */}
            <section id="p15">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">§15</span>
                Schlussbestimmungen
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">15.1 Anwendbares Recht</h3>
              <p className="mb-4 leading-relaxed">
                Für diese AGB und alle Rechtsbeziehungen zwischen byndl und dem Nutzer gilt das Recht der 
                Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG).
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">15.2 Gerichtsstand</h3>
              <p className="mb-4 leading-relaxed">
                Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches 
                Sondervermögen, ist ausschließlicher Gerichtsstand der Sitz von byndl.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">15.3 Salvatorische Klausel</h3>
              <p className="mb-4 leading-relaxed">
                Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies die 
                Wirksamkeit der übrigen Bestimmungen nicht.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">15.4 Kontakt</h3>
              <p className="mb-4">Bei Fragen zu diesen AGB wenden Sie sich bitte an:</p>
              <div className="bg-white/5 border border-white/20 rounded-lg p-5">
                <p className="font-semibold text-white">byndl UG (haftungsbeschränkt)</p>
                <p className="text-gray-300 mt-2">E-Mail: info@byndl.de</p>
              </div>
            </section>
          </div>
        </div>

        {/* Zurück Button */}
        <div className="text-center mt-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Zurück zur Startseite
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/30 py-8 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © 2025 byndl UG (haftungsbeschränkt) - Alle Rechte vorbehalten
            </p>
            <div className="flex gap-6 text-sm">
              <Link to="/nutzungsbedingungen" className="text-gray-400 hover:text-teal-400 transition-colors">
                Nutzungsbedingungen
              </Link>
              <Link to="/datenschutz" className="text-gray-400 hover:text-teal-400 transition-colors">
                Datenschutz
              </Link>
              <Link to="/impressum" className="text-gray-400 hover:text-teal-400 transition-colors">
                Impressum
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
