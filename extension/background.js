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

async function getDeviceHash() {
  // Simple deterministic hash based on static user agent data for device locking.
  // In a real V3 extension, you might generate a UUID and store it in local storage.
  const data = await chrome.storage.local.get(['device_id']);
  if (data.device_id) return data.device_id;
  
  const newDeviceId = crypto.randomUUID();
  await chrome.storage.local.set({ device_id: newDeviceId });
  return newDeviceId;
}

async function verifyStoredLicense() {
  const data = await chrome.storage.sync.get(['licenseKey']);
  if (data.licenseKey) {
    handleLicenseVerification(data.licenseKey);
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
    const deviceHash = await getDeviceHash();
    
    const response = await fetch(`${API_BASE_URL}/api/v1/license/verify-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license_key: licenseKey,
        device_hash: deviceHash
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      await chrome.storage.sync.set({ 
        plan: result.plan, 
        licenseKey: licenseKey,
        sessionToken: result.session_token,
        lastSync: Date.now() 
      });
      return { success: true, plan: result.plan, quotaUsed: result.quota_remaining ? LIMITS[`${result.plan}_PLAN_LIMIT`] - result.quota_remaining : 0 };
    } else {
      return { success: false, error: result.error || 'Failed to verify license key.' };
    }
  } catch (error) {
    console.error("Verification network error", error);
    return { success: false, error: 'Network error communicating with the server.' };
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
