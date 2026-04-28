import os

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///spyleads.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GUMROAD_API_KEY = os.getenv('GUMROAD_API_KEY', '')
    SENTRY_DSN = os.getenv('SENTRY_DSN', '')
    BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
