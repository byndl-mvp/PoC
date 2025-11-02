import React from 'react';
import { Link } from 'react-router-dom';

export default function Impressum() {
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
          <h1 className="text-4xl font-bold text-white mb-8">Impressum</h1>
          
          <div className="text-gray-200 space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Angaben gemäß § 5 TMG</h2>
              
              <div className="bg-white/5 border border-white/20 rounded-lg p-6 space-y-3">
                <p className="text-xl font-semibold text-white">byndl UG (haftungsbeschränkt)</p>
                <p className="text-gray-300">[Straße und Hausnummer]</p>
                <p className="text-gray-300">[PLZ] [Ort]</p>
              </div>

              <div className="mt-6 space-y-2">
                <p><span className="font-semibold text-white">Handelsregister:</span> Amtsgericht [Ort]</p>
                <p><span className="font-semibold text-white">Registernummer:</span> HRB [Nummer]</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Vertreten durch</h2>
              
              <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-lg p-6 border border-teal-400/30">
                <p className="text-lg font-semibold text-white mb-2">Geschäftsführer:</p>
                <ul className="space-y-1">
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-teal-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    <span className="text-gray-200">Christoph Keilbar</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-teal-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    <span className="text-gray-200">René Warzecha</span>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Kontakt</h2>
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-teal-400 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <div>
                    <p className="font-semibold text-white">E-Mail:</p>
                    <a href="mailto:info@byndl.de" className="text-teal-400 hover:text-teal-300 transition-colors">
                      info@byndl.de
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <svg className="w-6 h-6 text-teal-400 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                  </svg>
                  <div>
                    <p className="font-semibold text-white">Internet:</p>
                    <a href="https://www.byndl.de" className="text-teal-400 hover:text-teal-300 transition-colors">
                      www.byndl.de
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Umsatzsteuer-ID</h2>
              
              <p className="mb-2">
                Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
              </p>
              <p className="text-gray-300">[DE XXX XXX XXX]</p>
              <p className="text-sm text-gray-400 mt-2 italic">
                (wird nach Eintragung ins Handelsregister ergänzt)
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
              
              <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                <p className="text-white">Christoph Keilbar</p>
                <p className="text-gray-300">[Adresse wie oben]</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Haftungsausschluss</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-4">Haftung für Inhalte</h3>
              <p className="mb-4">
                Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach 
                den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter 
                jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen 
                oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
              </p>
              <p className="mb-4">
                Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen 
                Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt 
                der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden 
                Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">Haftung für Links</h3>
              <p className="mb-4">
                Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss 
                haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte 
                der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. 
                Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. 
                Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
              </p>
              <p className="mb-4">
                Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte 
                einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir 
                derartige Links umgehend entfernen.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">Urheberrecht</h3>
              <p className="mb-4">
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem 
                deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung 
                außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen 
                Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht 
                kommerziellen Gebrauch gestattet.
              </p>
              <p className="mb-4">
                Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte 
                Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie 
                trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden 
                Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Streitschlichtung</h2>
              
              <p className="mb-4">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" 
                   className="text-teal-400 hover:text-teal-300 underline ml-1">
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>
              <p className="mb-4">
                Unsere E-Mail-Adresse finden Sie oben im Impressum.
              </p>
              <p className="mb-4">
                Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">Hinweis zur Vermittlerrolle</h2>
              
              <div className="bg-teal-900/30 border-l-4 border-teal-400 p-6">
                <p className="font-semibold text-teal-300 mb-3">Wichtiger Hinweis</p>
                <p className="mb-3">
                  byndl tritt ausschließlich als Vermittler zwischen privaten Bauherren und Handwerksbetrieben auf. 
                  Die Plattform stellt lediglich die technische Infrastruktur zur Verfügung, um beide Parteien 
                  zusammenzubringen.
                </p>
                <p>
                  Vertragsverhältnisse bezüglich der Werkleistungen kommen ausschließlich zwischen Bauherren und 
                  Handwerkern zustande. byndl übernimmt keine Haftung für die Qualität, Vollständigkeit oder 
                  Termintreue der vermittelten Bauleistungen.
                </p>
              </div>
            </section>

            <div className="border-t border-white/20 pt-6 mt-8">
              <p className="text-sm text-gray-400 italic">
                Quelle: Erstellt mit Hilfe des 
                <a href="https://www.e-recht24.de" target="_blank" rel="noopener noreferrer" 
                   className="text-teal-400 hover:text-teal-300 underline ml-1">
                  e-recht24.de Impressum Generators
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation zu anderen rechtlichen Seiten */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
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
