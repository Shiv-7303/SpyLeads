import pytest
from app import create_app, db
from app.models.license import License
from app.models.extraction import Extraction
from app.utils.token import generate_session_token

@pytest.fixture
def client():
    app = create_app('testing')
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()
            db.drop_all()

def test_check_quota_success(client):
    license_key = 'test-pro-key'
    with client.application.app_context():
        new_license = License(license_key=license_key, plan='pro', status='active')
        db.session.add(new_license)
        db.session.commit()
    
    response = client.post('/api/v1/extraction/check-quota', json={
        'license_key': license_key,
        'device_id': 'dev-1'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['allowed'] == True
    assert data['remaining'] == 80

def test_check_quota_exceeded(client):
    license_key = 'test-free-key'
    with client.application.app_context():
        new_license = License(license_key=license_key, plan='free', status='active')
        db.session.add(new_license)
        # log 10 found profiles
        ext = Extraction(license_key=license_key, extraction_type='hashtag', query='test', profiles_found=10)
        db.session.add(ext)
        db.session.commit()
    
    response = client.post('/api/v1/extraction/check-quota', json={
        'license_key': license_key,
        'device_id': 'dev-1'
    })
    assert response.status_code == 403
    data = response.get_json()
    assert data['allowed'] == False

def test_start_extraction(client):
    response = client.post('/api/v1/extraction/start', json={
        'license_key': 'test-key',
        'device_id': 'dev-1',
        'extraction_type': 'hashtag',
        'query': 'fitness',
        'session_size': 40
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] == True
    assert 'extraction_id' in data

def test_log_extraction(client):
    # First start it
    response = client.post('/api/v1/extraction/start', json={
        'license_key': 'test-key',
        'query': 'fitness'
    })
    ext_id = response.get_json()['extraction_id']
    
    # Now log progress
    log_res = client.post('/api/v1/extraction/log', json={
        'extraction_id': ext_id,
        'profiles_found': 5,
        'profiles_extracted': [{'username': 'u1'}],
        'status': 'in_progress'
    })
    assert log_res.status_code == 200
    assert log_res.get_json()['success'] == True

def test_get_progress(client):
    response = client.post('/api/v1/extraction/start', json={
        'license_key': 'test-key',
        'query': 'fitness'
    })
    ext_id = response.get_json()['extraction_id']
    
    prog_res = client.get(f'/api/v1/extraction/progress/{ext_id}')
    assert prog_res.status_code == 200
    data = prog_res.get_json()
    assert data['success'] == True
    assert data['progress']['status'] == 'in_progress'
