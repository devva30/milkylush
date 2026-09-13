import React, { useState } from 'react';
import { Plus, Tag, Smartphone, Image as ImageIcon, Bell, Send, History } from 'lucide-react';
import type { Banner, OnboardingSlide } from '../types';

interface MobileControlPageProps {
  selectedHubId?: string;
  banners: Banner[];
  onboardingSlides: OnboardingSlide[];
  onAddBanner?: () => void;
  onAddOnboardingSlide?: () => void;
  onSaveBanner?: (banner: Partial<Banner>) => Promise<void>;
  onSaveOnboardingSlide?: (slide: Partial<OnboardingSlide>) => Promise<void>;
  onDeleteBanner: (id: string) => void;
  onDeleteOnboardingSlide: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CampaignLog {
  id: string;
  title: string;
  target: string;
  type: 'Offer' | 'Wishes & Info';
  recipients: number;
  sentAt: string;
  bodyPreview: string;
}

export default function MobileControlPage({
  selectedHubId = 'hub_hosur_main',
  banners,
  onboardingSlides,
  onSaveBanner,
  onSaveOnboardingSlide,
  onDeleteBanner,
  onDeleteOnboardingSlide,
  showToast,
}: MobileControlPageProps) {
  const [activeTab, setActiveTab] = useState<'onboarding' | 'banners' | 'broadcast'>('onboarding');

  // Internal state for banners & slides directly synced with Firestore snapshots
  const [localSlides, setLocalSlides] = useState<OnboardingSlide[]>(onboardingSlides || []);
  const [localBanners, setLocalBanners] = useState<Banner[]>(banners || []);

  React.useEffect(() => {
    setLocalSlides(onboardingSlides || []);
  }, [onboardingSlides]);

  React.useEffect(() => {
    setLocalBanners(banners || []);
  }, [banners]);

  // Modal State - Onboarding Slide Modal
  const [editingSlide, setEditingSlide] = useState<OnboardingSlide | null>(null);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);

