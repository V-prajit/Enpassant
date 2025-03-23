import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getGeminiExplanation } from '../services/api';

const ChatInterface = ({ fen, evaluation, bestMoves }) => {
  // Always use advanced level
  const playerLevel = 'advanced';
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // State for speech recognition status
  const [recognitionStatus, setRecognitionStatus] = useState('');
  
  // Function to initialize a new speech recognition instance
  const initializeSpeechRecognition = useCallback(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      setRecognitionStatus('Speech recognition not supported in this browser. Try using Chrome or Edge.');
      return null;
    }
    
    // Create a fresh speech recognition instance
    const recognition = new SpeechRecognition();
    
    // Configure for chess-optimized speech recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5; // Get more alternatives for better accuracy
    recognition.lang = 'en-US';
    
    // Handle start event
    recognition.onstart = () => {
      console.log('Speech recognition started');
      setRecognitionStatus('Listening...');
      setIsRecording(true);
    };
    
    // Process transcription for chess notation
    const processChessNotation = (text) => {
      // Convert spoken chess notation to standard notation
      // Maps for common speech recognition errors in chess context
      const fileCorrections = {
        'ay': 'a', 'a': 'a', 
        'bee': 'b', 'be': 'b', 'b': 'b',
        'see': 'c', 'sea': 'c', 'c': 'c',
        'dee': 'd', 'de': 'd', 'd': 'd',
        'e': 'e', 'ee': 'e',
        'f': 'f', 'ef': 'f',
        'gee': 'g', 'g': 'g', 'ji': 'g',
        'aitch': 'h', 'h': 'h'
      };
      
      const rankCorrections = {
        'one': '1', '1': '1',
        'two': '2', 'to': '2', '2': '2', 'too': '2',
        'three': '3', '3': '3', 'tree': '3',
        'four': '4', 'for': '4', '4': '4',
        'five': '5', '5': '5',
        'six': '6', '6': '6',
        'seven': '7', '7': '7',
        'eight': '8', '8': '8', 'ate': '8'
      };
      
      // Convert words like "Knight to e4" to "Ne4"
      const pieceCorrections = {
        'knight': 'N', 'night': 'N', 'net': 'N',
        'bishop': 'B',
        'rook': 'R', 'ruck': 'R', 'rock': 'R',
        'queen': 'Q',
        'king': 'K',
        'pawn': ''
      };
      
      // Process text word by word
      let processed = text.toLowerCase().split(' ').map(word => {
        // Check if this is a file (a-h)
        if (fileCorrections[word]) {
          return fileCorrections[word];
        }
        // Check if this is a rank (1-8)
        if (rankCorrections[word]) {
          return rankCorrections[word];
        }
        // Check if this is a piece name
        if (pieceCorrections[word] !== undefined) {
          return pieceCorrections[word];
        }
        return word;
      }).join(' ');
      
      // Replace common phrases
      processed = processed
        .replace(/move from/gi, '')
        .replace(/move to/gi, '')
        .replace(/captures on/gi, 'x')
        .replace(/captures/gi, 'x')
        .replace(/takes on/gi, 'x')
        .replace(/takes/gi, 'x')
        .replace(/to/gi, '')
        .replace(/castle/gi, 'O-O')
        .replace(/queen side castle/gi, 'O-O-O')
        .replace(/long castle/gi, 'O-O-O')
        .replace(/short castle/gi, 'O-O')
        .replace(/king side castle/gi, 'O-O')
        .replace(/check/gi, '+')
        .replace(/checkmate/gi, '#')
        .replace(/file/gi, '');
      
      return processed;
    };
    
    // Handle results with improved chess notation processing
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        // Check all alternatives for better chess notation recognition
        let bestTranscript = '';
        let bestConfidence = 0;
        
        // Look at all alternatives to find the highest confidence
        for (let alt = 0; alt < event.results[i].length; alt++) {
          const currentTranscript = event.results[i][alt].transcript;
          const currentConfidence = event.results[i][alt].confidence;
          
          // Log all alternatives for debugging
          console.log(`Alternative ${alt}: "${currentTranscript}" (${(currentConfidence * 100).toFixed(1)}%)`);
          
          if (currentConfidence > bestConfidence) {
            bestTranscript = currentTranscript;
            bestConfidence = currentConfidence;
          }
        }
        
        if (event.results[i].isFinal) {
          finalTranscript += bestTranscript;
          // Show confidence for debugging
          setRecognitionStatus(`Transcribed with ${(bestConfidence * 100).toFixed(1)}% confidence`);
        } else {
          interimTranscript += bestTranscript;
        }
      }
      
      // Update the input field with the transcribed text
      if (finalTranscript) {
        // Process the transcript for chess notation
        const processedTranscript = processChessNotation(finalTranscript);
        
        setInputText(prevText => {
          const newText = prevText + processedTranscript + ' ';
          return newText;
        });
      }
      
      // Update the interim transcript
      if (interimTranscript) {
        setTranscript(processChessNotation(interimTranscript));
      } else {
        setTranscript('');
      }
    };
    
    // Handle errors with better messaging
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      
      // Provide user-friendly error messages
      switch (event.error) {
        case 'no-speech':
          setRecognitionStatus('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setRecognitionStatus('Microphone not available. Check your microphone settings.');
          break;
        case 'not-allowed':
          setRecognitionStatus('Microphone permission denied. Please allow microphone access.');
          break;
        case 'network':
          setRecognitionStatus('Network error. Please check your connection.');
          break;
        case 'aborted':
          setRecognitionStatus('Speech recognition aborted');
          break;
        default:
          setRecognitionStatus(`Error: ${event.error}`);
      }
      
      setIsRecording(false);
    };
    
    // Handle end of speech
    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      if (isRecording) {
        // If still in recording mode but recognition ended, restart it after a short delay
        setTimeout(() => {
          try {
            recognition.start();
            setRecognitionStatus('Listening again...');
          } catch (error) {
            console.error('Error restarting speech recognition:', error);
            setIsRecording(false);
            setRecognitionStatus('Failed to restart speech recognition. Click microphone to reset.');
          }
        }, 300);
      } else {
        setRecognitionStatus('');
      }
    };
    
    return recognition;
  }, [isRecording]);
  
  // Function to reset and reinitialize speech recognition
  const resetSpeechRecognition = useCallback(() => {
    // Stop current recognition if running
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping current speech recognition:', error);
      }
    }
    
    // Force reset the recording state
    setIsRecording(false);
    setRecognitionStatus('Speech recognition reset. Click microphone to start again.');
    
    // Clear transcript
    setTranscript('');
    
    // Create a new instance
    const newRecognition = initializeSpeechRecognition();
    if (newRecognition) {
      recognitionRef.current = newRecognition;
    }
  }, [initializeSpeechRecognition]);
  
  // Initialize speech recognition only once
  useEffect(() => {
    const recognition = initializeSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
    }
    
    // Clean up on unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping speech recognition on unmount:', error);
        }
      }
    };
  }, [initializeSpeechRecognition]);

  // Add initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Welcome to Enpassant! You can ask me any questions about chess or the current position. Try asking:
        
