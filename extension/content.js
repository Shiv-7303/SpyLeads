if (!window.__spyLeadsInjected) {
  window.__spyLeadsInjected = true;

  const bgLog = (msg, obj) => {
      console.log(msg, obj || "");
      chrome.runtime.sendMessage({ action: 'content-log', message: msg, obj: obj });
  };

  bgLog("SpyLeads Content Script Loaded.");

  let isExtracting = false;
  let extractionPlan = null;
  let currentExtracted = 0;
  let floatUI = null;

  function createFloatingUI() {
      if(floatUI) return floatUI;

      floatUI = document.createElement('div');
      floatUI.style.position = 'fixed';
      floatUI.style.bottom = '20px';
      floatUI.style.left = '20px';
      floatUI.style.backgroundColor = '#b7004f'; // Primary color
      floatUI.style.color = '#ffffff';
      floatUI.style.padding = '12px 20px';
      floatUI.style.borderRadius = '8px';
      floatUI.style.fontFamily = 'system-ui, sans-serif';
      floatUI.style.fontSize = '14px';
      floatUI.style.fontWeight = 'bold';
      floatUI.style.zIndex = '9999999';
      floatUI.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
      floatUI.style.display = 'flex';
      floatUI.style.alignItems = 'center';
      floatUI.style.gap = '10px';

      const spinner = document.createElement('div');
      spinner.style.width = '16px';
      spinner.style.height = '16px';
      spinner.style.border = '3px solid rgba(255,255,255,0.3)';
      spinner.style.borderTop = '3px solid white';
      spinner.style.borderRadius = '50%';
      spinner.animate([
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(360deg)' }
      ], { duration: 1000, iterations: Infinity });

      const text = document.createElement('span');
      text.id = 'spyleads-float-text';
      text.innerText = 'SpyLeads: Initializing...';

      floatUI.appendChild(spinner);
      floatUI.appendChild(text);
      document.body.appendChild(floatUI);
      return floatUI;
  }

  function updateFloatingUI(message) {
      if(!floatUI) createFloatingUI();
      const text = document.getElementById('spyleads-float-text');
      if(text) text.innerText = message;
  }

  function removeFloatingUI() {
      if(floatUI) {
          floatUI.remove();
          floatUI = null;
      }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_PROFILE_DATA') {
        const username = request.username;
        bgLog(`Extracting profile data directly from DOM for ${username}`);

        // This is where DOM constants and selectors go. For now, dummy data since we can't reliably load IG in Sandbox.
        const profileData = {
           username: username,
           full_name: document.title || username,
           followers: "10K",
           following: "500",
           bio: "Sample bio",
           timestamp: new Date().toISOString()
        };

        sendResponse(profileData);
        return false;
    }

    if (request.action === 'init-extraction') {
      window._currentExtractionId = request.extractionId;
      window._extractedProfiles = [];

      if (!window.location.href.includes("instagram.com")) {
        sendResponse({ success: false, error: 'Not on Instagram' });
        return;
      }

      if (isExtracting) {
        sendResponse({ success: false, error: 'Extraction already in progress' });
        return;
      }

      bgLog(`Starting extraction sequence...`);
      isExtracting = true;
      extractionPlan = request.plan;
      currentExtracted = 0;

      createFloatingUI();
      executeExtractionPlan();

      sendResponse({ success: true, status: 'started' });
    }
    return true;
  });

  // Sleep utility
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Randomizer between bounds
  const getRandomDelay = (minSec, maxSec) => {
      return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
  };

  // Main loop for batched extraction logic simulating DOM human interactions
  async function executeExtractionPlan() {
      const totalToExtract = extractionPlan.total_extractions;
      const batchSize = extractionPlan.batch_size;
      const pauses = extractionPlan.pause_durations;
      const delays = extractionPlan.delays;

      let currentBatch = 0;
      let profilesInCurrentBatch = 0;

      while(currentExtracted < totalToExtract) {
          const statusPrefix = `SpyLeads [${currentExtracted + 1}/${totalToExtract}]:`;
          bgLog(`--- Extracting profile ${currentExtracted + 1} of ${totalToExtract} ---`);

          // Simulating 1. Scroll to profile
          let delay = getRandomDelay(delays.scroll[0], delays.scroll[1]);
          bgLog(`Scrolling... waiting ${delay/1000}s`);
          updateFloatingUI(`${statusPrefix} Scrolling... (${(delay/1000).toFixed(1)}s)`);
          await sleep(delay);

          // Simulating 3. Hover & Pause
          delay = getRandomDelay(2, 5);
          bgLog(`Hovering... waiting ${delay/1000}s`);
          updateFloatingUI(`${statusPrefix} Hovering... (${(delay/1000).toFixed(1)}s)`);
          await sleep(delay);


          // Option A: Extract profile data via background script -> New Tab
          // For now, we simulate getting username and sending it to background
          const username = "dummy_user_" + currentExtracted;
          bgLog(`Requesting background extraction for ${username}...`);
          updateFloatingUI(`${statusPrefix} Extracting ${username}...`);

          try {
             const profileData = await new Promise((resolve) => {
                 chrome.runtime.sendMessage({
                     action: 'extract-profile-background',
                     username: username
                 }, resolve);
             });
             bgLog("Extracted data:", profileData);

             // Log progress to DB every time a profile is found
             chrome.runtime.sendMessage({
                 action: 'log-extraction-progress',
                 extractionId: request.extractionId || window._currentExtractionId,
                 profilesFound: currentExtracted,
                 profilesData: window._extractedProfiles || [],
                 status: 'in_progress'
             });
          } catch(e) {
             bgLog("Error in background extraction:", e);
          }


          // Simulating 7. Extract Data
          delay = getRandomDelay(delays.extraction[0], delays.extraction[1]);
          bgLog(`Extracting data... waiting ${delay/1000}s`);
          updateFloatingUI(`${statusPrefix} Extracting... (${(delay/1000).toFixed(1)}s)`);
          await sleep(delay);

          currentExtracted++;
          profilesInCurrentBatch++;

          // Check batch completion limits
          if (profilesInCurrentBatch >= batchSize && currentExtracted < totalToExtract) {
               const pauseDurationSec = pauses[currentBatch] || 120;
               bgLog(`=== BATCH COMPLETE. Safe Scheduler initiating cooldown for ${pauseDurationSec} seconds ===`);
               updateFloatingUI(`SpyLeads Cooldown... (${pauseDurationSec}s left)`);
               await sleep(pauseDurationSec * 1000);

               profilesInCurrentBatch = 0;
               currentBatch++;
          }

          // Deep scroll pagination bounds check
          if (currentExtracted % 25 === 0 && currentExtracted < totalToExtract && profilesInCurrentBatch !== 0) {
              const scrollCooldown = getRandomDelay(300, 600); // 5-10 minutes
              bgLog(`=== DEEP SCROLL LIMIT REACHED. Additional cooldown for ${scrollCooldown/1000} seconds ===`);
              updateFloatingUI(`SpyLeads Scroll Cooldown... (${Math.round(scrollCooldown/1000)}s left)`);
              await sleep(scrollCooldown);
          }
      }

      bgLog("=== EXTRACTION COMPLETE ===");
      isExtracting = false;
      extractionPlan = null;

      updateFloatingUI(`SpyLeads: Extraction Complete! ✓`);
      setTimeout(removeFloatingUI, 5000);

      // Notify background that extraction finished
      chrome.runtime.sendMessage({ action: 'extraction-completed' });
  }
} else {
    console.log("SpyLeads script was already injected.");
}
