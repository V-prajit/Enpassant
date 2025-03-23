import React, { useState, useRef, useEffect, useCallback } from 'react';
import { speakText, prepareAnalysisForSpeech, stopSpeech } from '../utils/speechSynthesis';
import { getGeminiExplanation } from '../services/api';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react'; // Import Lucide React icons

// Process chess notation for better recognition
const processChessNotation = (text) => {
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

  const pieceCorrections = {
    'knight': 'N', 'night': 'N', 'net': 'N',
    'bishop': 'B',
    'rook': 'R', 'ruck': 'R', 'rock': 'R',
    'queen': 'Q',
    'king': 'K',
    'pawn': ''
  };

  let processed = text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (fileCorrections[word]) return fileCorrections[word];
      if (rankCorrections[word]) return rankCorrections[word];
      if (pieceCorrections[word] !== undefined) return pieceCorrections[word];
      return word;
    })
    .join(' ');

  // Common replacements
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

const ChatInterface = ({ fen, evaluation, bestMoves }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingError, setRecordingError] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Welcome to Chess Coach! You can ask me any questions about chess or the current position. Try asking:
        
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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined' || 
        (!window.SpeechRecognition && !window.webkitSpeechRecognition)) {
      setRecordingError('Speech recognition is not supported in this browser');
      return null;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    
    recognition.onstart = () => {
      setIsRecording(true);
      setRecordingError('Listening...');
    };
    
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const bestResult = result[0];
          const transcriptText = bestResult.transcript;
          const processed = processChessNotation(transcriptText);
          
          finalTranscript += processed + ' ';
          setInputMessage(prev => prev + processed + ' ');
          console.log(`Final transcript: "${processed}" (confidence: ${Math.round(bestResult.confidence * 100)}%)`);
          setTranscript('');
        } else {
          // Get best alternative for interim results
          let bestTranscript = '';
          let bestConfidence = 0;
          
          for (let j = 0; j < result.length; j++) {
            if (result[j].confidence > bestConfidence) {
              bestTranscript = result[j].transcript;
              bestConfidence = result[j].confidence;
            }
          }
          
          const processed = processChessNotation(bestTranscript);
          interimTranscript = processed;
          setTranscript(processed);
        }
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      switch (event.error) {
        case 'no-speech':
          setRecordingError('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setRecordingError('Microphone not available. Check your microphone settings.');
          break;
        case 'not-allowed':
          setRecordingError('Microphone permission denied. Please allow microphone access.');
          break;
        case 'network':
          setRecordingError('Network error. Please check your connection.');
          break;
        case 'aborted':
          setRecordingError('Speech recognition aborted');
          break;
        default:
          setRecordingError(`Error: ${event.error}`);
      }
    };
    
    recognition.onend = () => {
      // If still recording, restart recognition
      if (isRecording) {
        try {
          recognition.start();
          setRecordingError('Listening again...');
        } catch (error) {
          console.error('Error restarting speech recognition:', error);
          setIsRecording(false);
          setRecordingError('Failed to restart speech recognition. Click microphone to reset.');
        }
      } else {
        setRecordingError('');
      }
    };
    
    return recognition;
  }, [isRecording]);

  // Setup speech recognition when component mounts
  useEffect(() => {
    const newRecognition = initSpeechRecognition();
    if (newRecognition) {
      recognitionRef.current = newRecognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping speech recognition on unmount:', error);
        }
      }
    };
  }, [initSpeechRecognition]);
  
  const resetSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
    setIsRecording(false);
    setRecordingError('Speech recognition reset. Click microphone to start again.');
    setTranscript('');
    
    // Create a new recognition instance
    const newRecognition = initSpeechRecognition();
    if (newRecognition) {
      recognitionRef.current = newRecognition;
    }
  }, [initSpeechRecognition]);

  const handleMessageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage = inputMessage;
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInputMessage('');
    setTranscript('');

    // Show loading state
    setMessages(prev => [...prev, { role: 'assistant', content: '...', isLoading: true }]);

    try {
      // Get response from Gemini API
      const result = await getGeminiExplanation(
        fen,
        evaluation,
        bestMoves,
        'advanced', // Always use advanced level
        false, // isGameReport
        false, // isCheckmate 
        userMessage // Include the user question
      );

      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      // Add real response
      const responseContent = result.explanation || "I'm sorry, I couldn't analyze this position properly.";
      const response = {
        role: 'assistant',
        content: responseContent,
        responseTime: result.responseTime
      };
      
      setMessages(prev => [...prev, response]);
      
      if (autoSpeak) {
        handleSpeak(response.content);
      }
    } catch (error) {
      console.error('Error getting response:', error);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      // Add error message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I encountered an error while analyzing. Please try again." 
      }]);
    }
  };

  const getLastAssistantMessage = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && !messages[i].isLoading) {
        return messages[i].content;
      }
    }
    return null;
  };

  const handleSpeak = async (textToSpeak) => {
    if (!textToSpeak) return;
    
    try {
      // Stop any ongoing speech
      if (isSpeaking) {
        stopSpeech();
        setIsSpeaking(false);
        return;
      }
      
      // Process the text for better speech output
      const processedText = prepareAnalysisForSpeech(textToSpeak);
      
      setIsSpeaking(true);
      
      await speakText(processedText, {
        rate: 1.0,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: (error) => {
          console.error("Speech synthesis error:", error);
          setIsSpeaking(false);
        }
      });
    } catch (error) {
      console.error("Failed to speak message:", error);
      setIsSpeaking(false);
    }
  };

  const toggleRecording = useCallback(() => {
    if (
      recordingError &&
      (recordingError.includes('Error') ||
       recordingError.includes('Failed') ||
       recordingError.includes('denied'))
    ) {
      resetSpeechRecognition();
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      setRecordingError('Recording stopped');
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        resetSpeechRecognition();
      }
    } else {
      setTranscript('');
      setRecordingError('Starting microphone...');
      
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(() => {
            try {
              if (!recognitionRef.current) {
                const newRecognition = initSpeechRecognition();
                if (newRecognition) {
                  recognitionRef.current = newRecognition;
                } else {
                  throw new Error('Failed to initialize speech recognition');
                }
              }
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error starting speech recognition:', error);
              setIsRecording(false);
              setRecordingError('Error starting speech recognition. Click microphone to reset.');
            }
          })
          .catch(err => {
            console.error('Microphone permission error:', err);
            setIsRecording(false);
            setRecordingError(
              'Microphone access denied. Please allow microphone access in your browser settings.'
            );
          });
      } else {
        console.error('Media devices API not available');
        setIsRecording(false);
        setRecordingError('Speech recognition not supported in this browser. Try using Chrome or Edge.');
      }
    }
  }, [isRecording, recordingError, resetSpeechRecognition, initSpeechRecognition]);

  // Add keyboard shortcut for toggling speech recognition
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Space to toggle speech
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  return (
    <div className="bg-white rounded-xl shadow-md ring-1 ring-gray-200/50 p-6 transition-all duration-300 hover:shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Chess Coach Chat</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center mr-2">
            <input
              type="checkbox"
              id="autoSpeakChat"
              checked={autoSpeak}
              onChange={() => setAutoSpeak(!autoSpeak)}
              className="mr-1 h-4 w-4"
            />
            <label htmlFor="autoSpeakChat" className="text-sm text-gray-600">Auto-speak</label>
          </div>
          <button
            onClick={() => {
              const lastMessage = getLastAssistantMessage();
              if (lastMessage) handleSpeak(lastMessage);
            }}
            disabled={!getLastAssistantMessage() || isSpeaking}
            className={`flex items-center p-1.5 rounded-md text-white text-sm ${
              !getLastAssistantMessage()
                ? 'bg-gray-300 cursor-not-allowed'
                : isSpeaking
                  ? 'bg-red-500'
                  : 'bg-gray-700 hover:bg-gray-800'
            }`}
            title={isSpeaking ? "Stop speaking" : "Speak last response"}
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-md p-4 h-64 overflow-y-auto mb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 italic">Ask the chess coach about your position...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`${
                  msg.role === 'user' 
                    ? 'bg-gray-200 ml-auto' 
                    : 'bg-blue-100'
                } rounded-lg p-3 max-w-[80%] ${
                  msg.role === 'user' ? 'ml-auto' : 'mr-auto'
                }`}
              >
                {msg.isLoading ? (
                  <div className="flex space-x-1 justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-800">{msg.content}</p>
                    {msg.responseTime && (
                      <p className="text-xs text-gray-500 mt-1 text-right">
                        {typeof msg.responseTime === 'number' 
                          ? `${msg.responseTime.toFixed(2)}s` 
                          : `${msg.responseTime}s`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Transcript area */}
      {transcript && (
        <div className="mb-2 p-2 bg-gray-100 text-gray-900 rounded-md italic">
          {transcript}
        </div>
      )}

      {/* Status indicator */}
      {recordingError && (
        <div className="mb-2 text-sm flex items-center gap-1" 
             style={{ color: isRecording ? '#3b82f6' : recordingError.includes('Error') || recordingError.includes('denied') ? '#ef4444' : '#6b7280' }}>
          {isRecording && (
            <div className="flex space-x-1 mr-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
          {recordingError.includes('Error') && <AlertCircle size={14} />}
          <span>{recordingError}</span>
        </div>
      )}

      <form onSubmit={handleMessageSubmit} className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={isRecording ? "Speak your chess question..." : "Ask about your position..."}
          className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        {/* Clear input button */}
        {inputMessage && (
          <button
            type="button"
            onClick={() => setInputMessage('')}
            className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            style={{ marginTop: '24rem' }}
            title="Clear text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        
        {/* Microphone button */}
        <button
          type="button"
          onClick={toggleRecording}
          className={`p-2 flex items-center justify-center rounded-full shadow-md transition-colors duration-200 ${
            isRecording
              ? 'bg-red-600 text-white animate-pulse hover:bg-red-700'
              : recordingError && recordingError.includes('reset')
              ? 'bg-gray-500 text-white hover:bg-gray-600'
              : 'bg-gray-700 hover:bg-gray-800 text-white'
          }`}
          title={isRecording ? "Stop recording (Ctrl+Space)" : "Start recording (Ctrl+Space)"}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className={`px-4 py-2 rounded-md font-medium text-white ${
            !inputMessage.trim()
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;