import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-600 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            {/* Headline - ohne Logo, größerer Schriftzug */}
            <h1 className="text-7xl lg:text-9xl font-bold text-white mb-4">
              byndl
            </h1>
            <p className="text-3xl lg:text-4xl text-teal-400 font-light mb-8">
              einfach . bauen
            </p>
            
            <p className="text-xl lg:text-2xl text-gray-200 max-w-3xl mx-auto mb-12">
              Die digitale Plattform für effiziente und kostensparende
              Bau- und Sanierungsprojekte
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/start"
                className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-8 py-4 rounded-lg shadow-xl transform hover:scale-105 transition-all duration-200 text-lg"
              >
                Projekt starten →
              </Link>
              <a
                href="#how-it-works"
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-slate-900 font-semibold px-8 py-4 rounded-lg shadow-xl transform hover:scale-105 transition-all duration-200 text-lg"
              >
                So funktioniert's
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="bg-white/5 backdrop-blur-lg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">In Minuten erstellt</h3>
              <p className="text-gray-300">VOB-konforme Leistungsverzeichnisse in kürzester Zeit</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">KI-gestützt</h3>
              <p className="text-gray-300">Intelligente Fragenführung und automatische Kalkulation</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Kostenoptimiert</h3>
              <p className="text-gray-300">Realistische Marktpreise und neutrale Ausschreibungen</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            So einfach geht's
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Projekt beschreiben",
                desc: "Geben Sie Ihre Projektdaten in einfachen Worten ein"
              },
              {
                step: "2",
                title: "Fragen beantworten",
                desc: "KI-gestützte, adaptive Fragenkataloge führen Sie durch den Prozess"
              },
              {
                step: "3",
                title: "LV generieren",
                desc: "Automatische Erstellung VOB-konformer Leistungsverzeichnisse"
              },
              {
                step: "4",
                title: "Exportieren",
                desc: "Download mit oder ohne Preise für Ausschreibungen"
              }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="text-center">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
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

      {/* Features Grid */}
      <section className="bg-white/5 backdrop-blur-lg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            Ihre Vorteile mit BYNDL
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "18 Gewerke verfügbar",
              "VOB/C-konforme Ausschreibung",
              "Aktuelle Marktpreise",
              "Neutrale Angebotsanfragen",
              "Automatische Mengenermittlung",
              "PDF-Export & Druck"
            ].map((feature, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-teal-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-white font-medium">{feature}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-teal-400 mb-2">98%</div>
              <p className="text-xl text-white">Zeitersparnis</p>
              <p className="text-gray-400 mt-2">gegenüber herkömmlicher LV-Erstellung</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-teal-400 mb-2">18+</div>
              <p className="text-xl text-white">Gewerke</p>
              <p className="text-gray-400 mt-2">von Rohbau bis Außenanlagen</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-teal-400 mb-2">100%</div>
              <p className="text-xl text-white">VOB-konform</p>
              <p className="text-gray-400 mt-2">rechtssichere Ausschreibungen</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-teal-600 to-blue-600 py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold text-white mb-6">
            Starten Sie Ihr Projekt jetzt
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Keine Registrierung erforderlich. Kostenlos testen.
          </p>
          <Link
            to="/start"
            className="inline-block bg-white text-blue-900 font-bold px-10 py-4 rounded-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 text-lg"
          >
            Jetzt loslegen →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">byndl</h3>
              <p className="text-gray-400">
                Die intelligente Plattform für Ihr Bauprojekt
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2">
                <li><Link to="/start" className="text-gray-400 hover:text-teal-400">Projekt starten</Link></li>
                <li><a href="#how-it-works" className="text-gray-400 hover:text-teal-400">So funktioniert's</a></li>
                <li><Link to="/admin" className="text-gray-400 hover:text-teal-400">Admin</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Kontakt</h4>
              <p className="text-gray-400">
                info@byndl.de<br/>
                © 2024 BYNDL
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
