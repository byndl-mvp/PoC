"""
LV Builder Module (Simplified)

Generiert VOB-konforme Leistungsverzeichnisse basierend auf Projektdaten und Antworten
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional


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
        """Generiert ein einfaches Text-Dokument aus den LV-Daten"""
        try:
            # Erstelle einfaches Text-Dokument
            content = []
            content.append(f"Leistungsverzeichnis - {lv_data['trade_title']}")
            content.append("=" * 50)
            content.append("")
            content.append(f"Projekt: {lv_data['project_description']}")
            content.append(f"Erstellt am: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
            content.append("")
            content.append("Positionen:")
            content.append("-" * 30)
            
            if lv_data['positions']:
                for pos in lv_data['positions']:
                    content.append(f"{pos['position_number']} - {pos['description']}")
                    content.append(f"  Menge: {pos['quantity']} {pos['unit']}")
                    content.append(f"  Einzelpreis: {pos['unit_price']:.2f} €")
                    content.append(f"  Gesamtpreis: {pos['total_price']:.2f} €")
                    content.append("")
                
                content.append("-" * 30)
                content.append(f"Netto: {lv_data['total_net']:.2f} €")
                content.append(f"Risiko (+{lv_data['risk_factor']*100:.1f}%): {lv_data['total_gross'] - lv_data['total_net']:.2f} €")
                content.append(f"Gesamt: {lv_data['total_gross']:.2f} €")
            else:
                content.append("Keine Positionen verfügbar.")
            
            content.append("")
            content.append(f"Katalog-Treffer: {lv_data['catalog_matches']}/{len(lv_data['positions'])}")
            
            # Schreibe in Datei
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(content))
            
            print(f"✅ Text-Dokument erstellt: {output_path}")
            
        except Exception as e:
            print(f"❌ Fehler bei Dokument-Generierung: {e}")
            # Erstelle leere Datei als Fallback
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f"Fehler bei der Dokument-Generierung: {e}")

