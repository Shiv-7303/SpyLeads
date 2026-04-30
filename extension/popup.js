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
  
  const hashtagInput = document.getElementById('hashtag-input');
  const locationInput = document.getElementById('location-input');
  
  const followerPresets = document.getElementById('follower-presets');
  const customFollowerRange = document.getElementById('custom-follower-range');
  const followerMin = document.getElementById('follower-min');
  const followerMax = document.getElementById('follower-max');
  
  const extractionProgress = document.getElementById('extraction-progress');
  const upgradeLinkContainer = document.getElementById('upgrade-link-container');
  const lastSyncTime = document.getElementById('last-sync-time');

  let lastExtractedProfiles = [];
  let selectedFollowerRange = { type: 'none', min: null, max: null };

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

  // Follower Preset Logic
  if (followerPresets) {
      const presetButtons = followerPresets.querySelectorAll('button');
      presetButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
              // Reset all buttons
              presetButtons.forEach(b => {
                  b.classList.remove('bg-secondary', 'text-on-secondary');
                  b.classList.add('hover:bg-surface-variant');
              });
              
              // Highlight selected
              const target = e.target;
              target.classList.remove('hover:bg-surface-variant');
              target.classList.add('bg-secondary', 'text-on-secondary');
              
              const val = target.getAttribute('data-val');
              if (val === 'custom') {
                  customFollowerRange.classList.remove('hidden-element');
                  selectedFollowerRange.type = 'custom';
              } else {
                  customFollowerRange.classList.add('hidden-element');
                  selectedFollowerRange.type = val;
                  // Map values
                  if (val === 'micro') { selectedFollowerRange.min = 1000; selectedFollowerRange.max = 10000; }
                  else if (val === 'small') { selectedFollowerRange.min = 10000; selectedFollowerRange.max = 50000; }
                  else if (val === 'mid') { selectedFollowerRange.min = 50000; selectedFollowerRange.max = 100000; }
                  else if (val === 'macro') { selectedFollowerRange.min = 100000; selectedFollowerRange.max = 500000; }
                  else { selectedFollowerRange.min = null; selectedFollowerRange.max = null; }
              }
          });
      });
  }

  // Load previously extracted profiles if they exist
  chrome.storage.local.get(['lastExtractedProfiles'], (data) => {
      if (data.lastExtractedProfiles && data.lastExtractedProfiles.length > 0) {
          lastExtractedProfiles = data.lastExtractedProfiles;
          // Optionally, visually indicate there are profiles ready to download
          exportCsvBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">download</span> Export CSV (${lastExtractedProfiles.length} ready)`;
          if (extractionProgress) {
              extractionProgress.innerText = `${lastExtractedProfiles.length} extracted`;
          }
      }
  });
  
  // Check if extraction is currently active
  chrome.runtime.sendMessage({ action: 'get-extraction-status' }, (response) => {
      if (response && response.isExtracting) {
          extractBtn.disabled = true;
          extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span> In Progress...';
      }
  });

  // Listen for extraction updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extraction-completed') {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">search</span> Extract Leads';
      showMessage('Extraction completed successfully!', false);
      
      if (message.profiles) {
          lastExtractedProfiles = message.profiles;
          exportCsvBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">download</span> Export CSV (${lastExtractedProfiles.length} ready)`;
      }
      
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
      if (upgradeLinkContainer) upgradeLinkContainer.classList.remove('hidden-element');
    } else {
      licenseSection.classList.add('hidden-element');
      exportCsvBtn.disabled = false;
      exportCsvBtn.style.opacity = '1';
      exportCsvBtn.style.cursor = 'pointer';
      extractBtn.disabled = false;
      if (upgradeLinkContainer) upgradeLinkContainer.classList.add('hidden-element');
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

      
      let targetHashtag = hashtagInput && hashtagInput.value.trim() !== '' ? hashtagInput.value.trim() : null;
      if (!targetHashtag) {
          // Fallback to URL
          const url = new URL(tabs[0].url);
          let extractedHashtag = url.pathname.split('/explore/tags/')[1];
          if (extractedHashtag) {
              targetHashtag = extractedHashtag.replace('/', '');
          } else {
              targetHashtag = "any";
          }
      }
      
      // Update custom bounds if selected
      if (selectedFollowerRange.type === 'custom') {
          selectedFollowerRange.min = followerMin ? parseInt(followerMin.value) : null;
          selectedFollowerRange.max = followerMax ? parseInt(followerMax.value) : null;
      }
      
      const locationVal = locationInput ? locationInput.value.trim() : '';

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
            hashtag: targetHashtag,
            location: locationVal,
            followerRange: selectedFollowerRange,
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
