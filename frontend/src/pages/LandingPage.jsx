import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [formStatus, setFormStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('sending');
    
    // Mailto-Link als Fallback
    const mailtoLink = `mailto:info@byndl.de?subject=Kontaktanfrage von ${formData.name}&body=${encodeURIComponent(
      `Name: ${formData.name}\nE-Mail: ${formData.email}\n\nNachricht:\n${formData.message}`
    )}`;
    
    window.location.href = mailtoLink;
    
    setTimeout(() => {
      setFormStatus('success');
      setFormData({ name: '', email: '', message: '' });
    }, 1000);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header mit Login */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
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
            
            <p className="text-xl lg:text-2xl text-gray-200 max-w-4xl mx-auto mb-12 leading-relaxed">
              byndl ist eine digitale Plattform, die Bau- und Sanierungsprojekte umfassend vereinfacht und effizienter gestaltet. 
              Der Schlüssel liegt in <span className="text-teal-400 font-semibold">KI-gestützter Projekterfassung</span>, 
              <span className="text-teal-400 font-semibold"> Ausschreibung</span> und der 
              <span className="text-teal-400 font-semibold"> Bündelung ähnlicher Projekte</span> in derselben Region.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <Link
                to="/bauherr/register"
                className="group relative bg-gradient-to-r from-teal-500 to-teal-400 text-white font-bold px-10 py-5 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-200 text-lg"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                  Für Bauherren
                </span>
                <span className="block text-sm font-normal mt-1 opacity-90">
                  Jetzt als Bauherr registrieren und Projekt starten
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

      {/* Vorteile für Bauherren und Handwerker - Symmetrisch */}
      <section className="bg-white/5 backdrop-blur-lg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Für Bauherren */}
            <div className="bg-gradient-to-br from-teal-600/20 to-teal-700/20 backdrop-blur-lg rounded-3xl p-8 border border-teal-400/30">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-400 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-white">Für Bauherren</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-semibold text-teal-300 mb-3">Vereinfachung durch KI-gestützte Projekterfassung</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Professionelle Ausschreibung auch ohne Fachwissen</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Direkte und nachvollziehbare Kostenschätzung</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-teal-300 mb-3">Zeitersparnis</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Keine zeitintensiven Ortstermine vor Auftragsvergabe erforderlich</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-teal-300 mb-3">Kostenoptimierung durch Projektbündelung</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Durch gebündelte Ausschreibungen mit ähnlichen Projekten in deiner Region von Mengenrabatten und Synergievorteilen profitieren</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-teal-300 mb-3">Sicherheit durch geprüfte Angebote</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-teal-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>KI-gestützte fachliche Angebotsauswertung sorgt für Schutz vor überzogenen Preisen</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Für Handwerksbetriebe */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/30">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-white">Für Handwerksbetriebe</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-semibold text-blue-300 mb-3">Projektbündelung</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Sie erhalten größere, zeitlich und räumlich zusammenhängende Aufträge, wodurch sowohl Umsätze steigen als auch Leerfahrten und Verwaltungsaufwand deutlich sinken</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Eine planbare Auslastung sichert die Arbeitsabläufe und vereinfacht Personal- und Materialeinsatz</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-blue-300 mb-3">Zeitersparnis und Effizienzsteigerung</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Durch klare Leistungsbeschreibung zur Angebotskalkulation entfallen zeitintensive Ortstermine vor Beauftragung und Akquiseaufwand wird minimiert</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Zusatzleistungen werden transparent und stressfrei auf Basis der Auftragsgrundlage über Nachträge abgerechnet</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-blue-300 mb-3">Erhöhte Auftragschance</h4>
                  <ul className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Qualifizierte und budgetierte Ausschreibungen, keine Scheinanfragen zur Kostenermittlung</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* USP Bündelung */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-3xl p-12 border border-white/20">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-4">
                Einzigartige Projektbündelung
              </h2>
              <p className="text-xl text-gray-200 max-w-3xl mx-auto">
                Mehrere Projekte in einer Region werden zeitlich koordiniert – 
                <span className="text-teal-400 font-semibold"> Handwerker sparen Fahrtkosten und Zeit</span>, 
                <span className="text-teal-400 font-semibold"> Bauherren profitieren von besseren Preisen</span>
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Regional gebündelt</h3>
                <p className="text-gray-300">Projekte in derselben Region werden intelligent zusammengefasst</p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Zeitlich koordiniert</h3>
                <p className="text-gray-300">Optimale Terminplanung für maximale Effizienz</p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Win-Win für alle</h3>
                <p className="text-gray-300">Bessere Preise durch Synergieeffekte</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* So funktioniert's */}
      <section className="bg-white/5 backdrop-blur-lg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-4">
            So einfach funktioniert's
          </h2>
          <p className="text-xl text-center text-gray-300 mb-16">
            In 4 Schritten zum erfolgreichen Bauprojekt
          </p>
          
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

      {/* Pricing - Neues Gebührenmodell pro Gewerk */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-6">
            Transparente Preise für Bauherren
          </h2>
          <p className="text-xl text-center text-gray-300 mb-4 max-w-3xl mx-auto">
            Faire Gebühren pro Gewerk – je mehr Gewerke Ihr Projekt benötigt, desto günstiger wird es pro Leistungsverzeichnis.
          </p>
          <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
            Die KI analysiert Ihr Projekt und ermittelt automatisch die benötigten Gewerke. Preise je Leistungsverzeichnis:
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* 1-2 Gewerke */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 hover:border-teal-500/50 transition-all duration-300 hover:shadow-xl group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-300">1-2 Gewerke</h3>
                <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">9,90 €</span>
                <span className="text-gray-400 ml-2">pro LV</span>
              </div>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>z.B. Malerarbeiten, Bodenbelag</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Standardpreis</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400">
                  <span className="text-teal-400 font-medium">Beispiel:</span> 2 Gewerke = 19,80 € gesamt
                </p>
              </div>
            </div>
            
            {/* 3-5 Gewerke */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 hover:border-teal-500/50 transition-all duration-300 hover:shadow-xl group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-300">3-5 Gewerke</h3>
                <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">8,90 €</span>
                <span className="text-gray-300 ml-2">pro LV</span>
              </div>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>z.B. Badsanierung, Küche</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-teal-400 font-medium">10% Ersparnis pro LV</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400">
                  <span className="text-teal-400 font-medium">Beispiel:</span> 4 Gewerke = 35,60 € gesamt
                </p>
              </div>
            </div>
            
            {/* Ab 6 Gewerke */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-300">Ab 6 Gewerke</h3>
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">7,90 €</span>
                <span className="text-gray-400 ml-2">pro LV</span>
              </div>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>z.B. Kernsanierung, Anbau</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-teal-400 font-medium">20% Ersparnis pro LV</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400">
                  <span className="text-blue-400 font-medium">Beispiel:</span> 8 Gewerke = 63,20 € gesamt
                </p>
              </div>
            </div>
          </div>

          {/* Hinweis-Box */}
          <div className="max-w-3xl mx-auto mt-12">
            <div className="bg-gradient-to-r from-teal-900/30 to-blue-900/30 rounded-xl p-6 border border-teal-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">So funktioniert die Abrechnung</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Sie beschreiben Ihr Projekt, unsere KI analysiert es und ermittelt die benötigten Gewerke. 
                    <span className="text-teal-400"> Für jedes Gewerk wird ein professionelles Leistungsverzeichnis (LV) erstellt.</span> 
                    {' '}Die Gebühr richtet sich nach der Gesamtanzahl der Gewerke in Ihrem Projekt. 
                    Keine versteckten Kosten, keine Provisionen für Bauherren.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Über uns Sektion */}
      <section id="ueber-uns" className="bg-gradient-to-r from-slate-800/50 to-blue-900/50 backdrop-blur-lg py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-8">
            Über uns
          </h2>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <p className="text-lg text-gray-200 mb-6 leading-relaxed">
              byndl ist eine innovative digitale Plattform, die private Bauherren und Handwerksbetriebe effizient zusammenbringt. 
              Unser Ziel ist es, den gesamten Prozess privater Bau- und Renovierungsprojekte – von der ersten Idee über die 
              Ausschreibung bis zur Auftragsabwicklung – in einer integrierten Plattform abzubilden.
            </p>
            <p className="text-lg text-gray-200 mb-6 leading-relaxed">
              Damit reagieren wir auf zentrale Probleme der Baubranche: Intransparenz, Fragmentierung und häufige 
              Kostenüberschreitungen. Fast alle Bauvorhaben überschreiten ihr Budget – ein Zeichen dafür, wie dringend bessere 
              Planung und Kontrolle nötig sind.
            </p>
            <p className="text-lg text-gray-200 leading-relaxed">
              Wir setzen <span className="text-teal-400 font-semibold">künstliche Intelligenz (KI)</span> und 
              <span className="text-teal-400 font-semibold"> smarte Automatisierung</span> ein, um Bauherren durch den 
              Prozess zu führen und Handwerkern qualifizierte Aufträge zu verschaffen.
            </p>
          </div>
        </div>
      </section>

      {/* Kontaktformular */}
      <section id="kontakt" className="py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-white mb-4">
            Kontakt
          </h2>
          <p className="text-xl text-center text-gray-300 mb-12">
            Haben Sie Fragen? Kontaktieren Sie uns gerne!
          </p>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-200 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="Ihr Name"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                  E-Mail
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="ihre.email@beispiel.de"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-200 mb-2">
                  Nachricht
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="5"
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                  placeholder="Ihre Nachricht an uns..."
                ></textarea>
              </div>
              
              <button
                type="submit"
                disabled={formStatus === 'sending'}
                className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formStatus === 'sending' ? 'Wird gesendet...' : 'ABSENDEN'}
              </button>
              
              {formStatus === 'success' && (
                <div className="bg-teal-500/20 border border-teal-500/50 rounded-lg p-4 text-teal-200 text-center">
                  Vielen Dank für Ihre Nachricht! Wir melden uns bald bei Ihnen.
                </div>
              )}
            </form>
            
            <div className="mt-8 pt-6 border-t border-white/20 text-center">
              <p className="text-gray-300">
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <a href="mailto:info@byndl.de" className="text-teal-400 hover:text-teal-300 transition-colors">
                  info@byndl.de
                </a>
              </p>
            </div>
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
            to="/bauherr/register"
            className="inline-block bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold px-12 py-5 rounded-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 text-lg"
          >
            Projekt starten →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/30 py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo und Info */}
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold text-white mb-4">byndl</h3>
              <p className="text-gray-400 mb-4">
                Die intelligente Plattform für Ihr Bauprojekt
              </p>
              <p className="text-gray-500">
                © 2025 BYNDL
              </p>
            </div>
            
            {/* Links Spalte 1 */}
            <div>
              <h4 className="text-white font-semibold mb-4">Plattform</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/start" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Für Bauherren
                  </Link>
                </li>
                <li>
                  <Link to="/handwerker/register" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Für Handwerker
                  </Link>
                </li>
                <li>
                  <a href="#ueber-uns" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Über uns
                  </a>
                </li>
                <li>
                  <a href="#kontakt" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Kontakt
                  </a>
                </li>
              </ul>
            </div>
            
            {/* Links Spalte 2 */}
            <div>
              <h4 className="text-white font-semibold mb-4">Rechtliches</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/impressum" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Impressum
                  </Link>
                </li>
                <li>
                  <Link to="/datenschutz" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Datenschutz
                  </Link>
                </li>
                <li>
                  <Link to="/agb" className="text-gray-400 hover:text-teal-400 transition-colors">
                    AGB
                  </Link>
                </li>
                <li>
                  <Link to="/nutzungsbedingungen" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Nutzungsbedingungen
                  </Link>
                </li>
                <li>
                  <Link to="/disclaimer" className="text-gray-400 hover:text-teal-400 transition-colors">
                    Disclaimer
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-gray-500 text-sm">
              <a href="mailto:info@byndl.de" className="hover:text-teal-400 transition-colors">
                info@byndl.de
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
