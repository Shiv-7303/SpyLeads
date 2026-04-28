import pytest
from app import create_app

def test_app_boots():
    app = create_app('test')
    client = app.test_client()
    response = client.get('/')
    assert response.status_code in (200, 404)
