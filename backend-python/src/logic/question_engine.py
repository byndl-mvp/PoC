"""
Question Engine Module

Verwaltet adaptive Fragebögen für verschiedene Gewerke
"""

import os
import json
from typing import List, Dict, Optional


class QuestionEngine:
    def __init__(self, llm_provider):
        self.llm_provider = llm_provider
        self.questions_cache = {}
        self.load_questions()

    def load_questions(self):
        """Lädt vordefinierte Fragen für alle Gewerke"""
        # Sanitär-Fragen
        self.questions_cache['sanitaer'] = [
            {
                'id': 'sanitaer_1',
                'question': 'Welche Sanitärobjekte sollen installiert werden?',
                'type': 'multiple_choice',
                'options': ['WC', 'Waschbecken', 'Dusche', 'Badewanne', 'Urinal'],
                'required': True
            },
            {
                'id': 'sanitaer_2',
                'question': 'Sollen bestehende Sanitärobjekte demontiert werden?',
                'type': 'yes_no',
                'required': True
            },
            {
                'id': 'sanitaer_3',
                'question': 'Welche Art von Armaturen bevorzugen Sie?',
                'type': 'single_choice',
                'options': ['Standard', 'Hochwertig', 'Premium'],
                'required': False
            }
        ]
        
        # Fliesen-Fragen
        self.questions_cache['fliesen'] = [
            {
                'id': 'fliesen_1',
                'question': 'Welche Fläche soll gefliest werden (in m²)?',
                'type': 'number',
                'required': True
            },
            {
                'id': 'fliesen_2',
                'question': 'Welche Art von Fliesen bevorzugen Sie?',
                'type': 'single_choice',
                'options': ['Keramik', 'Naturstein', 'Feinsteinzeug'],
                'required': True
            },
            {
                'id': 'fliesen_3',
                'question': 'Sollen alte Fliesen entfernt werden?',
                'type': 'yes_no',
                'required': True
            },
            {
                'id': 'fliesen_4',
                'question': 'Welche Fliesengröße bevorzugen Sie?',
                'type': 'single_choice',
                'options': ['Klein (bis 30x30cm)', 'Mittel (30x60cm)', 'Groß (60x60cm oder größer)'],
                'required': False
            },
            {
                'id': 'fliesen_5',
                'question': 'Benötigen Sie eine Fußbodenheizung?',
                'type': 'yes_no',
                'required': False
            }
        ]
        
        # Maler-Fragen
        self.questions_cache['maler'] = [
            {
                'id': 'maler_1',
                'question': 'Welche Fläche soll gestrichen werden (in m²)?',
                'type': 'number',
                'required': True
            },
            {
                'id': 'maler_2',
                'question': 'Welche Art von Anstrich bevorzugen Sie?',
                'type': 'single_choice',
                'options': ['Dispersionsfarbe', 'Latexfarbe', 'Silikatfarbe'],
                'required': True
            },
            {
                'id': 'maler_3',
                'question': 'Benötigen Sie Vorarbeiten (Spachteln, Grundierung)?',
                'type': 'yes_no',
                'required': True
            }
        ]

    def detect_trades(self, description: str) -> List[str]:
        """Erkennt Gewerke aus der Projektbeschreibung"""
        description_lower = description.lower()
        detected_trades = []
        
        # Keyword-basierte Erkennung
        trade_keywords = {
            'sanitaer': ['sanitär', 'bad', 'wc', 'dusche', 'badewanne', 'waschbecken', 'toilette'],
            'fliesen': ['fliesen', 'kacheln', 'fliesenleger', 'bodenfliesen', 'wandfliesen'],
            'maler': ['maler', 'streichen', 'farbe', 'anstrich', 'tapete', 'malerei'],
            'elektro': ['elektro', 'strom', 'licht', 'schalter', 'steckdose', 'elektrik'],
            'heizung': ['heizung', 'heizkörper', 'thermostat', 'warmwasser'],
            'tischler': ['tischler', 'schreiner', 'möbel', 'schrank', 'holz'],
            'trockenbau': ['trockenbau', 'rigips', 'gipskarton', 'wand', 'decke']
        }
        
        for trade, keywords in trade_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                detected_trades.append(trade)
        
        # Fallback: Wenn nichts erkannt wurde, verwende Standard-Gewerke
        if not detected_trades:
            detected_trades = ['sanitaer', 'fliesen', 'maler']
        
        return detected_trades

    def get_questions_for_trade(self, trade: str) -> List[Dict]:
        """Gibt Fragen für ein bestimmtes Gewerk zurück"""
        return self.questions_cache.get(trade, [])

    def validate_answers(self, trade: str, answers: Dict) -> Dict:
        """Validiert Antworten für ein Gewerk"""
        questions = self.get_questions_for_trade(trade)
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        for question in questions:
            question_id = question['id']
            answer = answers.get(question_id)
            
            # Prüfe erforderliche Fragen
            if question.get('required', False) and not answer:
                validation_result['valid'] = False
                validation_result['errors'].append(f"Frage '{question['question']}' ist erforderlich")
                continue
            
            # Typ-spezifische Validierung
            if answer:
                if question['type'] == 'number':
                    try:
                        float(answer)
                    except (ValueError, TypeError):
                        validation_result['valid'] = False
                        validation_result['errors'].append(f"'{answer}' ist keine gültige Zahl")
                
                elif question['type'] in ['single_choice', 'multiple_choice']:
                    options = question.get('options', [])
                    if question['type'] == 'single_choice':
                        if answer not in options:
                            validation_result['valid'] = False
                            validation_result['errors'].append(f"'{answer}' ist keine gültige Option")
                    elif question['type'] == 'multiple_choice':
                        if isinstance(answer, list):
                            for item in answer:
                                if item not in options:
                                    validation_result['valid'] = False
                                    validation_result['errors'].append(f"'{item}' ist keine gültige Option")
                        else:
                            validation_result['valid'] = False
                            validation_result['errors'].append("Mehrfachauswahl erwartet eine Liste")
                
                elif question['type'] == 'yes_no':
                    if answer not in ['yes', 'no', 'ja', 'nein', True, False]:
                        validation_result['valid'] = False
                        validation_result['errors'].append(f"'{answer}' ist keine gültige Ja/Nein-Antwort")
        
        return validation_result

    def get_trade_summary(self, trade: str, answers: Dict) -> str:
        """Erstellt eine Zusammenfassung der Antworten für ein Gewerk"""
        questions = self.get_questions_for_trade(trade)
        summary_parts = []
        
        for question in questions:
            question_id = question['id']
            answer = answers.get(question_id)
            
            if answer:
                summary_parts.append(f"- {question['question']}: {answer}")
        
        return f"Zusammenfassung {trade.upper()}:\n" + "\n".join(summary_parts)

