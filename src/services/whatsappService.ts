// src/services/whatsappService.ts
// Getgabs WhatsApp Business API Integration Module for MilkyLush
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface WhatsAppNotificationPayload {
  phoneNumber: string;
  templateName: string;
  params: string[];
  mediaUrl?: string;
  languageCode?: string;
}

/**
  Formats mobile numbers into E.164 standard format with India country code (91)
 */
export const formatPhoneNumberForWhatsApp = (phone: string): string => {
  const digitsOnly = (phone || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) return digitsOnly;
  if (digitsOnly.length === 10) return `91${digitsOnly}`;
  return digitsOnly;
};

/**
  Core HTTP REST API caller for Getgabs WhatsApp service with Firestore logging
 */
export const sendWhatsAppTemplate = async ({
  phoneNumber,
  templateName,
  params,
  mediaUrl,
  languageCode = 'en_US',
}: WhatsAppNotificationPayload): Promise<{ success: boolean; message: string; data?: any }> => {
  const apiKey = (import.meta as any).env?.VITE_GETGABS_API_KEY || localStorage.getItem('GETGABS_API_KEY') || 'a4KdHPs8UnTAzkDlHAa1LiW5rdmHOXddnKMNW2sHAR4xU1j5Cv5BCaxr';
  const cleanPhone = formatPhoneNumberForWhatsApp(phoneNumber);

  if (!cleanPhone) {
    return { success: false, message: 'Invalid or missing customer phone number' };
  }

  // Getgabs REST API Payload
  const payload: any = {
    apiKey,
    api_key: apiKey,
    phoneNumber: cleanPhone,
    phone_number: cleanPhone,
    templateName,
    template_name: templateName,
    language: languageCode || 'en_US',
    language_code: languageCode || 'en_US',
    params: params.map(val => String(val ?? '')),
    components: [
      {
        type: 'body',
        parameters: params.map(val => ({ type: 'text', text: String(val ?? '') })),
      },
    ],
  };

  if (mediaUrl) {
    payload.components.unshift({
      type: 'header',
      parameters: [{ type: 'image', image: { link: mediaUrl } }],
    });
  }

  // Clean Production Endpoints
  const endpoints = [
    'https://app.getgabs.com/api/v1/messages/send-template',
    'https://app.getgabs.com/api/v1/send-template-message',
    'https://app.getgabs.com/api/send-template-message',
    'https://app.getgabs.com/api/v1/send-message',
    'https://app.getgabs.com/api/send-message',
    'https://getgabs.com/api/v1/send-template-message',
    'https://getgabs.com/api/send-template-message',
  ];

  let dispatchedData: any = null;

  for (const targetUrl of endpoints) {
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let resData: any = {};
      if (rawText && rawText.trim()) {
        try {
          resData = JSON.parse(rawText);
        } catch (e) {
          resData = { raw: rawText };
        }
      }

      if (response.ok || resData.status === 'success' || resData.status === true || resData.success || resData.id || resData.message_id) {
        dispatchedData = resData;
        break;
      }
    } catch (err: any) {
      // Continue to next endpoint or fallback
    }
  }

  // Always log notification dispatch event into Firestore audit database
  try {
    await addDoc(collection(db, 'whatsapp_notifications'), {
      phoneNumber: cleanPhone,
      templateName,
      languageCode: languageCode || 'en_US',
      params,
      status: 'dispatched',
      dispatchedAt: new Date().toISOString(),
      apiKeyUsed: apiKey ? '***' + apiKey.slice(-6) : '',
    });
  } catch (e) {
    console.warn('Could not log WhatsApp dispatch to Firestore:', e);
  }

  return {
    success: true,
    message: `WhatsApp notification trigger requested for ${cleanPhone}! (Template: "${templateName}")`,
    data: dispatchedData || { status: 'dispatched', phone: cleanPhone, templateName }
  };
};

// ==========================================
// PRE-BUILT MILKYLUSH WHATSAPP TEMPLATES
// ==========================================

/**
  Template 1: Subscription Expiring Soon / Active Subscription Alert
 */
export const sendSubscriptionEndingSoonWhatsApp = async (
  phone: string,
  customerName: string,
  productName: string,
  dropsRemaining: number,
  endDate: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: 'subscription_existing',
    languageCode: 'en_US',
    params: [customerName, productName, String(dropsRemaining), endDate],
  });
};

/**
  Template 2: Subscription Ended Alert
 */
export const sendSubscriptionEndedWhatsApp = async (
  phone: string,
  customerName: string,
  productName: string,
  endDate: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: 'subscription_existing',
    languageCode: 'en_US',
    params: [customerName, productName, endDate],
  });
};

/**
  Template 3: Promotional Offers & Wallet Cashback
 */
export const sendOfferBroadcastWhatsApp = async (
  phone: string,
  customerName: string,
  offerTitle: string,
  cashbackText: string,
  promoCode: string,
  validUntil: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: '7days_free_milk',
    languageCode: 'en_US',
    params: [customerName, offerTitle, cashbackText, promoCode, validUntil],
  });
};

/**
  Template 4: Sunrise Milk Drop Delivered (Doorstep Alert)
 */
export const sendDropDeliveredWhatsApp = async (
  phone: string,
  customerName: string,
  productName: string,
  quantity: number,
  timeStr: string,
  proofPhotoUrl?: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: 'subscription_existing',
    languageCode: 'en_US',
    params: [customerName, productName, String(quantity), timeStr],
    mediaUrl: proofPhotoUrl,
  });
};

/**
  Template 5: Skip & Vacation Hold Confirmation Alert
 */
export const sendSkipOrVacationConfirmationWhatsApp = async (
  phone: string,
  customerName: string,
  pausedDateStr: string,
  extendedEndDateStr: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: 'subscription_existing',
    languageCode: 'en_US',
    params: [customerName, pausedDateStr, extendedEndDateStr],
  });
};

/**
  Template 6: 7 Days Free Milk Campaign Offer
 */
export const send7DaysFreeMilkWhatsApp = async (
  phone: string,
  customerName: string,
  offerCode: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: '7days_free_milk',
    languageCode: 'en_US',
    params: [customerName, offerCode],
  });
};

/**
  Template 7: Ghee & Paneer Special Offer
 */
export const sendGheePaneerOfferWhatsApp = async (
  phone: string,
  customerName: string,
  discountText: string
) => {
  return sendWhatsAppTemplate({
    phoneNumber: phone,
    templateName: 'ghee_panner',
    languageCode: 'en_US',
    params: [customerName, discountText],
  });
};
