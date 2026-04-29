from flask import Blueprint, request, jsonify
from app.utils.safe_scheduler import SafeScheduler
from app.utils.token import decode_session_token

extraction_bp = Blueprint('extraction_bp', __name__)

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
    
    # Cap request by actual token quota
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
