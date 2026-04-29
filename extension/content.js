console.log("SpyLeads Content Script Loaded.");

let isExtracting = false;
let extractionConfig = null;

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
    
    console.log(`Starting extraction for ${request.count} leads...`);
    isExtracting = true;
    extractionConfig = request.count;
    
    // Simulate some extraction setup
    setTimeout(() => {
      console.log("Simulating completion...");
      isExtracting = false;
      // You'd typically message the background/popup here that it finished
    }, 2000);

    sendResponse({ success: true, status: 'started' });
  }
});

// Listener for visibility/active tab changes to pause safely
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isExtracting) {
    console.log("Tab inactive. SpyLeads extraction paused.");
    // Pause extraction logic here
  } else if (!document.hidden && isExtracting) {
    console.log("Tab active. SpyLeads extraction resumed.");
    // Resume extraction logic here
  }
});
