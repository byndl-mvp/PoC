# BYNDL - Deployment-Anleitung für Render & Netlify

## 🎯 **Übersicht**

Diese Anleitung führt Sie Schritt für Schritt durch das Deployment der BYNDL-Anwendung auf Render (Backend) und Netlify (Frontend).

## 📋 **Voraussetzungen**

- GitHub-Account mit Zugriff auf das Repository `https://github.com/byndl-mvp/PoC`
- Render-Account (kostenlos): https://render.com
- Netlify-Account (kostenlos): https://netlify.com
- OpenAI API-Key (für LLM-Funktionen)

## 🔧 **Teil 1: Backend auf Render deployen**

### **Schritt 1: Repository vorbereiten**
1. Laden Sie das ZIP-Archiv herunter und extrahieren Sie es
2. Committen Sie alle Änderungen in Ihr GitHub-Repository:
   ```bash
   git add .
   git commit -m "Add Python backend and deployment configs"
   git push origin main
   ```

### **Schritt 2: Render-Service erstellen**
1. Gehen Sie zu https://render.com und loggen Sie sich ein
2. Klicken Sie auf **"New +"** → **"Web Service"**
3. Verbinden Sie Ihr GitHub-Repository:
   - Wählen Sie `byndl-mvp/PoC`
   - Branch: `main`

### **Schritt 3: Service konfigurieren**
**Grundeinstellungen:**
- **Name:** `byndl-backend`
- **Region:** `Frankfurt (EU Central)`
- **Branch:** `main`
- **Runtime:** `Python 3`

**Build & Deploy:**
- **Build Command:** `cd backend-python && pip install -r requirements.txt`
- **Start Command:** `cd backend-python && python main.py`

### **Schritt 4: Umgebungsvariablen setzen**
Fügen Sie folgende Environment Variables hinzu:

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `FLASK_ENV` | `production` | Flask-Umgebung |
| `PORT` | `5000` | Server-Port |
| `HOST` | `0.0.0.0` | Server-Host |
| `OPENAI_API_KEY` | `sk-...` | **Ihr OpenAI API-Key** |
| `MODEL_OPENAI` | `gpt-4o-mini` | OpenAI-Modell |

**⚠️ WICHTIG:** Setzen Sie Ihren echten OpenAI API-Key ein!

### **Schritt 5: Deployment starten**
1. Klicken Sie auf **"Create Web Service"**
2. Warten Sie auf das Deployment (ca. 3-5 Minuten)
3. Notieren Sie sich die URL: `https://byndl-backend.onrender.com`

### **Schritt 6: Backend testen**
Testen Sie das Backend:
```bash
curl https://byndl-backend.onrender.com/api/healthz
```

Erwartete Antwort:
```json
{
  "status": "healthy",
  "providers": {
    "openaiAvailable": true
  }
}
```




## 🌐 **Teil 2: Frontend auf Netlify deployen**

### **Schritt 1: Netlify-Site erstellen**
1. Gehen Sie zu https://netlify.com und loggen Sie sich ein
2. Klicken Sie auf **"Add new site"** → **"Import an existing project"**
3. Wählen Sie **"Deploy with GitHub"**
4. Wählen Sie Ihr Repository: `byndl-mvp/PoC`

### **Schritt 2: Build-Einstellungen konfigurieren**
**Site-Einstellungen:**
- **Site name:** `byndl-frontend` (oder Wunschname)
- **Branch to deploy:** `main`
- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `frontend/dist`

### **Schritt 3: Umgebungsvariablen setzen**
Gehen Sie zu **Site settings** → **Environment variables** und fügen Sie hinzu:

| Variable | Wert |
|----------|------|
| `VITE_API_BASE_URL` | `https://byndl-backend.onrender.com/api` |

**⚠️ WICHTIG:** Verwenden Sie die exakte URL Ihres Render-Backends!

### **Schritt 4: Deployment starten**
1. Klicken Sie auf **"Deploy site"**
2. Warten Sie auf das Deployment (ca. 2-3 Minuten)
3. Notieren Sie sich die URL: `https://your-site-name.netlify.app`

### **Schritt 5: Frontend testen**
1. Öffnen Sie die Netlify-URL in Ihrem Browser
2. Klicken Sie auf **"Projekt starten"**
3. Füllen Sie das Formular aus und testen Sie die Funktionalität

## 🔍 **Teil 3: Funktionstest**

