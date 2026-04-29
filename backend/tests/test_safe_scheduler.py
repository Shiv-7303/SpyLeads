import pytest
from app.utils.safe_scheduler import SafeScheduler

def test_warmup_limits():
    assert SafeScheduler.calculate_warmup_limit(1, 80) == 40
    assert SafeScheduler.calculate_warmup_limit(3, 100) == 80
    assert SafeScheduler.calculate_warmup_limit(6, 250) == 150
    assert SafeScheduler.calculate_warmup_limit(10, 250) == 250

def test_generate_plan_pro():
    plan = SafeScheduler.generate_plan('pro', 80, account_age_days=10)

    assert plan['plan'] == 'pro'
    assert plan['batch_size'] == 20
    assert plan['batch_count'] == 4
    assert plan['adjusted_daily_limit'] == 80
    assert len(plan['pause_durations']) == 4
    assert plan['pause_durations'][-1] == 0  # Last pause is 0

    # Check delays exist
    assert 'scroll' in plan['delays']

def test_generate_plan_pro_plus_warmup():
    plan = SafeScheduler.generate_plan('pro_plus', 250, account_age_days=1)

    assert plan['plan'] == 'pro_plus'
    assert plan['adjusted_daily_limit'] == 40 # Capped by 1 day old
    assert 'Account < 7 days old' in plan['warm_up_message']

    assert plan['batch_size'] == 40
    assert plan['batch_count'] == 1
    assert len(plan['pause_durations']) == 1
