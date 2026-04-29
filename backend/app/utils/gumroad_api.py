import requests
from flask import current_app

GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify"

def verify_gumroad_license(license_key, product_id):
    """
    Verifies a license key against the Gumroad API.
    Since we might not know the product ID perfectly in advance if they have multiple tiers,
    we can attempt to verify. However, Gumroad API requires `product_permalink` or `product_id`.
    
    For SpyLeads, we'll assume the product_permalink is stored in config, or we attempt 
    multiple if needed. For this implementation, we pass it dynamically or use a configured one.
    """
    
    # Check if this is a mock test key
    if license_key.startswith("TEST_"):
        return _mock_gumroad_response(license_key)
        
    payload = {
        "product_permalink": current_app.config.get('GUMROAD_PRODUCT_PERMALINK', 'spyleads'),
        "license_key": license_key
    }
    
    try:
        response = requests.post(GUMROAD_VERIFY_URL, data=payload, timeout=10)
        data = response.json()
        
        if data.get('success'):
            purchase = data.get('purchase', {})
            
            # Determine plan based on product ID or variants (custom logic for SpyLeads)
            plan = 'PRO' # default mapping
            variant = purchase.get('custom_fields', {}).get('Tier') or purchase.get('variants', '')
            if 'plus' in str(variant).lower():
                plan = 'PRO_PLUS'
                
            return {
                'success': True,
                'gumroad_customer_id': purchase.get('email'),
                'gumroad_order_id': purchase.get('order_number'),
                'gumroad_product_id': purchase.get('product_id'),
                'plan': plan,
                'status': 'active' if not purchase.get('refunded') and not purchase.get('chargebacked') else 'cancelled',
                'subscription_failed': purchase.get('subscription_failed_at') is not None
            }
        else:
            return {'success': False, 'error': data.get('message', 'Invalid license key')}
            
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': f'Gumroad API error: {str(e)}'}

def _mock_gumroad_response(license_key):
    """Mock for testing without hitting real Gumroad API"""
    if license_key == "TEST_PRO":
        return {'success': True, 'plan': 'PRO', 'status': 'active', 'gumroad_customer_id': 'test@test.com', 'gumroad_order_id': '123'}
    elif license_key == "TEST_PRO_PLUS":
        return {'success': True, 'plan': 'PRO_PLUS', 'status': 'active', 'gumroad_customer_id': 'test@test.com', 'gumroad_order_id': '124'}
    elif license_key == "TEST_EXPIRED":
        return {'success': True, 'plan': 'PRO', 'status': 'expired', 'gumroad_customer_id': 'test@test.com', 'gumroad_order_id': '125'}
    elif license_key == "TEST_CANCELLED":
        return {'success': True, 'plan': 'PRO', 'status': 'cancelled', 'gumroad_customer_id': 'test@test.com', 'gumroad_order_id': '126'}
    return {'success': False, 'error': 'Invalid test license key'}
