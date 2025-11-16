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
          <h1 className="text-4xl font-bold text-white mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>
          
          <div className="text-gray-200 space-y-8">
            <section>
              <p className="text-sm text-gray-400 mb-4">Stand: Januar 2025</p>
              <p className="mb-4">
                Für die Nutzung der Plattform byndl (nachfolgend „Plattform") der byndl UG (haftungsbeschränkt) 
                (nachfolgend „byndl" oder „Betreiber") gelten ausschließlich die nachfolgenden Allgemeinen 
                Geschäftsbedingungen in ihrer zum Zeitpunkt der Nutzung gültigen Fassung.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 1 Geltungsbereich und Vertragsgegenstand</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">1.1 Geltungsbereich</h3>
              <p className="mb-4">
                Diese AGB gelten für alle Verträge zwischen byndl und den Nutzern der Plattform. Nutzer sind 
                sowohl private Bauherren (nachfolgend „Bauherren" oder „Auftraggeber") als auch Handwerksbetriebe 
                (nachfolgend „Handwerker" oder „Auftragnehmer").
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">1.2 Rolle von byndl als Vermittler</h3>
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-4 mb-4">
                <p className="font-semibold text-teal-300 mb-2">WICHTIG: Reine Vermittlerrolle</p>
                <p className="mb-3">
                  byndl tritt ausschließlich als Vermittler auf und stellt lediglich eine technische Plattform 
                  zur Verfügung, über die Bauherren und Handwerker zusammengebracht werden. byndl wird zu keinem 
                  Zeitpunkt Vertragspartei der zwischen Bauherren und Handwerkern geschlossenen Werkverträge. 
                  Das Vertragsverhältnis besteht ausschließlich zwischen dem Bauherrn (Auftraggeber) und dem 
                  Handwerker (Auftragnehmer).
                </p>
                <p className="mb-3">
                  byndl übernimmt keine Gewährleistung für die Ausführung, Qualität oder Vollständigkeit der 
                  vermittelten Bauleistungen. Ebenso übernimmt byndl keine Gewähr für die Richtigkeit oder 
                  Vollständigkeit der durch KI-Software generierten Leistungsverzeichnisse und Kostenschätzungen, 
                  die lediglich als erste Orientierung dienen.
                </p>
                <p className="text-sm">
                  byndl tritt weder als Bauträger, Generalunternehmer noch als Erfüllungsgehilfe einer der 
                  Vertragsparteien auf. Alle Rechte und Pflichten aus dem Werkvertrag bestehen ausschließlich 
                  zwischen Bauherr und Handwerker. Die Plattform dient ausschließlich der Vermittlung und 
                  Bereitstellung digitaler Werkzeuge zur Projektabwicklung.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">1.3 Leistungen von byndl</h3>
              <p className="mb-2">Die Plattform bietet folgende Leistungen:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>KI-gestützte Erfassung und Strukturierung von Bauprojekten</li>
                <li>Automatisierte Erstellung von Leistungsverzeichnissen</li>
                <li>KI-basierte Kostenschätzungen</li>
                <li>Vermittlung zwischen Bauherren und registrierten Handwerksbetrieben</li>
                <li>Regionale und zeitliche Bündelung von Projekten</li>
                <li>Digitale Kommunikations- und Projektmanagement-Tools</li>
                <li>Unterstützung bei der Vertragsanbahnung</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">1.4 Abweichende Bedingungen</h3>
              <p className="mb-4">
                Abweichende, entgegenstehende oder ergänzende AGB des Nutzers werden nicht Vertragsbestandteil, 
                es sei denn, byndl stimmt ihrer Geltung ausdrücklich schriftlich zu.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 2 Registrierung und Vertragsschluss</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.1 Registrierung</h3>
              <p className="mb-4">
                Die Nutzung der Plattform erfordert eine Registrierung. Mit der Registrierung gibt der Nutzer 
                ein verbindliches Angebot zum Abschluss eines Nutzungsvertrags ab. Der Vertrag kommt durch die 
                Bestätigung der Registrierung durch byndl (Freischaltung des Zugangs) zustande.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.2 Voraussetzungen</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Der Nutzer muss volljährig und voll geschäftsfähig sein</li>
                <li>Handwerksbetriebe müssen über eine gültige Gewerbeanmeldung verfügen</li>
                <li>Alle Angaben bei der Registrierung müssen wahrheitsgemäß und vollständig sein</li>
                <li>Der Nutzer verpflichtet sich, Änderungen seiner Daten unverzüglich mitzuteilen</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.3 Zugangsdaten</h3>
              <p className="mb-4">
                Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und vor dem Zugriff Dritter 
                zu schützen. Bei Verdacht auf Missbrauch ist byndl unverzüglich zu informieren.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 3 Leistungen für Bauherren</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.1 Projekterfassung</h3>
              <p className="mb-4">
                Bauherren können ihre Bauprojekte über die Plattform erfassen. Die KI-gestützte Software 
                erstellt auf Basis der Angaben des Bauherrn ein strukturiertes Leistungsverzeichnis und 
                eine Kostenschätzung. Diese dienen ausschließlich der Orientierung und stellen keine 
                verbindliche Zusage dar.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.2 Ausschreibung</h3>
              <p className="mb-4">
                Nach Freigabe durch den Bauherrn wird das Projekt an geeignete, registrierte Handwerksbetriebe 
                vermittelt. Der Bauherr erhält Angebote, die er vergleichen und bewerten kann. Die Entscheidung 
                über die Auftragsvergabe liegt ausschließlich beim Bauherrn.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.3 Haftungsbeschränkung für KI-generierte Inhalte</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-4 mb-4">
                <p className="font-semibold text-amber-300 mb-2">Wichtiger Haftungshinweis</p>
                <p className="mb-3">
                  Die von byndl bereitgestellten KI-generierten Leistungsverzeichnisse und Kostenschätzungen 
                  werden nach bestem Wissen und auf Grundlage der vom Bauherrn bereitgestellten Informationen 
                  erstellt. Sie dienen jedoch ausschließlich als erste, unverbindliche Orientierungshilfe für 
                  die Vertragsanbahnung und stellen keine Gewährleistung für Richtigkeit, Vollständigkeit oder 
                  Durchführbarkeit dar.
                </p>
                <p className="mb-3">
                  Der Bauherr wird ausdrücklich darauf hingewiesen, dass automatisiert erstellte Unterlagen 
                  technisch bedingt Ungenauigkeiten, Abweichungen von tatsächlichen Gegebenheiten oder 
                  unvollständige Erfassungen enthalten können. Der Bauherr ist daher verpflichtet, die 
                  KI-generierten Angaben eigenverantwortlich zu prüfen und bei Bedarf durch Fachleute 
                  (z.B. Architekten, Sachverständige) überprüfen zu lassen.
                </p>
                <p className="mb-3">
                  <span className="font-semibold text-white">Haftungsbegrenzung:</span> Die Haftung von byndl 
                  für die Richtigkeit oder Vollständigkeit der KI-generierten Ausschreibungsunterlagen ist auf 
                  Vorsatz und grobe Fahrlässigkeit beschränkt. Für leichte Fahrlässigkeit haftet byndl nicht, 
                  es sei denn, es handelt sich um die Verletzung wesentlicher Vertragspflichten oder um Schäden 
                  aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Bei Verletzung wesentlicher 
                  Vertragspflichten durch leichte Fahrlässigkeit ist die Haftung auf den vorhersehbaren, 
                  vertragstypischen Schaden begrenzt.
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Wichtiger Schutzmechanismus:</span> Für das verbindliche 
                  Angebot ist ausschließlich der Handwerker verantwortlich, der im Rahmen der zweistufigen 
                  Vergabe (§ 5.1) die Pflicht zur eigenständigen Prüfung und Verifizierung der Projektgegebenheiten 
                  hat, bevor er sein finales Angebot bestätigt. Ansprüche wegen fehlerhafter Leistungsbeschreibungen 
                  oder Kalkulationen sind vorrangig gegenüber dem Handwerker geltend zu machen.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.4 Gebühren</h3>
              <p className="mb-4">
                Für die Nutzung der Ausschreibungsfunktion erhebt byndl eine einmalige Servicegebühr gemäß 
                der jeweils gültigen Preisliste. Die Gebühr ist vor Veröffentlichung der Ausschreibung fällig.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 4 Leistungen für Handwerker</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.1 Profilerstellung</h3>
              <p className="mb-4">
                Handwerksbetriebe erstellen ein Profil mit Angaben zu ihren Gewerken, Kapazitäten, 
                Einsatzradius und Referenzen. byndl behält sich vor, die Angaben zu überprüfen und 
                gegebenenfalls Nachweise zu verlangen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.2 Projektvermittlung</h3>
              <p className="mb-4">
                Handwerker erhalten Benachrichtigungen über passende Projekte in ihrem Einsatzgebiet. 
                Sie können Angebote abgeben, die den Bauherren zur Verfügung gestellt werden. Es besteht 
                kein Anspruch auf Vermittlung bestimmter oder einer Mindestanzahl von Projekten.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.3 Vermittlungsprovision</h3>
              <p className="mb-4">
                Bei erfolgreicher Vermittlung und verbindlichem Vertragsschluss zwischen Handwerker und 
                Bauherr ist eine Vermittlungsprovision an byndl zu zahlen. Die Provision wird ausschließlich 
                im Erfolgsfall erhoben – das heißt nur dann, wenn in Stufe 2 der zweistufigen Vergabe 
                (siehe § 5.1) beide Parteien die verbindliche Beauftragung bestätigen und der Werkvertrag 
                tatsächlich zustande kommt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.4 Provisionsstaffelung</h3>
              <p className="mb-4">
                Die Höhe der Vermittlungsprovision richtet sich nach der Netto-Auftragssumme und wird wie 
                folgt gestaffelt berechnet:
              </p>
              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="pb-2 pr-4 font-semibold text-teal-300">Netto-Auftragssumme</th>
                      <th className="pb-2 font-semibold text-teal-300">Provisionssatz</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-200">
                    <tr className="border-b border-white/10">
                      <td className="py-2 pr-4">bis 10.000 EUR</td>
                      <td className="py-2">5%</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="py-2 pr-4">10.001 EUR bis 20.000 EUR</td>
                      <td className="py-2">4%</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">ab 20.001 EUR</td>
                      <td className="py-2">3%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mb-4">
                Die Provision wird auf Basis der im Werkvertrag vereinbarten Gesamtvergütung (netto) 
                berechnet und ist mit Zustandekommen des verbindlichen Werkvertrags (Stufe 2) fällig. 
                Die Rechnungsstellung durch byndl erfolgt nach Bestätigung der verbindlichen Beauftragung 
                durch beide Parteien.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.5 Verifizierungspflicht und Qualitätsstandards</h3>
              <div className="bg-blue-900/30 border-l-4 border-blue-400 p-4 mb-4">
                <p className="font-semibold text-blue-300 mb-2">Unternehmerische Sorgfaltspflicht bei Angebotserstellung</p>
                <p className="mb-3 text-sm">
                  Der Handwerker ist als Unternehmer (§ 14 BGB) verpflichtet, im Rahmen der Stufe 1 der 
                  zweistufigen Vergabe (§ 5.1) das durch die KI-Software erstellte Leistungsverzeichnis 
                  mit der im Geschäftsverkehr erforderlichen Sorgfalt eigenverantwortlich zu prüfen. 
                  Hierzu hat er insbesondere durch Vor-Ort-Besichtigung, Videocall oder auf anderem geeigneten 
                  Wege die tatsächlichen Gegebenheiten des Projekts zu verifizieren und zu dokumentieren.
                </p>
                <p className="mb-3 text-sm">
                  Der Handwerker trägt als Fachunternehmer die alleinige Verantwortung dafür, dass sein in 
                  Stufe 2 bestätigtes finales Angebot fachlich korrekt, vollständig, kalkulatorisch richtig 
                  und realisierbar ist. Dies umfasst insbesondere die Verantwortung für zutreffende Mengenansätze, 
                  vollständige Leistungspositionen und realistische Preise.
                </p>
                <p className="text-sm">
                  Eine Berufung auf unzutreffende oder unvollständige Angaben in der KI-generierten Ausschreibung 
                  ist nach Bestätigung des Angebots in Stufe 2 grundsätzlich ausgeschlossen, da dem Handwerker 
                  als Fachunternehmer ausreichend Gelegenheit zur sachkundigen Prüfung, Korrektur und Ergänzung 
                  eingeräumt wurde. Etwaige Nachforderungen oder Nachträge aufgrund von Differenzen zwischen 
                  KI-Ausschreibung und tatsächlichem Leistungsumfang sind zwischen Handwerker und Bauherr zu 
                  klären; byndl ist insoweit nicht Ansprechpartner.
                </p>
              </div>
              <p className="mb-4">
                Darüber hinaus verpflichten sich Handwerker zur fachgerechten und termingerechten Ausführung 
                der übernommenen Aufträge sowie zur Einhaltung aller gesetzlichen und berufsrechtlichen 
                Vorschriften. Bei wiederholten Beschwerden oder mangelhafter Leistung kann byndl den Nutzer 
                von der Plattform ausschließen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 5 Vertragsabschluss zwischen Bauherr und Handwerker</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.1 Zweistufige Vergabe</h3>
              <p className="mb-4">
                Die Auftragsvergabe erfolgt in einem zweistufigen Verfahren, das sowohl dem Schutz beider 
                Vertragsparteien als auch der rechtlichen Klarstellung der Verantwortlichkeiten dient:
              </p>
              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <p className="font-semibold text-white mb-2">Stufe 1: Vorläufige Beauftragung (Vertragsanbahnung)</p>
                <p className="mb-3">
                  Nach Auswahl eines Angebots durch den Bauherrn werden in Stufe 1 die Kontaktdaten zwischen 
                  Bauherr und Handwerker freigegeben und eine Kennenlern- und Prüfphase eingeleitet. Die 
                  Vermittlung gilt ab diesem Zeitpunkt rechtlich als erfolgt und die Nachwirkfrist von 24 Monaten 
                  greift (siehe § 5.2). Die Vermittlungsprovision gemäß § 4.3 und § 4.4 wird jedoch erst in 
                  Stufe 2 bei verbindlicher Beauftragung und Zustandekommen des Werkvertrags fällig. Dies 
                  gewährleistet eine reine Erfolgsprovision ohne unproduktive Gebühren für Kontaktaufnahmen, 
                  die nicht zu einem Vertragsabschluss führen.
                </p>
                <p className="mb-3 font-semibold text-teal-300">Prüf- und Verifizierungsphase:</p>
                <p className="mb-4">
                  Während der Kennenlernphase sind beide Parteien ausdrücklich aufgefordert, das durch die 
                  KI-gestützte Plattform erstellte Leistungsverzeichnis und die Kostenschätzung eigenverantwortlich 
                  zu überprüfen. Der Handwerker erhält die Möglichkeit und ist verpflichtet, durch eine 
                  Vor-Ort-Besichtigung, einen Videocall oder auf anderem geeigneten Wege die tatsächlichen 
                  Gegebenheiten des Projekts zu prüfen und sein Angebot entsprechend zu verifizieren, anzupassen 
                  oder zu bestätigen. Der Bauherr kann seinerseits Änderungswünsche einbringen und die Eignung 
                  des Handwerkers prüfen. Beide Seiten haben faire Ausstiegsmöglichkeiten, falls sich herausstellt, 
                  dass eine Zusammenarbeit nicht zustande kommen soll.
                </p>
                
                <p className="font-semibold text-white mb-2">Stufe 2: Verbindliche Beauftragung (Werkvertrag)</p>
                <p className="mb-3">
                  Nach Abschluss der Prüfungsphase und eventueller Feinabstimmung (z.B. Vor-Ort-Besichtigung, 
                  Anpassung der Leistungsbeschreibung, Präzisierung der Mengen und Preise) bestätigt der Handwerker 
                  sein finales, verbindliches Angebot durch Klick auf die entsprechende Schaltfläche in der 
                  Plattform. Anschließend erteilt der Bauherr durch Klick auf „verbindlich beauftragen" die 
                  Auftragserteilung. Mit diesem Bestätigungsvorgang kommt der Werkvertrag ausschließlich zwischen 
                  Bauherr und Handwerker zustande.
                </p>
                <p className="mb-3">
                  Der Werkvertrag regelt alle Details der Leistungserbringung, Vergütung, Termine und Gewährleistung. 
                  Mit Zustandekommen des Werkvertrags wird die Vermittlungsprovision an byndl fällig und die 
                  Premium-Plattform-Features werden freigeschaltet (Kosten- und Terminkontrolle, Nachtragsschutz, 
                  Rechnungslauf, Projekt-Chat etc.).
                </p>
                
                <div className="bg-amber-900/40 border border-amber-500/50 rounded p-3 mt-3">
                  <p className="font-semibold text-amber-300 mb-2">Eigenverantwortung und Haftungsübernahme des Handwerkers</p>
                  <p className="text-sm text-amber-100 mb-2">
                    Mit der Bestätigung seines finalen Angebots in Stufe 2 übernimmt der Handwerker (als 
                    Unternehmer im Sinne von § 14 BGB) die ausschließliche und vollständige Verantwortung für 
                    die Richtigkeit, Vollständigkeit und Durchführbarkeit seines Angebots. Die durch byndl 
                    bereitgestellte KI-gestützte Ausschreibung dient lediglich als erste, unverbindliche Orientierung.
                  </p>
                  <p className="text-sm text-amber-100 mb-2">
                    Durch die in Stufe 1 eingeräumte Möglichkeit zur eigenständigen Prüfung und Verifizierung 
                    der Projektgegebenheiten (insbesondere durch Ortsbesichtigung oder Videocall) trägt der 
                    Handwerker das ausschließliche unternehmerische Risiko für Fehlkalkulationen, unzutreffende 
                    Mengenansätze oder unvollständige Leistungsbeschreibungen in seinem finalen Angebot.
                  </p>
                  <p className="text-sm text-amber-100">
                    Die Haftung von byndl gegenüber dem Handwerker für die Richtigkeit oder Vollständigkeit 
                    der in Stufe 1 bereitgestellten Ausschreibungsunterlagen ist - soweit rechtlich zulässig - 
                    auf Vorsatz und grobe Fahrlässigkeit beschränkt. Für leichte Fahrlässigkeit haftet byndl 
                    nicht, es sei denn, es handelt sich um die Verletzung wesentlicher Vertragspflichten. 
                    In diesem Fall ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt. 
                    Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit 
                    bleibt unberührt.
                  </p>
                </div>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.2 Nachwirkfrist (24 Monate)</h3>
              <div className="bg-blue-900/30 border-l-4 border-blue-400 p-4 mb-4">
                <p className="font-semibold text-blue-300 mb-3">Schutz der Vermittlungsleistung</p>
                <p className="mb-3">
                  Ab dem Zeitpunkt der Kontaktfreigabe in Stufe 1 (Vorläufige Beauftragung) greift eine 
                  Nachwirkfrist von 24 Monaten. Diese Frist schützt die Vermittlungsleistung von byndl und 
                  stellt sicher, dass die Plattform für die erfolgreiche Zusammenführung von Bauherr und 
                  Handwerker angemessen vergütet wird.
                </p>
                <p className="mb-3 font-semibold text-white">Was bedeutet die Nachwirkfrist konkret?</p>
                <p className="mb-3">
                  Kommt innerhalb von 24 Monaten nach der Kontaktfreigabe ein Vertrag zwischen dem Bauherrn 
                  und dem vermittelten Handwerker zustande – unabhängig davon, ob dieser Vertrag über die 
                  Plattform oder außerhalb der Plattform geschlossen wird – gilt dieser Vertrag als durch 
                  byndl vermittelt. Die Vermittlungsprovision gemäß § 4.3 und § 4.4 bleibt in diesem Fall fällig.
                </p>
                <p className="mb-3">
                  Dies gilt für dasselbe Projekt sowie für vergleichbare oder Folgeprojekte zwischen denselben 
                  Vertragsparteien.
                </p>
                <p className="font-semibold text-white mb-2">Zweck und Fairness:</p>
                <p>
                  Die Nachwirkfrist verhindert eine Umgehung der Plattform und schützt byndl vor dem Szenario, 
                  dass Nutzer die Plattform lediglich zur kostenlosen Kontaktaufnahme nutzen und anschließend 
                  „offline" einen Vertrag schließen, um die Provision zu vermeiden. Gleichzeitig wird durch 
                  das zweistufige Modell sichergestellt, dass nur tatsächlich zustande gekommene Aufträge 
                  provisionspflichtig sind – es entstehen keine Kosten für bloße Kontaktaufnahmen ohne 
                  Vertragsabschluss.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.3 Direktes Vertragsverhältnis</h3>
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-4 mb-4">
                <p className="font-semibold text-teal-300 mb-2">Wichtig</p>
                <p>
                  Der Werkvertrag kommt ausschließlich zwischen Bauherr und Handwerker zustande. byndl ist 
                  nicht Vertragspartei und übernimmt keine Haftung für die Erfüllung, Qualität oder sonstige 
                  Aspekte des Werkvertrags. Alle Ansprüche aus dem Werkvertrag sind direkt zwischen Bauherr 
                  und Handwerker geltend zu machen.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 6 Umgehungsverbot</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.1 Verbot der Plattformumgehung</h3>
              <p className="mb-4">
                Es ist untersagt, die Plattform zu umgehen, indem Bauherr und Handwerker nach erfolgtem 
                Erstkontakt über byndl direkt außerhalb der Plattform einen Vertrag schließen, um die 
                Vermittlungsprovision zu vermeiden. Die Nachwirkfrist gemäß § 5.2 bleibt in jedem Fall 
                bestehen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.2 Vertragsstrafe</h3>
              <p className="mb-4">
                Bei vorsätzlicher Umgehung der Plattform verpflichtet sich der Handwerker zur Zahlung einer 
                Vertragsstrafe in Höhe der doppelten entgangenen Vermittlungsprovision, mindestens jedoch 
                2.500 Euro. Die Geltendmachung weitergehender Schadensersatzansprüche bleibt vorbehalten.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.3 Monitoring und Nachweis</h3>
              <p className="mb-4">
                byndl behält sich vor, Verstöße gegen das Umgehungsverbot durch technische und organisatorische 
                Maßnahmen zu überwachen. Die Kontaktfreigabe wird protokolliert und beide Parteien erhalten 
                Erinnerungen über ihre Verpflichtungen. Bei begründetem Verdacht auf Umgehung kann byndl 
                Nachforschungen anstellen und entsprechende Nachweise verlangen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 7 Pflichten der Nutzer</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.1 Allgemeine Pflichten</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Wahrheitsgemäße und vollständige Angaben bei Registrierung und Projekterfassung</li>
                <li>Einhaltung aller gesetzlichen Vorschriften</li>
                <li>Keine missbräuchliche Nutzung der Plattform</li>
                <li>Respektvoller Umgang mit anderen Nutzern</li>
                <li>Schutz der Zugangsdaten vor unbefugtem Zugriff</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.2 Verbotene Handlungen</h3>
              <p className="mb-2">Untersagt sind insbesondere:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Verbreitung rechtswidriger Inhalte</li>
                <li>Verletzung von Rechten Dritter</li>
                <li>Manipulation oder Sabotage der Plattform</li>
                <li>Automatisiertes Auslesen von Daten (Scraping)</li>
                <li>Erstellung von Fake-Profilen oder Fake-Projekten</li>
                <li>Spam oder unerwünschte Werbung</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.3 Besondere Pflichten der Handwerker</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Nachweis erforderlicher Qualifikationen und Genehmigungen</li>
                <li>Bestehen einer Betriebshaftpflichtversicherung</li>
                <li>Sorgfältige Prüfung und Verifizierung der KI-generierten Ausschreibungsunterlagen in Stufe 1 der zweistufigen Vergabe</li>
                <li>Eigenverantwortliche Überprüfung der Projektgegebenheiten (insbesondere durch Vor-Ort-Besichtigung oder Videocall)</li>
                <li>Fachgerechte Ausführung übernommener Aufträge</li>
                <li>Einhaltung zugesagter Termine</li>
                <li>Sachgerechte Kalkulation und realistische Angebote</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 8 Haftung und Gewährleistung</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.1 Haftungsbeschränkung für byndl</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-4 mb-4">
                <p className="font-semibold text-amber-300 mb-2">Wichtiger Haftungshinweis</p>
                
                <p className="mb-3 text-sm font-semibold text-white">a) Unbeschränkte Haftung</p>
                <p className="mb-3 text-sm">
                  byndl haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der 
                  Gesundheit, die auf einer vorsätzlichen oder fahrlässigen Pflichtverletzung von byndl oder 
                  deren gesetzlichen Vertretern oder Erfüllungsgehilfen beruhen. byndl haftet ferner unbeschränkt 
                  bei Vorsatz und grober Fahrlässigkeit sowie bei Ansprüchen nach dem Produkthaftungsgesetz.
                </p>
                
                <p className="mb-3 text-sm font-semibold text-white">b) Haftung bei Verletzung wesentlicher Vertragspflichten</p>
                <p className="mb-3 text-sm">
                  Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), deren 
                  Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren 
                  Einhaltung der Vertragspartner regelmäßig vertrauen darf, ist die Haftung von byndl der Höhe 
                  nach auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden begrenzt. Dies gilt 
                  nicht für Schäden gemäß lit. a).
                </p>
                
                <p className="mb-3 text-sm font-semibold text-white">c) Ausschluss der Haftung für leichte Fahrlässigkeit</p>
                <p className="mb-3 text-sm">
                  Im Übrigen ist die Haftung von byndl für leicht fahrlässige Pflichtverletzungen ausgeschlossen, 
                  soweit nicht Schäden gemäß lit. a) oder lit. b) betroffen sind.
                </p>
                
                <p className="mb-3 text-sm font-semibold text-white">d) Besondere Haftungsbegrenzung bei KI-gestützten Inhalten</p>
                <p className="text-sm">
                  Die Haftung von byndl für die Richtigkeit, Vollständigkeit oder Eignung der durch KI-Software 
                  erstellten Leistungsverzeichnisse und Kostenschätzungen ist - soweit rechtlich zulässig und 
                  vorbehaltlich der Regelungen in lit. a) bis c) - auf Vorsatz und grobe Fahrlässigkeit beschränkt. 
                  Dies gilt insbesondere, da durch die zweistufige Vergabe (§ 5.1) beiden Vertragsparteien 
                  ausdrücklich die Möglichkeit und Pflicht zur eigenverantwortlichen Prüfung und Verifizierung 
                  eingeräumt wird.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.2 Keine Haftung für Werkleistungen</h3>
              <p className="mb-4">
                byndl übernimmt ausdrücklich keine Haftung für die Qualität, Vollständigkeit, Termintreue 
                oder sonstige Aspekte der von Handwerkern erbrachten Werkleistungen. Alle entsprechenden 
                Ansprüche sind ausschließlich gegenüber dem Handwerker geltend zu machen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.3 Haftungsbeschränkung für Nutzerinhalte und KI-generierte Ausschreibungen</h3>
              <p className="mb-3">
                byndl übernimmt keine Haftung für von Nutzern eingestellte Inhalte, Angaben oder Angebote. 
                Die Nutzer sind selbst für die Richtigkeit und Rechtmäßigkeit ihrer Angaben verantwortlich.
              </p>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-3 mb-4">
                <p className="font-semibold text-amber-300 mb-2">Besondere Haftungsbegrenzung für KI-Ausschreibungen</p>
                <p className="text-sm mb-3">
                  Die Haftung von byndl für die Richtigkeit, Vollständigkeit oder Eignung der durch die 
                  KI-Software erstellten Leistungsverzeichnisse und Kostenschätzungen richtet sich nach § 8.1 
                  dieser AGB und ist - vorbehaltlich zwingender gesetzlicher Haftungstatbestände - auf Vorsatz 
                  und grobe Fahrlässigkeit beschränkt. Diese dienen ausschließlich als erste, unverbindliche 
                  Orientierung für die Vertragsanbahnung.
                </p>
                <p className="text-sm mb-3">
                  Durch die in § 5.1 geregelte zweistufige Vergabe mit obligatorischer Prüf- und Verifizierungsphase 
                  wird sowohl dem Bauherrn als auch dem Handwerker ausdrücklich die Möglichkeit und Pflicht 
                  eingeräumt, die KI-generierten Unterlagen eigenverantwortlich zu überprüfen, zu korrigieren 
                  und zu ergänzen. Der Handwerker als Fachunternehmer übernimmt mit Bestätigung seines finalen 
                  Angebots in Stufe 2 die ausschließliche fachliche und kalkulatorische Verantwortung für dessen 
                  Richtigkeit und Vollständigkeit.
                </p>
                <p className="text-sm mb-3">
                  Ansprüche aus fehlerhaften oder unvollständigen Leistungsbeschreibungen, Mengenansätzen oder 
                  Kalkulationen, die nach erfolgter Verifizierungsphase in das finale Angebot übernommen wurden, 
                  sind vorrangig zwischen Bauherr und Handwerker zu klären. Der Handwerker kann sich gegenüber 
                  dem Bauherrn nicht auf Unrichtigkeit der KI-generierten Ausschreibung berufen, wenn er die 
                  Möglichkeit zur Prüfung und Korrektur hatte.
                </p>
                <p className="text-sm">
                  byndl haftet nicht für mittelbare Schäden, entgangenen Gewinn oder Folgeschäden, die aus der 
                  Nutzung der KI-generierten Inhalte entstehen, es sei denn, diese beruhen auf Vorsatz oder 
                  grober Fahrlässigkeit von byndl. Die Haftung für Schäden aus der Verletzung des Lebens, 
                  des Körpers oder der Gesundheit bleibt hiervon unberührt.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.4 Technische Verfügbarkeit</h3>
              <p className="mb-4">
                byndl bemüht sich um eine hohe Verfügbarkeit der Plattform, kann diese aber nicht garantieren. 
                Insbesondere Wartungsarbeiten, technische Störungen oder höhere Gewalt können zu 
                vorübergehenden Ausfällen führen. Ein Anspruch auf jederzeitige Verfügbarkeit besteht nicht.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.5 Freistellung</h3>
              <p className="mb-3">
                Der Nutzer stellt byndl von allen Ansprüchen Dritter frei, die auf einer rechtswidrigen oder 
                vertragswidrigen Nutzung der Plattform durch den Nutzer beruhen. Dies umfasst auch die 
                angemessenen Kosten der Rechtsverteidigung.
              </p>
              <div className="bg-blue-900/20 border-l-4 border-blue-400 p-3 mb-4">
                <p className="font-semibold text-blue-300 mb-2 text-sm">Besondere Freistellung für Handwerker</p>
                <p className="text-sm">
                  Der Handwerker stellt byndl insbesondere von allen Ansprüchen des Bauherrn frei, die auf 
                  unzutreffenden, unvollständigen oder fehlerhaften Angaben in seinem finalen Angebot beruhen, 
                  wenn diese Fehler durch sorgfältige Prüfung und Verifizierung in Stufe 1 der zweistufigen 
                  Vergabe hätten erkannt und korrigiert werden können. Der Handwerker verpflichtet sich, byndl 
                  von sämtlichen Regressansprüchen freizuhalten, die sich aus mangelhafter Prüfung der 
                  KI-generierten Ausschreibungsunterlagen ergeben.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 9 Datenschutz</h2>
              
              <p className="mb-4">
                byndl verarbeitet personenbezogene Daten im Einklang mit der Datenschutz-Grundverordnung (DSGVO) 
                und dem Bundesdatenschutzgesetz (BDSG). Nähere Informationen sind in der 
                <Link to="/datenschutz" className="text-teal-400 hover:text-teal-300 underline mx-1">
                  Datenschutzerklärung
                </Link>
                zu finden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 10 Änderungen der AGB</h2>
              
              <p className="mb-4">
                byndl behält sich vor, diese AGB mit Wirkung für die Zukunft zu ändern. Registrierte Nutzer 
                werden über Änderungen per E-Mail informiert. Widerspricht der Nutzer der Geltung der neuen 
                AGB nicht innerhalb von vier Wochen nach Zugang der Änderungsmitteilung, gelten die neuen 
                AGB als akzeptiert. byndl wird in der Änderungsmitteilung auf die Widerspruchsmöglichkeit 
                und die Bedeutung der Widerspruchsfrist hinweisen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 11 Laufzeit und Kündigung</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">11.1 Laufzeit</h3>
              <p className="mb-4">
                Der Nutzungsvertrag wird auf unbestimmte Zeit geschlossen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">11.2 Ordentliche Kündigung</h3>
              <p className="mb-4">
                Beide Parteien können den Vertrag jederzeit mit einer Frist von 14 Tagen zum Monatsende kündigen. 
                Die Kündigung bedarf der Textform (E-Mail ausreichend).
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">11.3 Außerordentliche Kündigung</h3>
              <p className="mb-4">
                Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger 
                Grund liegt insbesondere vor bei schwerwiegenden Verstößen gegen diese AGB, missbräuchlicher 
                Nutzung der Plattform oder Zahlungsverzug trotz Mahnung.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">11.4 Folgen der Beendigung</h3>
              <p className="mb-4">
                Mit Beendigung des Nutzungsvertrags wird der Zugang zur Plattform gesperrt. Bereits begonnene 
                Vermittlungen werden zu Ende geführt. Noch offene Zahlungsverpflichtungen bleiben bestehen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 12 Streitbeilegung</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">12.1 Interne Streitbeilegung</h3>
              <p className="mb-4">
                Bei Streitigkeiten zwischen Nutzern (insbesondere zwischen Bauherr und Handwerker) bietet 
                byndl ein optionales Schlichtungsverfahren an. Die Teilnahme ist freiwillig und kostenpflichtig 
                gemäß gesonderter Gebührenordnung.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">12.2 Online-Streitbeilegung</h3>
              <p className="mb-4">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" 
                   className="text-teal-400 hover:text-teal-300 underline ml-1">
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">12.3 Verbraucherschlichtung</h3>
              <p className="mb-4">
                byndl ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">§ 13 Schlussbestimmungen</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.1 Anwendbares Recht</h3>
              <p className="mb-4">
                Für diese AGB und alle Rechtsbeziehungen zwischen byndl und dem Nutzer gilt das Recht der 
                Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG). Bei Verbrauchern gilt 
                diese Rechtswahl nur insoweit, als nicht der gewährte Schutz durch zwingene Bestimmungen des 
                Rechts des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, entzogen wird.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.2 Gerichtsstand</h3>
              <p className="mb-4">
                Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches 
                Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag 
                der Sitz von byndl. Dasselbe gilt, wenn der Nutzer keinen allgemeinen Gerichtsstand in Deutschland 
                hat oder Wohnsitz oder gewöhnlicher Aufenthalt im Zeitpunkt der Klageerhebung nicht bekannt sind.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.3 Salvatorische Klausel</h3>
              <p className="mb-4">
                Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies die 
                Wirksamkeit der übrigen Bestimmungen nicht. An die Stelle der unwirksamen Bestimmung tritt 
                eine Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.4 Abtretung</h3>
              <p className="mb-4">
                Der Nutzer darf seine Rechte und Pflichten aus dem Nutzungsvertrag nur mit vorheriger 
                schriftlicher Zustimmung von byndl auf Dritte übertragen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.5 Kontakt</h3>
              <p className="mb-4">
                Bei Fragen zu diesen AGB wenden Sie sich bitte an:
              </p>
              <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                <p className="font-semibold text-white">byndl UG (haftungsbeschränkt)</p>
                <p className="text-gray-300">E-Mail: info@byndl.de</p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 byndl UG (haftungsbeschränkt) - Alle Rechte vorbehalten
          </p>
        </div>
      </footer>
    </div>
  );
}
