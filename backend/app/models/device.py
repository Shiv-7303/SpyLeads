from app import db
import uuid
from datetime import datetime

class Device(db.Model):
    __tablename__ = 'devices'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    license_id = db.Column(db.String(36), db.ForeignKey('licenses.id'), nullable=False)
    
    device_hash = db.Column(db.String(255), nullable=False, index=True)
    user_agent = db.Column(db.Text, nullable=True)
    platform = db.Column(db.String(50), nullable=True)
    timezone = db.Column(db.String(50), nullable=True)
    install_id = db.Column(db.String(100), nullable=False)
    
    first_seen = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    device_status = db.Column(db.String(20), nullable=False, default='allowed') # allowed, warned, blocked
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_hash': self.device_hash,
            'device_status': self.device_status,
            'first_seen': self.first_seen.isoformat(),
            'last_seen': self.last_seen.isoformat()
        }
