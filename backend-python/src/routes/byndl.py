import os
import sys
import json
import uuid
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from flask_cors import cross_origin

# Add src directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from llm.provider import llm_provider
from pricing.catalog import PricingCatalog
from logic.question_engine import QuestionEngine
from logic.lv_builder_simple import LVBuilder

byndl_bp = Blueprint('byndl', __name__)

# Initialize components
pricing_catalog = PricingCatalog()
question_engine = QuestionEngine(llm_provider)
lv_builder = LVBuilder(llm_provider, pricing_catalog)

# In-memory session storage (in production, use Redis or database)
sessions = {}

@byndl_bp.route('/healthz', methods=['GET'])
@cross_origin()
def health_check():
    """Health check endpoint"""
    try:
        uptime = time.time() - getattr(health_check, 'start_time', time.time())
        if not hasattr(health_check, 'start_time'):
            health_check.start_time = time.time()
            
        issues = []
        if not os.getenv('OPENAI_API_KEY'):
            issues.append("OPENAI_API_KEY nicht gesetzt")
            
        status = "healthy" if not issues else "degraded"
        
        return jsonify({
            "status": status,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "uptime": uptime,
            "environment": "production",
            "version": "1.0.0",
            "providers": {
                "activeProvider": "openai",
                "openaiAvailable": bool(os.getenv('OPENAI_API_KEY')),
                "anthropicAvailable": bool(os.getenv('ANTHROPIC_API_KEY')),
                "openaiModel": "gpt-4o-mini",
                "anthropicModel": "claude-3-5-sonnet-latest"
            },
            "issues": issues
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@byndl_bp.route('/projects', methods=['POST'])
@cross_origin()
def create_project():
    """Create a new project and start questionnaire"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['category', 'description']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Feld '{field}' ist erforderlich"}), 400
        
        # Create session
        session_id = f"session_{int(time.time() * 1000)}_{uuid.uuid4().hex[:10]}"
        
        # Detect trades from description
        try:
            detected_trades = question_engine.detect_trades(data['description'])
        except Exception as e:
            print(f"Trade detection failed: {e}")
            # Fallback based on keywords
            description_lower = data['description'].lower()
            detected_trades = []
            if any(word in description_lower for word in ['bad', 'sanitär', 'wc', 'dusche']):
                detected_trades.append('sanitaer')
            if any(word in description_lower for word in ['fliesen', 'kachel']):
                detected_trades.append('fliesen')
            if any(word in description_lower for word in ['maler', 'streichen', 'farbe']):
                detected_trades.append('maler')
        
        # Store session
        sessions[session_id] = {
            'id': session_id,
            'project': data,
            'trades': detected_trades,
            'current_trade_index': 0,
            'answers': {},
            'created_at': datetime.utcnow().isoformat()
        }
        
        return jsonify({
            "sessionId": session_id,
            "detectedTrades": detected_trades,
            "message": f"Projekt erstellt. {len(detected_trades)} Gewerke erkannt."
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@byndl_bp.route('/sessions/<session_id>/questions', methods=['GET'])
@cross_origin()
def get_questions(session_id):
    """Get questions for current trade"""
    try:
        if session_id not in sessions:
            return jsonify({"error": "Session nicht gefunden"}), 404
            
        session = sessions[session_id]
        trades = session['trades']
        current_index = session['current_trade_index']
        
        if current_index >= len(trades):
            return jsonify({
                "completed": True,
                "message": "Alle Gewerke abgeschlossen"
            })
        
        current_trade = trades[current_index]
        
        # Get questions for current trade
        questions = question_engine.get_questions_for_trade(current_trade)
        
        return jsonify({
            "trade": current_trade,
            "tradeIndex": current_index + 1,
            "totalTrades": len(trades),
            "questions": questions,
            "completed": False
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@byndl_bp.route('/sessions/<session_id>/answers', methods=['POST'])
@cross_origin()
def submit_answers(session_id):
    """Submit answers for current trade"""
    try:
        if session_id not in sessions:
            return jsonify({"error": "Session nicht gefunden"}), 404
            
        data = request.get_json()
        answers = data.get('answers', {})
        
        session = sessions[session_id]
        trades = session['trades']
        current_index = session['current_trade_index']
        
        if current_index >= len(trades):
            return jsonify({"error": "Alle Gewerke bereits abgeschlossen"}), 400
        
        current_trade = trades[current_index]
        
        # Store answers
        session['answers'][current_trade] = answers
        session['current_trade_index'] += 1
        
        # Check if all trades completed
        completed = session['current_trade_index'] >= len(trades)
        
        return jsonify({
            "success": True,
            "completed": completed,
            "nextTrade": trades[session['current_trade_index']] if not completed else None,
            "message": f"Antworten für {current_trade} gespeichert"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@byndl_bp.route('/sessions/<session_id>/generate-lv', methods=['POST'])
@cross_origin()
def generate_lv(session_id):
    """Generate LV documents for all trades"""
    try:
        if session_id not in sessions:
            return jsonify({"error": "Session nicht gefunden"}), 404
            
        session = sessions[session_id]
        project = session['project']
        trades = session['trades']
        answers = session['answers']
        
        results = []
        total_cost = 0
        
        for trade in trades:
            trade_answers = answers.get(trade, {})
            
            # Generate LV for trade
            lv_data = lv_builder.generate_lv(
                trade=trade,
                project_description=project['description'],
                answers=trade_answers
            )
            
            # Generate TXT document
            timestamp = int(time.time() * 1000)
            txt_filename = f"lv_{session_id}_{trade}_{timestamp}.txt"
            txt_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'data', 'lvs', txt_filename
            )
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(txt_path), exist_ok=True)
            
            lv_builder.generate_pdf(lv_data, txt_path)
            
            results.append({
                "trade": trade,
                "positions": len(lv_data.get('positions', [])),
                "netCost": lv_data.get('total_net', 0),
                "grossCost": lv_data.get('total_gross', 0),
                "txtPath": txt_path,
                "txtFilename": txt_filename
            })
            
            total_cost += lv_data.get('total_gross', 0)
        
        return jsonify({
            "success": True,
            "results": results,
            "totalCost": total_cost,
            "sessionId": session_id
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@byndl_bp.route('/sessions/<session_id>/download/<filename>', methods=['GET'])
@cross_origin()
def download_file(session_id, filename):
    """Download generated file"""
    try:
        file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'data', 'lvs', filename
        )
        
        if not os.path.exists(file_path):
            return jsonify({"error": "Datei nicht gefunden"}), 404
            
        return send_file(file_path, as_attachment=True, download_name=filename)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@byndl_bp.route('/admin/sessions', methods=['GET'])
@cross_origin()
def list_sessions():
    """List all sessions (admin endpoint)"""
    try:
        session_list = []
        for session_id, session_data in sessions.items():
            session_list.append({
                "id": session_id,
                "project": session_data.get('project', {}),
                "trades": session_data.get('trades', []),
                "completed": session_data.get('current_trade_index', 0) >= len(session_data.get('trades', [])),
                "created_at": session_data.get('created_at')
            })
        
        return jsonify({
            "sessions": session_list,
            "total": len(session_list)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

