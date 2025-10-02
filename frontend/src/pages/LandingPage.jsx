import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header mit Login */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">byndl</h1>
            <div className="flex gap-3">
              <Link
                to="/bauherr/login"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
                <span>Bauherren-Login</span>
              </Link>
              <Link
                to="/handwerker/login"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur border border-teal-400/50 rounded-lg text-white hover:from-teal-500/30 hover:to-blue-600/30 transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span>Handwerker-Login</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pb-20">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-600 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-6xl lg:text-8xl font-bold text-white mb-4">
              byndl
            </h2>
            <p className="text-3xl lg:text-4xl text-teal-400 font-light mb-8">
              einfach . bauen
            </p>
            
            <p className="text-xl lg:text-2xl text-gray-200 max-w-4xl mx-auto mb-8">
              Die KI-gestützte Plattform, die private Bauherren befähigt, 
              <span className="text-teal-400 font-semibold"> wie Profis auszuschreiben - ohne Fachwissen</span>
            </p>

            <p className="text-lg text-gray-300 max-w-3xl mx-auto mb-12">
              Von der ersten Idee bis zum fertigen Leistungsverzeichnis in Minuten. 
              Automatische VOB-konforme Ausschreibungen, faire Preise durch regionale Projektbündelung.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                to="/start"
                className="group relative bg-gradient-to-r from-teal-500 to-teal-400 text-white font-bold px-10 py-5 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-200 text-lg"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                  Für Bauherren
                </span>
                <span className="block text-sm font-normal mt-1 opacity-90">
                  Projekt starten & Angebote erhalten
                </span>
              </Link>
              
              <Link
  to="/handwerker/register"
  className="group relative bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold px-10 py-5 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-200 text-lg"
>
  <span className="flex items-center justify-center">
    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
    Für Handwerksbetriebe
  </span>
  <span className="block text-sm font-normal mt-1 opacity-90">
    Jetzt registrieren & Aufträge erhalten
  </span>
</Link>
            </div>
          </div>
        </div>
      </section>

      {/* KI Value Proposition */}
      <section className="bg-white/5 backdrop-blur-lg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-4">
            Professionell ausschreiben ohne Fachwissen
          </h2>
          <p className="text-xl text-center text-gray-300 mb-16 max-w-3xl mx-auto">
            Unsere KI verwandelt Ihre einfache Projektbeschreibung in ein vollständiges, 
            VOB-konformes Leistungsverzeichnis mit realistischer Kostenprognose
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">KI-Projektassistent</h3>
              <p className="text-gray-300">Beschreiben Sie Ihr Vorhaben in eigenen Worten - die KI erkennt automatisch alle nötigen Gewerke und Leistungen</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">VOB-konforme LVs</h3>
              <p className="text-gray-300">Automatische Erstellung professioneller Leistungsverzeichnisse nach VOB/C Standard - rechtssicher und vollständig</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Realistische Preise</h3>
              <p className="text-gray-300">KI-basierte Kostenschätzung mit aktuellen Marktpreisen - keine bösen Überraschungen mehr</p>
            </div>
          </div>
        </div>
      </section>

      {/* USP Bündelung */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-3xl p-12 border border-white/20">
            <div className="text-center mb-8">
              <span className="bg-teal-500 text-white text-sm font-bold px-4 py-2 rounded-full">NEU & EINZIGARTIG</span>
            </div>
            <h2 className="text-3xl font-bold text-center text-white mb-6">
              Projektbündelung für bessere Preise
            </h2>
            <p className="text-xl text-center text-gray-200 mb-8 max-w-3xl mx-auto">
              Als erste Plattform bündeln wir ähnliche Projekte in Ihrer Region. 
              Handwerker sparen Fahrtkosten und geben bessere Preise - Sie profitieren!
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-teal-400 mb-2">3-5</div>
                <p className="text-white">Projekte pro Bündel</p>
              </div>
              <div className="bg-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-teal-400 mb-2">15-20%</div>
                <p className="text-white">Günstigere Angebote</p>
              </div>
              <div className="bg-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-teal-400 mb-2">50%</div>
                <p className="text-white">Kürzere Wartezeiten</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white/5 backdrop-blur-lg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            So funktioniert's für Bauherren
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Projekt beschreiben",
                desc: "Schildern Sie Ihr Vorhaben in eigenen Worten - die KI versteht Sie"
              },
              {
                step: "2",
                title: "KI erstellt LV",
                desc: "Automatische Erstellung eines professionellen Leistungsverzeichnisses"
              },
              {
                step: "3",
                title: "Angebote erhalten",
                desc: "Qualifizierte Handwerker aus Ihrer Region senden Angebote"
              },
              {
                step: "4",
                title: "Auftrag vergeben",
                desc: "Wählen Sie das beste Angebot - wir begleiten Ihr Projekt"
              }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-300 text-sm">{item.desc}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-8 left-full w-full">
                    <svg className="w-8 h-8 text-teal-500 -ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="bg-gradient-to-r from-teal-600/10 to-blue-600/10 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-6">
            Transparente Preise
          </h2>
          <p className="text-xl text-center text-gray-300 mb-12 max-w-2xl mx-auto">
            Einmalige Gebühr für die KI-gestützte Ausschreibung. 
            Keine versteckten Kosten, keine Provisionen für Bauherren.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Kleine Projekte</h3>
              <div className="text-3xl font-bold text-white mb-1">29,90 €</div>
              <p className="text-gray-400 mb-4">einmalig</p>
              <p className="text-gray-300">1-2 Gewerke</p>
              <p className="text-sm text-gray-400 mt-2">z.B. Malerarbeiten, Bodenbelagsarbeiten</p>
            </div>
            
            <div className="bg-gradient-to-br from-teal-600/20 to-blue-600/20 backdrop-blur rounded-2xl p-8 border-2 border-teal-500/50 transform scale-105">
              <div className="bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded inline-block mb-2">BELIEBT</div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Mittlere Projekte</h3>
              <div className="text-3xl font-bold text-white mb-1">59,90 €</div>
              <p className="text-gray-400 mb-4">einmalig</p>
              <p className="text-gray-300">3-5 Gewerke</p>
              <p className="text-sm text-gray-400 mt-2">z.B. Badsanierung, Fassadensanierung</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Große Projekte</h3>
              <div className="text-3xl font-bold text-white mb-1">99,90 €</div>
              <p className="text-gray-400 mb-4">einmalig</p>
              <p className="text-gray-300">Ab 6 Gewerken</p>
              <p className="text-sm text-gray-400 mt-2">z.B. Kernsanierung, Anbau</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            Ihre Vorteile auf einen Blick
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "KI erstellt professionelle Ausschreibungen",
              "VOB/C-konforme Leistungsverzeichnisse",
              "Automatische Kostenschätzung",
              "Regionale Projektbündelung",
              "Geprüfte Handwerksbetriebe",
              "Digitales Projektmanagement"
            ].map((feature, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-teal-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-white font-medium">{feature}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold text-white mb-6">
            Starten Sie Ihr Projekt jetzt
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            In nur 5 Minuten zur professionellen Ausschreibung
          </p>
          <Link
            to="/start"
            className="inline-block bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold px-12 py-5 rounded-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 text-lg"
          >
            Projekt starten →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/20 py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">byndl</h3>
            <p className="text-gray-400 mb-4">
              Die intelligente Plattform für Ihr Bauprojekt
            </p>
            <p className="text-gray-500 text-sm">
              © 2024 BYNDL - info@byndl.de
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
