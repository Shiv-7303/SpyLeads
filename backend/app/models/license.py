from app import db
import uuid
from datetime import datetime

class License(db.Model):
    __tablename__ = 'licenses'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    license_key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    gumroad_customer_id = db.Column(db.String(100), nullable=True)
    gumroad_product_id = db.Column(db.String(100), nullable=True)
    gumroad_order_id = db.Column(db.String(100), nullable=True)
    
    plan = db.Column(db.String(20), nullable=False, default='free') # free, pro, pro_plus
    status = db.Column(db.String(20), nullable=False, default='active') # active, cancelled, expired
    
    expiry_date = db.Column(db.DateTime, nullable=True)
    
    device_count = db.Column(db.Integer, default=0)
    device_hash_list = db.Column(db.JSON, default=list)
    
    quota_remaining = db.Column(db.Integer, default=10)
    daily_limit = db.Column(db.Integer, default=10)
    hourly_limit = db.Column(db.Integer, default=3)
    
    last_check_timestamp = db.Column(db.DateTime, nullable=True)
    suspicion_score = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'license_key': self.license_key,
            'plan': self.plan,
            'status': self.status,
            'quota_remaining': self.quota_remaining,
            'daily_limit': self.daily_limit,
            'hourly_limit': self.hourly_limit,
            'device_count': self.device_count,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'last_check_timestamp': self.last_check_timestamp.isoformat() if self.last_check_timestamp else None
        }
