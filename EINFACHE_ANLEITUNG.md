# BYNDL - Einfache Anleitung (ohne Fachjargon)

## 🎯 **Was Sie erreichen werden**
Am Ende haben Sie eine funktionierende Website, die automatisch Leistungsverzeichnisse für Bauprojekte erstellt.

## 📋 **Was Sie brauchen**
- Einen Computer mit Internet
- 30-45 Minuten Zeit
- Eine E-Mail-Adresse
- Eine Kreditkarte (für OpenAI - kostet nur wenige Euro)

---

## **TEIL 1: Vorbereitung (5 Minuten)**

### **Schritt 1: Dateien herunterladen**
1. Laden Sie das ZIP-Archiv `BYNDL_COMPLETE_DEPLOYMENT.zip` herunter
2. Entpacken Sie es auf Ihrem Computer (Rechtsklick → "Hier entpacken")
3. Sie sehen jetzt einen Ordner namens "PoC"

### **Schritt 2: GitHub vorbereiten**
1. Gehen Sie zu https://github.com
2. Loggen Sie sich in Ihr Konto ein
3. Gehen Sie zu Ihrem Repository: https://github.com/byndl-mvp/PoC
4. Klicken Sie auf "Upload files" (oder "Dateien hochladen")
5. Ziehen Sie ALLE Dateien aus dem entpackten "PoC"-Ordner in das Browser-Fenster
6. Scrollen Sie nach unten und klicken Sie auf "Commit changes" (grüner Button)

---

## **TEIL 2: OpenAI-Schlüssel besorgen (10 Minuten)**

### **Schritt 3: OpenAI-Konto erstellen**
1. Gehen Sie zu https://platform.openai.com
2. Klicken Sie auf "Sign up" (falls Sie noch kein Konto haben)
3. Melden Sie sich mit Ihrer E-Mail-Adresse an
4. Bestätigen Sie Ihre E-Mail-Adresse

### **Schritt 4: Zahlungsmethode hinzufügen**
1. Klicken Sie oben rechts auf Ihr Profil
2. Wählen Sie "Billing" (Abrechnung)
3. Klicken Sie auf "Add payment method" (Zahlungsmethode hinzufügen)
4. Geben Sie Ihre Kreditkartendaten ein
5. Setzen Sie ein Limit von 10€ (das reicht für Monate)

### **Schritt 5: API-Schlüssel erstellen**
1. Klicken Sie links auf "API keys" (API-Schlüssel)
2. Klicken Sie auf "Create new secret key" (Neuen geheimen Schlüssel erstellen)
3. Geben Sie einen Namen ein, z.B. "BYNDL"
4. Klicken Sie auf "Create secret key"
5. **WICHTIG:** Kopieren Sie den Schlüssel (beginnt mit "sk-") und speichern Sie ihn in einer Textdatei
6. **ACHTUNG:** Dieser Schlüssel wird nur einmal angezeigt!

---

## **TEIL 3: Backend (Server) einrichten (15 Minuten)**

### **Schritt 6: Render-Konto erstellen**
1. Gehen Sie zu https://render.com
2. Klicken Sie auf "Get Started" (Loslegen)
3. Wählen Sie "Sign up with GitHub" (Mit GitHub anmelden)
4. Erlauben Sie Render den Zugriff auf Ihr GitHub-Konto

### **Schritt 7: Server erstellen**
1. Klicken Sie auf "New +" (oben rechts)
2. Wählen Sie "Web Service" (Web-Dienst)
3. Suchen Sie Ihr Repository "byndl-mvp/PoC" und klicken Sie auf "Connect"

### **Schritt 8: Server konfigurieren**
Füllen Sie die Felder so aus:
- **Name:** `byndl-backend`
- **Region:** `Frankfurt (EU Central)` (oder das nächstgelegene)
- **Branch:** `main`
- **Runtime:** `Python 3`
- **Build Command:** `cd backend-python && pip install -r requirements.txt`
- **Start Command:** `cd backend-python && python main.py`

### **Schritt 9: OpenAI-Schlüssel eintragen**
1. Scrollen Sie nach unten zu "Environment Variables" (Umgebungsvariablen)
2. Klicken Sie auf "Add Environment Variable"
3. Tragen Sie ein:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** Hier fügen Sie Ihren OpenAI-Schlüssel ein (der mit "sk-" beginnt)
4. Klicken Sie nochmal auf "Add Environment Variable" und tragen Sie ein:
   - **Key:** `MODEL_OPENAI`
   - **Value:** `gpt-4o-mini`

