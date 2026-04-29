from app import db
import uuid
from datetime import datetime

class Extraction(db.Model):
    __tablename__ = 'extractions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    license_key = db.Column(db.String(100), db.ForeignKey('licenses.license_key'), nullable=False, index=True)
    device_id = db.Column(db.String(100), nullable=True) # Could be a FK, but keeping it simple string as user suggested device_id TEXT

    extraction_type = db.Column(db.String(20), nullable=False) # 'hashtag', 'location'
    query = db.Column(db.String(255), nullable=False)

    profiles_found = db.Column(db.Integer, default=0)
    profiles_extracted = db.Column(db.JSON, default=list) # Array of objects/usernames

    session_size = db.Column(db.Integer, default=0)
    duration_seconds = db.Column(db.Integer, default=0)

    status = db.Column(db.String(20), nullable=False, default='pending') # pending, in_progress, completed, failed

    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Note: extraction_logs table from PRD is basically this table doing double-duty.
    # We will log extractions here, and calculate quota by counting profiles_found here for today.

    def to_dict(self):
        return {
            'id': self.id,
            'license_key': self.license_key,
            'extraction_type': self.extraction_type,
            'query': self.query,
            'profiles_found': self.profiles_found,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
