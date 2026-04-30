import { API, PLANS, LIMITS } from './constants.js';

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
      const response = await fetch(`${API.backend_url}${API.endpoints.register_device}`, {
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
  
  
  if (request.action === 'check-quota') {
      handleQuotaCheck(request.count).then(sendResponse);
      return true;
  }
  
  if (request.action === 'start-extraction') {
    handleExtractionStart(request.tabId, request.count, request.accountAgeDays, request.hashtag, request.sessionSize).then(sendResponse);
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
    const response = await fetch(`${API.backend_url}${API.endpoints.verify_license}`, {
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
    const response = await fetch(`${API.backend_url}${API.endpoints.generate_plan}`, {
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

function executeContentScriptAndMessage(tabId, plan, hashtag, sessionSize, extractionId) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'init-extraction', plan: plan, hashtag: hashtag, sessionSize: sessionSize, extractionId: extractionId }, (response) => {
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
                  
                  chrome.tabs.sendMessage(tabId, { action: 'init-extraction', plan: plan, hashtag: hashtag, sessionSize: sessionSize, extractionId: extractionId }, (retryResponse) => {
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

async function handleExtractionStart(tabId, requestedCount, accountAgeDays, hashtag, sessionSize) {
  const planResponse = await fetchExtractionPlan(requestedCount, accountAgeDays);
  if (!planResponse.success) {
      return planResponse; // Send error back to popup
  }
  
  const extractionId = await startExtractionSessionInDB(hashtag, sessionSize);
  
  const plan = planResponse.plan;
  const scriptSuccess = await executeContentScriptAndMessage(tabId, plan, hashtag, sessionSize, extractionId);
  
  if (!scriptSuccess) {
      return { success: false, error: "Failed to connect to Instagram page. Try refreshing the tab." };
  }
  
  activeExtractionTabId = tabId;
  return { success: true, plan: plan };
}


async function handleQuotaCheck(requestedCount) {
  const data = await chrome.storage.sync.get(['licenseKey']);
  if (!data.licenseKey) {
    return { success: false, error: 'Not authenticated. Verify license first.' };
  }
  
  try {
    const response = await fetch(`${API.backend_url}${API.endpoints.check_quota}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            license_key: data.licenseKey,
            device_id: await getInstallId()
        })
    });
    
    if (response.status === 403) {
      const result = await response.json();
      return { success: true, allowed: false, reason: result.reason || result.error || "Quota error" };
    }
    
    const result = await response.json();
    return { success: true, allowed: result.allowed, session_size: result.session_size, remaining: result.remaining };
  } catch (err) {
      console.error("Failed to check quota", err);
      return { success: false, error: "Network error checking quota." };
  }
}

async function startExtractionSessionInDB(hashtag, sessionSize) {
  const data = await chrome.storage.sync.get(['licenseKey']);
  try {
    const response = await fetch(`${API.backend_url}${API.endpoints.start_extraction}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            license_key: data.licenseKey,
            device_id: await getInstallId(),
            extraction_type: 'hashtag',
            query: hashtag,
            session_size: sessionSize
        })
    });
    const result = await response.json();
    return result.extraction_id;
  } catch (err) {
      console.error("Failed to start db extraction", err);
      return null;
  }
}


// Listener for opening background tabs for profile extraction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract-profile-background') {
        extractProfileInBackground(request.username, sender.tab.id).then(sendResponse);
        return true;
    }
    
    if (request.action === 'log-extraction-progress') {
        logExtractionProgress(request.extractionId, request.profilesFound, request.profilesData, request.status);
        return false;
    }
});

async function logExtractionProgress(extractionId, profilesFound, profilesData, status) {
  try {
    await fetch(`${API.backend_url}${API.endpoints.log_extraction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            extraction_id: extractionId,
            profiles_found: profilesFound,
            profiles_extracted: profilesData,
            status: status
        })
    });
  } catch(e) {
      console.error("Failed to log progress", e);
  }
}

async function extractProfileInBackground(username, mainTabId) {
    const profileUrl = `https://www.instagram.com/${username}/`;
    
    // Step 1: Open profile in new background tab
    const profileTab = await chrome.tabs.create({
      url: profileUrl,
      active: false,  // BACKGROUND TAB
      openerTabId: mainTabId
    });
    
    console.log(`[EXTRACT] Opened profile tab: ${profileTab.id} for ${username}`);
    
    // Step 2: Wait for tab and send message
    try {
        await waitForTabReady(profileTab.id);
        
        // Brief pause to allow content script (auto-injected via manifest) to initialize
        await sleep(1000);
        
        // Step 3: Send message to extract profile data
        const profileData = await new Promise((resolve) => {
            chrome.tabs.sendMessage(profileTab.id, {
                action: 'EXTRACT_PROFILE_DATA',
                username: username
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error communicating with profile tab:", chrome.runtime.lastError);
                    resolve({ username: username, error: "Failed to extract" });
                } else {
                    resolve(response || { username: username, error: "Empty response" });
                }
            });
        });
        
        console.log(`[EXTRACT] Got profile data for ${username}:`, profileData);
        
        // Step 4: Close profile tab silently
        await chrome.tabs.remove(profileTab.id);
        console.log(`[EXTRACT] Closed profile tab for ${username}`);
        
        return profileData;
    } catch(e) {
        console.error("Failed to extract profile background:", e);
        try { await chrome.tabs.remove(profileTab.id); } catch(err){}
        return { username: username, error: "Extraction failed" };
    }
}

async function waitForTabReady(tabId, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') {
          return true;
      }
    } catch (e) {}
    
    await sleep(500);
  }
  
  throw new Error(`Tab ${tabId} failed to load in ${timeout}ms`);
}
