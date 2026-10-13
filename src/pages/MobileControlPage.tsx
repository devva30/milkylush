import React, { useState, useEffect } from 'react';
import { Plus, Tag, Smartphone, Image as ImageIcon, Bell, Send, History, ShieldCheck, Share2, Sparkles, Save, Headphones, Trash2, HelpCircle, Gift } from 'lucide-react';
import { isHubId, type HubId } from '../data/hubs';
import { useHubContext } from '../context/HubContext';
import { DataState } from '../components/common/DataState';
import {
  useOnboardingSlides, saveOnboardingSlide, deleteOnboardingSlide, useHubBanners, saveBanner, deleteBanner,
  loadHubSetting, saveHubSetting, loadAppConfig, saveAppConfig, loadBroadcasts, sendBroadcast, deleteBroadcast,
} from '../data/appContent';
import type { Banner, OnboardingSlide } from '../types';
import { useHubProducts } from '../data/products';

interface MobileControlPageProps {
  selectedHubId?: string;
  /** Ignored: the page loads its own data. Kept so existing callers compile. */
  banners?: Banner[];
  onboardingSlides?: OnboardingSlide[];
  onAddBanner?: () => void;
  onAddOnboardingSlide?: () => void;
  onSaveBanner?: (banner: Partial<Banner>) => Promise<void>;
  onSaveOnboardingSlide?: (slide: Partial<OnboardingSlide>) => Promise<void>;
  onDeleteBanner?: (id: string) => void;
  onDeleteOnboardingSlide?: (id: string) => void;
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
  selectedHubId = 'hosur',
  showToast,
}: MobileControlPageProps) {
  const hubId = selectedHubId as HubId;
  const { allowedHubIds, staff } = useHubContext();
  const slidesQuery = useOnboardingSlides();
  const bannersQuery = useHubBanners(hubId);
  const banners = bannersQuery.data;
  const onboardingSlides = slidesQuery.data;
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Every save reports the real result; errors are shown, never swallowed.
  const attempt = async (okMessage: string, action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      showToast(okMessage, 'success');
      return true;
    } catch (err) {
      const code = (err as { code?: string }).code;
      showToast(code === 'permission-denied'
        ? 'Only a Super Admin can change settings shared by both hubs.'
        : `Could not save: ${(err as Error).message}`, 'error');
      return false;
    }
  };
  const [activeTab, setActiveTab] = useState<'onboarding' | 'banners' | 'broadcast' | 'fssai-social' | 'popup-ad' | 'help-desk' | 'free-sample'>('onboarding');

  // FSSAI & Social Links State
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('https://instagram.com/milkylush');
  const [youtubeUrl, setYoutubeUrl] = useState('https://youtube.com/@milkylush');
  const [facebookUrl, setFacebookUrl] = useState('https://facebook.com/milkylush');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  // Pop-up Offer Ad State
  const [popupActive, setPopupActive] = useState(true);
  const [popupTitle, setPopupTitle] = useState('Special Morning Milk Offer 🥛');
  const [popupSubtitle, setPopupSubtitle] = useState('Subscribe today to get 20% Extra off on 30-Day Glass Bottle Packs!');
  const [popupImageUrl, setPopupImageUrl] = useState('https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800');
  const [popupCtaText, setPopupCtaText] = useState('Subscribe Now →');
  const [popupHubScope, setPopupHubScope] = useState('all');
  const [popupTimerSeconds, setPopupTimerSeconds] = useState(3);

  // Free Sample State
  const [fsActive, setFsActive] = useState(true);
  const [fsTitle, setFsTitle] = useState('Get Free Sample Today! 🥛');
  const [fsSubtitle, setFsSubtitle] = useState('Taste our farm fresh organic A2 milk delivered directly to your doorstep. 100% Free!');
  const [fsProductName, setFsProductName] = useState('Free Sample 500ml A2 Desi Cow Milk');
  const [fsImageUrl, setFsImageUrl] = useState('https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800');
  const [fsOnlyNew, setFsOnlyNew] = useState(true);
  const [fsShowInAuth, setFsShowInAuth] = useState(true);
  const [fsAuthTitle, setFsAuthTitle] = useState('Get Free Sample Today! 🥛');

  // Help & Support Desk State
  const [helpPhone, setHelpPhone] = useState('+91 99028 82332');
  const [helpPhone2, setHelpPhone2] = useState('');
  const [helpWhatsapp, setHelpWhatsapp] = useState('+91 99028 82332');
  const [helpEmail, setHelpEmail] = useState('milkylushorganic@gmail.com');
  const [helpAddress, setHelpAddress] = useState('Off Hosur Road, Near Electronic City, Bangalore - 560100');
  const [helpFaqs, setHelpFaqs] = useState<{ id: string; question: string; answer: string }[]>([
    {
      id: 'faq_1',
      question: 'What are the daily delivery slots?',
      answer: 'Our fresh milk drops occur every morning between 05:00 AM and 07:00 AM. Any subscription modifications must be saved before 8:30 PM the previous night.'
    },
    {
      id: 'faq_2',
      question: 'How do glass bottle returns work?',
      answer: 'Simply rinse your empty glass bottles and leave them outside your door. Our delivery partner collects them during sunrise drops, crediting eco points to your account.'
    },
    {
      id: 'faq_3',
      question: 'Can I pause my subscription when traveling?',
      answer: 'Yes! You can pause or resume your daily milk subscription anytime from the Subscriptions tab without extra charges.'
    }
  ]);

  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');

  // Load this hub's settings (and the shared app config) in parallel
  useEffect(() => {
    let cancelled = false;
    const loadConfigs = async () => {
      setLoadingConfigs(true);
      setConfigError(null);
      try {
        const [app, popup, help, fs, campaigns] = await Promise.all([
          loadAppConfig(),
          loadHubSetting<Record<string, any>>(hubId, 'popup'),
          loadHubSetting<Record<string, any>>(hubId, 'help'),
          loadHubSetting<Record<string, any>>(hubId, 'freeSample'),
          loadBroadcasts(hubId),
        ]);
        if (cancelled) return;
        if (app.fssaiNumber !== undefined) setFssaiNumber(String(app.fssaiNumber));
        if (app.instagramUrl !== undefined) setInstagramUrl(String(app.instagramUrl));
        if (app.youtubeUrl !== undefined) setYoutubeUrl(String(app.youtubeUrl));
        if (app.facebookUrl !== undefined) setFacebookUrl(String(app.facebookUrl));
        if (app.whatsappUrl !== undefined) setWhatsappUrl(String(app.whatsappUrl));

        if (popup.active !== undefined) setPopupActive(popup.active);
        if (popup.title !== undefined) setPopupTitle(popup.title);
        if (popup.subtitle !== undefined) setPopupSubtitle(popup.subtitle);
        if (popup.imageUrl !== undefined) setPopupImageUrl(popup.imageUrl);
        if (popup.ctaText !== undefined) setPopupCtaText(popup.ctaText);
        setPopupHubScope(hubId);
        if (popup.autoCloseSeconds !== undefined) setPopupTimerSeconds(popup.autoCloseSeconds);

        if (help.phone !== undefined) setHelpPhone(help.phone);
        if (help.phone2 !== undefined) setHelpPhone2(help.phone2);
        if (help.whatsapp !== undefined) setHelpWhatsapp(help.whatsapp);
        if (help.email !== undefined) setHelpEmail(help.email);
        if (help.address !== undefined) setHelpAddress(help.address);
        if (Array.isArray(help.faqs)) setHelpFaqs(help.faqs);

        if (fs.isActive !== undefined) setFsActive(fs.isActive);
        if (fs.title !== undefined) setFsTitle(fs.title);
        if (fs.subtitle !== undefined) setFsSubtitle(fs.subtitle);
        if (fs.productName !== undefined) setFsProductName(fs.productName);
        if (fs.imageUrl !== undefined) setFsImageUrl(fs.imageUrl);
        if (fs.onlyNewCustomers !== undefined) setFsOnlyNew(fs.onlyNewCustomers);
        if (fs.showInAuth !== undefined) setFsShowInAuth(fs.showInAuth);
        if (fs.authTitle !== undefined) setFsAuthTitle(fs.authTitle);

        setCampaignHistory(campaigns);
      } catch (err) {
        if (!cancelled) setConfigError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingConfigs(false);
      }
    };
    loadConfigs();
    return () => { cancelled = true; };
  }, [hubId, reloadKey]);

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
  // Products / categories of this hub, for "When tapped, open" on banners.
  const hubProducts = useHubProducts(hubId);
  const bannerCategories = Array.from(new Set(hubProducts.data.map((p) => (p.category ?? '').trim()).filter(Boolean))).sort();
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
    if (await attempt('Saved onboarding slide (shown in both hubs).', () => saveOnboardingSlide(editingSlide))) {
      setIsSlideModalOpen(false);
    }
  };

  const handleDeleteSlideInternal = (id: string) => {
    attempt('Onboarding slide removed.', () => deleteOnboardingSlide(id));
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
      id: '', // Firestore assigns the id on first save
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
    if (await attempt(`Saved banner for ${hubId === 'hosur' ? 'Hosur' : 'Bengaluru'}.`, () => saveBanner(hubId, editingBanner))) {
      setIsBannerModalOpen(false);
    }
  };

  const handleDeleteBannerInternal = (id: string) => {
    attempt('Banner deleted.', () => deleteBanner(hubId, id));
  };

  // Broadcast Handler (Writes live notification documents to Firestore for mobile system push bar)
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast('Please fill out both Headline Title and Message Body.', 'error');
      return;
    }

    await attempt(`Broadcast "${broadcastTitle.trim()}" published to ${hubId === 'hosur' ? 'Hosur' : 'Bengaluru'} customers.`, async () => {
      const row = await sendBroadcast(hubId, {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        type: alertCategory === 'Special Offer' ? 'offer' : 'info',
        audienceLabel: targetAudience,
        sentByUid: staff?.uid ?? '',
      });
      setCampaignHistory((prev) => [row, ...prev]);
      setBroadcastTitle('');
      setBroadcastBody('');
    });
  };

  const handleDeleteBroadcast = async (campaignId: string) => {
    await attempt('Broadcast campaign log deleted.', async () => {
      await deleteBroadcast(hubId, campaignId);
      setCampaignHistory((prev) => prev.filter((c) => c.id !== campaignId));
    });
  };

  // FSSAI & Social Media Save Handler (shared by both hubs → super admin only)
  const handleSaveSocialFssai = async (e: React.FormEvent) => {
    e.preventDefault();
    await attempt('FSSAI & Social Links saved successfully!', () =>
      saveAppConfig({ fssaiNumber, instagramUrl, youtubeUrl, facebookUrl, whatsappUrl }));
  };

  // Pop-up Offer Ad Save Handler ("all" scope writes the same popup to every hub this admin manages)
  const handleSavePopupAd = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets: HubId[] = popupHubScope === 'all' ? allowedHubIds : [isHubId(popupHubScope) ? popupHubScope : hubId];
    await attempt('Home Screen Pop-up Offer Ad updated live for customer app!', () =>
      saveHubSetting(targets, 'popup', {
        active: popupActive, title: popupTitle, subtitle: popupSubtitle, imageUrl: popupImageUrl,
        ctaText: popupCtaText, autoCloseSeconds: Number(popupTimerSeconds) || 0,
      }));
  };

  // Help & Support Desk Handler (customer-facing; rider contacts live in settings/contact)
  const handleSaveHelpSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    await attempt('Help & Support Desk settings & FAQs saved live!', () =>
      saveHubSetting([hubId], 'help', {
        phone: helpPhone.trim(), phone2: helpPhone2.trim(), whatsapp: helpWhatsapp.trim(),
        email: helpEmail.trim(), address: helpAddress.trim(), faqs: helpFaqs,
      }));
  };

  // Free Sample Campaign Control Handler
  const handleSaveFreeSample = async (e: React.FormEvent) => {
    e.preventDefault();
    await attempt('Free Sample Gateway Controls updated live for customer app!', () =>
      saveHubSetting([hubId], 'freeSample', {
        isActive: fsActive, title: fsTitle, subtitle: fsSubtitle, productName: fsProductName, imageUrl: fsImageUrl,
        onlyNewCustomers: fsOnlyNew, showInAuth: fsShowInAuth, authTitle: fsAuthTitle,
      }));
  };

  const handleAddFaq = () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) {
      showToast('Please enter both Question and Answer.', 'error');
      return;
    }
    const newFaq = {
      id: `faq_${Date.now()}`,
      question: newFaqQuestion.trim(),
      answer: newFaqAnswer.trim()
    };
    setHelpFaqs([...helpFaqs, newFaq]);
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    showToast('New FAQ added.', 'info');
  };

  const handleDeleteFaq = (id: string) => {
    setHelpFaqs(helpFaqs.filter(f => f.id !== id));
    showToast('FAQ deleted.', 'info');
  };

  return (
    <DataState
      loading={loadingConfigs || slidesQuery.loading || bannersQuery.loading}
      error={configError || slidesQuery.error || bannersQuery.error}
      onRetry={() => { setReloadKey((k) => k + 1); slidesQuery.retry(); bannersQuery.retry(); }}
      loadingLabel="Loading app content…"
    >
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Sub-Navigation Header Pills */}
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

        <button
          onClick={() => setActiveTab('fssai-social')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'fssai-social' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
            backgroundColor: activeTab === 'fssai-social' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'fssai-social' ? '#047857' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'fssai-social' ? '0 2px 4px rgba(4,120,87,0.06)' : 'none'
          }}
        >
          <ShieldCheck size={16} /> FSSAI &amp; Social Links
        </button>

        <button
          onClick={() => setActiveTab('popup-ad')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'popup-ad' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
            backgroundColor: activeTab === 'popup-ad' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'popup-ad' ? '#047857' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'popup-ad' ? '0 2px 4px rgba(4,120,87,0.06)' : 'none'
          }}
        >
          <Sparkles size={16} /> Pop-up Offer Ad Screen
        </button>

        <button
          onClick={() => setActiveTab('help-desk')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'help-desk' ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB',
            backgroundColor: activeTab === 'help-desk' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'help-desk' ? '#047857' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'help-desk' ? '0 2px 4px rgba(4,120,87,0.06)' : 'none'
          }}
        >
          <Headphones size={16} /> Help &amp; Support Desk
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
                    {selectedHubId.includes('hosur') ? (
                      <>
                        <option value="All Registered Users (Hosur)">📢 All Registered Users (Hosur Hub)</option>
                        <option value="Hosur Hub Only">📍 Hosur Hub Only</option>
                        <option value="Single User 👤">👤 Single User</option>
                        <option value="Active Subscribers Only">📅 Active Subscribers Only</option>
                      </>
                    ) : (
                      <>
                        <option value="All Registered Users (Bangalore)">📢 All Registered Users (Bangalore Hub)</option>
                        <option value="Bangalore Hub Only">📍 Bangalore Hub Only</option>
                        <option value="Single User 👤">👤 Single User</option>
                        <option value="Active Subscribers Only">📅 Active Subscribers Only</option>
                      </>
                    )}
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
                    <th style={{ padding: '0.85rem 1rem', textTransform: 'uppercase' }}>ACTION</th>
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
                      <td style={{ color: '#6B7280', padding: '0.85rem 1rem', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.bodyPreview}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <button
                          onClick={() => handleDeleteBroadcast(log.id)}
                          title="Delete Campaign Log"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: FSSAI & SOCIAL LINKS CONTROL */}
      {activeTab === 'fssai-social' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={22} style={{ color: '#047857' }} /> Customer Mobile App FSSAI &amp; Social Links Manager
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '3px' }}>
              Update the FSSAI License number and official social media channel links (Instagram, YouTube, Facebook, WhatsApp) shown on the Customer App Profile screen footer.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Form */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <form onSubmit={handleSaveSocialFssai} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    FSSAI License Number
                  </label>
                  <input
                    type="text"
                    value={fssaiNumber}
                    onChange={(e) => setFssaiNumber(e.target.value)}
                    placeholder="e.g. 12423999000123"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Instagram Page URL
                  </label>
                  <input
                    type="text"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/milkylush"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    YouTube Channel URL
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/@milkylush"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Facebook Page URL
                  </label>
                  <input
                    type="text"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/milkylush"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    WhatsApp Customer Care Link
                  </label>
                  <input
                    type="text"
                    value={whatsappUrl}
                    onChange={(e) => setWhatsappUrl(e.target.value)}
                    placeholder="https://wa.me/919876543210"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

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
                  <Save size={16} /> Save FSSAI &amp; Social Links
                </button>
              </form>
            </div>

            {/* Live Mobile Profile Footer Preview */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '2px dashed #047857', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#111827' }}>
                App Profile Footer Live Preview
              </div>

              <div style={{ backgroundColor: '#FAFAFA', borderRadius: '16px', padding: '1.5rem', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
                {/* FSSAI Official Logo Emblem Badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', padding: '6px 14px', borderRadius: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <img
                    src="https://fssai.gov.in/images/online-platforms/nsc.png"
                    alt="FSSAI Logo"
                    style={{ height: '20px', objectFit: 'contain' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const fallback = (e.target as HTMLElement).nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none', fontSize: '1.1rem', fontWeight: 900, fontStyle: 'italic', fontFamily: 'serif', color: '#1E3A8A', letterSpacing: '-0.5px' }}>
                    fssa<span style={{ color: '#EA580C' }}>i</span>
                  </div>
                  <div style={{ width: '1px', height: '18px', backgroundColor: '#CBD5E1' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748B' }}>Food Safety License</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F3A2C' }}>Lic No. {fssaiNumber || '12423999000123'}</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4B5563' }}>
                  Connect with MilkyLush
                </div>

                {/* Social Icons Row matching App Theme */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1.2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#0F3A2C' }}>📸</div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1.2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#0F3A2C' }}>▶️</div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1.2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#0F3A2C' }}>📘</div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1.2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#0F3A2C' }}>💬</div>
                </div>

                <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '0.5rem' }}>
                  MilkyLush Organic Farms &amp; Pure Glass Bottle Delivery v2.4.0
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: POP-UP OFFER AD SCREEN */}
      {activeTab === 'popup-ad' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={22} style={{ color: '#047857' }} /> Home Screen In-App Pop-up Offer Ad Manager
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '3px' }}>
              Manage promotional dialog ads shown when users open the customer mobile app home screen. Supports timed auto-close (3s) or manual dismiss.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Left Form Panel */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <form onSubmit={handleSavePopupAd} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Active Toggle Switch */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', backgroundColor: popupActive ? '#ECFDF5' : '#F9FAFB', borderRadius: '12px', border: popupActive ? '1px solid #A7F3D0' : '1px solid #E5E7EB' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: popupActive ? '#047857' : '#374151' }}>
                      Pop-up Offer Ad Status: {popupActive ? 'ACTIVE (LIVE)' : 'DISABLED'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                      Show offer dialog on app start
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={popupActive}
                    onChange={(e) => setPopupActive(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: '#047857', cursor: 'pointer' }}
                  />
                </div>

                {/* Offer Title */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Offer Dialog Title
                  </label>
                  <input
                    type="text"
                    value={popupTitle}
                    onChange={(e) => setPopupTitle(e.target.value)}
                    placeholder="e.g. Special Morning Milk Offer 🥛"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                {/* Offer Subtitle / Details */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Subtitle / Promotional Details
                  </label>
                  <textarea
                    rows={3}
                    value={popupSubtitle}
                    onChange={(e) => setPopupSubtitle(e.target.value)}
                    placeholder="e.g. Subscribe today to get 20% Extra off on 30-Day Glass Bottle Packs!"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                {/* Promo Image URL */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Pop-up Offer Image URL
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={popupImageUrl}
                      onChange={(e) => setPopupImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => showToast('Selected offer image.', 'info')}
                      style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      📷 Choose
                    </button>
                  </div>
                </div>

                {/* CTA Button Text (Optional) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
                      CTA Button Text (Optional)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>Leave blank to hide button</span>
                  </div>
                  <input
                    type="text"
                    value={popupCtaText}
                    onChange={(e) => setPopupCtaText(e.target.value)}
                    placeholder="e.g. Subscribe Now → (Leave blank to hide button)"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                {/* 2-Column Row: Auto-close timer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                      Auto-close Timer
                    </label>
                    <select
                      value={popupTimerSeconds}
                      onChange={(e) => setPopupTimerSeconds(parseInt(e.target.value))}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF', outline: 'none' }}
                    >
                      <option value={3}>3 Seconds (Recommended)</option>
                      <option value={5}>5 Seconds</option>
                      <option value={10}>10 Seconds</option>
                      <option value={0}>0s (No timer, manual close only)</option>
                    </select>
                  </div>
                </div>

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
                  <Save size={16} /> Save Pop-up Offer Settings
                </button>
              </form>
            </div>

            {/* Right Interactive Mobile Screen Mockup Preview */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '2px dashed #047857', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#111827', width: '100%', textAlign: 'left' }}>
                Live Pop-up Offer Ad Screen Preview
              </div>

              {/* Mobile Phone Mockup Box */}
              <div style={{
                width: '280px',
                height: '480px',
                borderRadius: '32px',
                backgroundColor: '#1F2937',
                padding: '12px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                position: 'relative'
              }}>
                {/* Phone Inner Screen Area */}
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '24px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px',
                  boxSizing: 'border-box',
                  position: 'relative'
                }}>
                  
                  {/* Pop-up Offer Modal Box inside Mobile Screen */}
                  <div style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    position: 'relative',
                    textAlign: 'center'
                  }}>
                    {/* Close Button X */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10
                    }}>
                      ✕
                    </div>

                    {/* Timer Badge (Timer-only count) */}
                    {popupTimerSeconds > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        zIndex: 10
                      }}>
                        {popupTimerSeconds}s
                      </div>
                    )}

                    {/* Banner Image */}
                    <div style={{ width: '100%', height: '120px', backgroundColor: '#F3F4F6' }}>
                      <img src={popupImageUrl} alt="Offer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    {/* Content */}
                    <div style={{ padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                        {popupTitle || 'Special Offer Title'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '4px', lineHeight: '1.3' }}>
                        {popupSubtitle || 'Offer description text goes here.'}
                      </div>

                      {/* Optional CTA Button */}
                      {popupCtaText.trim() && (
                        <button style={{
                          marginTop: '10px',
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '10px',
                          backgroundColor: '#047857',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          border: 'none'
                        }}>
                          {popupCtaText}
                        </button>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: HELP & SUPPORT DESK */}
      {activeTab === 'help-desk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Headphones size={22} style={{ color: '#047857' }} /> Help &amp; Support Desk Management
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '3px' }}>
              Configure customer care contact channels (Phone, WhatsApp, Email, Location) and dynamic FAQs displayed in the customer mobile app.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* LEFT COLUMN: Support Contact Channels */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginTop: 0, marginBottom: '1.25rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.5rem' }}>
                📞 Support Contact Channels
              </h3>

              <form onSubmit={handleSaveHelpSupport} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Customer Helpline Phone Number (Primary)
                  </label>
                  <input
                    type="text"
                    value={helpPhone}
                    onChange={(e) => setHelpPhone(e.target.value)}
                    placeholder="e.g. +91 99028 82332"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Extra Helpline Phone Number (Secondary / Phone 2)
                  </label>
                  <input
                    type="text"
                    value={helpPhone2}
                    onChange={(e) => setHelpPhone2(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Support WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={helpWhatsapp}
                    onChange={(e) => setHelpWhatsapp(e.target.value)}
                    placeholder="e.g. +91 99028 82332"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Customer Support Email Address
                  </label>
                  <input
                    type="email"
                    value={helpEmail}
                    onChange={(e) => setHelpEmail(e.target.value)}
                    placeholder="e.g. milkylushorganic@gmail.com"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Office Address / Hub Location (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={helpAddress}
                    onChange={(e) => setHelpAddress(e.target.value)}
                    placeholder="Leave empty if location card should be hidden"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '2px', display: 'block' }}>
                    If left blank, the office location card will be hidden in the mobile app.
                  </span>
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '0.5rem'
                  }}
                >
                  <Save size={16} /> Save Support Contact Details
                </button>
              </form>
            </div>

            {/* RIGHT COLUMN: Manage Dynamic FAQs */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginTop: 0, marginBottom: 0, borderBottom: '1px solid #F3F4F6', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={18} style={{ color: '#047857' }} /> Manage Frequently Asked Questions (FAQs)
              </h3>

              {/* Add New FAQ Form */}
              <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  + Add New FAQ Item
                </span>
                
                <input
                  type="text"
                  placeholder="Question (e.g. What are the delivery slots?)"
                  value={newFaqQuestion}
                  onChange={(e) => setNewFaqQuestion(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none' }}
                />

                <textarea
                  rows={2}
                  placeholder="Answer explanation text..."
                  value={newFaqAnswer}
                  onChange={(e) => setNewFaqAnswer(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none' }}
                />

                <button
                  type="button"
                  onClick={handleAddFaq}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} /> Add FAQ to List
                </button>
              </div>

              {/* Existing FAQs List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '380px', overflowY: 'auto' }}>
                {helpFaqs.map((faq, idx) => (
                  <div key={faq.id} style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111827' }}>
                        {idx + 1}. {faq.question}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#4B5563', lineHeight: '1.4' }}>
                        {faq.answer}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFaq(faq.id)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                ))}
              </div>
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

              {/* Badge */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Badge (small label above the title)
                </label>
                <input
                  type="text"
                  maxLength={22}
                  placeholder="SPECIAL OFFER"
                  value={editingBanner.badge ?? ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, badge: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '4px' }}>
                  e.g. NOW IN HOSUR, NEW, NOTICE, COMING SOON. Leave empty to show SPECIAL OFFER.
                </div>
              </div>

              {/* Tap opens */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  When tapped, open
                </label>
                <select
                  value={editingBanner.targetProductId ?? ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, targetProductId: e.target.value || undefined })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="">Nothing (notice only)</option>
                  {editingBanner.targetProductId && !editingBanner.targetProductId.startsWith('category:')
                    && !hubProducts.data.some((p) => p.id === editingBanner.targetProductId) && (
                    <option value={editingBanner.targetProductId}>⚠ Deleted product — choose another</option>
                  )}
                  {bannerCategories.length > 0 && (
                    <optgroup label="Shop category">
                      {bannerCategories.map((c) => <option key={c} value={`category:${c}`}>{c}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Product">
                    {hubProducts.data.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` · ${p.unit}` : ''}</option>)}
                  </optgroup>
                </select>
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
                  <span>📍 Locked to {selectedHubId === 'hosur' ? 'Hosur Central Hub (hub_hosur_main)' : 'Bangalore Electronic City Hub (hub_blr_ecity)'}</span>
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
    </DataState>
  );
}
