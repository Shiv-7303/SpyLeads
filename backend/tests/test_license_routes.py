import pytest
from app import create_app, db
from app.models.license import License
import json

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_verify_license_missing_key(client):
    response = client.post('/api/v1/license/verify-license', json={'device_hash': 'abc'})
    assert response.status_code == 400
    assert b'License key is required' in response.data

def test_verify_license_valid_pro(client):
    response = client.post('/api/v1/license/verify-license', json={
        'license_key': 'TEST_PRO',
        'device_hash': 'device_1'
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert data['plan'] == 'PRO'
    assert 'session_token' in data

def test_verify_license_expired(client):
    response = client.post('/api/v1/license/verify-license', json={
        'license_key': 'TEST_EXPIRED',
        'device_hash': 'device_1'
    })
    assert response.status_code == 403
    data = json.loads(response.data)
    assert data['error'] == 'License is expired'

def test_verify_license_device_limit(client):
    # First device
    client.post('/api/v1/license/verify-license', json={
        'license_key': 'TEST_PRO',
        'device_hash': 'device_1'
    })
    # Second device
    response = client.post('/api/v1/license/verify-license', json={
        'license_key': 'TEST_PRO',
        'device_hash': 'device_2'
    })
    assert response.status_code == 403
    data = json.loads(response.data)
    assert 'Device limit reached' in data['error']
