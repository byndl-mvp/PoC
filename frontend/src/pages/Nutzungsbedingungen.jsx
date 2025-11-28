import React from 'react';
import { Link } from 'react-router-dom';

export default function Nutzungsbedingungen() {
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
          <h1 className="text-4xl font-bold text-white mb-4">Nutzungsbedingungen</h1>
          <p className="text-gray-400 mb-8">für die Nutzung der Plattform byndl</p>
          
          {/* Inhaltsverzeichnis */}
          <nav className="bg-white/5 rounded-xl p-6 mb-10 border border-white/10">
            <h2 className="text-lg font-semibold text-teal-400 mb-4">Inhaltsübersicht</h2>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <a href="#n1" className="text-gray-300 hover:text-teal-400 transition-colors py-1">1. Geltungsbereich</a>
              <a href="#n2" className="text-gray-300 hover:text-teal-400 transition-colors py-1">2. Beschreibung der Plattform</a>
              <a href="#n3" className="text-gray-300 hover:text-teal-400 transition-colors py-1">3. Zugang und Registrierung</a>
              <a href="#n4" className="text-gray-300 hover:text-teal-400 transition-colors py-1">4. Nutzerkonto und Sicherheit</a>
              <a href="#n5" className="text-gray-300 hover:text-teal-400 transition-colors py-1">5. Verhaltensregeln</a>
              <a href="#n6" className="text-gray-300 hover:text-teal-400 transition-colors py-1">6. Geistiges Eigentum</a>
              <a href="#n7" className="text-gray-300 hover:text-teal-400 transition-colors py-1">7. Nutzerinhalte</a>
              <a href="#n8" className="text-gray-300 hover:text-teal-400 transition-colors py-1">8. KI-generierte Inhalte</a>
              <a href="#n9" className="text-gray-300 hover:text-teal-400 transition-colors py-1">9. Verfügbarkeit und Support</a>
              <a href="#n10" className="text-gray-300 hover:text-teal-400 transition-colors py-1">10. Haftungsausschluss</a>
              <a href="#n11" className="text-gray-300 hover:text-teal-400 transition-colors py-1">11. Freistellung</a>
              <a href="#n12" className="text-gray-300 hover:text-teal-400 transition-colors py-1">12. Sperrung und Kündigung</a>
              <a href="#n13" className="text-gray-300 hover:text-teal-400 transition-colors py-1">13. Änderungen</a>
              <a href="#n14" className="text-gray-300 hover:text-teal-400 transition-colors py-1">14. Schlussbestimmungen</a>
            </div>
          </nav>

          <div className="text-gray-200 space-y-10">
            <section>
              <p className="text-sm text-gray-400 mb-6">Stand: Januar 2025</p>
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-5 mb-6 rounded-r-lg">
                <p className="font-semibold text-teal-300 mb-2">Wichtiger Hinweis</p>
                <p className="text-sm leading-relaxed">
                  Bitte lesen Sie diese Nutzungsbedingungen sorgfältig durch, bevor Sie die Plattform nutzen. 
                  Mit der Registrierung oder Nutzung der Plattform erklären Sie sich mit diesen 
                  Nutzungsbedingungen einverstanden. Wenn Sie mit diesen Bedingungen nicht einverstanden sind, 
                  dürfen Sie die Plattform nicht nutzen.
                </p>
              </div>
            </section>

            {/* 1. Geltungsbereich */}
            <section id="n1">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">1</span>
                Geltungsbereich
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.1 Anwendbarkeit</h3>
              <p className="mb-4 leading-relaxed">
                Diese Nutzungsbedingungen regeln die Nutzung der Plattform „byndl" (im Folgenden „Plattform", 
                „Dienst" oder „Website"), die von der byndl UG (haftungsbeschränkt) (im Folgenden „byndl", 
                „wir", „uns" oder „unser") betrieben wird. Sie gelten für alle Besucher, Nutzer und andere 
                Personen, die auf die Plattform zugreifen oder diese nutzen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.2 Ergänzende Regelungen</h3>
              <p className="mb-4 leading-relaxed">
                Diese Nutzungsbedingungen ergänzen unsere{' '}
                <Link to="/agb" className="text-teal-400 hover:text-teal-300 underline">
                  Allgemeinen Geschäftsbedingungen (AGB)
                </Link>{' '}
                und unsere{' '}
                <Link to="/datenschutz" className="text-teal-400 hover:text-teal-300 underline">
                  Datenschutzerklärung
                </Link>. 
                Bei Widersprüchen zwischen diesen Dokumenten haben die AGB Vorrang, soweit sie spezifischere 
                Regelungen enthalten.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">1.3 Änderungsvorbehalt</h3>
              <p className="mb-4 leading-relaxed">
                Wir behalten uns das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Änderungen 
                werden auf dieser Seite veröffentlicht und treten mit der Veröffentlichung in Kraft. Die 
                fortgesetzte Nutzung der Plattform nach Veröffentlichung von Änderungen gilt als Zustimmung 
                zu den geänderten Bedingungen.
              </p>
            </section>

            {/* 2. Beschreibung der Plattform */}
            <section id="n2">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">2</span>
                Beschreibung der Plattform
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">2.1 Zweck</h3>
              <p className="mb-4 leading-relaxed">
                byndl ist eine digitale Vermittlungsplattform, die private Bauherren und Handwerksbetriebe 
                zusammenbringt. Die Plattform unterstützt Bauherren bei der Erfassung und Ausschreibung 
                ihrer Bauprojekte und ermöglicht Handwerkern, passende Aufträge zu finden.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">2.2 Kernfunktionen</h3>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>KI-gestützte Projekterfassung und Erstellung von Leistungsverzeichnissen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Automatische Kostenschätzungen basierend auf Projektdaten</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Vermittlung zwischen Bauherren und qualifizierten Handwerksbetrieben</span>
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
                  <span>Kommunikations- und Projektmanagement-Tools</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">2.3 Vermittlerrolle</h3>
              <p className="mb-4 leading-relaxed">
                byndl fungiert ausschließlich als Vermittler und wird nicht Vertragspartei der zwischen 
                Bauherren und Handwerkern geschlossenen Werkverträge. Wir übernehmen keine Verantwortung 
                für die Erfüllung dieser Verträge.
              </p>
            </section>

            {/* 3. Zugang und Registrierung */}
            <section id="n3">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">3</span>
                Zugang und Registrierung
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.1 Zugangsvoraussetzungen</h3>
              <p className="mb-4 leading-relaxed">
                Die Nutzung bestimmter Funktionen der Plattform erfordert eine Registrierung. 
                Sie müssen mindestens 18 Jahre alt und voll geschäftsfähig sein, um ein Konto zu erstellen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.2 Registrierungspflichten</h3>
              <p className="mb-4 leading-relaxed">
                Bei der Registrierung verpflichten Sie sich:
              </p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Wahrheitsgemäße, genaue und vollständige Angaben zu machen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Ihre Angaben aktuell zu halten</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Nur ein Konto pro Person/Unternehmen zu erstellen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Eine gültige E-Mail-Adresse anzugeben</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.3 Zusätzliche Anforderungen für Handwerker</h3>
              <p className="mb-4 leading-relaxed">
                Handwerksbetriebe müssen zusätzlich nachweisen, dass sie über die erforderlichen 
                Gewerbeanmeldungen, Qualifikationen und Versicherungen verfügen. byndl behält sich vor, 
                entsprechende Nachweise anzufordern.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">3.4 Ablehnung der Registrierung</h3>
              <p className="mb-4 leading-relaxed">
                Wir behalten uns das Recht vor, Registrierungen ohne Angabe von Gründen abzulehnen oder 
                bestehende Konten zu sperren, wenn wir Verstöße gegen diese Nutzungsbedingungen feststellen.
              </p>
            </section>

            {/* 4. Nutzerkonto und Sicherheit */}
            <section id="n4">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">4</span>
                Nutzerkonto und Sicherheit
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.1 Kontosicherheit</h3>
              <p className="mb-4 leading-relaxed">
                Sie sind für die Sicherheit Ihres Kontos verantwortlich. Dies umfasst:
              </p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <span>Verwendung eines starken, einzigartigen Passworts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <span>Geheimhaltung Ihrer Zugangsdaten</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <span>Unverzügliche Meldung bei Verdacht auf unbefugten Zugriff</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.2 Verantwortung für Kontoaktivitäten</h3>
              <p className="mb-4 leading-relaxed">
                Sie sind für alle Aktivitäten verantwortlich, die unter Ihrem Konto stattfinden. 
                byndl haftet nicht für Schäden, die durch unbefugte Nutzung Ihres Kontos entstehen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">4.3 Kontolöschung</h3>
              <p className="mb-4 leading-relaxed">
                Sie können Ihr Konto jederzeit löschen, indem Sie uns kontaktieren. Beachten Sie, dass 
                bestimmte Daten aus rechtlichen Gründen aufbewahrt werden müssen und dass bereits 
                eingegangene Verpflichtungen bestehen bleiben.
              </p>
            </section>

            {/* 5. Verhaltensregeln */}
            <section id="n5">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">5</span>
                Verhaltensregeln
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">5.1 Allgemeine Verhaltensregeln</h3>
              <p className="mb-4 leading-relaxed">
                Bei der Nutzung der Plattform verpflichten Sie sich:
              </p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Respektvoll und professionell mit anderen Nutzern zu kommunizieren</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Alle anwendbaren Gesetze und Vorschriften einzuhalten</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Ehrliche und genaue Informationen bereitzustellen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Die Plattform nur für ihren vorgesehenen Zweck zu nutzen</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">5.2 Verbotene Aktivitäten</h3>
              <p className="mb-3">Folgende Aktivitäten sind ausdrücklich untersagt:</p>
              <div className="bg-red-900/20 border-l-4 border-red-400 p-5 mb-4 rounded-r-lg">
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Veröffentlichung von falschen, irreführenden oder betrügerischen Inhalten</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Belästigung, Bedrohung oder Einschüchterung anderer Nutzer</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Verbreitung von Spam, Malware oder schädlicher Software</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Versuch, die Sicherheit der Plattform zu umgehen oder zu kompromittieren</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Automatisiertes Scraping oder Sammeln von Daten ohne Genehmigung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Umgehung der Plattform zur Vermeidung von Gebühren</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Nutzung der Plattform für illegale Zwecke</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 6. Geistiges Eigentum */}
            <section id="n6">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">6</span>
                Geistiges Eigentum
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.1 Eigentum von byndl</h3>
              <p className="mb-4 leading-relaxed">
                Die Plattform, einschließlich aller Inhalte, Funktionen, Design, Texte, Grafiken, Logos, 
                Bilder, Software und anderer Materialien, ist Eigentum von byndl oder seinen Lizenzgebern 
                und durch Urheberrechte, Markenrechte und andere Gesetze geschützt.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.2 Eingeschränkte Lizenz</h3>
              <p className="mb-4 leading-relaxed">
                Wir gewähren Ihnen eine eingeschränkte, nicht-exklusive, nicht übertragbare Lizenz zur 
                Nutzung der Plattform für Ihren persönlichen, nicht-kommerziellen Gebrauch im Rahmen 
                dieser Nutzungsbedingungen. Diese Lizenz beinhaltet nicht das Recht:
              </p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Die Plattform oder Teile davon zu kopieren, zu modifizieren oder abgeleitete Werke zu erstellen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Die Plattform für kommerzielle Zwecke zu nutzen, die über die vorgesehene Nutzung hinausgehen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <span>Marken, Logos oder andere Eigentumsbezeichnungen ohne Genehmigung zu verwenden</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">6.3 Markenrechte</h3>
              <p className="mb-4 leading-relaxed">
                „byndl" und das byndl-Logo sind Marken der byndl UG (haftungsbeschränkt). Die Verwendung 
                dieser Marken ohne unsere vorherige schriftliche Genehmigung ist untersagt.
              </p>
            </section>

            {/* 7. Nutzerinhalte */}
            <section id="n7">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">7</span>
                Nutzerinhalte
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.1 Definition</h3>
              <p className="mb-4 leading-relaxed">
                „Nutzerinhalte" umfassen alle Informationen, Texte, Bilder, Dateien und andere Materialien, 
                die Sie auf der Plattform hochladen, veröffentlichen oder übermitteln.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.2 Eigentumsrechte</h3>
              <p className="mb-4 leading-relaxed">
                Sie behalten das Eigentum an Ihren Nutzerinhalten. Durch das Hochladen von Inhalten gewähren 
                Sie byndl jedoch eine weltweite, nicht-exklusive, gebührenfreie Lizenz zur Nutzung, 
                Speicherung, Anzeige und Weitergabe dieser Inhalte im Rahmen der Plattformfunktionen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.3 Verantwortung für Inhalte</h3>
              <p className="mb-4 leading-relaxed">
                Sie sind allein verantwortlich für Ihre Nutzerinhalte und garantieren, dass:
              </p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Sie alle erforderlichen Rechte an den Inhalten besitzen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Die Inhalte keine Rechte Dritter verletzen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Die Inhalte wahrheitsgemäß und nicht irreführend sind</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">7.4 Entfernung von Inhalten</h3>
              <p className="mb-4 leading-relaxed">
                Wir behalten uns das Recht vor, Nutzerinhalte nach eigenem Ermessen zu entfernen oder 
                zu deaktivieren, wenn sie gegen diese Nutzungsbedingungen verstoßen oder aus anderen 
                berechtigten Gründen.
              </p>
            </section>

            {/* 8. KI-generierte Inhalte */}
            <section id="n8">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">8</span>
                KI-generierte Inhalte
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">8.1 Art der KI-Inhalte</h3>
              <p className="mb-4 leading-relaxed">
                Die Plattform nutzt künstliche Intelligenz zur Erstellung von Leistungsverzeichnissen, 
                Kostenschätzungen und anderen projektbezogenen Dokumenten. Diese KI-generierten Inhalte 
                basieren auf den von Nutzern bereitgestellten Informationen und verfügbaren Datenquellen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">8.2 Keine Gewährleistung</h3>
              <div className="bg-amber-900/30 border-l-4 border-amber-400 p-5 mb-4 rounded-r-lg">
                <p className="font-semibold text-amber-300 mb-3">Wichtiger Hinweis zu KI-Inhalten</p>
                <p className="text-sm leading-relaxed">
                  KI-generierte Inhalte dienen ausschließlich als erste Orientierung und unverbindliche 
                  Hilfestellung. byndl übernimmt keine Gewährleistung für die Richtigkeit, Vollständigkeit, 
                  Aktualität oder Eignung dieser Inhalte für einen bestimmten Zweck. Nutzer sind 
                  verpflichtet, alle KI-generierten Inhalte eigenverantwortlich zu prüfen.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">8.3 Prüfungspflicht</h3>
              <p className="mb-4 leading-relaxed">
                Insbesondere Handwerker sind als Fachunternehmer verpflichtet, KI-generierte 
                Leistungsverzeichnisse vor Abgabe eines verbindlichen Angebots sorgfältig zu prüfen 
                und gegebenenfalls anzupassen.
              </p>
            </section>

            {/* 9. Verfügbarkeit und Support */}
            <section id="n9">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">9</span>
                Verfügbarkeit und Support
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">9.1 Verfügbarkeit</h3>
              <p className="mb-4 leading-relaxed">
                Wir bemühen uns, die Plattform rund um die Uhr verfügbar zu halten. Wir garantieren jedoch 
                keine ununterbrochene Verfügbarkeit und behalten uns das Recht vor, den Dienst für 
                Wartungsarbeiten, Updates oder aus anderen Gründen vorübergehend einzuschränken.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">9.2 Änderungen an der Plattform</h3>
              <p className="mb-4 leading-relaxed">
                Wir können die Plattform jederzeit ändern, aktualisieren oder Funktionen hinzufügen oder 
                entfernen. Wesentliche Änderungen werden wir, soweit möglich, im Voraus ankündigen.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">9.3 Support</h3>
              <p className="mb-4 leading-relaxed">
                Bei Fragen oder Problemen können Sie uns über die auf der Plattform angegebenen 
                Kontaktmöglichkeiten erreichen. Wir bemühen uns, Anfragen zeitnah zu beantworten.
              </p>
            </section>

            {/* 10. Haftungsausschluss */}
            <section id="n10">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">10</span>
                Haftungsausschluss
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.1 Bereitstellung „wie besehen"</h3>
              <p className="mb-4 leading-relaxed">
                Die Plattform wird „wie besehen" und „wie verfügbar" bereitgestellt. Wir geben keine 
                ausdrücklichen oder stillschweigenden Garantien hinsichtlich der Eignung für einen 
                bestimmten Zweck, der Marktgängigkeit oder der Nichtverletzung von Rechten Dritter.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.2 Haftungsbeschränkung</h3>
              <p className="mb-4 leading-relaxed">
                Die Haftung von byndl richtet sich nach den Regelungen in unseren AGB. Soweit gesetzlich 
                zulässig, haften wir nicht für indirekte, zufällige, besondere oder Folgeschäden, 
                entgangenen Gewinn oder Datenverlust.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">10.3 Keine Haftung für Dritte</h3>
              <p className="mb-4 leading-relaxed">
                Wir haften nicht für Handlungen, Produkte oder Dienstleistungen von Handwerkern oder 
                anderen Dritten, die über die Plattform vermittelt werden. Alle Ansprüche sind direkt 
                gegen die jeweilige Vertragspartei zu richten.
              </p>
            </section>

            {/* 11. Freistellung */}
            <section id="n11">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">11</span>
                Freistellung
              </h2>
              
              <p className="mb-4 leading-relaxed">
                Sie verpflichten sich, byndl, seine Geschäftsführer, Mitarbeiter und Vertreter von allen 
                Ansprüchen, Verbindlichkeiten, Schäden, Verlusten und Kosten (einschließlich angemessener 
                Rechtsanwaltskosten) freizustellen, die sich ergeben aus:
              </p>
              <ul className="space-y-2 ml-4 mb-4">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Ihrer Nutzung der Plattform</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Verletzung dieser Nutzungsbedingungen</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Verletzung von Rechten Dritter</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Ihren Nutzerinhalten</span>
                </li>
              </ul>
            </section>

            {/* 12. Sperrung und Kündigung */}
            <section id="n12">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">12</span>
                Sperrung und Kündigung
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">12.1 Sperrung durch byndl</h3>
              <p className="mb-4 leading-relaxed">
                Wir können Ihren Zugang zur Plattform vorübergehend oder dauerhaft sperren, wenn Sie 
                gegen diese Nutzungsbedingungen verstoßen oder wenn wir dies aus anderen berechtigten 
                Gründen für notwendig halten.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">12.2 Kündigung durch den Nutzer</h3>
              <p className="mb-4 leading-relaxed">
                Sie können Ihre Nutzung der Plattform jederzeit beenden und Ihr Konto löschen. 
                Bereits eingegangene Verpflichtungen bleiben davon unberührt.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">12.3 Folgen der Beendigung</h3>
              <p className="mb-4 leading-relaxed">
                Nach Beendigung Ihrer Nutzung werden wir Ihre Daten gemäß unserer Datenschutzerklärung 
                und den gesetzlichen Aufbewahrungspflichten behandeln. Bestimmte Bestimmungen dieser 
                Nutzungsbedingungen bleiben auch nach Beendigung in Kraft.
              </p>
            </section>

            {/* 13. Änderungen */}
            <section id="n13">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">13</span>
                Änderungen der Nutzungsbedingungen
              </h2>
              
              <p className="mb-4 leading-relaxed">
                Wir behalten uns das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Bei 
                wesentlichen Änderungen werden wir Sie durch eine Mitteilung auf der Plattform oder 
                per E-Mail informieren. Die fortgesetzte Nutzung der Plattform nach Inkrafttreten 
                der Änderungen gilt als Zustimmung zu den geänderten Bedingungen.
              </p>
            </section>

            {/* 14. Schlussbestimmungen */}
            <section id="n14">
              <h2 className="text-2xl font-bold text-teal-400 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-sm">14</span>
                Schlussbestimmungen
              </h2>
              
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.1 Anwendbares Recht</h3>
              <p className="mb-4 leading-relaxed">
                Diese Nutzungsbedingungen unterliegen dem Recht der Bundesrepublik Deutschland unter 
                Ausschluss des UN-Kaufrechts (CISG).
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.2 Gerichtsstand</h3>
              <p className="mb-4 leading-relaxed">
                Soweit gesetzlich zulässig, ist ausschließlicher Gerichtsstand für alle Streitigkeiten 
                aus oder im Zusammenhang mit diesen Nutzungsbedingungen der Sitz von byndl.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.3 Salvatorische Klausel</h3>
              <p className="mb-4 leading-relaxed">
                Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam oder undurchführbar 
                sein oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.4 Vollständigkeit der Vereinbarung</h3>
              <p className="mb-4 leading-relaxed">
                Diese Nutzungsbedingungen, zusammen mit unseren AGB und der Datenschutzerklärung, 
                stellen die gesamte Vereinbarung zwischen Ihnen und byndl in Bezug auf die Nutzung 
                der Plattform dar.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">14.5 Kontakt</h3>
              <p className="mb-4">Bei Fragen zu diesen Nutzungsbedingungen kontaktieren Sie uns bitte unter:</p>
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
              <Link to="/agb" className="text-gray-400 hover:text-teal-400 transition-colors">
                AGB
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