### **Vollständiger Test-Workflow:**
1. **Frontend öffnen:** `https://your-site-name.netlify.app`
2. **Projekt erstellen:**
   - Hauptkategorie: "Sanierung"
   - Unterkategorie: "Badsanierung"
   - Beschreibung: "Komplette Badsanierung mit neuen Sanitärobjekten"
   - Budget: "15.000-20.000 €"
3. **Fragebogen starten:** Klick auf "Projekt anlegen und Fragebogen starten"
4. **Fragen beantworten:** Durchlaufen Sie den adaptiven Fragebogen
5. **LV generieren:** Lassen Sie das Leistungsverzeichnis erstellen
6. **Download testen:** Laden Sie das generierte Dokument herunter

### **Erwartete Ergebnisse:**
- ✅ Gewerke werden automatisch erkannt (z.B. Sanitär, Fliesen)
- ✅ Spezifische Fragen werden generiert (20-30+ pro Gewerk)
- ✅ LV wird mit realen Preisen erstellt
- ✅ Download-Funktion funktioniert

## 🚨 **Troubleshooting**

### **Backend-Probleme:**
- **Status "degraded":** API-Key nicht gesetzt oder ungültig
- **CORS-Fehler:** Überprüfen Sie die Frontend-URL in den Render-Einstellungen
- **Build-Fehler:** Überprüfen Sie die Python-Version und Dependencies

### **Frontend-Probleme:**
- **API-Fehler:** Überprüfen Sie die `VITE_API_BASE_URL` in Netlify
- **Build-Fehler:** Überprüfen Sie die Node.js-Version (sollte 20 sein)
- **Routing-Probleme:** Überprüfen Sie die `netlify.toml` Redirects

### **Häufige Fehler:**
1. **"Cannot read properties of undefined":** Backend-URL falsch oder Backend nicht erreichbar
2. **"CORS policy":** Backend-CORS nicht korrekt konfiguriert
3. **"API Key not found":** OpenAI API-Key nicht gesetzt oder ungültig

## 📊 **Monitoring & Logs**

### **Render-Logs:**
- Gehen Sie zu Ihrem Service → **"Logs"**
- Überwachen Sie Fehler und Performance

### **Netlify-Logs:**
- Gehen Sie zu Ihrer Site → **"Deploys"** → **"Deploy log"**
- Überprüfen Sie Build-Fehler

### **Browser-Logs:**
- Öffnen Sie die Entwicklertools (F12)
- Überprüfen Sie Console und Network-Tab

## 🎉 **Erfolgreiches Deployment**

Nach erfolgreichem Deployment haben Sie:
- ✅ **Backend:** `https://byndl-backend.onrender.com`
- ✅ **Frontend:** `https://your-site-name.netlify.app`
- ✅ **Vollständige BYNDL-Funktionalität**
- ✅ **Bereit für Präsentationen**

## 📞 **Support**

Bei Problemen:
1. Überprüfen Sie die Logs in Render/Netlify
2. Testen Sie die API-Endpoints direkt
3. Überprüfen Sie alle Umgebungsvariablen
4. Kontaktieren Sie den Support der jeweiligen Plattform

---

**Erstellt:** 12.08.2025  
**Version:** 1.0.0  
**Status:** Produktionsbereit


## 🔑 **API-Keys einsetzen - Detaillierte Anleitung**

### **OpenAI API-Key beschaffen:**
1. Gehen Sie zu https://platform.openai.com
2. Loggen Sie sich ein oder erstellen Sie einen Account
3. Navigieren Sie zu **"API Keys"** im Dashboard
4. Klicken Sie auf **"Create new secret key"**
5. Kopieren Sie den Key (beginnt mit `sk-...`)
6. **⚠️ WICHTIG:** Speichern Sie den Key sicher - er wird nur einmal angezeigt!

### **API-Key in Render einsetzen:**

#### **Methode 1: Über das Dashboard (Empfohlen)**
1. Gehen Sie zu https://dashboard.render.com
2. Wählen Sie Ihren `byndl-backend` Service
3. Klicken Sie auf **"Environment"** im linken Menü
4. Klicken Sie auf **"Add Environment Variable"**
5. Setzen Sie:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** `sk-proj-...` (Ihr kompletter API-Key)
6. Klicken Sie auf **"Save Changes"**
7. Der Service wird automatisch neu deployed

