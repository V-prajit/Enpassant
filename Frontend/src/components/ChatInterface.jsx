import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getGeminiExplanation, sendAudioToGemini, GEMINI_AUDIO_URL } from '../services/api';
import { speakText, prepareAnalysisForSpeech, stopSpeech } from '../utils/speechSynthesis';

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

  // State for speech status
  const [recognitionStatus, setRecognitionStatus] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const isRecordingAudioRef = useRef(false);

  // State for speech synthesis
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  
  // Media recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  
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
        'ay': 'a', 'a': 'a', 'hey': 'a', 'play': 'a',
        'bee': 'b', 'be': 'b', 'b': 'b', 'beat': 'b', 'bean': 'b',
        'see': 'c', 'sea': 'c', 'c': 'c', 'seize': 'c',
        'dee': 'd', 'de': 'd', 'd': 'd', 'deep': 'd',
        'e': 'e', 'ee': 'e', 'eat': 'e', 'each': 'e',
        'f': 'f', 'ef': 'f', 'eff': 'f',
        'gee': 'g', 'g': 'g', 'ji': 'g', 'gene': 'g', 'jeep': 'g',
        'aitch': 'h', 'h': 'h', 'age': 'h', 'ach': 'h'
      };
      
      const rankCorrections = {
        'one': '1', '1': '1', 'won': '1', 'fun': '1',
        'two': '2', 'to': '2', '2': '2', 'too': '2', 'do': '2', 'due': '2',
        'three': '3', '3': '3', 'tree': '3', 'free': '3',
        'four': '4', 'for': '4', '4': '4', 'fore': '4',
        'five': '5', '5': '5', 'hive': '5',
        'six': '6', '6': '6', 'sicks': '6',
        'seven': '7', '7': '7', 'heaven': '7',
        'eight': '8', '8': '8', 'ate': '8', 'hate': '8'
      };
      
      // Convert words like "Knight to e4" to "Ne4"
      const pieceCorrections = {
        'knight': 'N', 'night': 'N', 'net': 'N', 'mate': 'N', 'neat': 'N', 'knit': 'N',
        'bishop': 'B', 'shop': 'B', 'be shop': 'B',
        'rook': 'R', 'ruck': 'R', 'rock': 'R', 'brook': 'R', 'rookie': 'R',
        'queen': 'Q', 'ween': 'Q', 'clean': 'Q', 'cream': 'Q',
        'king': 'K', 'keen': 'K', 'kim': 'K',
        'pawn': '', 'pond': '', 'prawns': '', 'ponds': '', 'prawn': '', 'porn': '', 'bon': '', 'pan': ''
      };
      
      // Common chess words and questions
      const chessTermCorrections = {
        'center': 'center', 'centre': 'center', 'central': 'center', 'square': 'square',
        'diagonal': 'diagonal', 'diagonally': 'diagonal',
        'control': 'control', 'controls': 'control', 'controlling': 'control',
        'developing': 'development', 'develop': 'development',
        'attacking': 'attack', 'attack': 'attack',
        'defending': 'defense', 'defense': 'defense', 'defend': 'defense',
        'castling': 'castling', 'castle': 'castling',
        'material': 'material',
        'position': 'position', 'positioning': 'position',
        'evaluation': 'evaluation', 'evaluate': 'evaluation', 'eval': 'evaluation'
      };
      
      // First, preprocess some common transcription errors
      let processedText = text.toLowerCase()
        // Fix common number transcription errors
        .replace(/\b2\b/g, 'to')
        .replace(/\b4\b/g, 'for')
        // Fix common piece name transcription errors
        .replace(/pond/g, 'pawn')
        .replace(/bond/g, 'pawn')
        .replace(/porn/g, 'pawn')
        .replace(/bon/g, 'pawn')
        // Fix common chess terminology
        .replace(/center square/g, 'center squares')
        .replace(/central square/g, 'center squares')
        .replace(/middle of the board/g, 'center');
      
      // Process text word by word for chess notation
      let processed = processedText.split(' ').map(word => {
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
        // Check if this is a chess term
        if (chessTermCorrections[word]) {
          return chessTermCorrections[word];
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
        // Don't replace all instances of "to" as it can be part of a question
        .replace(/\s+to\s+([a-h][1-8])/gi, ' $1')
        .replace(/castle/gi, 'O-O')
        .replace(/queen side castle/gi, 'O-O-O')
        .replace(/long castle/gi, 'O-O-O')
        .replace(/short castle/gi, 'O-O')
        .replace(/king side castle/gi, 'O-O')
        .replace(/check/gi, '+')
        .replace(/checkmate/gi, '#')
        .replace(/file/gi, '')
        // Fix common question patterns for speech recognition
        .replace(/is\s+(.*?)\s+a good move/gi, 'Is $1 a good move?')
        .replace(/what is the best move/gi, 'What is the best move?')
        .replace(/why (.*?) the best move/gi, 'Why is $1 the best move?')
        .replace(/explain the position/gi, 'Explain the position.')
        .replace(/explain this position/gi, 'Explain this position.');
        
      // If the text looks like a question about chess, keep it as is
      if (
        processed.includes('best move') ||
        processed.includes('why') ||
        processed.includes('how') ||
        processed.includes('what') ||
        processed.includes('is') ||
        processed.includes('explain') ||
        processed.includes('center') ||
        processed.includes('attack') ||
        processed.includes('defense') ||
        processed.includes('development') ||
        processed.includes('should i')
      ) {
        return processed;
      }
      
      // If it looks like a chess move, format it as standard notation
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
        
        // Store all alternatives for improving recognition
        const alternatives = [];
        
        // Look at all alternatives to find the highest confidence
        for (let alt = 0; alt < event.results[i].length; alt++) {
          const currentTranscript = event.results[i][alt].transcript;
          const currentConfidence = event.results[i][alt].confidence;
          
          // Log all alternatives for debugging
          console.log(`Alternative ${alt}: "${currentTranscript}" (${(currentConfidence * 100).toFixed(1)}%)`);
          alternatives.push({ text: currentTranscript, confidence: currentConfidence });
          
          if (currentConfidence > bestConfidence) {
            bestTranscript = currentTranscript;
            bestConfidence = currentConfidence;
          }
        }
        
        // If we have a chess-specific term in a lower confidence alternative, prefer it
        // This helps with common chess terms that might be misrecognized
        const chessTerms = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'e4', 'd4', 'center'];
        for (const term of chessTerms) {
          const altWithTerm = alternatives.find(alt => 
            alt.text.toLowerCase().includes(term) && 
            !bestTranscript.toLowerCase().includes(term) &&
            alt.confidence > bestConfidence * 0.7 // Must be at least 70% of best confidence
          );
          
          if (altWithTerm) {
            console.log(`Preferring alternative with chess term "${term}": "${altWithTerm.text}"`);
            bestTranscript = altWithTerm.text;
            bestConfidence = altWithTerm.confidence;
            break;
          }
        }
        
        if (event.results[i].isFinal) {
          finalTranscript += bestTranscript;
          // Show confidence and processed version for user feedback
          const processedVersion = processChessNotation(bestTranscript);
          if (processedVersion !== bestTranscript.toLowerCase()) {
            setRecognitionStatus(`Transcribed: "${bestTranscript}" → "${processedVersion}"`);
          } else {
            setRecognitionStatus(`Transcribed with ${(bestConfidence * 100).toFixed(1)}% confidence`);
          }
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
        content: `Welcome to Chess Coach Chat! You can ask me any questions about chess or the current position. Try asking:
        
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
  
  // Handle speaking the given text
  const handleSpeak = async (text) => {
    if (!text) return;
    
    try {
      // Stop any ongoing speech
      if (isSpeaking) {
        stopSpeech();
        setIsSpeaking(false);
        return;
      }
      
      // Process the text for better speech output
      const processedText = prepareAnalysisForSpeech(text);
      
      setIsSpeaking(true);
      
      await speakText(processedText, {
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

  // Process user question for better chess understanding
  const preprocessChessQuestion = (text) => {
    // If already processed by speech recognition, just clean it up a bit
    text = text.trim();
    
    // Common speech recognition errors in chess questions
    const errorPatterns = [
      { pattern: /\b2\b/g, replacement: 'to' },
      { pattern: /\bpond(s)?\b/g, replacement: 'pawn$1' },
      { pattern: /\bbon\b/g, replacement: 'pawn' },
      { pattern: /\bbond\b/g, replacement: 'pawn' },
      { pattern: /\bi'm trying 2\b/g, replacement: 'is it good to' },
      { pattern: /\bwanted 2\b/g, replacement: 'should I' },
      { pattern: /\bcentre square\b/g, replacement: 'center' },
      { pattern: /\bcentral square\b/g, replacement: 'center' },
      { pattern: /\bsquares? in the center\b/g, replacement: 'center' },
      { pattern: /\bin the center\b/g, replacement: 'in the center' },
      { pattern: /\bbest move in this position\b/g, replacement: 'best move' },
      { pattern: /\bwhat should i do\b/g, replacement: 'what is the best move' },
      { pattern: /\bporn\b/g, replacement: 'pawn' },
      { pattern: /\bis ([a-h][1-8]) good\b/g, replacement: 'is $1 a good move' }
    ];

    // Apply each pattern
    let processed = text;
    for (const { pattern, replacement } of errorPatterns) {
      processed = processed.replace(pattern, replacement);
    }

    // Add question mark if it looks like a question but doesn't have one
    if (
      (processed.startsWith('what') || 
       processed.startsWith('why') || 
       processed.startsWith('how') || 
       processed.startsWith('is') || 
       processed.startsWith('should') ||
       processed.startsWith('can')) &&
      !processed.endsWith('?')
    ) {
      processed = processed + '?';
    }
    
    console.log('Processed question:', processed);
    return processed;
  };

  // Handle sending a message
  const handleSendMessage = async (text) => {
    if (!text.trim()) return;
    
    // Process the text to handle common chess question issues
    const processedText = preprocessChessQuestion(text);
    
    // Show original user message in chat
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
        processedText // Include the processed user question
      );

      // Add AI response to chat
      if (response && response.explanation) {
        const aiResponse = response.explanation;
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: aiResponse,
          responseTime: response.responseTime
        }]);
        
        // Auto-speak the response if enabled
        if (autoSpeak) {
          handleSpeak(aiResponse);
        }
      } else {
        throw new Error('Empty or invalid response from AI service');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = 'Sorry, I encountered an error processing your question. Please try again.';
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage
      }]);
      
      if (autoSpeak) {
        handleSpeak(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup function for audio recording
  const stopAndCleanupAudioStream = useCallback(() => {
    // Stop the MediaRecorder if it's recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
      }
    }
    
    // Stop all media tracks from the stream
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
        streamRef.current = null;
      } catch (error) {
        console.error('Error stopping media tracks:', error);
      }
    }
    
    // Clean up references
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    isRecordingAudioRef.current = false;
  }, []);

  // Check if the audio service is available
  const isAudioServiceAvailable = useCallback(async () => {
    try {
      // Make a simple OPTIONS request to check if the endpoint is available
      const response = await fetch(GEMINI_AUDIO_URL, {
        method: 'OPTIONS',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'omit'
      });
      
      // If service responds correctly to OPTIONS request
      return response.status === 204;
    } catch (error) {
      console.warn('Audio service availability check failed:', error);
      return false;
    }
  }, []);
  
  // Manual audio recording function that saves to a file and sends to Gemini for transcription
  const handleToggleAudioRecording = useCallback(async () => {
    if (isRecordingAudio) {
      // Already recording, so stop it when clicked again
      setRecognitionStatus('Stopping recording...');
      setIsRecordingAudio(false);
      isRecordingAudioRef.current = false;
  
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        stopAndCleanupAudioStream();
      }
      return;
    }
    
    // Start new recording
    setInputText('');
    setTranscript('');
    setRecognitionStatus('Initializing audio...');
    audioChunksRef.current = [];
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      
      streamRef.current = stream;
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }
      
      console.log(`Using mime type: ${mimeType} for audio recording`);
      
      const recorder = new MediaRecorder(stream, {
        mimeType, 
        audioBitsPerSecond: 128000
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log(`Received audio chunk: ${e.data.size} bytes`);
        }
      };
      
      mediaRecorderRef.current = recorder;
      
      recorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing audio...');
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log(`Recording complete: ${audioBlob.size} bytes`);
        
        if (audioBlob.size < 1000) {
          setRecognitionStatus('Recording too short. Please try again and speak clearly.');
          setIsRecordingAudio(false);
          isRecordingAudioRef.current = false;
          stopAndCleanupAudioStream();
          return;
        }
        
        setRecognitionStatus('Processing audio recording...');
        
        try {
          const transcript = await sendAudioToGemini(audioBlob, fen);
          
          if (transcript && transcript !== 'No audible speech detected.') {
            console.log('Transcription received:', transcript);
            setInputText(transcript);
            setRecognitionStatus(`Transcribed: "${transcript}"`);
          } else {
            console.warn('Empty or invalid transcript received');
            setRecognitionStatus('No speech detected. Please try again.');
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          setRecognitionStatus(`Error: ${error.message}`);
        } finally {
          setIsRecordingAudio(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
        }
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setRecognitionStatus(`Recording error: ${event.error}`);
        setIsRecordingAudio(false);
        stopAndCleanupAudioStream();
      };
      
      // Start recording with manual control
      recorder.start(500);
      setIsRecordingAudio(true);
      isRecordingAudioRef.current = true;
      setRecognitionStatus('Recording audio... Click microphone again to stop and process.');
      
    } catch (error) {
      console.error('Error setting up audio recording:', error);
      setRecognitionStatus(`Error: ${error.message}. Please type your question instead.`);
      setIsRecordingAudio(false);
      stopAndCleanupAudioStream();
    }
  }, [isRecordingAudio, fen, stopAndCleanupAudioStream]);
  
  
  // Legacy speech recognition toggle (memoized with useCallback)
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
  
  // Keyboard shortcut for speech recording (Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+Space to toggle recording
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault(); // Prevent space from scrolling the page
        handleToggleAudioRecording(); // Use the Gemini audio recording
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Cancel any ongoing speech when component unmounts
      stopSpeech();
      // Clean up any audio recording resources
      stopAndCleanupAudioStream();
    };
  }, [handleToggleAudioRecording, stopAndCleanupAudioStream]); // Re-add listener when handlers change
  
  // Get the last assistant message for easy speaking
  const getLastAssistantMessage = () => {
    if (messages.length === 0) return null;
    
    // Find the most recent assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i].content;
      }
    }
    
    return null;
  };

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
            disabled={!getLastAssistantMessage() || isLoading || isSpeaking}
            className={`flex items-center p-1.5 rounded-md text-white text-sm ${
              !getLastAssistantMessage() || isLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : isSpeaking
                  ? 'bg-red-500'
                  : 'bg-gray-700 hover:bg-gray-800'
            }`}
            title={isSpeaking ? "Stop speaking" : "Speak last response"}
          >
            {isSpeaking ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.414 1.414m-.293-4.95a7 7 0 011.414-3.95m2.879 2.879a3 3 0 00-4.243-4.243m2.121-2.121a7 7 0 0110 0l-5 5m-9.9 2.828a13 13 0 000 12.728"></path>
              </svg>
            )}
          </button>
        </div>
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
                <div className="flex items-center justify-between mt-1">
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleSpeak(message.content)}
                      disabled={isSpeaking}
                      className={`p-1 rounded ${isSpeaking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                      title="Speak this message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.414 1.414m-.293-4.95a7 7 0 011.414-3.95m2.879 2.879a3 3 0 00-4.243-4.243m2.121-2.121a7 7 0 0110 0l-5 5m-9.9 2.828a13 13 0 000 12.728"></path>
                      </svg>
                    </button>
                  )}
                  {message.responseTime && (
                    <div className="text-xs opacity-70 text-right">
                      {typeof message.responseTime === 'number' 
                        ? `${message.responseTime.toFixed(2)}s` 
                        : `${message.responseTime}s`}
                    </div>
                  )}
                </div>
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
            onClick={handleToggleAudioRecording}
            disabled={recognitionStatus && (recognitionStatus.includes('Processing') || recognitionStatus.includes('Initializing'))}
            className={`p-2 rounded-full flex items-center justify-center ${
              isRecordingAudio 
                ? 'bg-red-600 text-white animate-pulse' 
                : recognitionStatus && (recognitionStatus.includes('Processing') || recognitionStatus.includes('Initializing'))
                  ? 'bg-purple-400 text-white animate-pulse cursor-not-allowed'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
            title={
              isRecordingAudio 
                ? 'Click to STOP recording and transcribe' 
                : recognitionStatus && (recognitionStatus.includes('Processing') || recognitionStatus.includes('Initializing'))
                  ? 'Processing in progress, please wait...'
                  : 'Start manual recording (Ctrl+Space)'
            }
          >
            {isRecordingAudio ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
            {isRecordingAudio && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
        </div>
        
        {/* Legacy browser speech recognition (hidden for now)
        <div className="relative hidden">
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
        </div>*/}
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