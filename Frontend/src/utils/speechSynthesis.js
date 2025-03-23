
// Speech synthesis utility for chess analysis
export const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

/**
 * Converts text to speech using browser's Speech Synthesis API
 * @param {string} text - The text to convert to speech
 * @param {Object} options - Optional configuration parameters
 * @param {number} options.pitch - Speech pitch (0.1 to 2.0, default 1.0)
 * @param {number} options.rate - Speech rate (0.1 to 10.0, default 1.0)
 * @param {number} options.volume - Speech volume (0.0 to 1.0, default 1.0)
 * @param {string} options.voice - Voice name to use (defaults to system voice)
 * @param {Function} options.onStart - Callback when speech starts
 * @param {Function} options.onEnd - Callback when speech ends
 * @param {Function} options.onError - Callback when speech errors
 * @returns {Promise} - Promise that resolves when speech is complete or rejects on error
 */
export const speakText = (text, options = {}) => {
  return new Promise((resolve, reject) => {
    // Check if browser supports speech synthesis
    if (!synth) {
      const error = new Error("Speech synthesis not supported in this browser");
      if (options.onError) options.onError(error);
      return reject(error);
    }

    // Cancel any ongoing speech
    if (synth.speaking) {
      console.log("Cancelling ongoing speech...");
      synth.cancel();
    }

    // Prepare the utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Set default options
    utterance.pitch = options.pitch || 1.0;
    utterance.rate = options.rate || 1.0;
    utterance.volume = options.volume || 1.0;

    // Set voice if specified
    if (options.voice) {
      const voices = synth.getVoices();
      const selectedVoice = voices.find(voice => voice.name === options.voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // Set event handlers
    utterance.onstart = () => {
      console.log("Speech started");
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      console.log("Speech completed");
      if (options.onEnd) options.onEnd();
      resolve();
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event.error);
      if (options.onError) options.onError(event);
      reject(event);
    };

    // Start speaking
    synth.speak(utterance);
  });
};

/**
 * Prepare chess analysis for speech synthesis by cleaning and formatting the text
 * @param {string} analysis - Raw analysis text
 * @returns {string} - Processed text optimized for speech
 */
export const prepareAnalysisForSpeech = (analysis) => {
  if (!analysis) return "";

  // Handle formatting in text (emphasis and bullet points)
  const handleFormatting = (text) => {
    // Replace ** with pauses and emphasis
    let processed = text.replace(/\*\*([^*]+)\*\*/g, ", $1, ");
    
    // Handle bullet points (lines starting with *)
    processed = processed.replace(/^\s*\*\s+/gm, ". Bullet point: ");
    
    return processed;
  };

  // Replace chess notation with more speakable text
  let processedText = analysis
    // Make the evaluation more natural to hear
    .replace(/\+(\d+\.\d+)/g, "plus $1") // +0.45 -> "plus 0.45"
    .replace(/-(\d+\.\d+)/g, "minus $1") // -0.45 -> "minus 0.45"

    // Handle captures and check notation
    .replace(/([KQNBR]?)x([a-h]\d)/g, "$1 takes $2 ") // Kxe4 -> "K takes e4", xe4 -> "takes e4"
    .replace(/([a-h])x([a-h]\d)/g, "$1 takes $2 ") // exd5 -> "e takes d5"
    .replace(/\+$/g, " check") // e4+ -> "e4 check"
    .replace(/\#$/g, " checkmate") // e4# -> "e4 checkmate"

    // Handle castling
    .replace(/O-O-O/g, "Queen side castle") // O-O-O -> "Queen side castle"
    .replace(/O-O/g, "King side castle") // O-O -> "King side castle"

    // Make coordinate notation more speakable
    .replace(/([a-h])(\d)/g, "$1 $2") // e4 -> "e 4"

    // Make piece movement more natural
    .replace(/([KQNBR])([a-h])(\d)/g, "$1 to $2 $3") // Qe4 -> "Q to e 4"

    // Replace piece abbreviations with full names (when they appear as standalone characters)
    .replace(/\bK\b/g, "King")
    .replace(/\bQ\b/g, "Queen")
    .replace(/\bR\b/g, "Rook")
    .replace(/\bB\b/g, "Bishop")
    .replace(/\bN\b/g, "Knight")

    // Replace in-text piece abbreviations with full names
    .replace(/\s+K\s+/g, " King ")
    .replace(/\s+Q\s+/g, " Queen ")
    .replace(/\s+R\s+/g, " Rook ")
    .replace(/\s+B\s+/g, " Bishop ")
    .replace(/\s+N\s+/g, " Knight ")

    // Handle evaluation values for better speech
    .replace(/0\.00/g, "zero point zero zero")
    .replace(/0\.0/g, "zero point zero")

    // Make mate-in-X more natural to hear
    .replace(/[Mm]ate in (\d+)/g, "Mate in $1 moves")

    // Special case for e.p. (en passant)
    .replace(/e\.p\./g, "en passant");

  // Process formatting after other replacements
  return handleFormatting(processedText);
};

/**
 * Returns all available voices for speech synthesis
 * @returns {Array} - Array of available voices
 */
export const getAvailableVoices = () => {
  if (!synth) return [];
  return synth.getVoices();
};

/**
 * Stops any ongoing speech
 */
export const stopSpeech = () => {
  if (synth && synth.speaking) {
    synth.cancel();
  }
};