import { PLANS, LIMITS, IG_CONSTANTS } from './constants.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const planBadge = document.getElementById('plan-badge');
  const planQuotaText = document.getElementById('plan-quota-text');
  const messageContainer = document.getElementById('message-container');
  const licenseSection = document.getElementById('license-section');
  const licenseInput = document.getElementById('license-key');
  const verifyBtn = document.getElementById('verify-license-btn');
  
  const extractBtn = document.getElementById('extract-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const extractCountInput = document.getElementById('extract-count');

  // Load state from storage
  chrome.storage.sync.get(['plan', 'quotaUsed', 'licenseKey', 'deviceCount'], (data) => {
    const plan = data.plan || PLANS.FREE;
    const quotaUsed = data.quotaUsed || 0;
    const deviceCount = data.deviceCount || 1;
    
    updateUIForPlan(plan, quotaUsed, deviceCount);
    
    if (data.licenseKey && plan !== PLANS.FREE) {
      licenseInput.value = data.licenseKey;
    }
  });
  
  // Check if extraction is currently active
  chrome.runtime.sendMessage({ action: 'get-extraction-status' }, (response) => {
      if (response && response.isExtracting) {
          extractBtn.disabled = true;
          extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> In Progress...';
      }
  });

  // UI Updaters
  function updateUIForPlan(plan, quotaUsed, deviceCount = 1) {
    let limit = LIMITS.FREE_PLAN_LIMIT;
    let badgeText = 'FREE';
    
    if (plan === PLANS.PRO_PLUS) {
      badgeText = 'PRO+';
      limit = LIMITS.PRO_PLUS_PLAN_LIMIT;
    } else if (plan === PLANS.PRO) {
      badgeText = 'PRO';
      limit = LIMITS.PRO_PLAN_LIMIT;
    }

    planBadge.textContent = badgeText;
    
    if (plan === PLANS.FREE) {
      licenseSection.classList.remove('hidden-element');
      exportCsvBtn.disabled = true;
      exportCsvBtn.style.opacity = '0.5';
      exportCsvBtn.style.cursor = 'not-allowed';
      extractBtn.disabled = false;
    } else {
      licenseSection.classList.add('hidden-element');
      exportCsvBtn.disabled = false;
      exportCsvBtn.style.opacity = '1';
      exportCsvBtn.style.cursor = 'pointer';
      extractBtn.disabled = false;
    }

    const remaining = limit - quotaUsed;
    let quotaText = `Plan: ${badgeText}  |  Remaining: ${remaining}`;
    if (plan !== PLANS.FREE) {
        quotaText += `  |  Device: ${deviceCount} of 1`;
    }
    planQuotaText.textContent = quotaText;
    
    extractCountInput.max = remaining;
    if(parseInt(extractCountInput.value) > parseInt(extractCountInput.max)) {
      extractCountInput.value = extractCountInput.max;
    }
  }

  function showMessage(msg, isError = true) {
    messageContainer.textContent = msg;
    messageContainer.classList.remove('hidden-element');
    messageContainer.style.color = isError ? 'var(--error)' : '#4caf50';
    setTimeout(() => {
      messageContainer.classList.add('hidden-element');
    }, 8000);
  }

  verifyBtn.addEventListener('click', () => {
    const key = licenseInput.value.trim();
    if (!key) {
      showMessage('Please enter a license key.');
      return;
    }
    
    verifyBtn.disabled = true;
    verifyBtn.textContent = '...';
    
    chrome.runtime.sendMessage({ action: 'verify-license', licenseKey: key }, (response) => {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Activate';
      
      if (response && response.success) {
        showMessage('License verified!', false);
        chrome.storage.sync.set({ deviceCount: response.deviceCount });
        updateUIForPlan(response.plan, response.quotaUsed || 0, response.deviceCount);
      } else {
        showMessage(response?.error || 'Failed to verify license.');
      }
    });
  });

  extractBtn.addEventListener('click', () => {
    extractBtn.disabled = true;
    const originalText = extractBtn.innerHTML;
    extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> Generating Plan...';
    
    // Check if on IG
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if(!tabs[0] || !tabs[0].url.includes("instagram.com")) {
        showMessage("Please navigate to Instagram first.");
        extractBtn.disabled = false;
        extractBtn.innerHTML = originalText;
        return;
      }
      
      chrome.runtime.sendMessage({ 
        action: 'start-extraction', 
        count: parseInt(extractCountInput.value) || 10,
        accountAgeDays: IG_CONSTANTS.DEFAULT_ACCOUNT_AGE_DAYS, // default for now unless we add an input
        tabId: tabs[0].id
      }, (res) => {
          if (res && res.success) {
             const p = res.plan;
             let m = `Extraction started! Est. duration: ${p.session_duration_minutes}m.`;
             if (p.warm_up_message) m += ` Note: ${p.warm_up_message}`;
             showMessage(m, false);
             extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> In Progress...';
          } else {
             showMessage(res?.error || "Failed to start extraction");
             extractBtn.disabled = false;
             extractBtn.innerHTML = originalText;
          }
      });
    });
  });
});
