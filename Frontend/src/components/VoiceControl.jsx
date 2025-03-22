// Frontend/src/components/VoiceControl.jsx
import React, { useState, useEffect } from 'react';

const VoiceControl = ({ onMoveCommand, onAnalyzeCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [recognition, setRecognition] = useState(null);
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        setTranscript(result);
        
        // Process command when confident or end of speech
        if (event.results[current].isFinal) {
          processCommand(result);
        }
      };
      
      recognitionInstance.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      setError('Speech recognition not supported in this browser');
    }
    
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);
  
  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else {
      setError(null);
      setTranscript('');
      recognition?.start();
      setIsListening(true);
    }
  };
  
  // Process voice command
  const processCommand = (command) => {
    if (!command) return;
    
    const lowerCommand = command.toLowerCase().trim();
    
    // Check for move commands (e.g., "pawn to e4", "knight f3", etc.)
    const moveRegex = /(?:move\s+)?([a-z]+)(?:\s+to)?\s+([a-h][1-8])/i;
    const moveMatch = lowerCommand.match(moveRegex);
    
    if (moveMatch) {
      const [_, piece, square] = moveMatch;
      handleMoveCommand(piece, square);
      return;
    }
    
    // Check for analysis commands
    if (lowerCommand.includes('analyze') || lowerCommand.includes('analyse')) {
      onAnalyzeCommand();
      return;
    }
    
    // Other commands can be added here
    setTranscript(`Command not recognized: ${command}`);
  };
  
  // Handle move command
  const handleMoveCommand = (piece, targetSquare) => {
    // Map spoken piece names to chess notation
    const pieceMap = {
      'pawn': '',
      'knight': 'N',
      'bishop': 'B',
      'rook': 'R',
      'queen': 'Q',
      'king': 'K'
    };
    
    const chessPiece = pieceMap[piece.toLowerCase()] || '';
    const moveNotation = `${chessPiece}${targetSquare}`;
    
    onMoveCommand(moveNotation);
    setTranscript(`Move command: ${moveNotation}`);
  };
  
  return (
    <div className="voice-controls">
      <h4>Voice Control</h4>
      
      <button 
        onClick={toggleListening}
        className={`voice-button ${isListening ? 'listening' : ''}`}
      >
        {isListening ? 'Listening...' : 'Start Voice Command'}
      </button>
      
      {transcript && (
        <div className="transcript">
          <p><strong>Command:</strong> {transcript}</p>
        </div>
      )}
      
      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}
      
      <div className="voice-help">
        <p>Try commands like:</p>
        <ul>
          <li>"Pawn to e4"</li>
          <li>"Knight f3"</li>
          <li>"Analyze position"</li>
        </ul>
      </div>
    </div>
  );
};

export default VoiceControl;