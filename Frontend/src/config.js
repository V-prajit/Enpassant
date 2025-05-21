const CONFIG = {
    APP_NAME: 'Enpassant',
    VERSION: '1.0.0',
    
    API: {
      GEMINI_URL: '',
      STOCKFISH_URL: '',
      AUDIO_URL: '',
    },
    
    ANALYSIS: {
      preferLocalEngine: true,
      defaultDepth: 18,
      deepAnalysisDepth: 22,
      analysisDelay: 0,
    },
    
    SPEECH: {
      defaultRate: 1.0,
      defaultAutoSpeak: false,
    },
    
    defaultPlayerLevel: 'advanced',
};
  
export default CONFIG;