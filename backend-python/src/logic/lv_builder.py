"""
LV Builder Module

Generiert VOB-konforme Leistungsverzeichnisse basierend auf Projektdaten und Antworten
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm


class LVBuilder:
    def __init__(self, llm_provider, pricing_catalog):
        self.llm_provider = llm_provider
        self.pricing_catalog = pricing_catalog

    def generate_lv(self, trade: str, project_description: str, answers: Dict) -> Dict:
        """Generiert ein Leistungsverzeichnis für ein Gewerk"""
        try:
            # Hole Preise aus dem Katalog
            available_positions = self.pricing_catalog.get_prices_for_trade(trade)
            
            if not available_positions:
                print(f"⚠️ Keine Preise für Gewerk '{trade}' gefunden")
                return self.create_fallback_lv(trade)
            
            # Erstelle LV-Positionen basierend auf verfügbaren Preisen
            positions = []
            total_net = 0
            
            # Nimm die ersten 10 Positionen als Beispiel
            for i, catalog_position in enumerate(available_positions[:10]):
                position = {
                    'position_number': f"{i+1}.1",
                    'description': catalog_position.get('description', f'Position {i+1}'),
                    'unit': catalog_position.get('unit', 'Stk'),
                    'quantity': 1,
                    'unit_price': catalog_position.get('price', 0),
                    'total_price': catalog_position.get('price', 0),
                    'catalog_match': True
                }
                positions.append(position)
                total_net += position['total_price']
            
            # Berechne Risikopuffer und Brutto
            risk_factor = 0.05  # 5% Risikopuffer
            total_with_risk = total_net * (1 + risk_factor)
            
            lv_data = {
                'trade': trade,
                'trade_title': self.get_trade_title(trade),
                'project_description': project_description,
                'positions': positions,
                'total_net': total_net,
                'risk_factor': risk_factor,
                'total_gross': total_with_risk,
                'generated_at': datetime.now().isoformat(),
                'catalog_matches': len([p for p in positions if p.get('catalog_match', False)])
            }
            
            return lv_data
            
        except Exception as e:
            print(f"❌ Fehler bei LV-Generierung für {trade}: {e}")
            return self.create_fallback_lv(trade)

    def create_fallback_lv(self, trade: str) -> Dict:
        """Erstellt ein Fallback-LV wenn keine Preise verfügbar sind"""
        return {
            'trade': trade,
            'trade_title': self.get_trade_title(trade),
            'project_description': 'Fallback LV',
            'positions': [],
            'total_net': 0,
            'risk_factor': 0,
            'total_gross': 0,
            'generated_at': datetime.now().isoformat(),
            'catalog_matches': 0
        }

    def get_trade_title(self, trade: str) -> str:
        """Gibt den deutschen Titel für ein Gewerk zurück"""
        trade_titles = {
            'sanitaer': 'Sanitärinstallation',
            'fliesen': 'Fliesenarbeiten',
            'maler': 'Malerarbeiten',
            'elektro': 'Elektroinstallation',
            'heizung': 'Heizungsinstallation',
            'tischler': 'Tischlerarbeiten',
            'trockenbau': 'Trockenbauarbeiten'
        }
        return trade_titles.get(trade, trade.capitalize())

    def generate_pdf(self, lv_data: Dict, output_path: str):
        """Generiert ein PDF-Dokument aus den LV-Daten"""
        try:
            # Erstelle PDF-Dokument
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            story = []
            styles = getSampleStyleSheet()
            
            # Titel-Style
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=1  # Zentriert
            )
            
            # Header
            title = Paragraph(f"Leistungsverzeichnis - {lv_data['trade_title']}", title_style)
            story.append(title)
            story.append(Spacer(1, 20))
            
            # Projekt-Info
            project_info = Paragraph(f"<b>Projekt:</b> {lv_data['project_description']}", styles['Normal'])
            story.append(project_info)
            
            generation_date = Paragraph(f"<b>Erstellt am:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}", styles['Normal'])
            story.append(generation_date)
            story.append(Spacer(1, 20))
            
            # Positionen-Tabelle
            if lv_data['positions']:
                # Tabellen-Header
                table_data = [
                    ['Pos.', 'Beschreibung', 'Einheit', 'Menge', 'EP (€)', 'GP (€)']
                ]
                
                # Positionen hinzufügen
                for pos in lv_data['positions']:
                    table_data.append([
                        pos['position_number'],
                        pos['description'][:50] + '...' if len(pos['description']) > 50 else pos['description'],
                        pos['unit'],
                        str(pos['quantity']),
                        f"{pos['unit_price']:.2f}",
                        f"{pos['total_price']:.2f}"
                    ])
                
                # Summen-Zeile
                table_data.append(['', '', '', '', 'Netto:', f"{lv_data['total_net']:.2f}"])
                table_data.append(['', '', '', '', f"Risiko (+{lv_data['risk_factor']*100:.1f}%):", f"{lv_data['total_gross'] - lv_data['total_net']:.2f}"])
                table_data.append(['', '', '', '', 'Gesamt:', f"{lv_data['total_gross']:.2f}"])
                
                # Erstelle Tabelle
                table = Table(table_data, colWidths=[2*cm, 8*cm, 2*cm, 2*cm, 2.5*cm, 2.5*cm])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -4), colors.beige),
                    ('BACKGROUND', (0, -3), (-1, -1), colors.lightgrey),
                    ('FONTNAME', (0, -3), (-1, -1), 'Helvetica-Bold'),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                story.append(table)
            else:
                no_positions = Paragraph("Keine Positionen verfügbar.", styles['Normal'])
                story.append(no_positions)
            
            # Footer
            story.append(Spacer(1, 30))
            footer_text = f"Katalog-Treffer: {lv_data['catalog_matches']}/{len(lv_data['positions'])}"
            footer = Paragraph(footer_text, styles['Normal'])
            story.append(footer)
            
            # PDF erstellen
            doc.build(story)
            print(f"✅ PDF erstellt: {output_path}")
            
        except Exception as e:
            print(f"❌ Fehler bei PDF-Generierung: {e}")
            # Erstelle leere PDF als Fallback
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            story = [Paragraph(f"Fehler bei der PDF-Generierung: {e}", getSampleStyleSheet()['Normal'])]
            doc.build(story)

