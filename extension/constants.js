export const API_BASE_URL = "http://localhost:5000"; // Update in prod

export const PLANS = {
  FREE: "FREE",
  PRO: "PRO",
  PRO_PLUS: "PRO_PLUS"
};

export const LIMITS = {
  FREE_PLAN_LIMIT: 10,
  PRO_PLAN_LIMIT: 80,
  PRO_PLUS_PLAN_LIMIT: 250,
  HOURLY_LIMITS: {
    FREE: 3,
    PRO: 15,
    PRO_PLUS: 40
  }
};

export const SCHEDULER_CONFIG = {
  BATCH_SIZE: {
    PRO: 20,
    PRO_PLUS: 40
  },
  BATCH_PAUSE_MIN: 120000, // 2 minutes in ms
  BATCH_PAUSE_MAX: 420000, // 7 minutes in ms
  ACTION_DELAY_MIN: 4000, // 4 seconds in ms
  ACTION_DELAY_MAX: 12000, // 12 seconds in ms
  SCROLL_DEPTH_LIMIT: 25,
  COOLDOWN_MIN: 300000, // 5 minutes in ms
  COOLDOWN_MAX: 600000 // 10 minutes in ms
};
