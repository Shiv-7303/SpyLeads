import { API_BASE_URL, PLANS, LIMITS } from './constants.js';

// Initialization
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['plan', 'quotaUsed', 'lastSync'], (data) => {
    if (!data.plan) {
      chrome.storage.sync.set({
        plan: PLANS.FREE,
        quotaUsed: 0,
        lastSync: Date.now()
      });
    }
  });
});

// Periodic license check (every 24 hours)
chrome.alarms.create('checkLicense', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkLicense') {
    verifyStoredLicense();
  }
});

async function verifyStoredLicense() {
  const data = await chrome.storage.sync.get(['licenseKey']);
  if (data.licenseKey) {
    // In real implementation, ping backend API
    console.log("Checking license periodically for:", data.licenseKey);
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'verify-license') {
    handleLicenseVerification(request.licenseKey).then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'start-extraction') {
    handleExtractionStart(request.tabId, request.count);
    // Send immediate ack
    sendResponse({ success: true, status: 'pending' });
  }
});

async function handleLicenseVerification(licenseKey) {
  try {
    // MOCK API CALL - Replace with real fetch to API_BASE_URL
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate simple verification
    if (licenseKey.startsWith('PRO_PLUS')) {
      const plan = PLANS.PRO_PLUS;
      await chrome.storage.sync.set({ plan, licenseKey, lastSync: Date.now() });
      return { success: true, plan };
    } else if (licenseKey.startsWith('PRO')) {
      const plan = PLANS.PRO;
      await chrome.storage.sync.set({ plan, licenseKey, lastSync: Date.now() });
      return { success: true, plan };
    } else {
      return { success: false, error: 'Invalid license key format.' };
    }
  } catch (error) {
    return { success: false, error: 'Network error verifying license.' };
  }
}

function handleExtractionStart(tabId, count) {
  chrome.tabs.sendMessage(tabId, { action: 'init-extraction', count }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Content script not ready or error:", chrome.runtime.lastError);
      // Could reinject content script here if needed
    } else {
      console.log("Extraction initiated in tab", tabId);
    }
  });
}
