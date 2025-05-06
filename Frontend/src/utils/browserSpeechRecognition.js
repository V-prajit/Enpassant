export const isSpeechRecognitionSupported = () => 
  typeof window !== 'undefined' && 
  ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

export const createSpeechRecognition = () => {
  if (!isSpeechRecognitionSupported()) {
    console.warn('Speech recognition is not supported in this browser');
    return null;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return new SpeechRecognition();
};

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
    
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interim;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      const confidence = event.results[last][0].confidence;
      
      console.log(`Recognized: "${transcript}" (confidence: ${Math.round(confidence * 100)}%)`);
      
      if (onResult) {
        onResult(transcript, confidence);
      }
      
      if (!continuous && event.results[last].isFinal) {
        recognition.stop();
        resolve(transcript);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (onError) {
        onError(event.error);
      }
      
      reject(new Error(`Speech recognition error: ${event.error}`));
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      if (onEnd) {
        onEnd();
      }
      
      if (continuous) {
        resolve('');
      }
    };
    
    try {
      recognition.start();
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      reject(error);
    }
  });
};
