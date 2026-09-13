import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo.png';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onComplete, 
  durationMs = 3000 
}) => {
  const [progress, setProgress] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  const loadingMessages = [
    "Connecting to Pure Farm Network...",
    "Fetching Hosur & Bangalore Real-time Hub Data...",
    "Verifying Encrypted Security Protocols...",
    "Readying Pure Milk Operations..."
  ];

  useEffect(() => {
    const startTime = Date.now();
    const intervalTime = 40; // Update every 40ms for smooth 60fps animation

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min(100, Math.floor((elapsed / durationMs) * 100));
      
      setProgress(calculatedProgress);

      // Rotate loading messages dynamically
      const msgIndex = Math.min(
        loadingMessages.length - 1, 
        Math.floor((calculatedProgress / 100) * loadingMessages.length)
      );
      setLoadingTextIndex(msgIndex);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setIsFading(true);
        setTimeout(() => {
          onComplete();
        }, 500); // Wait for fade out animation
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [durationMs, onComplete]);

  return (
    <div className={`splash-overlay ${isFading ? 'fade-out' : ''}`}>
      <div className="splash-background-glow" />
      
      <div className="splash-card">
        {/* Animated Brand Logo Container */}
        <div className="splash-logo-wrapper">
          <div className="splash-pulse-ring" />
          <div className="splash-pulse-ring-outer" />
          <img 
            src={logoImg} 
            alt="MilkyLush Logo" 
            className="splash-logo-img" 
            onError={(e) => {
              // Fallback icon if logo image fails to load
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const icon = document.createElement('div');
                icon.className = 'splash-fallback-icon';
                icon.innerHTML = '🐄';
                parent.appendChild(icon);
              }
            }}
          />
        </div>

        {/* Brand Header */}
        <div className="splash-brand-text">
          <h1 className="splash-title">
            Milky<span className="splash-title-highlight">Lush</span>
          </h1>
          <p className="splash-subtitle">Farm-Fresh Pure A2 Milk & Organic Dairy</p>
        </div>

        {/* Live Loading Message */}
        <div className="splash-status-container">
          <div className="splash-status-badge">
            <Sparkles className="splash-icon-spin" size={14} />
            <span>{loadingMessages[loadingTextIndex]}</span>
          </div>

          {/* Progress Bar Container */}
          <div className="splash-progress-track">
            <div 
              className="splash-progress-bar" 
              style={{ width: `${progress}%` }} 
            />
          </div>

          <div className="splash-progress-meta">
            <span className="splash-security-tag">
              <ShieldCheck size={13} style={{ display: 'inline', marginRight: 4 }} />
              256-bit Encrypted Session
            </span>
            <span className="splash-percentage">{progress}%</span>
          </div>
        </div>

        {/* Location indicators preview */}
        <div className="splash-locations-preview">
          <span className="splash-loc-chip">📍 Hosur Hub</span>
          <span className="splash-loc-chip">📍 Bangalore Hub</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
