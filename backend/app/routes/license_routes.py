from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.license import License
from app.utils.gumroad_api import verify_gumroad_license
from app.utils.token import generate_session_token
from app import db

license_bp = Blueprint('license_bp', __name__)

PLAN_LIMITS = {
    'FREE': {'daily': 10, 'hourly': 3},
    'PRO': {'daily': 80, 'hourly': 15},
    'PRO_PLUS': {'daily': 250, 'hourly': 40}
}

@license_bp.route('/verify-license', methods=['POST'])
def verify_license():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request JSON'}), 400
        
    license_key = data.get('license_key')
    device_hash = data.get('device_hash', 'unknown_device')
    
    if not license_key:
        return jsonify({'error': 'License key is required'}), 400

    # 1. Fetch license from DB
    license_record = License.query.filter_by(license_key=license_key).first()
    
    # 2. Check with Gumroad if not in DB or if it's been a while (mocked dynamic logic)
    gumroad_data = verify_gumroad_license(license_key, None)
    
    if not gumroad_data['success']:
        return jsonify({'error': gumroad_data['error']}), 403
        
    plan = gumroad_data['plan']
    status = gumroad_data['status']
    
    if status in ['cancelled', 'expired'] or gumroad_data.get('subscription_failed'):
        if license_record:
            license_record.status = status
            db.session.commit()
        return jsonify({'error': f'License is {status}'}), 403

    if not license_record:
        # Create new license
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS['FREE'])
        license_record = License(
            license_key=license_key,
            gumroad_customer_id=gumroad_data.get('gumroad_customer_id'),
            gumroad_order_id=gumroad_data.get('gumroad_order_id'),
            gumroad_product_id=gumroad_data.get('gumroad_product_id'),
            plan=plan,
            status=status,
            device_hash_list=[],
            quota_remaining=limits['daily'],
            daily_limit=limits['daily'],
            hourly_limit=limits['hourly']
        )
        db.session.add(license_record)
        
    # Update plan details if they changed
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS['FREE'])
    license_record.plan = plan
    license_record.daily_limit = limits['daily']
    license_record.hourly_limit = limits['hourly']

    # 3. Check Device Limits (Max 1 device)
    current_devices = license_record.device_hash_list or []
    
    if device_hash not in current_devices:
        if len(current_devices) >= 1:
            return jsonify({'error': 'Device limit reached (max 1 device per license).'}), 403
            
        current_devices.append(device_hash)
        license_record.device_hash_list = current_devices
        license_record.device_count = len(current_devices)

    license_record.last_check_timestamp = datetime.utcnow()
    db.session.commit()
    
    # 4. Generate Session Token
    session_token = generate_session_token(
        license_key=license_key,
        device_hash=device_hash,
        plan=plan,
        daily_limit=license_record.daily_limit,
        hourly_limit=license_record.hourly_limit,
        quota_remaining=license_record.quota_remaining
    )
    
    return jsonify({
        'success': True,
        'plan': plan,
        'daily_limit': license_record.daily_limit,
        'hourly_limit': license_record.hourly_limit,
        'quota_remaining': license_record.quota_remaining,
        'session_token': session_token
    }), 200