  // Modal State - Banner Modal
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);

  // Broadcast Form State
  const [targetAudience, setTargetAudience] = useState('All Registered Users');
  const [alertCategory, setAlertCategory] = useState<'Special Offer' | 'Wishes & Info'>('Special Offer');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  // Broadcast Campaign History Log State
  const [campaignHistory, setCampaignHistory] = useState<CampaignLog[]>([]);

  // Slide Handlers
  const handleOpenEditSlide = (slide: OnboardingSlide) => {
    setEditingSlide({ ...slide });
    setIsSlideModalOpen(true);
  };

  const handleOpenAddSlide = () => {
    setEditingSlide({
      id: `onb_${Date.now()}`,
      title: 'Fresh Daily Pure Dairy',
      description: 'Chilled glass bottles delivered directly to your home every morning before 6:30 AM.',
      tag: 'Morning Freshness',
      displayOrder: localSlides.length + 1,
      iconName: 'water_drop',
      imageUrl: 'https://images.unsplash.com/photo-1527018601619-a508a2be00cd?w=600&auto=format&fit=crop&q=80'
    });
    setIsSlideModalOpen(true);
  };

  const handleSaveSlide = async () => {
    if (!editingSlide) return;
    const exists = localSlides.some(s => s.id === editingSlide.id);
    if (exists) {
      setLocalSlides(localSlides.map(s => s.id === editingSlide.id ? editingSlide : s));
    } else {
      setLocalSlides([...localSlides, editingSlide]);
    }
    if (onSaveOnboardingSlide) {
      await onSaveOnboardingSlide(editingSlide);
    } else {
      showToast('Updated onboarding presentation slide!', 'success');
    }
    setIsSlideModalOpen(false);
  };

  const handleDeleteSlideInternal = (id: string) => {
    setLocalSlides(localSlides.filter(s => s.id !== id));
    onDeleteOnboardingSlide(id);
    showToast('Onboarding slide removed.', 'info');
  };

  // Banner Handlers
  const handleOpenEditBanner = (banner: Banner) => {
    setEditingBanner({ ...banner });
    setIsBannerModalOpen(true);
  };

  const activeBannersCount = localBanners.filter(b => b.active).length;

  const handleOpenAddBanner = () => {
    if (activeBannersCount >= 6) {
      showToast('Maximum 6 active promo banners allowed per hub. Please deactivate an existing banner first.', 'error');
      return;
    }
    setEditingBanner({
      id: `ban_${Date.now()}`,
      title: 'Fresh Organic Milk Offer',
      description: 'Subscribe today and get zero delivery charges for the first month!',
      displayOrder: localBanners.length + 1,
      active: true,
      hubIds: [selectedHubId],
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80'
    } as any);
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async () => {
    if (!editingBanner) return;
    if (editingBanner.active) {
      const activeOthers = localBanners.filter(b => b.id !== editingBanner.id && b.active).length;
      if (activeOthers >= 6) {
        showToast('Maximum 6 active promo banners allowed per hub. Please deactivate an existing banner first.', 'error');
        return;
      }
    }
    const exists = localBanners.some(b => b.id === editingBanner.id);
    if (exists) {
      setLocalBanners(localBanners.map(b => b.id === editingBanner.id ? editingBanner : b));
    } else {
      setLocalBanners([...localBanners, editingBanner]);
    }
    if (onSaveBanner) {
      await onSaveBanner(editingBanner);
    } else {
      showToast('Updated promotional banner!', 'success');
    }
    setIsBannerModalOpen(false);
  };

  const handleDeleteBannerInternal = (id: string) => {
    setLocalBanners(localBanners.filter(b => b.id !== id));
    onDeleteBanner(id);
    showToast('Banner deleted.', 'info');
  };

  // Broadcast Handler
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast('Please fill out both Headline Title and Message Body.', 'error');
      return;
    }

    const newLog: CampaignLog = {
      id: `cmp_${Date.now()}`,
      title: broadcastTitle.trim(),
      target: targetAudience,
      type: alertCategory === 'Special Offer' ? 'Offer' : 'Wishes & Info',
      recipients: targetAudience.includes('Single User') ? 1 : 4,
      sentAt: new Date().toLocaleString(),
      bodyPreview: broadcastBody.trim()
    };

    setCampaignHistory([newLog, ...campaignHistory]);
    showToast(`Broadcast notification "${broadcastTitle}" sent to mobile app users! 🚀`, 'success');
    setBroadcastTitle('');
    setBroadcastBody('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Sub-Navigation Header Pills matching Screenshots 1, 3, 5 */}
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('onboarding')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'onboarding' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
            backgroundColor: activeTab === 'onboarding' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'onboarding' ? '#047857' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'onboarding' ? '0 2px 4px rgba(4,120,87,0.06)' : 'none'
          }}
        >
          <Smartphone size={16} /> Onboarding Slides ({localSlides.length})
        </button>

        <button
          onClick={() => setActiveTab('banners')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'banners' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
            backgroundColor: activeTab === 'banners' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'banners' ? '#047857' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'banners' ? '0 2px 4px rgba(4,120,87,0.06)' : 'none'
          }}
        >
          <ImageIcon size={16} /> Promotional Home Banners ({localBanners.length})
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'broadcast' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
            backgroundColor: activeTab === 'broadcast' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'broadcast' ? '#047857' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'broadcast' ? '0 2px 4px rgba(4,120,87,0.06)' : 'none'
          }}
        >
          <Bell size={16} /> Broadcast Push Alerts
        </button>
      </div>

      {/* TAB 1: ONBOARDING SLIDES */}
      {activeTab === 'onboarding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Bar matching Screenshot 1 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                Onboarding Screen Presentation Slides
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '3px' }}>
                Configure images, icons, tags, and taglines shown to first-time app installers.
              </p>
            </div>

            <button
              onClick={handleOpenAddSlide}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Add Presentation Slide
            </button>
          </div>

          {/* 3 Presentation Slide Cards Grid matching Screenshot 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
            {localSlides.map((slide) => (
              <div 
                key={slide.id} 
                style={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '16px', 
                  border: '1px solid #E5E7EB', 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* Slide Image with Category Badge Tag Overlay */}
                  <div style={{ position: 'relative', width: '100%', height: '180px', backgroundColor: '#F3F4F6' }}>
                    <img 
                      src={slide.imageUrl} 
                      alt={slide.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      backgroundColor: '#044E35',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <Tag size={12} /> {slide.tag || 'Pureness guaranteed'}
                    </div>
                  </div>

                  {/* Slide Content Box */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    
                    {/* Icon Pill Identifier */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', width: 'fit-content' }}>
                      Icon: {slide.iconName || 'water_drop'}
                    </div>

                    {/* Headline Title */}
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: '4px 0 2px 0', whiteSpace: 'pre-line' }}>
                      {slide.title.replace('\\n', '\n')}
                    </h3>

                    {/* Tagline Details */}
                    <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0, lineHeight: '1.45' }}>
                      {slide.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer Bar */}
                <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857' }}>
                    Rank Order: #{slide.displayOrder}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleOpenEditSlide(slide)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: '#FFFFFF',
                        color: '#111827',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSlideInternal(slide.id)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 2: PROMOTIONAL HOME BANNERS */}
      {activeTab === 'banners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Bar matching Screenshot 3 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                Active Promo Banners (Max 5)
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '3px' }}>
                Configure promotional banners displayed on the mobile app home screen
              </p>
            </div>

            <button
              onClick={handleOpenAddBanner}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Add Promo Banner
            </button>
          </div>

          {/* Banner Cards Grid matching Screenshot 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
            {localBanners.map((banner) => (
              <div 
                key={banner.id} 
                style={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '16px', 
                  border: '1px solid #E5E7EB', 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* Banner Graphic Image with ACTIVE Tag Overlay */}
                  <div style={{ position: 'relative', width: '100%', height: '170px', backgroundColor: '#F3F4F6' }}>
                    <img 
                      src={banner.imageUrl} 
                      alt={banner.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: banner.active ? '#059669' : '#6B7280',
                      color: '#FFFFFF',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {banner.active ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                  </div>

                  {/* Banner Info Box */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                      {banner.title}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0, lineHeight: '1.4' }}>
                      {banner.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer Bar */}
                <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857' }}>
                    Display Rank: #{banner.displayOrder}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleOpenEditBanner(banner)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: '#FFFFFF',
                        color: '#111827',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBannerInternal(banner.id)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 3: BROADCAST PUSH ALERTS */}
      {activeTab === 'broadcast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Title matching Screenshot 5 */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={20} style={{ color: '#047857' }} /> System Campaigns &amp; Broadcast Center
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '3px' }}>
              Send instant manual pushes (offers, wishes, alerts) directly to MilkyLush client app users and their email inboxes simultaneously.
            </p>
          </div>

          {/* 2-Column Main Broadcast Section matching Screenshot 5 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', width: '100%' }}>
            
            {/* LEFT COLUMN: Broadcast Configuration Form */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Field 1: Target Audience */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Target Audience
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      color: '#111827',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  >
                    <option value="All Registered Users (4 customers)">📢 All Registered Users (4 customers)</option>
                    <option value="Single User 👤">👤 Single User</option>
                    <option value="Active Subscribers Only">📅 Active Subscribers Only</option>
                    <option value="Hosur Hub Only">📍 Hosur Hub Only</option>
                    <option value="Bangalore Hub Only">📍 Bangalore Hub Only</option>
                  </select>
                </div>

                {/* Field 2: Alert Category */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Alert Category
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setAlertCategory('Special Offer')}
                      style={{
                        flex: 1,
                        padding: '0.55rem 0.85rem',
                        borderRadius: '10px',
                        border: alertCategory === 'Special Offer' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
                        backgroundColor: alertCategory === 'Special Offer' ? '#ECFDF5' : '#FFFFFF',
                        color: alertCategory === 'Special Offer' ? '#047857' : '#374151',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      📌 Special Offer
                    </button>

                    <button
                      type="button"
                      onClick={() => setAlertCategory('Wishes & Info')}
                      style={{
                        flex: 1,
                        padding: '0.55rem 0.85rem',
                        borderRadius: '10px',
                        border: alertCategory === 'Wishes & Info' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
                        backgroundColor: alertCategory === 'Wishes & Info' ? '#ECFDF5' : '#FFFFFF',
                        color: alertCategory === 'Wishes & Info' ? '#047857' : '#374151',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      👍 Wishes &amp; Info
                    </button>
                  </div>
                </div>

                {/* Field 3: Headline / Title */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
                      Headline / Title
                    </label>
                    <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                      {broadcastTitle.length}/50 chars
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder="e.g. 🍓 Sunday Berry Bliss Offer!"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      color: '#111827',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Field 4: Message Content / Body */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
                      Message Content / Body
                    </label>
                    <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                      {broadcastBody.length}/150 chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={150}
                    placeholder="Type notification text..."
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      color: '#111827',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '10px',
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '0.5rem'
                  }}
                >
                  <Send size={16} /> Broadcast Notification &amp; Email
                </button>

              </form>
            </div>

            {/* RIGHT COLUMN: Live Visual Push Preview Box matching Screenshot 5 */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '2px dashed #059669',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#111827' }}>
                Visual Push Preview
              </div>

              {/* Smartphone Live Push Box */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid #E5E7EB',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                    🏷️
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827' }}>
                        {broadcastTitle || 'MilkyLush App Update'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>now</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: '1.4', paddingLeft: '38px' }}>
                  {broadcastBody || 'Type message body to see live smartphone layout preview.'}
                </div>

                {/* Email Preview Box Below */}
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #F3F4F6',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ color: '#6B7280' }}>
                    To: <span style={{ color: '#374151' }}>All Active Customers</span>
                  </div>
                  <div style={{ fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                    Subject: {broadcastTitle || 'MilkyLush Update'}
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #E5E7EB', color: '#6B7280', marginTop: '4px' }}>
                    {broadcastBody || 'Message content body template...'}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* BOTTOM SECTION: Campaign & Broadcast History Log Table matching Screenshot 5 */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #F3F4F6', fontSize: '0.95rem', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} style={{ color: '#047857' }} /> Campaign &amp; Broadcast History Log
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
              <table className="admin-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.7rem', color: '#6B7280' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>CAMPAIGN TITLE</th>
                    <th style={{ padding: '0.85rem 1rem' }}>TARGET</th>
                    <th style={{ padding: '0.85rem 1rem' }}>TYPE</th>
                    <th style={{ padding: '0.85rem 1rem' }}>RECIPIENTS</th>
                    <th style={{ padding: '0.85rem 1rem' }}>SENT DATE &amp; TIME</th>
                    <th style={{ padding: '0.85rem 1rem' }}>MESSAGE BODY PREVIEW</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignHistory.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ fontWeight: 800, color: '#111827', padding: '0.85rem 1rem' }}>
                        {log.title}
                      </td>
                      <td style={{ color: '#4B5563', padding: '0.85rem 1rem' }}>
                        {log.target}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#059669',
                          backgroundColor: '#ECFDF5',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          {log.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: '#111827', padding: '0.85rem 1rem' }}>
                        {log.recipients}
                      </td>
                      <td style={{ color: '#6B7280', padding: '0.85rem 1rem' }}>
                        {log.sentAt}
                      </td>
                      <td style={{ color: '#6B7280', padding: '0.85rem 1rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.bodyPreview}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* EDIT / ADD ONBOARDING SLIDE MODAL matching Screenshot 2 */}
      {isSlideModalOpen && editingSlide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '1.25rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
              Edit Onboarding Presentation Slide
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title Input */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Presentation Title / Headline
                </label>
                <input
                  type="text"
                  value={editingSlide.title}
                  onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Tagline Description */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Tagline Description / Details
                </label>
                <textarea
                  rows={3}
                  value={editingSlide.description}
                  onChange={(e) => setEditingSlide({ ...editingSlide, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* 2 Column Row: Feature Badge & Lucide Icon */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Feature Badge / Category Tag
                  </label>
                  <input
                    type="text"
                    value={editingSlide.tag}
                    onChange={(e) => setEditingSlide({ ...editingSlide, tag: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Lucide Icon Class Identifier
                  </label>
                  <select
                    value={editingSlide.iconName}
                    onChange={(e) => setEditingSlide({ ...editingSlide, iconName: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF', outline: 'none' }}
                  >
                    <option value="water_drop">Milk / Water Drop</option>
                    <option value="organic">Organic / Leaf</option>
                    <option value="truck">Delivery Truck</option>
                    <option value="shield">Shield / Pure</option>
                  </select>
                </div>
              </div>

              {/* Display Rank */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Sequence Display Rank (1 = First)
                </label>
                <input
                  type="number"
                  value={editingSlide.displayOrder}
                  onChange={(e) => setEditingSlide({ ...editingSlide, displayOrder: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Artwork URL & Upload Button */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Presentation Image / Slide Artwork URL
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={editingSlide.imageUrl}
                    onChange={(e) => setEditingSlide({ ...editingSlide, imageUrl: e.target.value })}
                    style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => showToast('Selected local presentation image file.', 'info')}
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📷 Upload Image
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlide}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Slide
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* EDIT / ADD MARKETING BANNER MODAL matching Screenshot 4 */}
      {isBannerModalOpen && editingBanner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '1.25rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
              Edit Marketing Banner
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Banner Title */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Banner Title / Headline
                </label>
                <input
                  type="text"
                  value={editingBanner.title}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Description / Offer Details
                </label>
                <textarea
                  rows={3}
                  value={editingBanner.description}
                  onChange={(e) => setEditingBanner({ ...editingBanner, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Display Rank */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Display Rank (1 = First)
                </label>
                <input
                  type="number"
                  value={editingBanner.displayOrder}
                  onChange={(e) => setEditingBanner({ ...editingBanner, displayOrder: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Target Hub Selection */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Target Operations Hub
                </label>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '10px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#047857',
                  fontSize: '0.82rem',
                  fontWeight: 800
                }}>
                  <span>📍 Locked to {selectedHubId === 'hub_hosur_main' ? 'Hosur Central Hub (hub_hosur_main)' : 'Bangalore Electronic City Hub (hub_blr_ecity)'}</span>
                </div>
              </div>

              {/* Active Toggle Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="showBannerCheck"
                  checked={editingBanner.active}
                  onChange={(e) => setEditingBanner({ ...editingBanner, active: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#047857', cursor: 'pointer' }}
                />
                <label htmlFor="showBannerCheck" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', cursor: 'pointer' }}>
                  Show Banner on App
                </label>
              </div>

              {/* Graphic Link / File Upload box matching Screenshot 4 */}
              <div style={{ border: '1px dashed #D1D5DB', borderRadius: '12px', padding: '1rem', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
                  Banner Graphic Link / File Upload
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img 
                    src={editingBanner.imageUrl} 
                    alt="Preview" 
                    style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E5E7EB' }} 
                  />
                  <button
                    type="button"
                    onClick={() => showToast('Selected banner image file.', 'info')}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '10px',
                      backgroundColor: '#3B82F6',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    📁 Choose Image File to Upload
                  </button>
                </div>

                <input
                  type="text"
                  value={editingBanner.imageUrl}
                  onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBanner}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Banner
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
