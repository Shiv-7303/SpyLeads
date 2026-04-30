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

def test_register_device_missing_fields(client):
    response = client.post('/api/v1/license/register-device', json={'license_key': 'abc'})
    assert response.status_code == 400

def test_register_device_valid(client, app):
    # Setup license
    with app.app_context():
        l = License(license_key="TEST_PRO")
        db.session.add(l)
        db.session.commit()

    response = client.post('/api/v1/license/register-device', json={
        'license_key': 'TEST_PRO',
        'user_agent': 'Mozilla/5.0',
        'platform': 'Win32',
        'timezone': 'UTC',
        'install_id': 'uuid-1234'
    })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert data['device_status'] == 'allowed'

def test_register_device_second_blocked(client, app):
    with app.app_context():
        l = License(license_key="TEST_PRO")
        db.session.add(l)
        db.session.commit()

    # Device 1
    client.post('/api/v1/license/register-device', json={
        'license_key': 'TEST_PRO',
        'install_id': 'uuid-1'
    })

    # Device 2
    response = client.post('/api/v1/license/register-device', json={
        'license_key': 'TEST_PRO',
        'install_id': 'uuid-2'
    })

    assert response.status_code == 403
    data = json.loads(response.data)
    assert data['success'] is False
    assert data['device_status'] == 'blocked'

def test_register_device_same_allowed(client, app):
    with app.app_context():
        l = License(license_key="TEST_PRO")
        db.session.add(l)
        db.session.commit()

    # Device 1 Request 1
    client.post('/api/v1/license/register-device', json={
        'license_key': 'TEST_PRO',
        'install_id': 'uuid-1'
    })

    # Device 1 Request 2 (same)
    response = client.post('/api/v1/license/register-device', json={
        'license_key': 'TEST_PRO',
        'install_id': 'uuid-1'
    })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['device_status'] == 'allowed'
