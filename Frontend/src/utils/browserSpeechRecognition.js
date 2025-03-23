// src/utils/browserSpeechRecognition.js

/**
 * A utility for browser-based speech recognition as a fallback
 * when cloud transcription services are unavailable
 */

// Check if the browser supports speech recognition
export const isSpeechRecognitionSupported = () => 
  typeof window !== 'undefined' && 
  ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

/**
 * Initialize a speech recognition instance
 * @returns {SpeechRecognition} Speech recognition instance or null if not supported
 */
export const createSpeechRecognition = () => {
  if (!isSpeechRecognitionSupported()) {
    console.warn('Speech recognition is not supported in this browser');
    return null;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return new SpeechRecognition();
};

/**
 * Recognize speech using the browser's built-in speech recognition
 * @param {Object} options Configuration options
 * @param {string} options.language Language to recognize (default: 'en-US')
 * @param {boolean} options.continuous Whether to continuously recognize (default: false)
 * @param {boolean} options.interim Whether to return interim results (default: false)
 * @param {Function} options.onResult Callback for successful recognition
 * @param {Function} options.onError Callback for recognition errors
 * @param {Function} options.onEnd Callback for when recognition ends
 * @returns {Promise<string>} Promise that resolves with the recognized text
 */
export const recognizeSpeech = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported()) {
      reject(new Error('Speech recognition is not supported in this browser'));
      return;
    }
    
    const { 
      language = 'en-US',
      continuous = false,
      interim = false,
      onResult = null,
      onError = null,
      onEnd = null
    } = options;
    
    const recognition = createSpeechRecognition();
    
    if (!recognition) {
      reject(new Error('Could not create speech recognition instance'));
      return;
    }
    
    // Configure recognition
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interim;
    recognition.maxAlternatives = 1;
    
    // Handle results
    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      const confidence = event.results[last][0].confidence;
      
      console.log(`Recognized: "${transcript}" (confidence: ${Math.round(confidence * 100)}%)`);
      
      if (onResult) {
        onResult(transcript, confidence);
      }
      
      // For non-continuous recognition, resolve with the final result
      if (!continuous && event.results[last].isFinal) {
        recognition.stop();
        resolve(transcript);
      }
    };
    
    // Handle errors
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (onError) {
        onError(event.error);
      }
      
      reject(new Error(`Speech recognition error: ${event.error}`));
    };
    
    // Handle end of recognition
    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      if (onEnd) {
        onEnd();
      }
      
      // For continuous recognition, we need to manually resolve
      if (continuous) {
        resolve('');
      }
    };
    
    // Start recognition
    try {
      recognition.start();
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      reject(error);
    }
  });
};

// Export functions directly instead of as a default export
// This allows for named imports in other files