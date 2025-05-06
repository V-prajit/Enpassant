self.importScripts('./stockfish.js');

self.onmessage = function(e) {
  if (!self.stockfish) {
    self.stockfish = Stockfish();
    
    self.stockfish.onmessage = function(msg) {
      self.postMessage(msg);
    };
    
    self.postMessage('Stockfish engine initialized');
  }
  
  self.stockfish.postMessage(e.data);
};