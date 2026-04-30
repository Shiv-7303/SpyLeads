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

        const safeText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : "";
        };

        const safeAttribute = (selector, attr) => {
             const el = document.querySelector(selector);
             return el ? el.getAttribute(attr) : "";
        };

        const extractFollowers = () => {
             const buttons = document.querySelectorAll('button');
             for (let btn of buttons) {
                 if (btn.innerText.toLowerCase().includes('followers')) {
                     const match = btn.innerText.match(/([\d,\.]+)\s*followers?/i);
                     if (match) return match[1];
                 }
             }
             return "";
        };

        const extractFollowing = () => {
             const buttons = document.querySelectorAll('button');
             for (let btn of buttons) {
                 if (btn.innerText.toLowerCase().includes('following')) {
                     const match = btn.innerText.match(/([\d,\.]+)\s*following/i);
                     if (match) return match[1];
                 }
             }
             return "";
        };

        // Use selectors or fallbacks
        const profileData = {
           username: username,
           full_name: safeText('header section h2') || document.title.split('(')[0].trim() || username,
           followers: extractFollowers(),
           following: extractFollowing(),
           bio: safeText('header section > div:nth-child(3)') || safeText('[data-testid="bio"]') || "",
           is_verified: !!document.querySelector('svg[aria-label="Verified"]'),
           timestamp: new Date().toISOString(),
           profile_url: window.location.href
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

  const scrollPageDown = async () => {
    window.scrollBy(0, window.innerHeight / 2);
    await sleep(getRandomDelay(1, 2));
  };

  const scrapeVisibleUsernames = () => {
    const links = document.querySelectorAll('a[href^="/"]');
    const usernames = new Set();

    links.forEach(link => {
       const href = link.getAttribute('href');
       if (href && href.length > 2 && href.split('/').length === 3) {
           const username = href.replaceAll('/', '');
           if (!['explore', 'reels', 'stories', 'direct', 'p'].includes(username)) {
              usernames.add(username);
           }
       }
    });
    return Array.from(usernames);
  };

  // Main loop for batched extraction logic simulating DOM human interactions
  async function executeExtractionPlan() {
      const totalToExtract = extractionPlan.total_extractions;
      const batchSize = extractionPlan.batch_size;
      const pauses = extractionPlan.pause_durations;
      const delays = extractionPlan.delays;

      let currentBatch = 0;
      let profilesInCurrentBatch = 0;

      let scrapedUsernamesQueue = [];
      let processedUsernames = new Set();

      while(currentExtracted < totalToExtract) {
          const statusPrefix = `SpyLeads [${currentExtracted + 1}/${totalToExtract}]:`;

          // 1. Gather usernames if queue is empty
          if (scrapedUsernamesQueue.length === 0) {
              updateFloatingUI(`SpyLeads: Scrolling to find profiles...`);
              await scrollPageDown();
              const found = scrapeVisibleUsernames();
              found.forEach(u => {
                  if (!processedUsernames.has(u)) {
                      scrapedUsernamesQueue.push(u);
                      processedUsernames.add(u);
                  }
              });

              if (scrapedUsernamesQueue.length === 0) {
                  bgLog("No new profiles found on screen. Waiting and scrolling...");
                  await sleep(getRandomDelay(2, 4));
                  continue; // Try again
              }
          }

          const targetUsername = scrapedUsernamesQueue.shift();
          bgLog(`--- Extracting profile ${currentExtracted + 1} of ${totalToExtract}: ${targetUsername} ---`);

          // Simulating 1. Scroll delay logic
          let delay = getRandomDelay(delays.scroll[0], delays.scroll[1]);
          updateFloatingUI(`${statusPrefix} Preparing (${(delay/1000).toFixed(1)}s)`);
          await sleep(delay);

          // Option A: Extract profile data via background script -> New Tab
          updateFloatingUI(`${statusPrefix} Extracting ${targetUsername}...`);

          try {
             const profileData = await new Promise((resolve) => {
                 chrome.runtime.sendMessage({
                     action: 'extract-profile-background',
                     username: targetUsername
                 }, resolve);
             });
             bgLog("Extracted data:", profileData);

             if (profileData && profileData.username) {
                 window._extractedProfiles.push(profileData);
                 currentExtracted++;
                 profilesInCurrentBatch++;

                 // Log progress to DB every time a profile is found
                 chrome.runtime.sendMessage({
                     action: 'log-extraction-progress',
                     extractionId: window._currentExtractionId,
                     profilesFound: currentExtracted,
                     profilesData: window._extractedProfiles,
                     status: 'in_progress'
                 });
             }
          } catch(e) {
             bgLog("Error in background extraction:", e);
          }

          // Simulating 7. Extract Data / Safety Delay
          delay = getRandomDelay(delays.extraction[0], delays.extraction[1]);
          updateFloatingUI(`${statusPrefix} Safety Pause (${(delay/1000).toFixed(1)}s)`);
          await sleep(delay);

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

      // Final log to DB
      chrome.runtime.sendMessage({
          action: 'log-extraction-progress',
          extractionId: window._currentExtractionId,
          profilesFound: currentExtracted,
          profilesData: window._extractedProfiles,
          status: 'completed'
      });

      updateFloatingUI(`SpyLeads: Extraction Complete! ✓`);
      setTimeout(removeFloatingUI, 5000);

      // Notify background that extraction finished
      chrome.runtime.sendMessage({ action: 'extraction-completed', profiles: window._extractedProfiles });
  }
} else {
    console.log("SpyLeads script was already injected.");
}
