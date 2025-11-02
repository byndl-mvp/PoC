import React from 'react';
import { Link } from 'react-router-dom';

export default function Disclaimer() {
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
          <h1 className="text-4xl font-bold text-white mb-8">Disclaimer (Haftungsausschluss)</h1>
          
          <div className="text-gray-200 space-y-8">
            <section>
              <p className="text-sm text-gray-400 mb-4">Stand: Januar 2025</p>
              <p className="mb-4">
                Dieser Disclaimer gilt für die Website www.byndl.de sowie die darüber bereitgestellte Plattform 
                der byndl UG (haftungsbeschränkt).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">1. Rolle von byndl als Vermittler</h2>
              
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-6 mb-4">
                <p className="font-semibold text-teal-300 text-lg mb-3">Zentrale Klarstellung</p>
                <p className="mb-3">
                  byndl betreibt ausschließlich eine Vermittlungsplattform und tritt nicht als Vertragspartei 
                  bei den zwischen Bauherren und Handwerkern geschlossenen Werkverträgen auf.
                </p>
                <p className="mb-3">
                  <span className="font-semibold text-white">Das bedeutet konkret:</span>
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                    <span>Der Werkvertrag kommt ausschließlich zwischen Bauherr (Auftraggeber) und Handwerker (Auftragnehmer) zustande</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                    <span>byndl ist nicht verantwortlich für die Ausführung der Bauleistungen</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                    <span>byndl übernimmt keine Gewährleistung für die Qualität der Werkleistungen</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                    <span>byndl haftet nicht für Mängel, Verzögerungen oder Nichterfüllung der Bauleistungen</span>
                  </li>
                </ul>
              </div>

              <p className="mb-4">
                Die Funktion von byndl beschränkt sich auf die Bereitstellung der technischen Infrastruktur 
                und die Unterstützung bei der Zusammenführung von Angebot und Nachfrage im Bereich privater 
                Bau- und Renovierungsprojekte.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">2. Haftungsausschluss für Werkleistungen</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.1 Keine Haftung für Handwerkerleistungen</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-6 mb-4">
                <p className="font-semibold text-amber-300 mb-3">Wichtiger Haftungsausschluss</p>
                <p className="mb-3">
                  byndl übernimmt keinerlei Haftung oder Gewährleistung für:
                </p>
                <ul className="space-y-2">
                  <li>• Die fachgerechte Ausführung der Bauleistungen</li>
                  <li>• Die Qualität der verwendeten Materialien</li>
                  <li>• Die Einhaltung von Terminen</li>
                  <li>• Die Vollständigkeit der Leistungserbringung</li>
                  <li>• Mängel oder Schäden an der Baustelle</li>
                  <li>• Die Erfüllung von Gewährleistungspflichten</li>
                  <li>• Die Einhaltung von Sicherheitsvorschriften</li>
                  <li>• Die Rechtmäßigkeit der erbrachten Leistungen</li>
                </ul>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.2 Handwerker als unabhängige Unternehmer</h3>
              <p className="mb-4">
                Die auf der Plattform registrierten Handwerksbetriebe sind eigenständige, unabhängige Unternehmer. 
                Sie handeln nicht als Erfüllungsgehilfen oder Vertreter von byndl. Jeder Handwerker ist für seine 
                eigenen Leistungen, Angebote und Verpflichtungen selbst verantwortlich.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.3 Direkte Ansprüche gegen Handwerker</h3>
              <p className="mb-4">
                Alle Ansprüche aus dem Werkvertrag (insbesondere Gewährleistungs-, Schadenersatz- und 
                Nacherfüllungsansprüche) sind ausschließlich gegenüber dem beauftragten Handwerksbetrieb 
                geltend zu machen. byndl ist hierfür nicht der richtige Ansprechpartner.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">3. KI-gestützte Leistungsverzeichnisse und Kostenschätzungen</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.1 Unverbindliche Orientierungshilfe</h3>
              <div className="bg-white/5 border border-white/20 rounded-lg p-6 mb-4">
                <p className="mb-3">
                  Die von der künstlichen Intelligenz erstellten Leistungsverzeichnisse und Kostenschätzungen 
                  dienen ausschließlich als unverbindliche Orientierungshilfe für Bauherren.
                </p>
                <p className="font-semibold text-white mb-2">Diese Angaben sind:</p>
                <ul className="space-y-2">
                  <li>• Nicht rechtsverbindlich</li>
                  <li>• Keine Garantie für tatsächliche Kosten</li>
                  <li>• Keine Gewährleistung für Vollständigkeit</li>
                  <li>• Keine fachliche Beratung im rechtlichen Sinne</li>
                  <li>• Keine Haftungsübernahme für Abweichungen</li>
                </ul>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.2 Eigene Prüfpflicht</h3>
              <p className="mb-4">
                Bauherren sind verpflichtet, die KI-generierten Leistungsverzeichnisse und Kostenschätzungen 
                eigenverantwortlich zu prüfen und gegebenenfalls durch Fachleute (Architekten, Ingenieure, 
                Sachverständige) überprüfen zu lassen. byndl übernimmt keine Haftung für Fehler, Unvollständigkeiten 
                oder Ungenauigkeiten in den automatisch erstellten Dokumenten.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.3 Keine Planungsleistung</h3>
              <p className="mb-4">
                Die Erstellung von Leistungsverzeichnissen durch die KI stellt keine Planungsleistung im Sinne 
                der HOAI (Honorarordnung für Architekten und Ingenieure) dar und ersetzt nicht die Beauftragung 
                qualifizierter Fachplaner, wo diese gesetzlich oder faktisch erforderlich ist.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">4. Haftung für Nutzerinhalte</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.1 Verantwortung der Nutzer</h3>
              <p className="mb-4">
                Nutzer sind für die von ihnen auf der Plattform eingestellten Inhalte (Projektbeschreibungen, 
                Angebote, Bewertungen, Nachrichten etc.) selbst verantwortlich. byndl übernimmt keine Haftung 
                für die Richtigkeit, Vollständigkeit, Rechtmäßigkeit oder Aktualität von Nutzerinhalten.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.2 Keine Überprüfungspflicht</h3>
              <p className="mb-4">
                byndl ist als Plattformbetreiber nicht verpflichtet, von Nutzern eingestellte Inhalte vor ihrer 
                Veröffentlichung zu überprüfen. Eine stichprobenartige Kontrolle findet jedoch statt. Bei 
                Bekanntwerden von rechtswidrigen Inhalten werden diese umgehend entfernt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.3 Bewertungen und Referenzen</h3>
              <p className="mb-4">
                Bewertungen und Referenzen von Nutzern geben ausschließlich die subjektive Meinung des jeweiligen 
                Nutzers wieder. byndl übernimmt keine Gewähr für die Richtigkeit oder Vollständigkeit von 
                Bewertungen. Handwerker haben die Möglichkeit, auf Bewertungen zu reagieren.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">5. Haftung für technische Verfügbarkeit</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.1 Keine Verfügbarkeitsgarantie</h3>
              <p className="mb-4">
                byndl bemüht sich um eine möglichst hohe Verfügbarkeit der Plattform, kann jedoch keine 
                ununterbrochene oder fehlerfreie Verfügbarkeit garantieren. Insbesondere können Wartungsarbeiten, 
                technische Störungen, höhere Gewalt oder Eingriffe Dritter zu vorübergehenden Ausfällen führen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.2 Kein Anspruch auf ständige Verfügbarkeit</h3>
              <p className="mb-4">
                Nutzer haben keinen Anspruch auf jederzeitige Verfügbarkeit der Plattform. byndl haftet nicht 
                für Schäden, die durch vorübergehende Nichtverfügbarkeit entstehen, es sei denn, die Nichtverfügbarkeit 
                beruht auf Vorsatz oder grober Fahrlässigkeit.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.3 Datensicherheit</h3>
              <p className="mb-4">
                byndl trifft angemessene technische und organisatorische Maßnahmen zur Datensicherheit. Eine 
                absolute Sicherheit kann jedoch nicht garantiert werden. Nutzer werden gebeten, ihre Daten 
                zusätzlich selbst zu sichern.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">6. Haftung für externe Links</h2>
              
              <p className="mb-4">
                Unsere Website kann Links zu externen Websites enthalten. Für die Inhalte dieser verlinkten Seiten 
                ist ausschließlich deren Betreiber verantwortlich. byndl hat keinen Einfluss auf die Gestaltung 
                und den Inhalt fremder Internetseiten und distanziert sich ausdrücklich von allen Inhalten, die 
                möglicherweise straf- oder haftungsrechtlich relevant sind oder gegen die guten Sitten verstoßen.
              </p>
              <p className="mb-4">
                Sollten uns rechtswidrige Inhalte auf verlinkten Websites bekannt werden, werden wir den 
                entsprechenden Link umgehend entfernen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">7. Allgemeine Haftungsbeschränkung</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.1 Haftung bei Vorsatz und grober Fahrlässigkeit</h3>
              <p className="mb-4">
                byndl haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der 
                Gesundheit sowie für Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung 
                von byndl oder eines gesetzlichen Vertreters oder Erfüllungsgehilfen von byndl beruhen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.2 Haftung bei leichter Fahrlässigkeit</h3>
              <p className="mb-4">
                Bei leichter Fahrlässigkeit haftet byndl nur bei Verletzung einer wesentlichen Vertragspflicht 
                (Kardinalpflicht), deren Erfüllung die ordnungsgemäße Durchführung des Vertrages überhaupt erst 
                ermöglicht und auf deren Einhaltung der Vertragspartner regelmäßig vertrauen darf. In diesen Fällen 
                ist die Haftung auf den Ersatz des vorhersehbaren, typischerweise eintretenden Schadens begrenzt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.3 Produkthaftung</h3>
              <p className="mb-4">
                Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.4 Ausschluss weitergehender Haftung</h3>
              <p className="mb-4">
                Im Übrigen ist die Haftung von byndl ausgeschlossen, unabhängig von der Rechtsnatur des geltend 
                gemachten Anspruchs. Dies gilt insbesondere für Ansprüche aus Verschulden bei Vertragsschluss, 
                wegen sonstiger Pflichtverletzungen oder wegen deliktischer Ansprüche auf Ersatz von Sachschäden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">8. Fördermittelhinweise</h2>
              
              <div className="bg-white/5 border border-white/20 rounded-lg p-6 mb-4">
                <p className="mb-3">
                  Soweit auf der Plattform Hinweise auf mögliche Fördermittel (z.B. KfW, BAFA) gegeben werden, 
                  handelt es sich um unverbindliche Informationen ohne Gewähr.
                </p>
                <p className="mb-3">
                  Die tatsächliche Förderfähigkeit eines Projekts hängt von vielen individuellen Faktoren ab und 
                  muss im Einzelfall geprüft werden. byndl empfiehlt, sich bei Förderfragen an spezialisierte 
                  Energieberater oder die Förderstellen direkt zu wenden.
                </p>
                <p>
                  byndl übernimmt keine Haftung dafür, dass Fördermittel tatsächlich gewährt werden oder dass 
                  die Voraussetzungen für eine Förderung vorliegen.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">9. Rechtliche Hinweise</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.1 Keine Rechtsberatung</h3>
              <p className="mb-4">
                Die auf der Plattform bereitgestellten Informationen stellen keine Rechtsberatung dar. Bei 
                rechtlichen Fragen sollten Nutzer einen Rechtsanwalt oder eine andere qualifizierte Person 
                konsultieren.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.2 Keine Steuerberatung</h3>
              <p className="mb-4">
                Steuerliche Hinweise oder Informationen auf der Plattform stellen keine Steuerberatung dar. 
                Für steuerliche Fragen sollte ein Steuerberater hinzugezogen werden.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.3 Aktualität der Informationen</h3>
              <p className="mb-4">
                byndl bemüht sich, die Informationen auf der Plattform aktuell zu halten. Eine Gewähr für die 
                Aktualität, Richtigkeit und Vollständigkeit kann jedoch nicht übernommen werden. Insbesondere 
                können sich gesetzliche Regelungen, Förderbedingungen oder Marktpreise ändern.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">10. Streitbeilegung</h2>
              
              <p className="mb-4">
                Bei Streitigkeiten zwischen Bauherren und Handwerkern bietet byndl optional ein internes 
                Schlichtungsverfahren an. Die Teilnahme ist freiwillig und kostenpflichtig. Ein 
                Schlichtungsverfahren ersetzt nicht den Rechtsweg, kann aber helfen, Streitigkeiten außergerichtlich 
                beizulegen.
              </p>
              <p className="mb-4">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" 
                   className="text-teal-400 hover:text-teal-300 underline ml-1">
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>
              <p className="mb-4">
                byndl ist nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">11. Salvatorische Klausel</h2>
              
              <p className="mb-4">
                Sollten einzelne Bestimmungen dieses Disclaimers unwirksam sein oder werden, berührt dies die 
                Wirksamkeit der übrigen Bestimmungen nicht. An die Stelle der unwirksamen Bestimmung tritt eine 
                Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">12. Kontakt</h2>
              
              <p className="mb-4">
                Bei Fragen zu diesem Disclaimer wenden Sie sich bitte an:
              </p>
              <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                <p className="font-semibold text-white">byndl UG (haftungsbeschränkt)</p>
                <p className="text-gray-300">[Adresse]</p>
                <p className="text-gray-300 mt-3">E-Mail: info@byndl.de</p>
              </div>
            </section>

            <div className="bg-teal-900/30 border-l-4 border-teal-400 p-6 mt-8">
              <p className="font-semibold text-teal-300 text-lg mb-3">Zusammenfassung</p>
              <p className="mb-3">
                byndl ist eine reine Vermittlungsplattform. Werkverträge kommen ausschließlich zwischen 
                Bauherren und Handwerkern zustande. byndl haftet nicht für die Qualität, Vollständigkeit oder 
                Termintreue der vermittelten Bauleistungen.
              </p>
              <p>
                KI-generierte Leistungsverzeichnisse und Kostenschätzungen sind unverbindliche Orientierungshilfen 
                ohne Gewähr. Nutzer sind verpflichtet, diese eigenverantwortlich zu prüfen.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Link
            to="/impressum"
            className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-all text-center"
          >
            <p className="text-teal-400 font-semibold">Impressum</p>
          </Link>
          <Link
            to="/datenschutz"
            className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-all text-center"
          >
            <p className="text-teal-400 font-semibold">Datenschutz</p>
          </Link>
          <Link
            to="/agb"
            className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-all text-center"
          >
            <p className="text-teal-400 font-semibold">AGB</p>
          </Link>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 byndl UG (haftungsbeschränkt) - Alle Rechte vorbehalten
          </p>
        </div>
      </footer>
    </div>
  );
}
