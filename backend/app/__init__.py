from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import os
from dotenv import load_dotenv

from .config import config

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Allow CORS from the extension
    CORS(app)

    db.init_app(app)
    migrate.init_app(app, db)

    # Register blueprints
    from .routes.license_routes import license_bp
    from .routes.extraction_routes import extraction_bp
    app.register_blueprint(extraction_bp, url_prefix="/api/v1/extraction")
    app.register_blueprint(license_bp, url_prefix='/api/v1/license')

    @app.route('/health')
    def health_check():
        return jsonify({"status": "healthy"}), 200

    return app
