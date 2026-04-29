import { PLANS, LIMITS, API } from './constants.js';

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
  
<<<<<<< Updated upstream
=======
  let lastExtractedProfiles = [];

>>>>>>> Stashed changes
  // Listen for extraction updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extraction-completed') {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">search</span> Extract Leads';
      showMessage('Extraction completed successfully!', false);
      
<<<<<<< Updated upstream
=======
      if (message.profiles) {
          lastExtractedProfiles = message.profiles;
      }
      
>>>>>>> Stashed changes
      // Update quota
      chrome.storage.sync.get(['plan', 'quotaUsed', 'deviceCount'], (data) => {
        updateUIForPlan(data.plan || PLANS.FREE, data.quotaUsed || 0, data.deviceCount || 1);
      });
    } else if (message.action === 'extraction-error') {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">search</span> Extract Leads';
      showMessage(message.error || 'Extraction failed.', true);
    }
  });
<<<<<<< Updated upstream
=======

  exportCsvBtn.addEventListener('click', () => {
      if (lastExtractedProfiles.length === 0) {
          showMessage('No leads extracted yet.');
          return;
      }

      // Convert to CSV
      const headers = ['Username', 'Full Name', 'Followers', 'Following', 'Verified', 'Bio', 'Profile URL', 'Extracted At'];
      const csvRows = [headers.join(',')];

      for (const profile of lastExtractedProfiles) {
          // Escape quotes and commas in bio/names
          const escapeCsv = (str) => {
              if (str === null || str === undefined) return '""';
              const strVal = String(str);
              if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
                  return `"${strVal.replace(/"/g, '""')}"`;
              }
              return strVal;
          };

          const row = [
              escapeCsv(profile.username),
              escapeCsv(profile.full_name),
              escapeCsv(profile.followers),
              escapeCsv(profile.following),
              escapeCsv(profile.is_verified),
              escapeCsv(profile.bio),
              escapeCsv(profile.profile_url),
              escapeCsv(profile.timestamp)
          ];
          csvRows.push(row.join(','));
      }

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `spyleads_export_${Date.now()}.csv`;
      a.click();
      
      URL.revokeObjectURL(url);
  });
>>>>>>> Stashed changes

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

  extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    const originalText = extractBtn.innerHTML;
    extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> Checking Quota...';
    
    // Check if on IG
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      if(!tabs[0] || !tabs[0].url.includes("instagram.com")) {
        showMessage("Please navigate to Instagram first.");
        extractBtn.disabled = false;
        extractBtn.innerHTML = originalText;
        return;
      }

      // We need to parse hashtags from input if possible, but let's assume current tab URL is hashtag for now or use dummy hashtag
      const hashtag = "fitness"; // Should come from UI, keeping dummy for now or extracting from URL
      const url = new URL(tabs[0].url);
      let extractedHashtag = url.pathname.split('/explore/tags/')[1] || "fitness";
      extractedHashtag = extractedHashtag.replace('/', '');

      // Step 1: Check Quota via background message
      chrome.runtime.sendMessage({ 
        action: 'check-quota', 
        count: parseInt(extractCountInput.value) || 10
      }, (quotaRes) => {
          if (!quotaRes || !quotaRes.success) {
             showMessage(quotaRes?.error || "Quota check failed");
             extractBtn.disabled = false;
             extractBtn.innerHTML = originalText;
             return;
          }
          
          if (!quotaRes.allowed) {
             showMessage(quotaRes.reason || "Quota exceeded");
             extractBtn.disabled = false;
             extractBtn.innerHTML = originalText;
             return;
          }

          extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> Generating Plan...';
          
          chrome.runtime.sendMessage({ 
            action: 'start-extraction', 
            count: parseInt(extractCountInput.value) || 10,
            accountAgeDays: 7, // default
            tabId: tabs[0].id,
            hashtag: extractedHashtag,
            sessionSize: quotaRes.session_size
          }, (res) => {
              if (res && res.success) {
                 const p = res.plan;
                 let m = `Extraction started!`; // p.session_duration_minutes might be undefined if we change plan
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
});
