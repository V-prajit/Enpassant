// Stockfish worker wrapper
// This file uses a locally bundled stockfish WASM file
(function() {
  // Load local stockfish
  function loadStockfish() {
    try {
      // Try local file
      self.importScripts('./stockfish.js');
      self.postMessage('Loaded Stockfish from local file');
    } catch (error) {
      console.error('Failed to load local Stockfish:', error);
      
      // If local file fails, notify the main thread
      self.postMessage('error: Failed to load Stockfish engine');
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