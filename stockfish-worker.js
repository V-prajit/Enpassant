(function() {
  function loadStockfish() {
    try {
      self.importScripts('./stockfish.js');
      self.postMessage('Loaded Stockfish from local file');
    } catch (error) {
      console.error('Failed to load local Stockfish:', error);
      
      self.postMessage('error: Failed to load Stockfish engine');
    }
  }
  
  loadStockfish();
  
  self.onmessage = function(event) {
    if (typeof STOCKFISH === 'function') {
      if (!self.stockfish) {
        try {
          self.stockfish = STOCKFISH();
          
          self.stockfish.onmessage = function(msg) {
            self.postMessage(msg);
          };
          
          self.postMessage('Stockfish engine initialized');
        } catch (initError) {
          console.error('Error initializing Stockfish:', initError);
          self.postMessage('error: Failed to initialize Stockfish engine');
        }
      }
      
      self.stockfish.postMessage(event.data);
    } else {
      self.postMessage('error: Stockfish not available');
    }
  };
})();