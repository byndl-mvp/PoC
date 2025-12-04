import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

// Kategorien-Struktur
const CATEGORIES = {
  'Neubau': [
    'Einfamilienhaus (freistehend)',
    'Doppelhaushälfte (einseitig angebaut)',
    'Reihenhaus (beidseitig angebaut/Baulücke)',
    'Bungalow',
    'Tiny House / Minihaus',
  ],
  'Erweiterungsbau': [
    'Anbau (Raumerweiterung)',
    'Aufstockung (zusätzliche Etage)',
    'Dachausbau (Wohnraum unterm Dach)',
    'Wintergarten / Glasanbau',
    'Einliegerwohnung',
    'Kellerausbau zum Wohnraum',
  ],
  'Sanierung': [
    'Kernsanierung (Komplettsanierung)',
    'Teilsanierung',
    'Altbausanierung',
    'Kellersanierung',
    'Dachsanierung',
    'Fassadensanierung',
    'Schadstoffsanierung (Asbest/Schimmel)',
    'Feuchtigkeitssanierung / Trockenlegung',
  ],
  'Energetische Sanierung': [
    'KfW-Effizienzhaus-Sanierung (Komplett)',
    'Fassadendämmung (WDVS)',
    'Dachsanierung mit Dämmung',
    'Kellerdeckendämmung',
    'Fenstertausch',
    'Heizungstausch (Wärmepumpe, Gas, Pellet)',
    'Photovoltaikanlage / Solarthermie',
    'Wallbox / E-Ladestation',
  ],
  'Innenausbau / Renovierung': [
    'Badsanierung (Komplett)',
    'Badteilsanierung (z.B. Dusche/Wanne)',
    'Küchensanierung',
    'Bodenbeläge (Parkett/Fliesen/Vinyl)',
    'Wandgestaltung (Putz/Tapete/Farbe)',
    'Türen und Zargen',
    'Trockenbau (Raumaufteilung, Abhangdecken, Schallschutz)',
    'Treppensanierung / Neubau',
  ],
  'Umbau / Grundrissänderung': [
    'Wanddurchbruch (nicht tragend)',
    'Wanddurchbruch (tragend, mit Statik)',
    'Raumzusammenlegung',
    'Raumteilung',
    'Türversetzung / neue Türöffnung',
    'Barrierefreier Umbau',
  ],
  'Rohbauarbeiten': [
    'Erdarbeiten / Aushub',
    'Mauer- und Betonarbeiten (Bodenplatte/Wände/Decken/Stützen)',
    'Dachstuhl / Zimmererarbeiten',
    'Drainage / Abdichtung',
  ],
  'Rückbau / Abbruch': [
    'Komplettabriss Gebäude',
    'Teilabriss',
    'Entkernung',
  ],
  'Haustechnik (TGA)': [
    'Heizungsinstallation komplett',
    'Sanitärinstallation komplett',
    'Elektroinstallation komplett',
    'Smart Home / Gebäudeautomation',
    'Lüftungsanlage mit Wärmerückgewinnung',
    'Klimaanlage',
  ],
  'Dach': [
    'Dacheindeckung neu (Ziegel/Schiefer)',
    'Flachdachsanierung',
    'Dachrinnen und Fallrohre',
    'Dachfenster / Dachflächenfenster',
    'Gaube neu',
    'Schornsteinsanierung',
    'Dachbegrünung',
  ],
  'Außenanlagen': [
    'Terrasse (Holz/WPC/Stein/Fliesen)',
    'Pflasterarbeiten / Einfahrt/Gehwege',
    'Zaunbau / Sichtschutz',
    'Carport',
    'Gartenhaus',
    'Pool / Schwimmteich',
    'Gartenneugestaltung',
  ],
  'Sonstiges': [],
};

