from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.license import License
from app.models.device import Device
from app.utils.gumroad_api import verify_gumroad_license
from app.utils.device_fingerprint import generate_device_hash
from app.utils.token import generate_session_token
from app import db

license_bp = Blueprint('license_bp', __name__)

PLAN_LIMITS = {
    'FREE': {'daily': 10, 'hourly': 3},
    'PRO': {'daily': 80, 'hourly': 15},
    'PRO_PLUS': {'daily': 250, 'hourly': 40}
}

def get_or_create_license(license_key):
    license_record = License.query.filter_by(license_key=license_key).first()

    gumroad_data = verify_gumroad_license(license_key, None)

    if not gumroad_data['success']:
        return None, gumroad_data['error']

    plan = gumroad_data['plan']
    status = gumroad_data['status']

    if status in ['cancelled', 'expired'] or gumroad_data.get('subscription_failed'):
        if license_record:
            license_record.status = status
            db.session.commit()
        return None, f'License is {status}'

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
    license_record.last_check_timestamp = datetime.utcnow()

    db.session.commit()

    return license_record, None


@license_bp.route('/verify-license', methods=['POST'])
def verify_license():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request JSON'}), 400

    license_key = data.get('license_key')
    device_hash = data.get('device_hash', 'unknown_device')

    if not license_key:
        return jsonify({'error': 'License key is required'}), 400

    license_record, err = get_or_create_license(license_key)
    if err:
        return jsonify({'error': err}), 403

    # 3. Check Device Limits (Max 1 device)
    current_devices = license_record.device_hash_list or []

    if device_hash not in current_devices:
        if len(current_devices) >= 1:
            return jsonify({'error': 'Device limit reached (max 1 device per license).'}), 403

        current_devices.append(device_hash)
        license_record.device_hash_list = current_devices
        license_record.device_count = len(current_devices)
        db.session.commit()

    # 4. Generate Session Token
    session_token = generate_session_token(
        license_key=license_key,
        device_hash=device_hash,
        plan=license_record.plan,
        daily_limit=license_record.daily_limit,
        hourly_limit=license_record.hourly_limit,
        quota_remaining=license_record.quota_remaining
    )

    return jsonify({
        'success': True,
        'plan': license_record.plan,
        'daily_limit': license_record.daily_limit,
        'hourly_limit': license_record.hourly_limit,
        'quota_remaining': license_record.quota_remaining,
        'session_token': session_token
    }), 200

@license_bp.route('/register-device', methods=['POST'])
def register_device():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request JSON'}), 400

    license_key = data.get('license_key')
    user_agent = data.get('user_agent', '')
    platform = data.get('platform', '')
    timezone = data.get('timezone', '')
    install_id = data.get('install_id')

    if not license_key or not install_id:
        return jsonify({'error': 'license_key and install_id are required'}), 400

    license_record, err = get_or_create_license(license_key)
    if err:
        return jsonify({'error': err}), 403

    device_hash = generate_device_hash(user_agent, platform, timezone, install_id)

    existing_device = Device.query.filter_by(license_id=license_record.id, device_hash=device_hash).first()

    if existing_device:
        existing_device.last_seen = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'success': True,
            'device_hash': device_hash,
            'device_status': existing_device.device_status,
            'device_count': license_record.device_count
        }), 200

    # Check limits
    current_device_count = Device.query.filter_by(license_id=license_record.id).count()

    device_status = 'allowed'
    if current_device_count >= 1:
        device_status = 'blocked'

    new_device = Device(
        license_id=license_record.id,
        device_hash=device_hash,
        user_agent=user_agent,
        platform=platform,
        timezone=timezone,
        install_id=install_id,
        device_status=device_status
    )

    if device_status == 'allowed':
        license_record.device_count += 1

        # update legacy json list just in case
        hashes = license_record.device_hash_list or []
        if device_hash not in hashes:
            hashes.append(device_hash)
            license_record.device_hash_list = hashes

    db.session.add(new_device)
    db.session.commit()

    if device_status == 'blocked':
        return jsonify({
            'success': False,
            'error': 'Device limit reached (max 1 device per license).',
            'device_status': device_status,
            'device_hash': device_hash
        }), 403

    return jsonify({
        'success': True,
        'device_status': device_status,
        'device_hash': device_hash,
        'device_count': license_record.device_count
    }), 200
