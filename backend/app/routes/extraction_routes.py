from flask import Blueprint, request, jsonify
from app.utils.safe_scheduler import SafeScheduler
from app.utils.token import decode_session_token
from app.models.extraction import Extraction
from app.models.license import License
from app import db
from datetime import datetime
import json

extraction_bp = Blueprint('extraction_bp', __name__)

@extraction_bp.route('/check-quota', methods=['POST'])
def check_quota():
    data = request.get_json()
    license_key = data.get('license_key')
    device_id = data.get('device_id')
    
    if not license_key:
        return jsonify({"error": "Missing license_key"}), 400
        
    license_data = License.query.filter_by(license_key=license_key).first()
    
    if not license_data or license_data.status != 'active':
        return jsonify({"error": "License invalid"}), 403
        
    if license_data.expiry_date and license_data.expiry_date < datetime.utcnow():
        return jsonify({"error": "License expired"}), 403
        
    # Get today's extraction count by summing profiles_found
    today = datetime.utcnow().date()
    
    extractions_today = db.session.query(Extraction).filter(
        Extraction.license_key == license_key,
        db.func.date(Extraction.created_at) == today
    ).all()
    
    today_count = sum([e.profiles_found for e in extractions_today if e.profiles_found])
    
    # Calculate remaining
    plan = license_data.plan
    daily_limit = 80 if plan in ['pro', 'pro_plus'] else 10 # Adjust pro_plus if needed
    if plan == 'pro_plus':
        daily_limit = 200 # Based on constants.js LIMITS
        
    remaining = max(0, daily_limit - today_count)
    
    if remaining == 0:
        return jsonify({
            "allowed": False,
            "reason": "Daily quota reached",
            "remaining": 0
        }), 403
        
    session_size = min(40 if plan in ['pro', 'pro_plus'] else 10, remaining)
    
    return jsonify({
        "allowed": True,
        "remaining": remaining,
        "session_size": session_size,
        "plan": plan
    }), 200

@extraction_bp.route('/start', methods=['POST'])
def start_extraction():
    # Like /extract-hashtag and /extract-location combined
    data = request.get_json()
    license_key = data.get('license_key')
    device_id = data.get('device_id')
    extraction_type = data.get('extraction_type', 'hashtag')
    query = data.get('query', '')
    session_size = data.get('session_size', 0)
    
    if not license_key or not query:
        return jsonify({"error": "Missing license_key or query"}), 400
        
    extraction = Extraction(
        license_key=license_key,
        device_id=device_id,
        extraction_type=extraction_type,
        query=query,
        session_size=session_size,
        status='in_progress',
        started_at=datetime.utcnow()
    )
    db.session.add(extraction)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "extraction_id": extraction.id
    }), 200

@extraction_bp.route('/log', methods=['POST'])
def log_extraction():
    data = request.get_json()
    extraction_id = data.get('extraction_id')
    profiles_found = data.get('profiles_found', 0)
    profiles_extracted = data.get('profiles_extracted', [])
    status = data.get('status', 'in_progress')
    
    if not extraction_id:
        return jsonify({"error": "Missing extraction_id"}), 400
        
    extraction = db.session.get(Extraction, extraction_id)
    if not extraction:
        return jsonify({"error": "Extraction not found"}), 404
        
    extraction.profiles_found = profiles_found
    extraction.profiles_extracted = profiles_extracted
    extraction.status = status
    
    if status in ['completed', 'failed']:
        extraction.completed_at = datetime.utcnow()
        if extraction.started_at:
            extraction.duration_seconds = int((extraction.completed_at - extraction.started_at).total_seconds())
            
    db.session.commit()
    
    return jsonify({"success": True}), 200

@extraction_bp.route('/progress/<extraction_id>', methods=['GET'])
def get_progress(extraction_id):
    extraction = db.session.get(Extraction, extraction_id)
    if not extraction:
        return jsonify({"error": "Extraction not found"}), 404
        
    return jsonify({
        "success": True,
        "progress": {
            "profiles_extracted_count": extraction.profiles_found, # user might count profiles_extracted length
            "status": extraction.status,
            "profiles_extracted": extraction.profiles_extracted
        }
    }), 200

@extraction_bp.route('/generate-plan', methods=['POST'])
def generate_plan():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request JSON'}), 400
        
    session_token = request.headers.get('Authorization')
    if not session_token:
        return jsonify({'error': 'Missing session token. Please verify license.'}), 401
        
    # strip Bearer if present
    if session_token.startswith('Bearer '):
        session_token = session_token.split(' ')[1]
        
    # Validate token
    token_res = decode_session_token(session_token)
    if not token_res['success']:
        return jsonify({'error': token_res['error']}), 401
        
    payload = token_res['data']
    plan_type = payload.get('plan', 'free')
    
    requested_count = data.get('requested_count', 10)
    account_age_days = data.get('account_age_days', 7)
    
    # Cap request by actual token quota -> We could also hit DB here, but keep original logic
    quota_remaining = payload.get('quota_remaining', 10)
    if requested_count > quota_remaining:
        requested_count = quota_remaining
        
    if requested_count <= 0:
         return jsonify({'error': 'No quota remaining today.'}), 403

    extraction_plan = SafeScheduler.generate_plan(plan_type, requested_count, account_age_days)
    
    return jsonify({
        'success': True,
        'plan': extraction_plan
    }), 200
