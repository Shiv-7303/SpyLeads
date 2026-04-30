from app import db
from app import create_app

# Import models to ensure SQLAlchemy registers them before create_all

def init_db():
    app = create_app()
    with app.app_context():
        # Drop all tables first to ensure a clean slate if schema changed
        db.drop_all()
        # Recreate tables
        db.create_all()
        print("Database initialized successfully with all tables.")

if __name__ == "__main__":
    init_db()
