import React, { useState } from 'react';
import { 
  MapPin, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  Building2, 
  Truck, 
  Milk, 
  AlertTriangle,
  X,
  LogIn,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface LocationSelectorProps {
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
  isLoggedIn: boolean;
  onOpenLoginModal: () => void;
  adminUsername?: string;
  hubs?: any[];
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedHubId,
  onSelectHub,
  isLoggedIn,
  onOpenLoginModal,
  hubs = []
}) => {
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [attemptedHubName, setAttemptedHubName] = useState<string>('');

  const handleHubClick = (hubId: string, hubName: string) => {
    if (!isLoggedIn) {
      setAttemptedHubName(hubName);
      setShowAuthPopup(true);
      return;
    }
    onSelectHub(hubId);
  };

  const hosurHub = hubs.find(h => h.id === 'hub_hosur_main') || {
    id: 'hub_hosur_main',
    name: 'Hosur - Central Hub',
    cityName: 'Hosur',
    state: 'Tamil Nadu',
    code: 'HOS_MAIN_01',
    isActive: true
  };

  const bangaloreHub = hubs.find(h => h.id === 'hub_blr_ecity') || {
    id: 'hub_blr_ecity',
    name: 'Bangalore - Electronic City Hub',
    cityName: 'Bangalore',
    state: 'Karnataka',
    code: 'BLR_ECITY_01',
    isActive: true
  };

  return (
    <div className="location-selector-container">
      {/* Background aesthetics */}
      <div className="location-grid-bg" />

      <div className="location-selector-header">
        <div className="location-badge-pill">
          <Building2 size={15} />
          <span>Multi-Hub Operations Center</span>
        </div>
        <h2 className="location-selector-title">
          Select Active Operating Branch
        </h2>
        <p className="location-selector-subtitle">
          Choose between <strong>Hosur</strong> and <strong>Bangalore</strong> hubs to view location-specific catalog, live dispatch, and customer analytics.
        </p>

        {!isLoggedIn && (
          <div className="auth-warning-banner">
            <Lock size={16} />
            <span>Login with email & password is required to select and access branch management.</span>
            <button 
              className="auth-login-inline-btn"
              onClick={onOpenLoginModal}
            >
              <LogIn size={14} /> Log In Now
            </button>
          </div>
        )}
      </div>

      {/* Two Location Cards Grid */}
      <div className="location-cards-grid">
        {/* CARD 1: HOSUR HUB */}
        <div 
          className={`location-card hosur-card ${selectedHubId === hosurHub.id ? 'active-hub' : ''}`}
          onClick={() => handleHubClick(hosurHub.id, hosurHub.name)}
        >
          <div className="location-card-header">
            <div className="location-icon-box hosur-icon">
              <MapPin size={26} />
            </div>
            <div className="location-card-meta">
              <span className="location-code-badge">{hosurHub.code || 'HOS_MAIN_01'}</span>
              <span className="location-state-tag">Tamil Nadu</span>
            </div>
          </div>

          <h3 className="location-card-title">{hosurHub.name}</h3>
          <p className="location-card-desc">
            Primary dairy farm dispatch & central processing hub covering Hosur municipality, Zuzuvadi, and industrial zones.
          </p>

          <div className="location-card-stats">
            <div className="loc-stat-item">
              <Milk size={15} className="loc-stat-icon" />
              <div>
                <span className="loc-stat-val">100% Pure A2</span>
                <span className="loc-stat-label">Farm Source</span>
              </div>
            </div>
            <div className="loc-stat-item">
              <Truck size={15} className="loc-stat-icon" />
              <div>
                <span className="loc-stat-val">5.0 km</span>
                <span className="loc-stat-label">Delivery Radius</span>
              </div>
            </div>
          </div>

          <div className="location-features-list">
            <div className="loc-feat-item">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Direct Farm-Fresh Daily Morning Slots</span>
            </div>
            <div className="loc-feat-item">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Dedicated Hosur Rider Dispatch Fleet</span>
            </div>
          </div>

          <div className="location-card-footer">
            {selectedHubId === hosurHub.id ? (
              <span className="active-status-btn hosur-btn">
                <Sparkles size={16} /> Currently Active Hub
              </span>
            ) : (
              <button className="select-hub-btn hosur-btn">
                {isLoggedIn ? (
                  <>Select Hosur Hub <ArrowRight size={16} /></>
                ) : (
                  <><Lock size={15} /> Login to Select Hosur</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: BANGALORE HUB */}
        <div 
          className={`location-card bangalore-card ${selectedHubId === bangaloreHub.id ? 'active-hub' : ''}`}
          onClick={() => handleHubClick(bangaloreHub.id, bangaloreHub.name)}
        >
          <div className="location-card-header">
            <div className="location-icon-box blr-icon">
              <Building2 size={26} />
            </div>
            <div className="location-card-meta">
              <span className="location-code-badge blr-code">{bangaloreHub.code || 'BLR_ECITY_01'}</span>
              <span className="location-state-tag blr-tag">Karnataka</span>
            </div>
          </div>

          <h3 className="location-card-title">{bangaloreHub.name}</h3>
          <p className="location-card-desc">
            Express urban fulfillment hub serving Electronic City Phase 1 & 2, HSR Layout, Bommasandra, and Sarjapur Road.
          </p>

          <div className="location-card-stats">
            <div className="loc-stat-item">
              <Milk size={15} className="loc-stat-icon blr-stat-icon" />
              <div>
                <span className="loc-stat-val">Express Metro</span>
                <span className="loc-stat-label">Subscription Hub</span>
              </div>
            </div>
            <div className="loc-stat-item">
              <Truck size={15} className="loc-stat-icon blr-stat-icon" />
              <div>
                <span className="loc-stat-val">7.5 km</span>
                <span className="loc-stat-label">Delivery Radius</span>
              </div>
            </div>
          </div>

          <div className="location-features-list">
            <div className="loc-feat-item">
              <CheckCircle2 size={14} className="text-blue-500" />
              <span>Electronic City Same-Day Evening Slots</span>
            </div>
            <div className="loc-feat-item">
              <CheckCircle2 size={14} className="text-blue-500" />
              <span>Automated Route Optimization</span>
            </div>
          </div>

          <div className="location-card-footer">
            {selectedHubId === bangaloreHub.id ? (
              <span className="active-status-btn blr-btn">
                <Sparkles size={16} /> Currently Active Hub
              </span>
            ) : (
              <button className="select-hub-btn blr-btn">
                {isLoggedIn ? (
                  <>Select Bangalore Hub <ArrowRight size={16} /></>
                ) : (
                  <><Lock size={15} /> Login to Select Bangalore</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AUTHENTICATION POPUP MODAL */}
      {showAuthPopup && (
        <div className="auth-popup-overlay">
          <div className="auth-popup-card">
            <button 
              className="auth-popup-close-btn" 
              onClick={() => setShowAuthPopup(false)}
            >
              <X size={20} />
            </button>

            <div className="auth-popup-header">
              <div className="auth-popup-icon-wrapper">
                <Lock size={28} className="text-amber-500" />
              </div>
              <h3 className="auth-popup-title">Authentication Required</h3>
              <p className="auth-popup-subtitle">
                Access to <strong>{attemptedHubName || 'Location Branch'}</strong> operations is restricted.
              </p>
            </div>

            <div className="auth-popup-body">
              <div className="auth-popup-alert-box">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                <p>
                  To view or manage orders, inventory, riders, and pricing for this branch, please log in with your account credentials.
                </p>
              </div>

              <div className="auth-popup-features">
                <div className="auth-feat-point">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Separated data isolation for Hosur & Bangalore operations</span>
                </div>
                <div className="auth-feat-point">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Secure 256-bit encrypted authentication</span>
                </div>
              </div>
            </div>

            <div className="auth-popup-footer">
              <button 
                className="auth-popup-cancel-btn"
                onClick={() => setShowAuthPopup(false)}
              >
                Cancel
              </button>
              <button 
                className="auth-popup-login-btn"
                onClick={() => {
                  setShowAuthPopup(false);
                  onOpenLoginModal();
                }}
              >
                <LogIn size={16} /> Log In with Email & Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