export default function ProjectFormPage() {
  const navigate = useNavigate();
  
  // Check ob Bauherr eingeloggt ist
  const bauherrData = JSON.parse(sessionStorage.getItem('bauherrData') || sessionStorage.getItem('userData') || '{}');
  const isLoggedIn = bauherrData.email && bauherrData.name;
  
  // Startsektion basierend auf Login-Status
  const [currentSection, setCurrentSection] = useState(isLoggedIn ? 'project' : 'user');
  
  const [form, setForm] = useState({
    // Nutzerdaten - bei eingeloggten Usern vorausfüllen
    userName: isLoggedIn ? bauherrData.name : '',
    userEmail: isLoggedIn ? bauherrData.email : '',
    // Projektadresse
    projectStreet: '',
    projectHouseNumber: '',
    projectZip: '',
    projectCity: '',
    // Projektdetails
    category: '',
    subCategories: [],
    description: '',
    timeframe: '',
    budget: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'category') {
      setForm(prev => ({ ...prev, category: value, subCategories: [] }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubCategoryToggle = (subCategory) => {
    setForm(prev => ({
      ...prev,
      subCategories: prev.subCategories.includes(subCategory)
        ? prev.subCategories.filter(sc => sc !== subCategory)
        : [...prev.subCategories, subCategory]
    }));
  };

  const handleSectionChange = (section) => {
    // Validierung für User-Section
    if (currentSection === 'user' && section === 'project') {
      if (!form.userName || !form.userEmail || !form.projectStreet || 
          !form.projectHouseNumber || !form.projectZip || !form.projectCity) {
        setError('Bitte füllen Sie alle Pflichtfelder aus.');
        return;
      }
      // E-Mail Validierung
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.userEmail)) {
        setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        return;
      }
      // PLZ Validierung
      if (form.projectZip.length !== 5 || !/^\d{5}$/.test(form.projectZip)) {
        setError('Bitte geben Sie eine gültige 5-stellige Postleitzahl ein.');
        return;
      }
    }
    setError('');
    setCurrentSection(section);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validierung für eingeloggte User - nur Projektadresse prüfen
    if (isLoggedIn && (!form.projectStreet || !form.projectHouseNumber || 
        !form.projectZip || !form.projectCity)) {
      setError('Bitte füllen Sie alle Adressfelder aus.');
      return;
    }
    
    if (form.category && form.category !== 'Sonstiges' && form.subCategories.length === 0) {
      setError('Bitte wählen Sie mindestens eine Unterkategorie aus.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const projectData = {
        // User data - bei eingeloggten Nutzern aus Session nehmen
        userName: isLoggedIn ? bauherrData.name : form.userName,
        userEmail: isLoggedIn ? bauherrData.email : form.userEmail,
        // Bauherr ID mitschicken wenn eingeloggt
        bauherrId: isLoggedIn ? bauherrData.id : null,
        // Project address
        address: {
          street: form.projectStreet,
          houseNumber: form.projectHouseNumber,
          zipCode: form.projectZip,
          city: form.projectCity,
        },
        // Project details
        category: form.category,
        subCategory: form.subCategories.join(', '),
        description: form.description,
        timeframe: form.timeframe,
        budget: form.budget ? Number(form.budget) : null,
      };

      const res = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Fehler beim Anlegen des Projekts');
      }
      
      const data = await res.json();
      const { project } = data;

      // Projekt-ID in Session speichern für späteren Zugriff
      sessionStorage.setItem('currentProjectId', project.id);
      
      // Nur für nicht eingeloggte User speichern
      if (!isLoggedIn) {
        sessionStorage.setItem('userData', JSON.stringify({
          name: form.userName,
          email: form.userEmail
        }));
      }
      
      // Direkt zur Intake-Seite navigieren
      navigate(`/project/${project.id}/intake`);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const availableSubCategories = form.category ? CATEGORIES[form.category] || [] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <a href="/" className="text-white text-3xl font-bold hover:text-teal-400 transition-colors">
            byndl
          </a>
          <p className="text-gray-400 text-sm mt-1">einfach . bauen</p>
        </div>

        {/* Progress Indicator - nur zeigen wenn nicht eingeloggt */}
        {!isLoggedIn && (
          <div className="flex justify-between items-center mb-12 max-w-md mx-auto">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                currentSection === 'user' ? 'bg-teal-500' : 'bg-teal-600'
              }`}>
                {currentSection === 'project' ? '✓' : '1'}
              </div>
              <span className="ml-2 text-white text-sm">Ihre Daten</span>
            </div>
            <div className="flex-1 h-0.5 bg-white/20 mx-2"></div>
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                currentSection === 'project' ? 'bg-teal-500 text-white' : 'bg-white/20 text-white/60'
              }`}>
                2
              </div>
              <span className={`ml-2 text-sm ${
                currentSection === 'project' ? 'text-white' : 'text-white/60'
              }`}>Projektdetails</span>
            </div>
          </div>
        )}

        {/* Main Title anpassen */}
        <div className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            {isLoggedIn ? 'Neues Projekt anlegen' : 'Projekt anlegen'}
          </h1>
          <p className="text-xl text-gray-300">
            {isLoggedIn 
              ? 'Beschreiben Sie Ihr Bauvorhaben' 
              : 'In wenigen Schritten zur professionellen Ausschreibung'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Nutzerdaten - NUR für nicht eingeloggte User */}
            {currentSection === 'user' && !isLoggedIn && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white border-b border-white/20 pb-2">
                  Ihre Kontaktdaten
                </h2>
                
                {/* Name */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Ihr Name *
                  </label>
                  <input
                    type="text"
                    name="userName"
                    value={form.userName}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Max Mustermann"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    E-Mail Adresse *
                  </label>
                  <input
                    type="email"
                    name="userEmail"
                    value={form.userEmail}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="max.mustermann@email.de"
                  />
                  <p className="mt-2 text-sm text-gray-400">
                    Für Rückfragen und Angebotsübermittlung
                  </p>
                </div>

                <h2 className="text-2xl font-semibold text-white border-b border-white/20 pb-2 mt-8">
                  Projektstandort
                </h2>
                
                {/* Straße und Hausnummer */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-white font-medium mb-2">
                      Straße *
                    </label>
                    <input
                      type="text"
                      name="projectStreet"
                      value={form.projectStreet}
                      onChange={handleChange}
                      required
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Musterstraße"
                    />
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Hausnr. *
                    </label>
                    <input
                      type="text"
                      name="projectHouseNumber"
                      value={form.projectHouseNumber}
                      onChange={handleChange}
                      required
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="12a"
                    />
                  </div>
                </div>

                {/* PLZ und Ort */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      PLZ *
                    </label>
                    <input
                      type="text"
                      name="projectZip"
                      value={form.projectZip}
                      onChange={handleChange}
                      required
                      pattern="[0-9]{5}"
                      maxLength="5"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="52349"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-white font-medium mb-2">
                      Ort *
                    </label>
                    <input
                      type="text"
                      name="projectCity"
                      value={form.projectCity}
                      onChange={handleChange}
                      required
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Düren"
                    />
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-teal-500/20 border border-teal-500/50 rounded-lg p-4">
                  <p className="text-teal-200 text-sm">
                    <strong>💡 Warum brauchen wir die Adresse?</strong><br />
                    Die genaue Projektadresse ermöglicht uns, Handwerker aus Ihrer Region zu finden 
                    und ähnliche Projekte in Ihrer Nähe zu bündeln - für bessere Preise und kürzere Wartezeiten.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-200">{error}</p>
                  </div>
                )}

                {/* Continue Button */}
                <button
                  type="button"
                  onClick={() => handleSectionChange('project')}
                  className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold py-4 rounded-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200"
                >
                  Weiter zu Projektdetails →
                </button>
              </div>
            )}

            {/* Section 2: Projektdetails - Direkt für eingeloggte User */}
            {(currentSection === 'project' || (isLoggedIn && currentSection !== 'user')) && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white border-b border-white/20 pb-2">
                  Projektdetails
                </h2>
                
                {/* Back Button - nur für nicht eingeloggte User */}
                {!isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => handleSectionChange('user')}
                    className="text-gray-400 hover:text-white transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                    Zurück
                  </button>
                )}
                
                {/* Projektadresse für eingeloggte User */}
                {isLoggedIn && (
                  <>
                    <h3 className="text-lg font-semibold text-white mt-6">Projektstandort</h3>
                    
                    {/* Straße und Hausnummer */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-white font-medium mb-2">
                          Straße *
                        </label>
                        <input
                          type="text"
                          name="projectStreet"
                          value={form.projectStreet}
                          onChange={handleChange}
                          required
                          className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Musterstraße"
                        />
                      </div>
                      <div>
                        <label className="block text-white font-medium mb-2">
                          Hausnr. *
                        </label>
                        <input
                          type="text"
                          name="projectHouseNumber"
                          value={form.projectHouseNumber}
                          onChange={handleChange}
                          required
                          className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="12a"
                        />
                      </div>
                    </div>
                    
                    {/* PLZ und Ort */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">
                          PLZ *
                        </label>
                        <input
                          type="text"
                          name="projectZip"
                          value={form.projectZip}
                          onChange={handleChange}
                          required
                          pattern="[0-9]{5}"
                          maxLength="5"
                          className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="52349"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-white font-medium mb-2">
                          Ort *
                        </label>
                        <input
                          type="text"
                          name="projectCity"
                          value={form.projectCity}
                          onChange={handleChange}
                          required
                          className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Düren"
                        />
                      </div>
                    </div>
                    
                    {/* Info Box für Adresse */}
                    <div className="bg-teal-500/20 border border-teal-500/50 rounded-lg p-4">
                      <p className="text-teal-200 text-sm">
                        <strong>💡 Warum brauchen wir die Adresse?</strong><br />
                        Die genaue Projektadresse ermöglicht uns, Handwerker aus Ihrer Region zu finden 
                        und ähnliche Projekte in Ihrer Nähe zu bündeln - für bessere Preise und kürzere Wartezeiten.
                      </p>
                    </div>
                  </>
                )}

                {/* Hauptkategorie */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Hauptkategorie *
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="" className="bg-slate-800">Bitte wählen</option>
                    {Object.keys(CATEGORIES).map(cat => (
                      <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Unterkategorien - nicht bei Sonstiges */}
                {form.category && form.category !== 'Sonstiges' && (
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Unterkategorien * 
                      <span className="text-gray-400 font-normal ml-2">(Mehrfachauswahl möglich)</span>
                    </label>
                    <div className="bg-white/10 rounded-lg p-4 max-h-60 overflow-y-auto">
                      {availableSubCategories.map(subCat => (
                        <label
                          key={subCat}
                          className="flex items-center text-white hover:bg-white/10 rounded p-2 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={form.subCategories.includes(subCat)}
                            onChange={() => handleSubCategoryToggle(subCat)}
                            className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500 focus:ring-2"
                          />
                          <span>{subCat}</span>
                        </label>
                      ))}
                    </div>
                    {form.subCategories.length > 0 && (
                      <div className="mt-2 text-sm text-gray-400">
                        Ausgewählt: {form.subCategories.length} Unterkategorie(n)
                      </div>
                    )}
                  </div>
                )}

                {/* Beschreibung */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Projektbeschreibung *
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    rows={5}
                    placeholder="Beschreiben Sie Ihr Vorhaben in eigenen Worten. Die KI hilft Ihnen, daraus ein professionelles Leistungsverzeichnis zu erstellen..."
                  />
                  <p className="mt-2 text-sm text-gray-400">
                    Je detaillierter Ihre Beschreibung, desto präziser die Ausschreibung
                  </p>
                </div>

                {/* Zeitrahmen */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Gewünschter Ausführungszeitraum
                  </label>
                  <select
                    name="timeframe"
                    value={form.timeframe}
                    onChange={handleChange}
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="" className="bg-slate-800">Keine Angabe</option>
                    <option value="asap" className="bg-slate-800">So bald wie möglich</option>
                    <option value="1mon" className="bg-slate-800">Innerhalb 1 Monat</option>
                    <option value="3mon" className="bg-slate-800">In 3 Monaten</option>
                    <option value="6mon" className="bg-slate-800">In 6 Monaten</option>
                    <option value="year" className="bg-slate-800">Innerhalb eines Jahres</option>
                    <option value="planning" className="bg-slate-800">Noch in Planung</option>
                  </select>
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Geplantes Budget
                    <span className="text-gray-400 font-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={form.budget}
                    onChange={handleChange}
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Budget in EUR"
                    min="0"
                    step="100"
                  />
                </div>

                {/* Info zur Preisgestaltung */}
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-blue-200 text-sm">
                    <strong>ℹ️ Hinweis zur Preisgestaltung:</strong><br />
                    Die Gebühr für die KI-gestützte Ausschreibung richtet sich nach der Anzahl der Gewerke 
                    und wird Ihnen nach der automatischen Gewerke-Erkennung angezeigt.
                  </p>
                </div>

                {/* Hinweis bei genehmigungspflichtigen Arbeiten */}
                {(form.category === 'Neubau' ||
                  form.category === 'Erweiterungsbau' || 
                  form.category === 'Umbau / Grundrissänderung' ||
                  form.category === 'Rohbauarbeiten' ||
                  form.subCategories.some(sc => 
                    sc.includes('Anbau') || 
                    sc.includes('Aufstockung') || 
                    sc.includes('Dachausbau') ||
                    sc.includes('Wanddurchbruch') ||
                    sc.includes('Einliegerwohnung')
                  )) && (
                  <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                    <p className="text-yellow-200 text-sm">
                      <strong>⚠️ Hinweis:</strong> Bei strukturellen Änderungen oder Nutzungsänderungen 
                      kann eine Baugenehmigung erforderlich sein. Bitte prüfen Sie die lokale Bauordnung.
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-200">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || (form.category && form.category !== 'Sonstiges' && form.subCategories.length === 0)}
                  className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold py-4 rounded-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Projekt wird angelegt...
                    </span>
                  ) : (
                    'Projekt anlegen und KI-Analyse starten →'
                  )}
                </button>
              </div>
            )}

          </form>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Nach dem Anlegen analysiert die KI Ihr Projekt und erkennt 
            automatisch die benötigten Gewerke.
          </p>
        </div>
      </div>
    </div>
  );
}