### **Schritt 10: Server starten**
1. Klicken Sie auf "Create Web Service" (Web-Dienst erstellen)
2. Warten Sie 3-5 Minuten (Sie sehen den Fortschritt)
3. Wenn "Deploy succeeded" erscheint, ist Ihr Server fertig
4. Notieren Sie sich die URL (steht oben, z.B. "https://byndl-backend-xyz.onrender.com")

### **Schritt 11: Server testen**
1. Klicken Sie auf die URL Ihres Servers
2. Fügen Sie `/api/healthz` am Ende hinzu (z.B. "https://byndl-backend-xyz.onrender.com/api/healthz")
3. Sie sollten eine Meldung sehen mit "status": "healthy"
4. **Falls "degraded" steht:** Der OpenAI-Schlüssel ist falsch eingegeben

---

## **TEIL 4: Website einrichten (10 Minuten)**

### **Schritt 12: Netlify-Konto erstellen**
1. Gehen Sie zu https://netlify.com
2. Klicken Sie auf "Sign up" (Anmelden)
3. Wählen Sie "Sign up with GitHub" (Mit GitHub anmelden)

### **Schritt 13: Website erstellen**
1. Klicken Sie auf "Add new site" (Neue Website hinzufügen)
2. Wählen Sie "Import an existing project" (Vorhandenes Projekt importieren)
3. Klicken Sie auf "Deploy with GitHub" (Mit GitHub bereitstellen)
4. Wählen Sie Ihr Repository "byndl-mvp/PoC"

### **Schritt 14: Website konfigurieren**
Füllen Sie die Felder so aus:
- **Site name:** `byndl-demo` (oder einen Namen Ihrer Wahl)
- **Branch to deploy:** `main`
- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `frontend/dist`

### **Schritt 15: Server-Adresse eintragen**
1. Klicken Sie auf "Show advanced" (Erweitert anzeigen)
2. Klicken Sie auf "New variable" (Neue Variable)
3. Tragen Sie ein:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** Die URL Ihres Render-Servers + "/api" (z.B. "https://byndl-backend-xyz.onrender.com/api")

### **Schritt 16: Website starten**
1. Klicken Sie auf "Deploy site" (Website bereitstellen)
2. Warten Sie 2-3 Minuten
3. Wenn "Published" erscheint, ist Ihre Website fertig
4. Klicken Sie auf die URL (z.B. "https://byndl-demo.netlify.app")

---

## **TEIL 5: Alles testen (5 Minuten)**

### **Schritt 17: Funktionstest**
1. Öffnen Sie Ihre Website-URL
2. Klicken Sie auf "Projekt starten"
3. Füllen Sie das Formular aus:
   - **Hauptkategorie:** "Sanierung"
   - **Unterkategorie:** "Badsanierung"
   - **Beschreibung:** "Komplette Badsanierung mit neuen Sanitärobjekten"
   - **Budget:** "15.000-20.000 €"
4. Klicken Sie auf "Projekt anlegen und Fragebogen starten"

### **Schritt 18: Erfolg prüfen**
**✅ Wenn alles funktioniert:**
- Sie sehen Fragen zum Badezimmer
- Sie können Fragen beantworten
- Am Ende wird ein Leistungsverzeichnis erstellt
- Sie können es herunterladen

**❌ Wenn es nicht funktioniert:**
- Überprüfen Sie den OpenAI-Schlüssel in Render
- Überprüfen Sie die Server-URL in Netlify
- Warten Sie 5 Minuten und versuchen Sie es erneut

---

## **🎉 Geschafft!**

**Ihre URLs:**
- **Website:** https://ihr-name.netlify.app
- **Server:** https://byndl-backend-xyz.onrender.com

**Was Sie jetzt haben:**
- Eine funktionierende BYNDL-Website
- Automatische Leistungsverzeichnis-Erstellung
- Bereit für Präsentationen vor Investoren

## **💰 Kosten pro Monat**
- **Render:** 0€ (kostenlos)
- **Netlify:** 0€ (kostenlos)
- **OpenAI:** 1-5€ (je nach Nutzung)

## **🆘 Hilfe bei Problemen**

### **Problem: "Cannot read properties of undefined"**
**Lösung:** Server-URL in Netlify überprüfen (Schritt 15)

### **Problem: "API Key not found"**
**Lösung:** OpenAI-Schlüssel in Render überprüfen (Schritt 9)

### **Problem: Website lädt nicht**
**Lösung:** 5 Minuten warten, dann F5 drücken

### **Problem: Fragen werden nicht generiert**
**Lösung:** OpenAI-Guthaben überprüfen (mindestens 1€)

---

**Bei weiteren Fragen:** Überprüfen Sie die Logs in Render und Netlify oder kontaktieren Sie den Support der jeweiligen Plattform.

**Viel Erfolg! 🚀**

