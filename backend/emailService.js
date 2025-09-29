// ============================================================================
// E-MAIL SERVICE FÜR BYNDL
// ============================================================================
// Installation: npm install nodemailer dotenv

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

// ============================================================================
// KONFIGURATION
// ============================================================================

// E-Mail Transporter erstellen (z.B. für Gmail, SendGrid, oder andere)
const createTransporter = () => {
  // Option 1: Gmail (für Entwicklung/Test)
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // App-spezifisches Passwort verwenden!
      }
    });
  }
  
  // Option 2: SendGrid (empfohlen für Produktion)
  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    return nodemailer.createTransporter({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // Option 3: Generischer SMTP Server
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true für 465, false für andere Ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Transporter initialisieren
const transporter = createTransporter();

// ============================================================================
// E-MAIL TEMPLATES
// ============================================================================

const emailTemplates = {
  // Handwerker Registrierungs-Bestätigung
  handwerkerRegistration: (data) => ({
    subject: 'Willkommen bei byndl - Ihre Registrierung war erfolgreich',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #14b8a6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .info-box { background: white; padding: 20px; border-left: 4px solid #14b8a6; margin: 20px 0; }
          .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
          h1 { margin: 0; font-size: 32px; }
          .company-id { font-size: 24px; font-weight: bold; color: #14b8a6; background: white; padding: 15px; border-radius: 5px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>byndl</h1>
            <p style="margin-top: 10px;">Ihre Plattform für erfolgreiche Bauprojekte</p>
          </div>
          
          <div class="content">
            <h2>Herzlich Willkommen, ${data.companyName}!</h2>
            
            <p>Vielen Dank für Ihre Registrierung bei byndl. Ihr Handwerksbetrieb wurde erfolgreich in unserem System angelegt.</p>
            
            <div class="info-box">
              <strong>Ihre Betriebs-ID:</strong>
              <div class="company-id">${data.companyId}</div>
              <p style="color: #666; font-size: 14px;">Bitte bewahren Sie diese ID sicher auf. Sie benötigen sie für den Login.</p>
            </div>
            
            <h3>Nächste Schritte:</h3>
            <ol>
              <li><strong>E-Mail-Adresse bestätigen:</strong> Klicken Sie auf den Button unten</li>
              <li><strong>Profil vervollständigen:</strong> Laden Sie Zertifikate und Referenzen hoch</li>
              <li><strong>Erste Projekte finden:</strong> Durchsuchen Sie passende Ausschreibungen</li>
            </ol>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/handwerker/verify?token=${data.verificationToken}" class="button">
                E-Mail-Adresse bestätigen
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Der Bestätigungslink ist 48 Stunden gültig. Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:
            </p>
            <p style="word-break: break-all; color: #0066cc; font-size: 12px;">
              ${process.env.FRONTEND_URL}/handwerker/verify?token=${data.verificationToken}
            </p>
            
            <h3>Ihre Vorteile bei byndl:</h3>
            <ul>
              <li>✅ Qualifizierte Anfragen mit vollständigen Leistungsverzeichnissen</li>
              <li>✅ Regionale Projektbündelung für optimale Auslastung</li>
              <li>✅ Keine Akquisekosten - nur Provision bei erfolgreichem Auftrag</li>
              <li>✅ Digitale Abwicklung spart Zeit und Ressourcen</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht darauf.</p>
            <p>Bei Fragen wenden Sie sich an: support@byndl.de</p>
            <p>&copy; 2024 byndl - Alle Rechte vorbehalten</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Willkommen bei byndl, ${data.companyName}!
      
      Ihre Registrierung war erfolgreich. Ihre Betriebs-ID lautet: ${data.companyId}
      
      Bitte bestätigen Sie Ihre E-Mail-Adresse:
      ${process.env.FRONTEND_URL}/handwerker/verify?token=${data.verificationToken}
      
      Bei Fragen: support@byndl.de
    `
  }),
  
  // Passwort-Reset E-Mail
  passwordReset: (data) => ({
    subject: 'byndl - Passwort zurücksetzen',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>byndl</h1>
            <p>Passwort zurücksetzen</p>
          </div>
          
          <div class="content">
            <h2>Hallo ${data.contactPerson || data.companyName},</h2>
            
            <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/handwerker/reset-password?token=${data.resetToken}" class="button">
                Neues Passwort festlegen
              </a>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Sicherheitshinweis:</strong>
              <ul style="margin: 10px 0;">
                <li>Dieser Link ist nur 1 Stunde gültig</li>
                <li>Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail</li>
                <li>Ihr Passwort bleibt unverändert, solange Sie nicht auf den Link klicken</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Falls der Button nicht funktioniert, kopieren Sie diesen Link:
            </p>
            <p style="word-break: break-all; color: #0066cc; font-size: 12px;">
              ${process.env.FRONTEND_URL}/handwerker/reset-password?token=${data.resetToken}
            </p>
          </div>
          
          <div class="footer">
            <p>Diese E-Mail wurde automatisch generiert.</p>
            <p>Bei Fragen: support@byndl.de</p>
            <p>&copy; 2024 byndl</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Passwort zurücksetzen für ${data.companyName}
      
      Klicken Sie auf diesen Link, um ein neues Passwort festzulegen:
      ${process.env.FRONTEND_URL}/handwerker/reset-password?token=${data.resetToken}
      
      Der Link ist 1 Stunde gültig.
      
      Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.
    `
  }),
  
  // Login-Benachrichtigung bei verdächtigem Zugriff
  loginNotification: (data) => ({
    subject: 'byndl - Neuer Login erkannt',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fbbf24; color: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-table { width: 100%; margin: 20px 0; }
          .info-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          .info-table td:first-child { font-weight: bold; width: 40%; }
          .button { display: inline-block; padding: 10px 25px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin: 15px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Neuer Login erkannt</h1>
          </div>
          
          <div class="content">
            <h2>Hallo ${data.companyName},</h2>
            
            <p>Es wurde ein neuer Login zu Ihrem byndl-Konto erkannt:</p>
            
            <table class="info-table">
              <tr>
                <td>Zeitpunkt:</td>
                <td>${new Date(data.loginTime).toLocaleString('de-DE')}</td>
              </tr>
              <tr>
                <td>IP-Adresse:</td>
                <td>${data.ipAddress}</td>
              </tr>
              <tr>
                <td>Browser:</td>
                <td>${data.userAgent}</td>
              </tr>
              <tr>
                <td>Standort (ungefähr):</td>
                <td>${data.location || 'Unbekannt'}</td>
              </tr>
            </table>
            
            <p><strong>Waren Sie das?</strong></p>
            <p>Falls ja, können Sie diese E-Mail ignorieren.</p>
            
            <p><strong>Waren Sie das nicht?</strong></p>
            <p>Sichern Sie sofort Ihr Konto:</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/handwerker/security" class="button">
                Passwort ändern
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>Sicherheit ist uns wichtig. Bei Fragen: security@byndl.de</p>
            <p>&copy; 2024 byndl</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Neuer Login zu Ihrem byndl-Konto erkannt
      
      Zeit: ${new Date(data.loginTime).toLocaleString('de-DE')}
      IP: ${data.ipAddress}
      
      Waren Sie das nicht? Ändern Sie sofort Ihr Passwort:
      ${process.env.FRONTEND_URL}/handwerker/security
    `
  })
};

// ============================================================================
// E-MAIL VERSAND FUNKTIONEN
// ============================================================================

class EmailService {
  // Handwerker Registrierungs-E-Mail senden
  async sendHandwerkerRegistrationEmail(handwerkerData) {
    try {
      // Verification Token generieren
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Token in DB speichern (muss in Ihrer DB-Route implementiert werden)
      await query(
        `UPDATE handwerker 
         SET email_verification_token = $1,
             email_verification_expires = $2
         WHERE id = $3`,
        [
          verificationToken,
          new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 Stunden
          handwerkerData.id
        ]
      );
      
      // E-Mail Template abrufen
      const template = emailTemplates.handwerkerRegistration({
        ...handwerkerData,
        verificationToken
      });
      
      // E-Mail senden
      const info = await transporter.sendMail({
        from: `"byndl Platform" <${process.env.EMAIL_FROM || 'noreply@byndl.de'}>`,
        to: handwerkerData.email,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
      
      console.log('Registrierungs-E-Mail gesendet:', info.messageId);
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      console.error('Fehler beim E-Mail-Versand:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Passwort-Reset E-Mail senden
  async sendPasswordResetEmail(email, resetToken, handwerkerData) {
    try {
      const template = emailTemplates.passwordReset({
        ...handwerkerData,
        resetToken
      });
      
      const info = await transporter.sendMail({
        from: `"byndl Security" <${process.env.EMAIL_FROM || 'security@byndl.de'}>`,
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
      
      console.log('Passwort-Reset E-Mail gesendet:', info.messageId);
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      console.error('Fehler beim E-Mail-Versand:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Login-Benachrichtigung senden
  async sendLoginNotification(handwerkerData, loginDetails) {
    try {
      const template = emailTemplates.loginNotification({
        ...handwerkerData,
        ...loginDetails
      });
      
      const info = await transporter.sendMail({
        from: `"byndl Security" <${process.env.EMAIL_FROM || 'security@byndl.de'}>`,
        to: handwerkerData.email,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
      
      console.log('Login-Benachrichtigung gesendet:', info.messageId);
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      console.error('Fehler beim E-Mail-Versand:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Allgemeine E-Mail senden
  async sendEmail(to, subject, html, text) {
    try {
      const info = await transporter.sendMail({
        from: `"byndl" <${process.env.EMAIL_FROM || 'noreply@byndl.de'}>`,
        to,
        subject,
        text,
        html
      });
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Fehler beim E-Mail-Versand:', error);
      return { success: false, error: error.message };
    }
  }
  
  // E-Mail-Adresse verifizieren
  async verifyEmail(email) {
    try {
      const verify = await transporter.verify();
      return verify;
    } catch (error) {
      console.error('E-Mail-Verifikation fehlgeschlagen:', error);
      return false;
    }
  }
}
