import { PLANS, LIMITS } from './constants.js';

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
  chrome.storage.sync.get(['plan', 'quotaUsed', 'licenseKey'], (data) => {
    const plan = data.plan || PLANS.FREE;
    const quotaUsed = data.quotaUsed || 0;
    
    updateUIForPlan(plan, quotaUsed);
    
    if (data.licenseKey && plan !== PLANS.FREE) {
      licenseInput.value = data.licenseKey;
    }
  });

  // UI Updaters
  function updateUIForPlan(plan, quotaUsed) {
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
    planQuotaText.textContent = `Plan: ${badgeText}  |  Remaining: ${remaining}`;
    
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
    }, 5000);
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
        updateUIForPlan(response.plan, response.quotaUsed || 0);
      } else {
        showMessage(response?.error || 'Failed to verify license.');
      }
    });
  });

  extractBtn.addEventListener('click', () => {
    extractBtn.disabled = true;
    const originalText = extractBtn.innerHTML;
    extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> Extracting...';
    
    // Trigger extraction in content script via background
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
        tabId: tabs[0].id
      });
    });
  });
});
