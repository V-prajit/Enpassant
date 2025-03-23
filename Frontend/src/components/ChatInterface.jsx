import React, { useState, useRef, useEffect } from 'react';
import { speakText, prepareAnalysisForSpeech, stopSpeech } from '../utils/speechSynthesis';

const ChatInterface = ({ fen, evaluation, bestMoves }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleMessageSubmit = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Add user message
    const newMessages = [...messages, { role: 'user', content: inputMessage }];
    setMessages(newMessages);
    setInputMessage('');

    // Simulate response (this would be replaced with actual AI response)
    setTimeout(() => {
      const response = {
        role: 'assistant',
        content: `I'm analyzing the position with evaluation ${evaluation}. The best move is ${bestMoves[0]?.san || 'not available yet'}.`
      };
      setMessages(prev => [...prev, response]);
      
      if (autoSpeak) {
        handleSpeak(response.content);
      }
    }, 1000);
  };

  const getLastAssistantMessage = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
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
            {isSpeaking ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1-1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.414 1.414m-.293-4.95a7 7 0 011.414-3.95m2.879 2.879a3 3 0 00-4.243-4.243m2.121-2.121a7 7 0 0110 0l-5 5m-9.9 2.828a13 13 0 000 12.728"></path>
              </svg>
            )}
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
                <p className="text-gray-800">{msg.content}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleMessageSubmit} className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask about your position..."
          className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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