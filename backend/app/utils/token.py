import jwt
import datetime
from flask import current_app

def generate_session_token(license_key, device_hash, plan, daily_limit, hourly_limit, quota_remaining):
    """Generates a JWT session token valid for 24 hours."""
    payload = {
        'license_key': license_key,
        'device_hash': device_hash,
        'plan': plan,
        'daily_limit': daily_limit,
        'hourly_limit': hourly_limit,
        'quota_remaining': quota_remaining,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24),
        'iat': datetime.datetime.utcnow()
    }

    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return token

def decode_session_token(token):
    """Decodes and validates a JWT session token."""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return {'success': True, 'data': payload}
    except jwt.ExpiredSignatureError:
        return {'success': False, 'error': 'Token has expired'}
    except jwt.InvalidTokenError:
        return {'success': False, 'error': 'Invalid token'}
