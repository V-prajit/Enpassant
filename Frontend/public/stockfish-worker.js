// Stockfish worker wrapper
// This file loads Stockfish from CDN if needed
(function() {
  // Try to load Stockfish from multiple sources
  function loadStockfish() {
    try {
      // Try primary CDN
      self.importScripts('https://unpkg.com/stockfish@16.0.0/stockfish.js');
      self.postMessage('Loaded Stockfish from primary CDN');
    } catch (error) {
      console.error('Failed to load Stockfish from primary CDN:', error);
      
      try {
        // Try fallback CDN
        self.importScripts('https://cdn.jsdelivr.net/npm/stockfish@16.0.0/stockfish.js');
        self.postMessage('Loaded Stockfish from fallback CDN');
      } catch (fallbackError) {
        console.error('Failed to load Stockfish from fallback CDN:', fallbackError);
        
        try {
          // Try local copy if available
          self.importScripts('./stockfish.js');
          self.postMessage('Loaded Stockfish from local file');
        } catch (localError) {
          console.error('Failed to load Stockfish from all sources');
          self.postMessage('error: Failed to load Stockfish engine from any source');
        }
      }
    }
  }
  
  // Load Stockfish
  loadStockfish();
  
  // Forward messages to the Stockfish engine
  self.onmessage = function(event) {
    if (typeof STOCKFISH === 'function') {
      // Initialize Stockfish engine if not already done
      if (!self.stockfish) {
        try {
          self.stockfish = STOCKFISH();
          
          // Set up message handler to forward engine output back to main thread
          self.stockfish.onmessage = function(msg) {
            self.postMessage(msg);
          };
          
          self.postMessage('Stockfish engine initialized');
        } catch (initError) {
          console.error('Error initializing Stockfish:', initError);
          self.postMessage('error: Failed to initialize Stockfish engine');
        }
      }
      
      // Forward command to Stockfish
      self.stockfish.postMessage(event.data);
    } else {
      self.postMessage('error: Stockfish not available');
    }
  };
})();