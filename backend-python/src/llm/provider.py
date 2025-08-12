"""
LLM Provider Abstraction

Dieses Modul stellt eine einheitliche Schnittstelle für OpenAI APIs bereit.
"""

import os
import openai


class LLMProvider:
    def __init__(self):
        self.active_provider = None
        self.initialize_providers()

    def initialize_providers(self):
        """Initialisiert verfügbare LLM Provider"""
        # Prüfe OpenAI API Key
        if os.getenv('OPENAI_API_KEY'):
            try:
                openai.api_key = os.getenv('OPENAI_API_KEY')
                self.active_provider = 'openai'
                print('✅ OpenAI Provider initialisiert')
                return
            except Exception as error:
                print(f'⚠️ OpenAI Provider Initialisierung fehlgeschlagen: {error}')

        # Kein Provider verfügbar
        self.active_provider = None
        print('❌ Kein LLM Provider verfügbar - bitte OPENAI_API_KEY setzen')

    def chat_complete_sync(self, options):
        """Synchrone Chat-Completion"""
        messages = options.get('messages', [])
        model = options.get('model', 'gpt-3.5-turbo')
        system_prompt = options.get('system_prompt')
        max_tokens = options.get('max_tokens', 4000)
        temperature = options.get('temperature', 0.7)

        if not self.active_provider:
            raise Exception('Kein API-Key gesetzt – bitte OPENAI_API_KEY hinterlegen.')

        # Nachrichten vorbereiten
        formatted_messages = messages.copy()
        if system_prompt:
            formatted_messages.insert(0, {'role': 'system', 'content': system_prompt})

        try:
            response = openai.ChatCompletion.create(
                model=model,
                messages=formatted_messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as error:
            print(f'❌ OpenAI API Fehler: {error}')
            raise Exception(f'LLM API Fehler: {error}')

    def get_active_provider(self):
        """Gibt den aktuell aktiven Provider zurück"""
        return self.active_provider

    def is_available(self):
        """Prüft, ob ein Provider verfügbar ist"""
        return self.active_provider is not None

    def get_provider_info(self):
        """Gibt Provider-Informationen zurück"""
        return {
            'activeProvider': self.active_provider,
            'openaiAvailable': self.active_provider == 'openai',
            'anthropicAvailable': False,
            'openaiModel': 'gpt-3.5-turbo',
            'anthropicModel': 'claude-3-5-sonnet-latest',
        }


# Singleton-Instanz
llm_provider = LLMProvider()