• "Why is this move the best?"
• "What should I focus on in this position?"
• "Is e4 a good move here?"
• "How do I improve my pawn structure?"
• "Can you explain the evaluation?"
• "What's the idea behind Queen to d5?"

You can type or use the microphone button to speak your question. For chess notation, you can say moves like:
"Knight to e5" or "e4" or "Queen captures on d7".`
      }]);
    }
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInputText('');
    setTranscript('');
    setIsLoading(true);

    try {
      // Get AI response based on chess position and user question
      const response = await getGeminiExplanation(
        fen, 
        evaluation, 
        bestMoves, 
        'advanced', // Always use advanced level
        false, // Not a game report 
        false, // Not a checkmate report
        text // Include the user's question
      );

      // Add AI response to chat
      if (response && response.explanation) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: response.explanation,
          responseTime: response.responseTime
        }]);
      } else {
        throw new Error('Empty or invalid response from AI service');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your question. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle speech recognition (memoized with useCallback)
  const handleToggleRecording = useCallback(() => {
    // If there's a previous error, reset the recognition system first
    if (recognitionStatus && (
        recognitionStatus.includes('Error') || 
        recognitionStatus.includes('Failed') || 
        recognitionStatus.includes('denied')
      )) {
      resetSpeechRecognition();
      return;
    }
    
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setRecognitionStatus('Recording stopped');
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        resetSpeechRecognition();
      }
    } else {
      // Start recording
      setTranscript('');
      setRecognitionStatus('Starting microphone...');
      
      // Check for microphone permission first
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            try {
              // Permission granted, start recognition
              if (!recognitionRef.current) {
                // Create a new instance if needed
                const newRecognition = initializeSpeechRecognition();
                if (newRecognition) {
                  recognitionRef.current = newRecognition;
                } else {
                  throw new Error('Failed to initialize speech recognition');
                }
              }
              
              // Start recognition
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error starting speech recognition:', error);
              setIsRecording(false);
              setRecognitionStatus('Error starting speech recognition. Click microphone to reset.');
            }
          })
          .catch(err => {
            console.error('Microphone permission error:', err);
            setIsRecording(false);
            setRecognitionStatus('Microphone access denied. Please allow microphone access in your browser settings.');
          });
      } else {
        console.error('Media devices API not available');
        setIsRecording(false);
        setRecognitionStatus('Speech recognition not supported in this browser. Try using Chrome or Edge.');
      }
    }
  }, [isRecording, recognitionStatus, resetSpeechRecognition, initializeSpeechRecognition]);
  
  // Keyboard shortcut for speech recognition (Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+Space to toggle recording
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault(); // Prevent space from scrolling the page
        handleToggleRecording();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleRecording]); // Re-add listener when handleToggleRecording changes

  return (
    <div className="bg-white rounded-xl shadow-md ring-1 ring-gray-200/50 p-6 transition-all duration-300 hover:shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Enpassant 1.0</h3>
      </div>
      
      {/* Messages container */}
      <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-md">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center italic">
            Ask your chess coach a question about the current position...
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div 
                className={`inline-block max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-gray-700 text-white rounded-tr-none' 
                    : 'bg-gray-200 text-gray-800 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-line">{message.content}</div>
                {message.responseTime && (
                  <div className="text-xs opacity-70 text-right mt-1">
                    {typeof message.responseTime === 'number' 
                      ? `${message.responseTime.toFixed(2)}s` 
                      : `${message.responseTime}s`}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="text-center p-2">
            <div className="inline-block">
              <div className="animate-bounce inline-block bg-gray-500 rounded-full w-2 h-2 mr-1"></div>
              <div className="animate-bounce inline-block bg-gray-500 rounded-full w-2 h-2 mr-1" style={{ animationDelay: '0.2s' }}></div>
              <div className="animate-bounce inline-block bg-gray-500 rounded-full w-2 h-2" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Transcript and status display */}
      {(isRecording || recognitionStatus) && (
        <div className="mb-3">
          {transcript && (
            <div className="p-2 bg-gray-100 text-gray-600 rounded-md italic">
              {transcript}
            </div>
          )}
          {recognitionStatus && (
            <div className={`mt-1 text-xs flex items-center ${
              recognitionStatus.includes('Error') || recognitionStatus.includes('denied')
                ? 'text-red-500'
                : isRecording ? 'text-green-600' : 'text-gray-500'
            }`}>
              {isRecording && (
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              )}
              {recognitionStatus}
            </div>
          )}
        </div>
      )}
      
      {/* Input area */}
      <div className="flex gap-2">
        <div className="relative">
          <button
            onClick={handleToggleRecording}
            className={`p-2 rounded-full flex items-center justify-center ${
              isRecording 
                ? 'bg-red-500 text-white animate-pulse' 
                : recognitionStatus && recognitionStatus.includes('reset')
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={
              isRecording 
                ? 'Stop recording (Ctrl+Space)' 
                : recognitionStatus && (recognitionStatus.includes('Error') || recognitionStatus.includes('Failed'))
                  ? 'Click to reset speech recognition'
                  : 'Start recording (Ctrl+Space)'
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          
          {/* Add a reset button when needed */}
          {!isRecording && recognitionStatus && (
            recognitionStatus.includes('Error') || recognitionStatus.includes('Failed') || recognitionStatus.includes('denied')
          ) && (
            <button
              onClick={resetSpeechRecognition}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs"
              title="Reset speech recognition"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
            placeholder={
              isRecording 
                ? "Speak your chess question..." 
                : "Ask about a specific move or position aspect..."
            }
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isLoading}
          />
          {inputText && (
            <button
              onClick={() => setInputText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear text"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => handleSendMessage(inputText)}
          disabled={!inputText.trim() || isLoading}
          className={`px-4 py-2 rounded-md ${
            !inputText.trim() || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-gray-700 text-white hover:bg-gray-800'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;