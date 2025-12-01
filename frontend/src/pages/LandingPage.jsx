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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex gap-2 sm:gap-4 justify-center sm:justify-start">
            <Link
              to="/bauherr/login"
              className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all duration-200 text-xs sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              <span>Bauherren-Login</span>
            </Link>
            <Link
              to="/handwerker/login"
              className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur border border-teal-400/50 rounded-lg text-white hover:from-teal-500/30 hover:to-blue-600/30 transition-all duration-200 text-xs sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span>Handwerker-Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pb-12 sm:pb-20">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-48 sm:w-72 h-48 sm:h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
          <div className="absolute top-0 -right-4 w-48 sm:w-72 h-48 sm:h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
          <div className="absolute -bottom-8 left-20 w-48 sm:w-72 h-48 sm:h-72 bg-blue-600 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
          <div className="text-center">
            <h2 className="text-4xl sm:text-6xl lg:text-8xl font-bold text-white mb-3 sm:mb-4">
              byndl
            </h2>
            <p className="text-xl sm:text-3xl lg:text-4xl text-teal-400 font-light mb-6 sm:mb-8">
              einfach . bauen
            </p>
            
            <p className="text-base sm:text-xl lg:text-2xl text-gray-200 max-w-4xl mx-auto mb-8 sm:mb-12 leading-relaxed px-2">
              byndl ist eine digitale Plattform, die Bau- und Sanierungsprojekte umfassend vereinfacht und effizienter gestaltet. 
              Der Schlüssel liegt in <span className="text-teal-400 font-semibold">KI-gestützter Projekterfassung</span>, 
              <span className="text-teal-400 font-semibold"> Ausschreibung</span> und der 
              <span className="text-teal-400 font-semibold"> Bündelung ähnlicher Projekte</span> in derselben Region.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-12 sm:mb-16 px-4">
              <Link
                to="/bauherr/register"
                className="group relative bg-gradient-to-r from-teal-500 to-teal-400 text-white font-bold px-6 sm:px-10 py-4 sm:py-5 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-200 text-base sm:text-lg"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                  Für Bauherren
                </span>
                <span className="block text-xs sm:text-sm font-normal mt-1 opacity-90">
                  Jetzt registrieren und Projekt starten
                </span>
              </Link>
              
              <Link
                to="/handwerker/register"
                className="group relative bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold px-6 sm:px-10 py-4 sm:py-5 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-200 text-base sm:text-lg"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  Für Handwerksbetriebe
                </span>
                <span className="block text-xs sm:text-sm font-normal mt-1 opacity-90">
                  Jetzt registrieren & Aufträge erhalten
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          VORTEILE FÜR BAUHERREN UND HANDWERKER
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white/5 backdrop-blur-lg py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ihre Vorteile mit byndl
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto">
              Modernste KI-Technologie unterstützt Sie in jeder Phase Ihres Bauprojekts
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
            {/* ═══ Für Bauherren ═══ */}
            <div className="bg-gradient-to-br from-teal-600/20 to-teal-700/20 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-teal-400/30">
              <div className="flex items-center mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-500 to-teal-400 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">Für Bauherren</h3>
              </div>

              <div className="space-y-6 sm:space-y-8">
                {/* KI-gestützte Projekterfassung */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-teal-300 mb-3">KI-gestützte Projekterfassung</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Professionelle Ausschreibung auch ohne Fachwissen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Automatische Erkennung aller benötigten Gewerke</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Direkte und nachvollziehbare Kostenschätzung</span>
                    </li>
                  </ul>
                </div>

                {/* KI-Angebotsauswertung */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-teal-300 mb-3">KI-Angebotsauswertung & Vergabeempfehlung</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Automatischer Vergleich aller eingehenden Angebote</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>KI-basierte Vergabeempfehlung nach Preis-Leistung</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Schutz vor überhöhten Preisen durch Marktanalyse</span>
                    </li>
                  </ul>
                </div>

                {/* KI-Terminplanung */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-teal-300 mb-3">KI-Terminplanung</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Automatische Koordination aller Gewerke in der richtigen Reihenfolge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Alle Beteiligten wissen jederzeit, was wann passiert</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Terminänderungen einfach auf der Plattform abstimmen</span>
                    </li>
                  </ul>
                </div>

                {/* KI-Nachtragsprüfung */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-teal-300 mb-3">KI-Nachtragsprüfung</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Ki gestützte Prüfung von Nachtragsangeboten</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Bewertung der Angemessenheit von Mehrkosten</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Volle Kostenkontrolle über die gesamte Projektlaufzeit</span>
                    </li>
                  </ul>
                </div>

                {/* Projektbündelung für Bauherren */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-teal-300 mb-3">Kostenvorteile durch Projektbündelung</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>byndl bündelt ähnliche Projekte in Ihrer Region zu attraktiven Auftragspaketen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Handwerker sparen Fahrtzeiten – diesen Vorteil geben sie als günstigere Angebote weiter</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Kürzere Wartezeiten, da gebündelte Aufträge für Handwerker attraktiver sind</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ═══ Für Handwerksbetriebe ═══ */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-blue-400/30">
              <div className="flex items-center mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">Für Handwerksbetriebe</h3>
              </div>

              <div className="space-y-6 sm:space-y-8">
                {/* Qualifizierte Ausschreibungen */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-blue-300 mb-3">Qualifizierte Ausschreibungen</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Nur budgetierte Anfragen – keine Scheinanfragen zur Kostenermittlung</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Bauherren sind über Kosten informiert und entscheidungsbereit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Deutlich höhere Auftragschance als bei klassischen Anfragen</span>
                    </li>
                  </ul>
                </div>

                {/* Klare Kalkulationsgrundlage */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-blue-300 mb-3">Klare Kalkulationsgrundlage</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Professionelle Leistungsverzeichnisse mit allen Details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Keine zeitintensiven Ortstermine zur Angebotsabgabe nötig</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Zusatzleistungen transparent über Nachträge abrechnen</span>
                    </li>
                  </ul>
                </div>

                {/* Projektbündelung - Das Herzstück */}
                <div className="bg-gradient-to-r from-blue-500/10 to-teal-500/10 rounded-xl p-4 sm:p-5 border border-blue-400/30">
                  <h4 className="text-lg sm:text-xl font-semibold text-blue-300 mb-3">Projektbündelung – Mehr Umsatz, weniger Aufwand</h4>
                  <p className="text-gray-300 text-sm sm:text-base mb-4">
                    byndl erkennt automatisch, wenn mehrere Bauherren in Ihrer Region ähnliche Arbeiten benötigen, und bündelt diese intelligent zu Auftragspaketen. 
                    Das ermöglicht Ihnen eine effiziente Tourenplanung mit kurzen Wegen zwischen den einzelnen Baustellen.
                  </p>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span><strong className="text-green-400">Optimierte Logistik:</strong> Gebündelte Aufträge in direkter Nähe zueinander – für kurze Wege und eine effiziente Abwicklung</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span><strong className="text-green-400">Höhere Rentabilität:</strong> Größere Auftragsvolumen statt vieler unrentabler Einzelfahrten</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span><strong className="text-green-400">Bessere Planbarkeit:</strong> Zusammenhängende Aufträge erleichtern die Personal- und Materialplanung</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span><strong className="text-green-400">Weniger Verwaltung:</strong> Ein koordiniertes Auftragspaket statt mehrerer Einzelvorgänge</span>
                    </li>
                  </ul>
                </div>

                {/* Zeitersparnis */}
                <div className="bg-white/5 rounded-xl p-4 sm:p-5">
                  <h4 className="text-lg sm:text-xl font-semibold text-blue-300 mb-3">Zeitersparnis & Effizienz</h4>
                  <ul className="space-y-2 text-gray-200 text-sm sm:text-base">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Minimierter Akquiseaufwand durch qualifizierte Anfragen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Digitale Kommunikation mit Bauherren über die Plattform</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Einfache Nachtrags- und Terminverwaltung</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          PROJEKTBÜNDELUNG - VISUALISIERUNG
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-12 border border-white/20">
            <div className="text-center mb-8 sm:mb-12">
              <span className="inline-block px-4 py-2 bg-teal-500/20 rounded-full text-teal-400 text-sm font-semibold mb-4">
                Das Herzstück von byndl
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
                Intelligente Projektbündelung
              </h2>
              <p className="text-base sm:text-xl text-gray-200 max-w-3xl mx-auto">
                Unsere Plattform erkennt automatisch, wenn in einer Region mehrere Bauherren ähnliche Arbeiten benötigen. 
                Diese Projekte werden zeitlich und räumlich koordiniert, sodass Handwerker gebündelte Auftragspakete erhalten 
                und ihre Ressourcen optimal einsetzen können.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Regionale Bündelung</h3>
                <p className="text-gray-300 text-sm sm:text-base">Aufträge in geografischer Nähe werden zu effizienten Paketen zusammengefasst</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Zeitliche Koordination</h3>
                <p className="text-gray-300 text-sm sm:text-base">Ausschreibungsfristen werden synchronisiert, damit Handwerker Paketangebote abgeben können</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-teal-500/30 to-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Beiderseitiger Nutzen</h3>
                <p className="text-gray-300 text-sm sm:text-base">Bauherren profitieren von günstigeren Konditionen, Handwerker von höherer Rentabilität</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* So funktioniert's */}
      <section className="bg-white/5 backdrop-blur-lg py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-4xl font-bold text-center text-white mb-3 sm:mb-4">
            So einfach funktioniert's
          </h2>
          <p className="text-base sm:text-xl text-center text-gray-300 mb-10 sm:mb-16">
            In 4 Schritten zum erfolgreichen Bauprojekt
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
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
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-white text-xl sm:text-2xl font-bold shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">{item.title}</h3>
                  <p className="text-gray-300 text-xs sm:text-sm">{item.desc}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-6 sm:top-8 left-full w-full">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-teal-500 -ml-3 sm:-ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          NEUES PREISMODELL - STANDARDPREIS IM FOKUS
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
              Transparente Preise für Bauherren
            </h2>
            <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto">
              Faire Gebühren pro Leistungsverzeichnis – mit Mengenrabatt bei größeren Projekten
            </p>
          </div>
          
          {/* Hauptpreis-Box */}
          <div className="max-w-2xl mx-auto mb-8 sm:mb-12">
            <div className="bg-gradient-to-br from-teal-500/20 to-blue-500/20 backdrop-blur rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-2 border-teal-400/50 relative overflow-hidden">
              {/* Highlight Badge */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                <span className="px-3 py-1 bg-teal-500 text-white text-xs sm:text-sm font-bold rounded-full">
                  Standardpreis
                </span>
              </div>
              
              <div className="text-center">
                <p className="text-gray-300 text-sm sm:text-base mb-2">Pro Leistungsverzeichnis (LV)</p>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-5xl sm:text-7xl font-bold text-white">9,90</span>
                  <span className="text-2xl sm:text-3xl text-gray-300">€</span>
                </div>
                <p className="text-gray-400 text-sm sm:text-base mb-6">
                  Einmalige Gebühr • Keine versteckten Kosten • Keine Provision
                </p>
                
                <div className="bg-white/10 rounded-xl p-4 sm:p-6 text-left">
                  <h4 className="text-white font-semibold mb-3 text-center">Was ist ein Leistungsverzeichnis (LV)?</h4>
                  <p className="text-gray-300 text-sm sm:text-base">
                    Ein LV ist eine detaillierte Auflistung aller Arbeiten, die durchgeführt werden sollen. 
                    Jede Position beschreibt eine konkrete Leistung mit Menge, Einheit und Preis. 
                    Unsere KI analysiert Ihre Eingaben und generiert für jedes Gewerk einen spezifischen Fragenkatalog, 
                    um alle wesentlichen Details zu erfassen, die für ein technisch fachgerechtes LV erforderlich sind. 
                    Sie benötigen dabei keinerlei Fachwissen, um eine realistische Kostenschätzung auf aktuellen Marktdaten 
                    zu erhalten und Ihr Bauvorhaben professionell auszuschreiben zu können.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mengenrabatte */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-6 sm:mb-8">
              💰 Mengenrabatt für größere Projekte
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Ab 3 LVs */}
              <div className="bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-white/10 hover:border-teal-500/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🏠</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">Ab 3 Gewerken</h4>
                      <p className="text-gray-400 text-sm">z.B. Badsanierung, Küche</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">-10%</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-white">8,90</span>
                  <span className="text-gray-400">€ pro LV</span>
                </div>
                <p className="text-gray-500 text-sm mt-2">
                  Beispiel: 4 Gewerke = 35,60 € statt 39,60 €
                </p>
              </div>
              
              {/* Ab 6 LVs */}
              <div className="bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-white/10 hover:border-blue-500/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🏗️</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">Ab 6 Gewerken</h4>
                      <p className="text-gray-400 text-sm">z.B. Kernsanierung, Anbau</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">-20%</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-white">7,90</span>
                  <span className="text-gray-400">€ pro LV</span>
                </div>
                <p className="text-gray-500 text-sm mt-2">
                  Beispiel: 8 Gewerke = 63,20 € statt 79,20 €
                </p>
              </div>
            </div>
          </div>

          {/* Info-Box */}
          <div className="max-w-3xl mx-auto mt-8 sm:mt-12">
            <div className="bg-gradient-to-r from-slate-800/50 to-blue-900/30 rounded-xl p-5 sm:p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2 text-sm sm:text-base">So funktioniert die Abrechnung</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Sie beschreiben Ihr Projekt, unsere KI analysiert es und ermittelt die benötigten Gewerke. 
                    <span className="text-teal-400"> Für jedes Gewerk wird ein professionelles Leistungsverzeichnis erstellt.</span> 
                    {' '}Die Gebühr richtet sich nach der Gesamtanzahl der Gewerke. 
                    <strong className="text-white"> Keine versteckten Kosten, keine Provisionen.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Über uns Sektion */}
      <section id="ueber-uns" className="bg-gradient-to-r from-slate-800/50 to-blue-900/50 backdrop-blur-lg py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-4xl font-bold text-center text-white mb-6 sm:mb-8">
            Über uns
          </h2>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/20">
            <p className="text-base sm:text-lg text-gray-200 mb-4 sm:mb-6 leading-relaxed">
              byndl ist eine innovative digitale Plattform, die private Bauherren und Handwerksbetriebe effizient zusammenbringt. 
              Unser Ziel ist es, den gesamten Prozess privater Bau- und Renovierungsprojekte – von der ersten Idee über die 
              Ausschreibung bis zur Auftragsabwicklung – in einer integrierten Plattform abzubilden.
            </p>
            <p className="text-base sm:text-lg text-gray-200 mb-4 sm:mb-6 leading-relaxed">
              Damit reagieren wir auf zentrale Probleme der Baubranche: Intransparenz, Fragmentierung und häufige 
              Kostenüberschreitungen. Fast alle Bauvorhaben überschreiten ihr Budget – ein Zeichen dafür, wie dringend bessere 
              Planung und Kontrolle nötig sind.
            </p>
            <p className="text-base sm:text-lg text-gray-200 leading-relaxed">
              Wir setzen <span className="text-teal-400 font-semibold">künstliche Intelligenz (KI)</span> und 
              <span className="text-teal-400 font-semibold"> smarte Automatisierung</span> ein, um Bauherren durch den 
              Prozess zu führen und Handwerkern qualifizierte Aufträge zu verschaffen.
            </p>
          </div>
        </div>
      </section>

      {/* Kontaktformular */}
      <section id="kontakt" className="py-12 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-4xl font-bold text-center text-white mb-3 sm:mb-4">
            Kontakt
          </h2>
          <p className="text-base sm:text-xl text-center text-gray-300 mb-8 sm:mb-12">
            Haben Sie Fragen? Kontaktieren Sie uns gerne!
          </p>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
                className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold py-3 sm:py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formStatus === 'sending' ? 'Wird gesendet...' : 'ABSENDEN'}
              </button>
              
              {formStatus === 'success' && (
                <div className="bg-teal-500/20 border border-teal-500/50 rounded-lg p-4 text-teal-200 text-center text-sm sm:text-base">
                  Vielen Dank für Ihre Nachricht! Wir melden uns bald bei Ihnen.
                </div>
              )}
            </form>
            
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/20 text-center">
              <p className="text-gray-300 text-sm sm:text-base">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <section className="py-12 sm:py-20 bg-gradient-to-r from-teal-600/10 to-blue-600/10">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4 sm:mb-6">
            Starten Sie Ihr Projekt jetzt
          </h2>
          <p className="text-base sm:text-xl text-gray-300 mb-6 sm:mb-8">
            In nur 5 Minuten zur professionellen Ausschreibung
          </p>
          <Link
            to="/bauherr/register"
            className="inline-block bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold px-8 sm:px-12 py-4 sm:py-5 rounded-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 text-base sm:text-lg"
          >
            Projekt starten →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/30 py-8 sm:py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            {/* Logo und Info */}
            <div className="col-span-2">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">byndl</h3>
              <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
                Die intelligente Plattform für Ihr Bauprojekt
              </p>
              <p className="text-gray-500 text-sm">
                © 2025 BYNDL
              </p>
            </div>
            
            {/* Links Spalte 1 */}
            <div>
              <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Plattform</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/bauherr/register" className="text-gray-400 hover:text-teal-400 transition-colors">
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
              <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Rechtliches</h4>
              <ul className="space-y-2 text-sm">
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
          <div className="border-t border-white/10 pt-6 sm:pt-8 text-center">
            <p className="text-gray-500 text-xs sm:text-sm">
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
