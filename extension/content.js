if (!window.__spyLeadsInjected) {
  window.__spyLeadsInjected = true;
  console.log("SpyLeads Content Script Loaded.");

  let isExtracting = false;
  let extractionPlan = null;
  let currentExtracted = 0;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'init-extraction') {
      if (!window.location.href.includes("instagram.com")) {
        sendResponse({ success: false, error: 'Not on Instagram' });
        return;
      }
      
      if (isExtracting) {
        sendResponse({ success: false, error: 'Extraction already in progress' });
        return;
      }
      
      console.log(`Starting extraction sequence...`, request.plan);
      isExtracting = true;
      extractionPlan = request.plan;
      currentExtracted = 0;
      
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
          console.log(`--- Extracting profile ${currentExtracted + 1} of ${totalToExtract} ---`);
          
          // Simulating 1. Scroll to profile
          let delay = getRandomDelay(delays.scroll[0], delays.scroll[1]);
          console.log(`Scrolling... waiting ${delay/1000}s`);
          await sleep(delay);
          
          // Simulating 3. Hover & Pause
          delay = getRandomDelay(2, 5);
          console.log(`Hovering... waiting ${delay/1000}s`);
          await sleep(delay);
          
          // Simulating 5. Click Profile & Wait to load
          delay = getRandomDelay(delays.profile_open[0], delays.profile_open[1]);
          console.log(`Opening profile... waiting ${delay/1000}s`);
          await sleep(delay);
          
          // Simulating 7. Extract Data
          delay = getRandomDelay(delays.extraction[0], delays.extraction[1]);
          console.log(`Extracting data... waiting ${delay/1000}s`);
          await sleep(delay);
          
          currentExtracted++;
          profilesInCurrentBatch++;
          
          // Check batch completion limits
          if (profilesInCurrentBatch >= batchSize && currentExtracted < totalToExtract) {
               const pauseDurationSec = pauses[currentBatch] || 120;
               console.log(`=== BATCH COMPLETE. Safe Scheduler initiating cooldown for ${pauseDurationSec} seconds ===`);
               await sleep(pauseDurationSec * 1000);
               
               profilesInCurrentBatch = 0;
               currentBatch++;
          }
          
          // Deep scroll pagination bounds check
          if (currentExtracted % 25 === 0 && currentExtracted < totalToExtract && profilesInCurrentBatch !== 0) {
              // Additional cooldown to prevent fast deep pagination as per PRD
              const scrollCooldown = getRandomDelay(300, 600); // 5-10 minutes
              console.log(`=== DEEP SCROLL LIMIT REACHED. Additional cooldown for ${scrollCooldown/1000} seconds ===`);
              await sleep(scrollCooldown);
          }
      }
      
      console.log("=== EXTRACTION COMPLETE ===");
      isExtracting = false;
      extractionPlan = null;
  }
}
