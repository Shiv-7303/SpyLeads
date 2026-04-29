import { API_BASE_URL, PLANS, LIMITS } from './constants.js';

let activeExtractionTabId = null;

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

async function getInstallId() {
  const data = await chrome.storage.local.get(['install_id']);
  if (data.install_id) return data.install_id;
  
  const newInstallId = crypto.randomUUID();
  await chrome.storage.local.set({ install_id: newInstallId });
  return newInstallId;
}

async function getDeviceFingerprintPayload(licenseKey) {
  const install_id = await getInstallId();
  const user_agent = navigator.userAgent;
  const platform = navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return {
    license_key: licenseKey,
    user_agent,
    platform,
    timezone,
    install_id
  };
}

async function registerDevice(licenseKey) {
  try {
      const payload = await getDeviceFingerprintPayload(licenseKey);
      const response = await fetch(`${API_BASE_URL}/api/v1/license/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      return result;
  } catch(e) {
      console.error("Device registration network error", e);
      return { success: false, error: 'Network error communicating with the server.' };
  }
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
    handleExtractionStart(request.tabId, request.count, request.accountAgeDays).then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'get-extraction-status') {
      sendResponse({ isExtracting: activeExtractionTabId !== null, tabId: activeExtractionTabId });
      return false; // synchronous
  }
  
  if (request.action === "content-log") {
      console.log("[Content Script]:", request.message, request.obj || "");
      return false;
  }

  if (request.action === 'extraction-completed') {
      activeExtractionTabId = null;
      sendResponse({ success: true });
      return false;
  }
});

// Clean up state if tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeExtractionTabId) {
        activeExtractionTabId = null;
    }
});

async function handleLicenseVerification(licenseKey) {
  try {
    const deviceResult = await registerDevice(licenseKey);
    if (!deviceResult.success) {
       return { success: false, error: deviceResult.error || 'Device blocked.' };
    }
      
    const deviceHash = deviceResult.device_hash;
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
      return { 
          success: true, 
          plan: result.plan, 
          quotaUsed: result.quota_remaining ? LIMITS[`${result.plan}_PLAN_LIMIT`] - result.quota_remaining : 0,
          deviceCount: deviceResult.device_count || 1
      };
    } else {
      return { success: false, error: result.error || 'Failed to verify license key.' };
    }
  } catch (error) {
    console.error("Verification network error", error);
    return { success: false, error: 'Network error communicating with the server.' };
  }
}

async function fetchExtractionPlan(requestedCount, accountAgeDays) {
  const data = await chrome.storage.sync.get(['sessionToken']);
  if (!data.sessionToken) {
    return { success: false, error: 'Not authenticated. Verify license first.' };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/extraction/generate-plan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.sessionToken}`
        },
        body: JSON.stringify({
            requested_count: requestedCount,
            account_age_days: accountAgeDays
        })
    });
    const result = await response.json();
    return result;
  } catch (err) {
      console.error("Failed to fetch extraction plan", err);
      return { success: false, error: "Network error fetching plan." };
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function executeContentScriptAndMessage(tabId, plan) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'init-extraction', plan: plan }, (response) => {
            if (chrome.runtime.lastError) {
              console.log("Injecting content script dynamically because it wasn't ready.");
              
              chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  files: ['content.js']
              }, async () => {
                  if (chrome.runtime.lastError) {
                      console.error("Failed to inject script: ", chrome.runtime.lastError);
                      resolve(false);
                      return;
                  }
                  
                  // Wait a brief moment for the script execution context to fully parse
                  await sleep(500);
                  
                  chrome.tabs.sendMessage(tabId, { action: 'init-extraction', plan: plan }, (retryResponse) => {
                      if (chrome.runtime.lastError) {
                          console.error("Still failed after injection: ", chrome.runtime.lastError);
                          resolve(false);
                      } else {
                          console.log("Extraction initiated in tab after injection", tabId);
                          resolve(true);
                      }
                  });
              });
            } else {
              console.log("Extraction initiated in tab", tabId);
              resolve(true);
            }
        });
    });
}

async function handleExtractionStart(tabId, requestedCount, accountAgeDays) {
  const planResponse = await fetchExtractionPlan(requestedCount, accountAgeDays);
  if (!planResponse.success) {
      return planResponse; // Send error back to popup
  }
  
  const plan = planResponse.plan;
  const scriptSuccess = await executeContentScriptAndMessage(tabId, plan);
  
  if (!scriptSuccess) {
      return { success: false, error: "Failed to connect to Instagram page. Try refreshing the tab." };
  }
  
  activeExtractionTabId = tabId;
  return { success: true, plan: plan };
}
