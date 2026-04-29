
export const API_BASE_URL = 'http://127.0.0.1:5000';

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  PRO_PLUS: 'pro_plus'
};

export const LIMITS = {
  FREE_DAILY_QUOTA: 10,
  PRO_DAILY_QUOTA: 50,
  PRO_PLUS_DAILY_QUOTA: 200
};

export const HASHTAG_SELECTORS = {
  // Profile card container (each result is inside this)
  profile_card: 'a[href^="/"]',  // Generic: all profile links
  profile_card_alt: '[role="button"]',  // Fallback

  // Username (inside profile card)
  username: 'span',  // Username text

  // Follower count (usually in bio area)
  followers_button: 'button:has-text("followers")',  // Direct match
  followers_text: 'button',  // Fallback: get all buttons, parse

  // Full name
  full_name: 'h2',  // Usually in header

  // Bio text
  bio: '[data-testid="bio"]',  // Specific test ID
  bio_fallback: 'span',  // Fallback

  // Verification badge
  verified_badge: 'svg[aria-label="Verified"]',
};

// ==================
// PROFILE PAGE SELECTORS
// ==================

export const PROFILE_SELECTORS = {
  // Main profile info header
  header: 'header',

  // Username (H1 or similar)
  username: 'h1',

  // Follower count button
  followers: 'button:has-text("followers")',

  // Following count
  following: 'button:has-text("following")',

  // Bio section
  bio_container: '[data-testid="bio"]',

  // Email in bio (regex-based, not selector)
  email_regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,

  // Instagram URL
  website_link: 'a[href^="http"]',  // Links in bio
};

// ==================
// EXTRACTION CONFIG
// ==================

export const EXTRACTION_CONFIG = {
  // Rate limiting
  delay_between_requests_ms: 3000,  // 3 sec between Instagram API calls
  delay_between_profiles_ms: 1500,  // 1.5 sec per profile extraction

  // Session settings
  free_session_size: 10,  // Free: extract 10, then done
  pro_session_size: 40,  // Pro: extract 40, then 5 min break
  pro_break_minutes: 5,  // Break after 40 profiles

  // Timeout
  page_load_timeout_ms: 10000,  // 10 sec to load page
  extraction_timeout_ms: 30000,  // 30 sec total per profile

  // Retry logic
  max_retries: 3,
  retry_delay_ms: 5000,
};

// ==================
// API ENDPOINTS
// ==================

export const API = {
  backend_url: 'http://127.0.0.1:5000',

  endpoints: {
    verify_license: '/api/v1/license/verify-license',
    register_device: '/api/v1/license/register-device',
    generate_plan: '/api/v1/extraction/generate-plan',
    check_quota: '/api/v1/extraction/check-quota',
    log_extraction: '/api/v1/extraction/log',
    start_extraction: '/api/v1/extraction/start',
    extraction_progress: '/api/v1/extraction/progress'
  }
};

// ==================
// FEATURE FLAGS
// ==================

export const FEATURES = {
  email_enrichment_enabled: true,  // Can disable for testing
  auto_scroll_enabled: false,  // Not yet implemented
  sheets_sync_enabled: false,  // Not yet implemented
  debug_mode: true,  // Show debug panel by default
};

// ==================
// ERROR MESSAGES
// ==================

export const ERRORS = {
  hashtag_not_found: '#Hashtag not found or no profiles matched',
  rate_limited: 'Instagram rate-limited us. Wait 15 min, then retry.',
  session_expired: 'Instagram session expired. Please login and retry.',
  page_load_timeout: 'Page took too long to load. Check internet & retry.',
  invalid_license: 'License key is invalid or expired.',
  quota_exceeded: 'Daily quota reached. Upgrade to Pro for more.',
};

// ==================
// SUCCESS MESSAGES
// ==================

export const SUCCESS = {
  extraction_complete: (count) => `✅ Done! ${count} profiles found`,
  profile_extracted: (username, followers) => `👤 ${username} | ${followers} followers`,
  license_activated: '✅ Pro plan activated!',
};
