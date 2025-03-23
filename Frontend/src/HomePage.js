import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { BrainCircuit, Volume2, Mic, Award, BookOpen, Settings, LogIn } from 'lucide-react';

const HomePage = () => {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const [showAuthSettings, setShowAuthSettings] = useState(false);
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  
  // Glass card component for reuse
  const GlassCard = ({ children, className = '' }) => (
    <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-lg p-6 ${className}`}>
      {children}
    </div>
  );

  // Animating dots for loading states
  const LoadingDots = () => (
    <div className="flex space-x-1 mt-1">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Navigation */}
      <nav className="backdrop-blur-md bg-white/5 border-b border-white/10 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Enpassant
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <button 
                    onClick={() => setShowAuthSettings(!showAuthSettings)}
                    className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 transition-all duration-300 rounded-full px-4 py-2"
                  >
                    {user.picture ? (
                      <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span>{user.name}</span>
                  </button>
                  
                  {showAuthSettings && (
                    <div className="absolute right-0 mt-2 w-72 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
                      <h3 className="text-lg font-semibold mb-4">Auth Settings</h3>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Auth0 Domain</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="your-domain.auth0.com"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Client ID</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Your Auth0 Client ID"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Redirect URI</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={window.location.origin}
                          readOnly
                        />
                      </div>
                      
                      <button 
                        className="w-full bg-blue-600 hover:bg-blue-700 transition rounded-md py-2 font-medium"
                        onClick={() => setShowAuthSettings(false)}
                      >
                        Save Settings
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => logout({ returnTo: window.location.origin })}
                  className="text-sm bg-white/10 hover:bg-white/20 transition-all duration-300 rounded-md px-4 py-2"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => loginWithRedirect()}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 rounded-md px-6 py-2 font-medium"
              >
                <LogIn size={18} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-24">
          <div className="lg:w-1/2">
            <h1 className="text-5xl font-extrabold leading-tight mb-6">
              AI-Powered Chess <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Thinking Tool</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Elevate your chess skills with AI-powered analysis and voice coaching. 
              Learn to think like a master with instant feedback and personalized insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => isAuthenticated ? window.location.href = '/app' : loginWithRedirect()}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <BrainCircuit size={20} />
                <span>Start Learning</span>
              </button>
              <button className="bg-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm text-white font-bold py-3 px-8 rounded-xl border border-white/10 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2">
                <BookOpen size={20} />
                <span>How It Works</span>
              </button>
            </div>
          </div>
          
          <div className="lg:w-1/2">
            <GlassCard className="w-full max-w-md mx-auto">
              <div className="aspect-square max-w-sm mx-auto">
                <Chessboard 
                  position={fen}
                  boardWidth={400}
                  areArrowsAllowed={true}
                  customDarkSquareStyle={{ backgroundColor: '#4b7399' }}
                  customLightSquareStyle={{ backgroundColor: '#e8e8e8' }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">AI Analysis</div>
                  <div className="font-semibold">Italian Game Opening</div>
                  <LoadingDots />
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 bg-white/10 hover:bg-white/20 transition-all duration-200 rounded-full">
                    <Mic size={20} />
                  </button>
                  <button className="p-2 bg-white/10 hover:bg-white/20 transition-all duration-200 rounded-full">
                    <Volume2 size={20} />
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="mb-24">
          <h2 className="text-3xl font-bold text-center mb-12">Learn Chess <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">10x Faster</span></h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard>
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <BrainCircuit size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">AI-Powered Analysis</h3>
              <p className="text-gray-300">Get instant feedback on your moves with advanced Stockfish and Gemini AI analysis.</p>
            </GlassCard>
            
            <GlassCard>
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <Mic size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Voice Interaction</h3>
              <p className="text-gray-300">Control the board and get coaching through natural voice commands. Perfect for hands-free learning.</p>
            </GlassCard>
            
            <GlassCard>
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <Award size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Skill Development</h3>
              <p className="text-gray-300">Our personalized feedback helps you break through plateaus and reach new rating heights.</p>
            </GlassCard>
          </div>
        </section>

        {/* Stats Section */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard className="text-center">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">10X</div>
              <p className="text-gray-300">Faster learning with AI-powered feedback and coaching</p>
            </GlassCard>
            
            <GlassCard className="text-center">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">40%</div>
              <p className="text-gray-300">Of players quit at 1400 ELO - we help you break through</p>
            </GlassCard>
            
            <GlassCard className="text-center">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">35M</div>
              <p className="text-gray-300">Chess players in the US can benefit from our platform</p>
            </GlassCard>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <GlassCard className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Ready to improve your chess thinking?</h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of players who are using Enpassant to learn faster and think better on the board.
            </p>
            <button 
              onClick={() => isAuthenticated ? window.location.href = '/app' : loginWithRedirect()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl inline-flex items-center justify-center space-x-2"
            >
              <BrainCircuit size={20} />
              <span>Start Learning Now</span>
            </button>
          </GlassCard>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-md border-t border-white/10 py-8 mt-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                Enpassant
              </div>
              <p className="text-gray-400 mt-1">AI-Powered Chess Thinking Tool</p>
            </div>
            
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white transition">About</a>
              <a href="#" className="text-gray-400 hover:text-white transition">Features</a>
              <a href="#" className="text-gray-400 hover:text-white transition">Pricing</a>
              <a href="#" className="text-gray-400 hover:text-white transition">Contact</a>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© 2025 Enpassant. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white transition text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white transition text-sm">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;