"""
Pricing Catalog Module

Lädt und verwaltet Preise aus den Repository-Prompts
"""

import os
import json
import re
from typing import Dict, List, Optional


class PricingCatalog:
    def __init__(self):
        self.catalog = {}
        self.load_catalog()

    def load_catalog(self):
        """Lädt den Preiskatalog aus den Prompt-Dateien"""
        try:
            # Versuche zuerst, einen bereits generierten Katalog zu laden
            catalog_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'data', 'pricing.json'
            )
            
            if os.path.exists(catalog_path):
                with open(catalog_path, 'r', encoding='utf-8') as f:
                    self.catalog = json.load(f)
                print(f"✅ Preiskatalog geladen: {len(self.catalog)} Gewerke")
                return
            
            # Fallback: Generiere Katalog aus Prompts
            self.generate_catalog_from_prompts()
            
        except Exception as e:
            print(f"⚠️ Fehler beim Laden des Preiskatalogs: {e}")
            self.catalog = {}

    def generate_catalog_from_prompts(self):
        """Generiert Katalog aus Prompt-Dateien"""
        prompts_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'prompts'
        )
        
        if not os.path.exists(prompts_dir):
            print(f"⚠️ Prompts-Verzeichnis nicht gefunden: {prompts_dir}")
            return
        
        for filename in os.listdir(prompts_dir):
            if filename.endswith('-lv-prompt.txt'):
                trade_name = filename.replace('-lv-prompt.txt', '').replace('-lv-prompt-2.txt', '')
                self.parse_prompt_file(os.path.join(prompts_dir, filename), trade_name)
        
        # Speichere generierten Katalog
        self.save_catalog()

    def parse_prompt_file(self, filepath: str, trade_name: str):
        """Parst eine Prompt-Datei und extrahiert Preise"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            positions = []
            
            # Regex-Pattern für Preise (verschiedene Formate)
            price_patterns = [
                r'(\d+(?:,\d+)?(?:\.\d+)?)\s*€',  # 123,45 €
                r'€\s*(\d+(?:,\d+)?(?:\.\d+)?)',  # € 123,45
                r'(\d+(?:,\d+)?(?:\.\d+)?)\s*EUR', # 123,45 EUR
            ]
            
            # Suche nach Positionen mit Preisen
            lines = content.split('\n')
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                
                # Suche nach Preisen in der Zeile
                for pattern in price_patterns:
                    matches = re.findall(pattern, line)
                    if matches:
                        for match in matches:
                            try:
                                # Konvertiere deutschen Preis zu float
                                price_str = match.replace(',', '.')
                                price = float(price_str)
                                
                                # Erstelle Position
                                position = {
                                    'description': line,
                                    'price': price,
                                    'unit': 'Stk',  # Default
                                    'line_number': i + 1
                                }
                                positions.append(position)
                                break
                            except ValueError:
                                continue
            
            if positions:
                self.catalog[trade_name] = positions
                print(f"📄 Parse {trade_name}: {len(positions)} Positionen gefunden")
            else:
                print(f"⚠️ Keine Preise in {filepath} gefunden")
                
        except Exception as e:
            print(f"❌ Fehler beim Parsen von {filepath}: {e}")

    def save_catalog(self):
        """Speichert den Katalog als JSON"""
        try:
            catalog_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'data', 'pricing.json'
            )
            
            os.makedirs(os.path.dirname(catalog_path), exist_ok=True)
            
            with open(catalog_path, 'w', encoding='utf-8') as f:
                json.dump(self.catalog, f, ensure_ascii=False, indent=2)
            
            print(f"💾 Katalog gespeichert: {catalog_path}")
            
        except Exception as e:
            print(f"❌ Fehler beim Speichern des Katalogs: {e}")

    def get_prices_for_trade(self, trade: str) -> List[Dict]:
        """Gibt Preise für ein Gewerk zurück"""
        return self.catalog.get(trade, [])

    def find_matching_positions(self, trade: str, description: str, limit: int = 10) -> List[Dict]:
        """Findet passende Positionen basierend auf Beschreibung"""
        positions = self.get_prices_for_trade(trade)
        if not positions:
            return []
        
        # Einfache Keyword-Suche
        keywords = description.lower().split()
        scored_positions = []
        
        for position in positions:
            pos_desc = position['description'].lower()
            score = sum(1 for keyword in keywords if keyword in pos_desc)
            
            if score > 0:
                scored_positions.append({
                    **position,
                    'match_score': score
                })
        
        # Sortiere nach Score und gib Top-Ergebnisse zurück
        scored_positions.sort(key=lambda x: x['match_score'], reverse=True)
        return scored_positions[:limit]

    def get_catalog_stats(self) -> Dict:
        """Gibt Katalog-Statistiken zurück"""
        total_positions = sum(len(positions) for positions in self.catalog.values())
        
        return {
            'trades': len(self.catalog),
            'total_positions': total_positions,
            'trades_list': list(self.catalog.keys())
        }

