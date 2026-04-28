import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from dotenv import load_dotenv

db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name=None):
    load_dotenv()
    app = Flask(__name__)
    config_name = config_name or os.getenv('FLASK_ENV', 'development')
    app.config.from_object(f'app.config.{config_name.capitalize()}Config')
    db.init_app(app)
    migrate.init_app(app, db)
    # Register blueprints here
    return app
