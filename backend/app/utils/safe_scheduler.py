import random
import math

class SafeScheduler:
    @staticmethod
    def calculate_warmup_limit(account_age_days, requested_limit):
        """Applies warm-up protection based on Instagram account age."""
        if account_age_days < 2:
            return min(requested_limit, 40)
        elif account_age_days < 5:
            return min(requested_limit, 80)
        elif account_age_days < 7:
            return min(requested_limit, 150)
        return requested_limit

    @staticmethod
    def generate_plan(plan_type, requested_count, account_age_days=7):
        """Generates a secure extraction sequence plan matching the PRD specs."""

        # 1. Base Setup
        daily_limit = requested_count
        adjusted_limit = SafeScheduler.calculate_warmup_limit(account_age_days, daily_limit)

        warm_up_msg = f"Account < 7 days old. Limit reduced to {adjusted_limit}/day." if adjusted_limit < daily_limit else None

        # 2. Batch Logic
        if plan_type.upper() == 'PRO_PLUS':
            batch_size = 40
            pause_ranges = [(300, 540), (360, 720), (420, 900), (480, 1080), (600, 1200)] # Extracted from PRD (seconds)
        else:
            batch_size = 20
            pause_ranges = [(120, 240), (180, 360), (240, 420)] # Extracted from PRD (seconds)

        batch_count = math.ceil(adjusted_limit / batch_size)

        # Build pause list
        pause_durations = []
        for i in range(batch_count):
            if i == batch_count - 1:
                pause_durations.append(0) # No pause after the last batch
            else:
                idx = min(i, len(pause_ranges) - 1)
                min_s, max_s = pause_ranges[idx]
                pause_durations.append(random.randint(min_s, max_s))

        # 3. Delays per action
        delays = {
            "scroll": [4, 12],
            "profile_open": [5, 15],
            "extraction": [2, 8],
            "pagination": [3, 10]
        }

        # 4. Human Simulation estimates (for UI)
        # Average time per profile = scroll(8s) + profile_open(10s) + extraction(5s) + pagination(6s) + hover_pauses(15s) ~= 44 seconds
        avg_profile_time = 44
        total_active_time = adjusted_limit * avg_profile_time
        total_pause_time = sum(pause_durations)
        total_session_minutes = math.ceil((total_active_time + total_pause_time) / 60)

        return {
            "plan": plan_type.lower(),
            "batch_size": batch_size,
            "batch_count": batch_count,
            "pause_durations": pause_durations,
            "delays": delays,
            "adjusted_daily_limit": adjusted_limit,
            "warm_up_message": warm_up_msg,
            "total_extractions": adjusted_limit,
            "session_duration_minutes": total_session_minutes
        }
