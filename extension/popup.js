import { PLANS, LIMITS } from './constants.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const planBadge = document.getElementById('plan-badge');
  const messageContainer = document.getElementById('message-container');
  const licenseSection = document.getElementById('license-section');
  const quotaSection = document.getElementById('quota-section');
  const licenseInput = document.getElementById('license-key');
  const verifyBtn = document.getElementById('verify-license-btn');
  const upgradeContainer = document.getElementById('upgrade-link-container');
  
  const quotaUsedEl = document.getElementById('quota-used');
  const quotaTotalEl = document.getElementById('quota-total');
  const quotaProgressEl = document.getElementById('quota-progress');
  const lastSyncEl = document.getElementById('last-sync-time');
  
  const extractBtn = document.getElementById('extract-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const extractCountSlider = document.getElementById('extract-count');
  const extractCountVal = document.getElementById('extract-count-val');

  // Load state from storage
  chrome.storage.sync.get(['plan', 'quotaUsed', 'lastSync', 'licenseKey'], (data) => {
    const plan = data.plan || PLANS.FREE;
    const quotaUsed = data.quotaUsed || 0;
    const lastSync = data.lastSync || Date.now();
    
    updateUIForPlan(plan, quotaUsed, lastSync);
    
    if (data.licenseKey && plan !== PLANS.FREE) {
      licenseInput.value = data.licenseKey;
    }
  });

  // UI Updaters
  function updateUIForPlan(plan, quotaUsed, lastSync) {
    let limit = LIMITS.FREE_PLAN_LIMIT;
    
    planBadge.textContent = plan === PLANS.PRO_PLUS ? 'Pro+' : (plan === PLANS.PRO ? 'Pro' : 'Free');
    planBadge.className = `badge badge-${plan.toLowerCase().replace('_', '-')}`;
    
    if (plan === PLANS.FREE) {
      licenseSection.classList.remove('hidden');
      quotaSection.classList.add('hidden');
      exportCsvBtn.disabled = true;
      extractBtn.disabled = false;
      upgradeContainer.classList.remove('hidden');
    } else {
      licenseSection.classList.add('hidden');
      quotaSection.classList.remove('hidden');
      exportCsvBtn.disabled = false;
      extractBtn.disabled = false;
      upgradeContainer.classList.add('hidden');
      
      limit = plan === PLANS.PRO ? LIMITS.PRO_PLAN_LIMIT : LIMITS.PRO_PLUS_PLAN_LIMIT;
    }

    quotaUsedEl.textContent = quotaUsed;
    quotaTotalEl.textContent = limit;
    
    const progressPercent = Math.min((quotaUsed / limit) * 100, 100);
    quotaProgressEl.style.width = `${progressPercent}%`;
    
    extractCountSlider.max = limit - quotaUsed;
    if(parseInt(extractCountSlider.value) > extractCountSlider.max) {
      extractCountSlider.value = extractCountSlider.max;
    }
    extractCountVal.textContent = extractCountSlider.value;
    
    const syncDate = new Date(lastSync);
    lastSyncEl.textContent = `${syncDate.getHours()}:${syncDate.getMinutes().toString().padStart(2, '0')}`;
  }

  function showMessage(msg, type = 'error') {
    messageContainer.textContent = msg;
    messageContainer.className = `message ${type}`;
    setTimeout(() => {
      messageContainer.className = 'message hidden';
    }, 5000);
  }

  // Event Listeners
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));
      
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.target}-tab`).classList.remove('hidden');
    });
  });

  extractCountSlider.addEventListener('input', (e) => {
    extractCountVal.textContent = e.target.value;
  });

  verifyBtn.addEventListener('click', () => {
    const key = licenseInput.value.trim();
    if (!key) {
      showMessage('Please enter a license key.');
      return;
    }
    
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="loading-spinner"></span>';
    
    chrome.runtime.sendMessage({ action: 'verify-license', licenseKey: key }, (response) => {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify';
      
      if (response && response.success) {
        showMessage('License verified successfully!', 'success');
        updateUIForPlan(response.plan, response.quotaUsed || 0, Date.now());
      } else {
        showMessage(response?.error || 'Failed to verify license.');
      }
    });
  });

  extractBtn.addEventListener('click', () => {
    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="loading-spinner"></span> Extracting...';
    
    // Trigger extraction in content script via background
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if(!tabs[0].url.includes("instagram.com")) {
        showMessage("Please navigate to Instagram first.");
        extractBtn.disabled = false;
        extractBtn.textContent = 'Extract Leads';
        return;
      }
      
      chrome.runtime.sendMessage({ 
        action: 'start-extraction', 
        count: extractCountSlider.value,
        tabId: tabs[0].id
      });
    });
  });

});
