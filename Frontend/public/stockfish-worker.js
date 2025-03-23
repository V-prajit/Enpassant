// Stockfish worker wrapper
// This file loads Stockfish from CDN if needed
(function() {
  self.importScripts('https://unpkg.com/stockfish@16.0.0/stockfish.js');
  
  // Forward messages to the Stockfish engine
  self.onmessage = function(event) {
    self.postMessage(`received: ${event.data}`);
    if (typeof STOCKFISH === 'function') {
      // Initialize Stockfish engine if not already done
      if (!self.stockfish) {
        self.stockfish = STOCKFISH();
        
        // Set up message handler to forward engine output back to main thread
        self.stockfish.onmessage = function(msg) {
          self.postMessage(msg);
        };
      }
      
      // Forward command to Stockfish
      self.stockfish.postMessage(event.data);
    } else {
      self.postMessage('error: Stockfish not available');
    }
  };
})();