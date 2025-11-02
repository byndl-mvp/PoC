import React from 'react';
import { Link } from 'react-router-dom';

export default function Datenschutz() {
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
          <h1 className="text-4xl font-bold text-white mb-8">Datenschutzerklärung</h1>
          
          <div className="text-gray-200 space-y-8">
            <section>
              <p className="text-sm text-gray-400 mb-4">Stand: Januar 2025</p>
              <p className="mb-4">
                Wir freuen uns über Ihr Interesse an unserer Plattform. Der Schutz Ihrer personenbezogenen Daten 
                ist uns ein wichtiges Anliegen. Nachfolgend informieren wir Sie ausführlich über den Umgang mit 
                Ihren Daten.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">1. Verantwortlicher</h2>
              
              <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                <p className="text-lg font-semibold text-white mb-2">Verantwortlich für die Datenverarbeitung ist:</p>
                <p className="text-gray-200">byndl UG (haftungsbeschränkt)</p>
                <p className="text-gray-300">[Straße und Hausnummer]</p>
                <p className="text-gray-300">[PLZ] [Ort]</p>
                <p className="text-gray-300 mt-3">E-Mail: info@byndl.de</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">2. Allgemeines zur Datenverarbeitung</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.1 Umfang der Verarbeitung personenbezogener Daten</h3>
              <p className="mb-4">
                Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur 
                Bereitstellung einer funktionsfähigen Plattform sowie unserer Inhalte und Leistungen erforderlich 
                ist. Die Verarbeitung personenbezogener Daten erfolgt regelmäßig nur nach Einwilligung des Nutzers. 
                Eine Ausnahme gilt in solchen Fällen, in denen eine vorherige Einholung einer Einwilligung aus 
                tatsächlichen Gründen nicht möglich ist und die Verarbeitung der Daten durch gesetzliche Vorschriften 
                gestattet ist.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.2 Rechtsgrundlage für die Verarbeitung personenbezogener Daten</h3>
              <div className="space-y-3 mb-4">
                <p>
                  <span className="font-semibold text-white">Art. 6 Abs. 1 lit. a DSGVO</span> dient als 
                  Rechtsgrundlage für Verarbeitungsvorgänge, bei denen wir eine Einwilligung für einen bestimmten 
                  Verarbeitungszweck einholen.
                </p>
                <p>
                  <span className="font-semibold text-white">Art. 6 Abs. 1 lit. b DSGVO</span> ist die 
                  Rechtsgrundlage für die Verarbeitung, die zur Erfüllung eines Vertrages erforderlich ist, 
                  dessen Vertragspartei die betroffene Person ist. Dies gilt auch für vorvertragliche Maßnahmen.
                </p>
                <p>
                  <span className="font-semibold text-white">Art. 6 Abs. 1 lit. c DSGVO</span> gilt, wenn die 
                  Verarbeitung zur Erfüllung einer rechtlichen Verpflichtung erforderlich ist.
                </p>
                <p>
                  <span className="font-semibold text-white">Art. 6 Abs. 1 lit. f DSGVO</span> ist die Grundlage 
                  für die Verarbeitung, die zur Wahrung unserer berechtigten Interessen erforderlich ist, sofern 
                  nicht die Interessen oder Grundrechte der betroffenen Person überwiegen.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.3 Datenlöschung und Speicherdauer</h3>
              <p className="mb-4">
                Die personenbezogenen Daten der betroffenen Person werden gelöscht oder gesperrt, sobald der Zweck 
                der Speicherung entfällt. Eine Speicherung kann darüber hinaus erfolgen, wenn dies durch den 
                europäischen oder nationalen Gesetzgeber in unionsrechtlichen Verordnungen, Gesetzen oder sonstigen 
                Vorschriften, denen der Verantwortliche unterliegt, vorgesehen wurde. Eine Sperrung oder Löschung 
                der Daten erfolgt auch dann, wenn eine durch die genannten Normen vorgeschriebene Speicherfrist 
                abläuft, es sei denn, dass eine Erforderlichkeit zur weiteren Speicherung der Daten für einen 
                Vertragsabschluss oder eine Vertragserfüllung besteht.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">3. Bereitstellung der Website und Erstellung von Logfiles</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.1 Beschreibung und Umfang der Datenverarbeitung</h3>
              <p className="mb-4">
                Bei jedem Aufruf unserer Internetseite erfasst unser System automatisiert Daten und Informationen 
                vom Computersystem des aufrufenden Rechners. Folgende Daten werden hierbei erhoben:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Informationen über den Browsertyp und die verwendete Version</li>
                <li>Das Betriebssystem des Nutzers</li>
                <li>Den Internet-Service-Provider des Nutzers</li>
                <li>Die IP-Adresse des Nutzers</li>
                <li>Datum und Uhrzeit des Zugriffs</li>
                <li>Websites, von denen das System des Nutzers auf unsere Internetseite gelangt</li>
                <li>Websites, die vom System des Nutzers über unsere Website aufgerufen werden</li>
              </ul>
              <p className="mb-4">
                Die Daten werden in den Logfiles unseres Systems gespeichert. Eine Speicherung dieser Daten 
                zusammen mit anderen personenbezogenen Daten des Nutzers findet nicht statt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.2 Rechtsgrundlage</h3>
              <p className="mb-4">
                Rechtsgrundlage für die vorübergehende Speicherung der Daten und der Logfiles ist Art. 6 Abs. 1 
                lit. f DSGVO.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.3 Zweck der Datenverarbeitung</h3>
              <p className="mb-4">
                Die vorübergehende Speicherung der IP-Adresse durch das System ist notwendig, um eine Auslieferung 
                der Website an den Rechner des Nutzers zu ermöglichen. Hierfür muss die IP-Adresse des Nutzers für 
                die Dauer der Sitzung gespeichert bleiben. Die Speicherung in Logfiles erfolgt, um die 
                Funktionsfähigkeit der Website sicherzustellen. Zudem dienen uns die Daten zur Optimierung der 
                Website und zur Sicherstellung der Sicherheit unserer informationstechnischen Systeme.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.4 Dauer der Speicherung</h3>
              <p className="mb-4">
                Die Daten werden gelöscht, sobald sie für die Erreichung des Zweckes ihrer Erhebung nicht mehr 
                erforderlich sind. Im Falle der Erfassung der Daten zur Bereitstellung der Website ist dies der 
                Fall, wenn die jeweilige Sitzung beendet ist. Die Logfiles werden nach spätestens 7 Tagen gelöscht.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">4. Registrierung</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.1 Beschreibung und Umfang der Datenverarbeitung</h3>
              <p className="mb-4">
                Auf unserer Plattform bieten wir Nutzern die Möglichkeit, sich unter Angabe personenbezogener 
                Daten zu registrieren. Die Daten werden dabei in eine Eingabemaske eingegeben und an uns übermittelt 
                und gespeichert.
              </p>
              <p className="mb-4">
                <span className="font-semibold text-white">Für Bauherren werden folgende Daten erhoben:</span>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Vor- und Nachname</li>
                <li>E-Mail-Adresse</li>
                <li>Telefonnummer (optional)</li>
                <li>Anschrift des Projekts</li>
                <li>Projektbeschreibung</li>
              </ul>
              <p className="mb-4">
                <span className="font-semibold text-white">Für Handwerksbetriebe werden folgende Daten erhoben:</span>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Firmenname</li>
                <li>Vor- und Nachname des Ansprechpartners</li>
                <li>E-Mail-Adresse</li>
                <li>Telefonnummer</li>
                <li>Geschäftsadresse</li>
                <li>Gewerbeanmeldung / Handelsregisternummer</li>
                <li>Gewerke und Tätigkeitsbereiche</li>
                <li>Einsatzradius</li>
                <li>Versicherungsnachweise</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.2 Rechtsgrundlage</h3>
              <p className="mb-4">
                Rechtsgrundlage für die Verarbeitung der Daten ist bei Vorliegen einer Einwilligung des Nutzers 
                Art. 6 Abs. 1 lit. a DSGVO. Dient die Registrierung der Erfüllung eines Vertrages, dessen 
                Vertragspartei der Nutzer ist oder der Durchführung vorvertraglicher Maßnahmen, so ist zusätzliche 
                Rechtsgrundlage für die Verarbeitung der Daten Art. 6 Abs. 1 lit. b DSGVO.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.3 Zweck der Datenverarbeitung</h3>
              <p className="mb-4">
                Eine Registrierung des Nutzers ist zur Erfüllung eines Vertrages mit dem Nutzer oder zur 
                Durchführung vorvertraglicher Maßnahmen erforderlich. Die Registrierung ermöglicht die Nutzung 
                der Vermittlungsplattform, die Erstellung von Projekten durch Bauherren sowie die Abgabe von 
                Angeboten durch Handwerker.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.4 Dauer der Speicherung</h3>
              <p className="mb-4">
                Die Daten werden gelöscht, sobald sie für die Erreichung des Zweckes ihrer Erhebung nicht mehr 
                erforderlich sind. Dies ist für die während des Registrierungsvorgangs erhobenen Daten der Fall, 
                wenn die Registrierung auf unserer Internetseite aufgehoben oder abgeändert wird. Während der 
                Vertragslaufzeit sowie zur Erfüllung gesetzlicher Aufbewahrungspflichten (z.B. Handels- und 
                Steuerrecht) werden die Daten länger gespeichert.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">5. Kontaktformular und E-Mail-Kontakt</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.1 Beschreibung und Umfang der Datenverarbeitung</h3>
              <p className="mb-4">
                Auf unserer Internetseite ist ein Kontaktformular vorhanden, welches für die elektronische 
                Kontaktaufnahme genutzt werden kann. Nimmt ein Nutzer diese Möglichkeit wahr, so werden die in 
                der Eingabemaske eingegeben Daten an uns übermittelt und gespeichert. Diese Daten sind:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Name</li>
                <li>E-Mail-Adresse</li>
                <li>Nachricht</li>
              </ul>
              <p className="mb-4">
                Alternativ ist eine Kontaktaufnahme über die bereitgestellte E-Mail-Adresse möglich. In diesem 
                Fall werden die mit der E-Mail übermittelten personenbezogenen Daten des Nutzers gespeichert.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.2 Rechtsgrundlage</h3>
              <p className="mb-4">
                Rechtsgrundlage für die Verarbeitung der Daten ist bei Vorliegen einer Einwilligung des Nutzers 
                Art. 6 Abs. 1 lit. a DSGVO. Rechtsgrundlage für die Verarbeitung der Daten, die im Zuge einer 
                Übersendung einer E-Mail übermittelt werden, ist Art. 6 Abs. 1 lit. f DSGVO.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.3 Dauer der Speicherung</h3>
              <p className="mb-4">
                Die Daten werden gelöscht, sobald sie für die Erreichung des Zweckes ihrer Erhebung nicht mehr 
                erforderlich sind. Für die personenbezogenen Daten aus der Eingabemaske des Kontaktformulars und 
                diejenigen, die per E-Mail übersandt wurden, ist dies dann der Fall, wenn die jeweilige Konversation 
                mit dem Nutzer beendet ist.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">6. Verwendung von Cookies</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.1 Beschreibung und Umfang der Datenverarbeitung</h3>
              <p className="mb-4">
                Unsere Webseite verwendet Cookies. Bei Cookies handelt es sich um Textdateien, die im 
                Internetbrowser bzw. vom Internetbrowser auf dem Computersystem des Nutzers gespeichert werden. 
                Ruft ein Nutzer eine Website auf, so kann ein Cookie auf dem Betriebssystem des Nutzers gespeichert 
                werden. Dieser Cookie enthält eine charakteristische Zeichenfolge, die eine eindeutige 
                Identifizierung des Browsers beim erneuten Aufrufen der Website ermöglicht.
              </p>
              <p className="mb-4">
                Wir setzen Cookies ein, um unsere Website nutzerfreundlicher zu gestalten. Einige Elemente unserer 
                Internetseite erfordern es, dass der aufrufende Browser auch nach einem Seitenwechsel identifiziert 
                werden kann.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.2 Rechtsgrundlage</h3>
              <p className="mb-4">
                Die Rechtsgrundlage für die Verarbeitung personenbezogener Daten unter Verwendung technisch 
                notwendiger Cookies ist Art. 6 Abs. 1 lit. f DSGVO. Die Rechtsgrundlage für die Verarbeitung 
                personenbezogener Daten unter Verwendung von Cookies zu Analysezwecken ist bei Vorliegen einer 
                diesbezüglichen Einwilligung des Nutzers Art. 6 Abs. 1 lit. a DSGVO.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.3 Zweck der Datenverarbeitung</h3>
              <p className="mb-4">
                Der Zweck der Verwendung technisch notwendiger Cookies ist, die Nutzung von Websites für die 
                Nutzer zu vereinfachen. Einige Funktionen unserer Internetseite können ohne den Einsatz von 
                Cookies nicht angeboten werden. Für diese ist es erforderlich, dass der Browser auch nach einem 
                Seitenwechsel wiedererkannt wird.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.4 Widerspruchs- und Beseitigungsmöglichkeit</h3>
              <p className="mb-4">
                Cookies werden auf dem Rechner des Nutzers gespeichert und von diesem an unsere Seite übermittelt. 
                Daher haben Sie als Nutzer auch die volle Kontrolle über die Verwendung von Cookies. Durch eine 
                Änderung der Einstellungen in Ihrem Internetbrowser können Sie die Übertragung von Cookies 
                deaktivieren oder einschränken. Bereits gespeicherte Cookies können jederzeit gelöscht werden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">7. KI-gestützte Projekterfassung</h2>
              
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-6 mb-4">
                <h3 className="text-xl font-semibold text-teal-300 mb-3">Besonderheiten der KI-Verarbeitung</h3>
                <p className="mb-4">
                  Im Rahmen der Projekterfassung nutzen wir künstliche Intelligenz zur automatischen Erstellung 
                  von Leistungsverzeichnissen und Kostenschätzungen. Hierbei werden die von Ihnen eingegebenen 
                  Projektbeschreibungen, Bilder und sonstigen Informationen verarbeitet.
                </p>
                <p className="mb-4">
                  <span className="font-semibold text-white">Verarbeitete Daten:</span>
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>Projektbeschreibungen (Texteingaben)</li>
                  <li>Hochgeladene Bilder und Pläne</li>
                  <li>Angaben zu Räumen, Flächen, gewünschten Materialien</li>
                  <li>Standortdaten (zur regionalen Preisermittlung)</li>
                </ul>
                <p className="mb-4">
                  <span className="font-semibold text-white">Zweck:</span> Die KI analysiert Ihre Eingaben, 
                  um automatisiert ein strukturiertes Leistungsverzeichnis und eine Kostenschätzung zu erstellen.
                </p>
                <p>
                  <span className="font-semibold text-white">Rechtsgrundlage:</span> Art. 6 Abs. 1 lit. b DSGVO 
                  (Vertragserfüllung) und Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
                </p>
              </div>

              <p className="mb-4">
                Die von der KI generierten Daten werden zur Verbesserung der Algorithmen verwendet. Eine 
                Weitergabe an Dritte erfolgt nicht. Sie können der Nutzung Ihrer Daten zur Verbesserung der 
                KI jederzeit widersprechen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">8. Weitergabe von Daten an Dritte</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.1 Vermittlung zwischen Bauherren und Handwerkern</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-4 mb-4">
                <p className="font-semibold text-amber-300 mb-2">Wichtiger Hinweis</p>
                <p>
                  Im Rahmen der Vermittlungstätigkeit werden bestimmte Daten zwischen Bauherren und Handwerkern 
                  ausgetauscht. Dies erfolgt ausschließlich zum Zweck der Vertragsanbahnung und -durchführung.
                </p>
              </div>
              <p className="mb-4">
                <span className="font-semibold text-white">Bauherren sehen von Handwerkern:</span>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Firmenname und Geschäftsadresse</li>
                <li>Kontaktdaten (nach Phase 1 der Vergabe)</li>
                <li>Gewerke und Qualifikationen</li>
                <li>Angebote und Kostenschätzungen</li>
                <li>Bewertungen anderer Nutzer</li>
              </ul>
              <p className="mb-4">
                <span className="font-semibold text-white">Handwerker sehen von Bauherren:</span>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>Projektbeschreibung und Leistungsverzeichnis</li>
                <li>Standort des Projekts (Ort, nicht vollständige Adresse)</li>
                <li>Kontaktdaten (erst nach Phase 1 der Vergabe)</li>
                <li>Gewünschter Ausführungszeitraum</li>
              </ul>
              <p className="mb-4">
                <span className="font-semibold text-white">Rechtsgrundlage:</span> Art. 6 Abs. 1 lit. b DSGVO 
                (Vertragserfüllung).
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.2 Zahlungsdienstleister</h3>
              <p className="mb-4">
                Zur Abwicklung von Zahlungen arbeiten wir mit externen Zahlungsdienstleistern zusammen. Dabei 
                werden die für die Zahlungsabwicklung erforderlichen Daten an den jeweiligen Dienstleister 
                übermittelt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.3 Hosting-Provider</h3>
              <p className="mb-4">
                Unsere Website wird bei einem externen Dienstleister gehostet (Hoster). Die personenbezogenen 
                Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert. 
                Der Hoster verarbeitet die Daten ausschließlich nach unserer Weisung und ist durch einen 
                Auftragsverarbeitungsvertrag gebunden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">9. Rechte der betroffenen Person</h2>
              
              <p className="mb-4">
                Werden personenbezogene Daten von Ihnen verarbeitet, sind Sie Betroffener i.S.d. DSGVO und es 
                stehen Ihnen folgende Rechte gegenüber dem Verantwortlichen zu:
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.1 Auskunftsrecht (Art. 15 DSGVO)</h3>
              <p className="mb-4">
                Sie können von uns eine Bestätigung darüber verlangen, ob personenbezogene Daten, die Sie 
                betreffen, von uns verarbeitet werden. Liegt eine solche Verarbeitung vor, können Sie von uns 
                Auskunft über diese Daten verlangen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.2 Recht auf Berichtigung (Art. 16 DSGVO)</h3>
              <p className="mb-4">
                Sie haben ein Recht auf Berichtigung und/oder Vervollständigung, sofern die verarbeiteten 
                personenbezogenen Daten, die Sie betreffen, unrichtig oder unvollständig sind.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.3 Recht auf Löschung (Art. 17 DSGVO)</h3>
              <p className="mb-4">
                Sie können von uns verlangen, dass die Sie betreffenden personenbezogenen Daten unverzüglich 
                gelöscht werden, sofern einer der gesetzlichen Gründe zutrifft und soweit die Verarbeitung nicht 
                erforderlich ist.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.4 Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</h3>
              <p className="mb-4">
                Sie haben das Recht, von uns die Einschränkung der Verarbeitung zu verlangen, wenn eine der 
                gesetzlichen Voraussetzungen gegeben ist.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.5 Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</h3>
              <p className="mb-4">
                Sie haben das Recht, die Sie betreffenden personenbezogenen Daten, die Sie uns bereitgestellt 
                haben, in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten. Außerdem haben 
                Sie das Recht, diese Daten einem anderen Verantwortlichen zu übermitteln.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.6 Widerspruchsrecht (Art. 21 DSGVO)</h3>
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-6 mb-4">
                <p className="font-semibold text-teal-300 mb-3">Wichtiges Widerspruchsrecht</p>
                <p className="mb-3">
                  Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit 
                  gegen die Verarbeitung der Sie betreffenden personenbezogenen Daten, die aufgrund von 
                  Art. 6 Abs. 1 lit. e oder f DSGVO erfolgt, Widerspruch einzulegen.
                </p>
                <p>
                  Der Verantwortliche verarbeitet die Sie betreffenden personenbezogenen Daten nicht mehr, es 
                  sei denn, er kann zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre 
                  Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, 
                  Ausübung oder Verteidigung von Rechtsansprüchen.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.7 Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO)</h3>
              <p className="mb-4">
                Sie haben das Recht, Ihre datenschutzrechtliche Einwilligungserklärung jederzeit zu widerrufen. 
                Durch den Widerruf der Einwilligung wird die Rechtmäßigkeit der aufgrund der Einwilligung bis 
                zum Widerruf erfolgten Verarbeitung nicht berührt.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.8 Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</h3>
              <p className="mb-4">
                Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs steht 
                Ihnen das Recht auf Beschwerde bei einer Aufsichtsbehörde, insbesondere in dem Mitgliedstaat 
                ihres Aufenthaltsorts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes, zu, wenn 
                Sie der Ansicht sind, dass die Verarbeitung der Sie betreffenden personenbezogenen Daten gegen 
                die DSGVO verstößt.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">10. Datensicherheit</h2>
              
              <p className="mb-4">
                Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure Socket Layer) 
                in Verbindung mit der jeweils höchsten Verschlüsselungsstufe, die von Ihrem Browser unterstützt 
                wird. In der Regel handelt es sich dabei um eine 256-Bit-Verschlüsselung. Falls Ihr Browser keine 
                256-Bit-Verschlüsselung unterstützt, greifen wir stattdessen auf 128-Bit-v3-Technologie zurück.
              </p>
              <p className="mb-4">
                Wir bedienen uns im Übrigen geeigneter technischer und organisatorischer Sicherheitsmaßnahmen, 
                um Ihre Daten gegen zufällige oder vorsätzliche Manipulationen, teilweisen oder vollständigen 
                Verlust, Zerstörung oder gegen den unbefugten Zugriff Dritter zu schützen. Unsere 
                Sicherheitsmaßnahmen werden entsprechend der technologischen Entwicklung fortlaufend verbessert.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">11. Aktualität und Änderung dieser Datenschutzerklärung</h2>
              
              <p className="mb-4">
                Diese Datenschutzerklärung ist aktuell gültig und hat den Stand Januar 2025. Durch die 
                Weiterentwicklung unserer Website und Angebote darüber oder aufgrund geänderter gesetzlicher 
                beziehungsweise behördlicher Vorgaben kann es notwendig werden, diese Datenschutzerklärung zu 
                ändern. Die jeweils aktuelle Datenschutzerklärung kann jederzeit auf der Website von Ihnen 
                abgerufen und ausgedruckt werden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">12. Kontakt</h2>
              
              <p className="mb-4">
                Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an:
              </p>
              <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                <p className="font-semibold text-white">byndl UG (haftungsbeschränkt)</p>
                <p className="text-gray-300">[Adresse]</p>
                <p className="text-gray-300 mt-3">E-Mail: info@byndl.de</p>
              </div>
            </section>
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
            to="/agb"
            className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-all text-center"
          >
            <p className="text-teal-400 font-semibold">AGB</p>
          </Link>
          <Link
            to="/disclaimer"
            className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-all text-center"
          >
            <p className="text-teal-400 font-semibold">Disclaimer</p>
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
