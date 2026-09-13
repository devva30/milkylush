import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, Check, MapPin } from 'lucide-react';
import logoImg from '../assets/logo.png';

interface LoginPageProps {
  onLoginSuccess: (username: string, hubId: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
}

export default function LoginPage({ onLoginSuccess, showToast, selectedHubId, onSelectHub }: LoginPageProps) {
  const [email, setEmail] = useState('tomadmin@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [btnHover, setBtnHover] = useState(false);

  const isHosur = selectedHubId === 'hub_hosur_main';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      const err = "Please enter your admin email or username.";
      setErrorMessage(err);
      showToast(err, "error");
      return;
    }

    if (!password.trim()) {
      const err = "Please enter your admin password.";
      setErrorMessage(err);
      showToast(err, "error");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const cleanEmail = email.trim().toLowerCase();

      if (cleanEmail === 'fail@test.com') {
        const err = "Account disabled by Super Admin. Contact security support.";
        setErrorMessage(err);
        showToast(err, "error");
        return;
      }

      if (password.length < 3) {
        const err = "Incorrect password. Passwords must be at least 3 characters.";
        setErrorMessage(err);
        showToast(err, "error");
        return;
      }

      const hubName = isHosur ? 'Hosur Central Hub (TN)' : 'Bangalore Electronic City Hub (KA)';
      showToast(`Welcome back! Logged into ${hubName}`, "success");
      onLoginSuccess(email, selectedHubId);
    }, 500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #ECFDF5 0%, #F4F8F5 45%, #FFFFFF 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: "'Poppins', sans-serif",
      boxSizing: 'border-box',
      padding: '2.5rem 1.5rem',
      overflowX: 'hidden'
    }}>
      
      {/* Centered Main Login Container Card */}
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#FFFFFF',
        borderRadius: '28px',
        boxShadow: '0 25px 60px rgba(2, 44, 34, 0.25), 0 8px 25px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        padding: '2.5rem 2rem',
        boxSizing: 'border-box',
        textAlign: 'center'
      }}>
        
        {/* Logo Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '96px',
            height: '96px',
            borderRadius: '24px',
            backgroundColor: '#ECFDF5',
            padding: '12px',
            border: '2px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(4, 120, 87, 0.15)'
          }}>
            <img src={logoImg} alt="MilkyLush" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>

        {/* Brand Headline */}
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#111827',
          margin: '0 0 0.4rem 0',
          letterSpacing: '-0.02em'
        }}>
          MilkyLush Dairy Admin
        </h2>
        <p style={{
          fontSize: '0.88rem',
          color: '#6B7280',
          margin: '0 0 1.5rem 0',
          lineHeight: '1.4',
          fontWeight: 500
        }}>
          Authorized Portal Access &amp; Hub Fulfillment System
        </p>

        {/* Error Banner if any */}
        {errorMessage && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '14px',
            padding: '0.8rem 1rem',
            marginBottom: '1.25rem',
            color: '#991B1B',
            fontSize: '0.84rem',
            fontWeight: 600,
            textAlign: 'left'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', textAlign: 'left', width: '100%' }}>
          
          {/* Step 1: Select Location Branch */}
          <div style={{ width: '100%' }}>
            <label style={{
              color: '#047857',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '0.65rem'
            }}>
              1. SELECT PORTAL LOCATION BRANCH
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', width: '100%' }}>
              
              {/* Hosur Branch Card */}
              <div 
                onClick={() => {
                  onSelectHub('hub_hosur_main');
                  showToast("Selected Hosur Central Hub (TN)", "info");
                }}
                style={{
                  padding: '0.95rem 0.85rem',
                  borderRadius: '16px',
                  border: isHosur ? '2px solid #047857' : '1px solid #CBD5E1',
                  backgroundColor: isHosur ? '#ECFDF5' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isHosur ? 'translateY(-2px)' : 'none',
                  boxShadow: isHosur ? '0 6px 16px rgba(4, 120, 87, 0.15)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  position: 'relative'
                }}
              >
                {isHosur && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isHosur ? '#047857' : '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Green Location Pin Icon */}
                  <MapPin size={16} style={{ color: '#059669' }} /> Hosur
                </div>
                <div style={{ fontSize: '0.74rem', color: isHosur ? '#059669' : '#64748B', fontWeight: 500 }}>
                  Hosur Central Hub (TN)
                </div>
              </div>

              {/* Bangalore Branch Card */}
              <div 
                onClick={() => {
                  onSelectHub('hub_blr_ecity');
                  showToast("Selected Bangalore E-City Hub (KA)", "info");
                }}
                style={{
                  padding: '0.95rem 0.85rem',
                  borderRadius: '16px',
                  border: !isHosur ? '2px solid #047857' : '1px solid #CBD5E1',
                  backgroundColor: !isHosur ? '#ECFDF5' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: !isHosur ? 'translateY(-2px)' : 'none',
                  boxShadow: !isHosur ? '0 6px 16px rgba(4, 120, 87, 0.15)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  position: 'relative'
                }}
              >
                {!isHosur && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: !isHosur ? '#047857' : '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Green Location Pin Icon */}
                  <MapPin size={16} style={{ color: '#059669' }} /> Bangalore
                </div>
                <div style={{ fontSize: '0.74rem', color: !isHosur ? '#059669' : '#64748B', fontWeight: 500 }}>
                  Electronic City Hub (KA)
                </div>
              </div>

            </div>
          </div>

          {/* Step 2: Email Input */}
          <div style={{ width: '100%' }}>
            <label style={{
              color: '#475569',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '0.45rem'
            }}>
              2. EMAIL OR ADMIN USERNAME
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Mail size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8'
              }} />
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tomadmin@gmail.com"
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem 0.85rem 44px',
                  borderRadius: '14px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Step 3: Password Input */}
          <div style={{ width: '100%' }}>
            <label style={{
              color: '#475569',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '0.45rem'
            }}>
              3. PASSWORD
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8'
              }} />
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.85rem 44px 0.85rem 44px',
                  borderRadius: '14px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Dark Green Action Button */}
          <button 
            type="submit" 
            disabled={isLoading}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '16px',
              backgroundColor: btnHover ? '#065F46' : '#047857',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '1rem',
              border: 'none',
              cursor: isLoading ? 'wait' : 'pointer',
              boxShadow: btnHover ? '0 12px 28px rgba(4, 120, 87, 0.45)' : '0 8px 22px rgba(4, 120, 87, 0.35)',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: btnHover ? 'translateY(-2px)' : 'none',
              opacity: isLoading ? 0.85 : 1,
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Log In to {isHosur ? 'Hosur' : 'Bangalore'} Portal</span>
                <ArrowRight size={20} style={{ transition: 'transform 0.2s ease', transform: btnHover ? 'translateX(4px)' : 'none' }} />
              </>
            )}
          </button>

        </form>

        {/* Clean Footer Note */}
        <div style={{
          marginTop: '1.75rem',
          fontSize: '0.78rem',
          color: '#64748B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <ShieldCheck size={14} style={{ color: '#047857' }} />
          <span>MilkyLush Operations Console</span>
        </div>

      </div>
    </div>
  );
}
