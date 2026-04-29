import hashlib

def generate_device_hash(user_agent, platform, timezone, install_id):
    """
    Generates a deterministic SHA256 hash representing a unique device.
    Format: SHA256(user_agent|platform|timezone|install_id)
    """
    raw_string = f"{user_agent}|{platform}|{timezone}|{install_id}"
    hash_obj = hashlib.sha256(raw_string.encode('utf-8'))
    return hash_obj.hexdigest()