#### **Methode 2: Über render.yaml (Erweitert)**
Falls Sie die `render.yaml` verwenden:
```yaml
envVars:
  - key: OPENAI_API_KEY
    sync: false  # Manuell setzen, nicht aus Git
```
Dann manuell im Dashboard setzen (siehe Methode 1).

### **API-Key-Validierung:**

#### **Schritt 1: Backend-Status prüfen**
Nach dem Setzen des API-Keys:
```bash
curl https://byndl-backend.onrender.com/api/healthz
```

#### **Erwartete Antwort (Erfolg):**
```json
{
  "status": "healthy",
  "environment": "production",
  "providers": {
    "activeProvider": "openai",
    "openaiAvailable": true,
    "openaiModel": "gpt-4o-mini"
  },
  "issues": []
}
```

#### **Fehlerhafte Antwort (API-Key fehlt):**
```json
{
  "status": "degraded",
  "issues": ["OPENAI_API_KEY nicht gesetzt"],
  "providers": {
    "openaiAvailable": false
  }
}
```

### **Lokale Entwicklung (Optional):**

Falls Sie lokal entwickeln möchten:

#### **Backend (.env-Datei):**
Erstellen Sie `backend-python/.env`:
```env
OPENAI_API_KEY=sk-proj-...
MODEL_OPENAI=gpt-4o-mini
FLASK_ENV=development
```

#### **Frontend (.env-Datei):**
Erstellen Sie `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### **Sicherheitshinweise:**

#### **✅ Sichere Praktiken:**
- API-Keys nur über Dashboard/Environment Variables setzen
- Niemals API-Keys in Git committen
- Regelmäßig API-Keys rotieren
- Verwendung überwachen (OpenAI Dashboard)

#### **❌ Vermeiden Sie:**
- API-Keys in Code-Dateien
- API-Keys in öffentlichen Repositories
- Unverschlüsselte Übertragung
- Sharing von API-Keys

### **Kosten-Monitoring:**

#### **OpenAI-Kosten überwachen:**
1. Gehen Sie zu https://platform.openai.com/usage
2. Setzen Sie Spending-Limits
3. Überwachen Sie die monatliche Nutzung
4. Typische BYNDL-Kosten: ~$0.01-0.05 pro LV-Generierung

#### **Render-Kosten:**
- Free Tier: 750 Stunden/Monat kostenlos
- Danach: $7/Monat für kontinuierlichen Betrieb

#### **Netlify-Kosten:**
- Free Tier: 100GB Bandwidth/Monat
- Für BYNDL-Demo vollständig ausreichend

### **Troubleshooting API-Keys:**

#### **Problem: "API Key not found"**
**Lösung:**
1. Überprüfen Sie die Schreibweise: `OPENAI_API_KEY`
2. Stellen Sie sicher, dass der Key mit `sk-` beginnt
3. Neu-Deployment in Render auslösen

#### **Problem: "Invalid API Key"**
**Lösung:**
1. Generieren Sie einen neuen API-Key bei OpenAI
2. Überprüfen Sie Ihr OpenAI-Guthaben
3. Stellen Sie sicher, dass der Account aktiv ist

#### **Problem: "Rate limit exceeded"**
**Lösung:**
1. Warten Sie einige Minuten
2. Überprüfen Sie Ihr OpenAI-Tier (Free vs. Paid)
3. Implementieren Sie Rate-Limiting im Code

### **API-Key-Test-Workflow:**

#### **Schritt-für-Schritt-Test:**
1. **API-Key setzen** (siehe oben)
2. **Backend neu starten** (automatisch in Render)
3. **Health-Check:** `curl .../api/healthz`
4. **Frontend testen:** Projekt anlegen
5. **LLM-Funktionen testen:** Fragebogen generieren
6. **Vollständiger Test:** LV erstellen

#### **Erwartete Funktionalität mit API-Key:**
- ✅ Automatische Gewerke-Erkennung aus Projektbeschreibung
- ✅ Adaptive Fragenfluss-Generierung (20-30+ Fragen)
- ✅ Intelligente LV-Erstellung mit Preisen
- ✅ Kontextuelle Anpassung der Fragen

#### **Ohne API-Key (Fallback):**
- ⚠️ Keyword-basierte Gewerke-Erkennung
- ⚠️ Statische Fragenkataloge
- ⚠️ Basis-LV ohne intelligente Anpassung
- ❌ Keine adaptiven Funktionen

