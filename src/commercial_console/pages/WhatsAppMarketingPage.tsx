import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  FileText
} from 'lucide-react';
import type { UserProfile } from '../../types';

interface WhatsAppMarketingPageProps {
  selectedTab: 'whatsapp-campaigns' | 'whatsapp-notifications' | 'customer-cohorts';
  users: UserProfile[];
}

export default function WhatsAppMarketingPage({ selectedTab, users }: WhatsAppMarketingPageProps) {
  const [campaignTitle, setCampaignTitle] = useState('Fresh Paneer & Ghee Special Discount');
  const [messageTemplate, setMessageTemplate] = useState(
    '🥛 Hello {Name}! Enjoy 10% extra discount on MilkyLush Farm Fresh Paneer & Cow Ghee today. Order directly on the MilkyLush app!'
  );
  const [targetAudience, setTargetAudience] = useState<'all' | 'active_subs' | 'inactive'>('active_subs');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534', margin: 0 }}>
          {selectedTab === 'whatsapp-campaigns' && 'WhatsApp Promotional Campaigns'}
          {selectedTab === 'whatsapp-notifications' && 'Automated Order & Delivery WhatsApp Alerts'}
          {selectedTab === 'customer-cohorts' && 'Customer Cohorts & High-Value Segment Analytics'}
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
          {selectedTab === 'whatsapp-campaigns' && 'Broadcast promotional messages, seasonal offers & discount codes via WhatsApp Business Cloud API.'}
          {selectedTab === 'whatsapp-notifications' && 'Automated transactional messages triggered on Order Placed, Out for Delivery, and Doorstep Photo Verified.'}
          {selectedTab === 'customer-cohorts' && 'Identify top spending customers, inactive users and churned subscribers.'}
        </p>
      </div>

      {selectedTab === 'whatsapp-campaigns' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Message Builder Box */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
              Create New Broadcast Campaign
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Campaign Title</label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Target Customer Audience</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value as any)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <option value="active_subs">Active Daily Milk Subscribers ({users.length} Customers)</option>
                  <option value="all">All Registered MilkyLush App Users</option>
                  <option value="inactive">Inactive / Paused Subscribers</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>WhatsApp Message Text</label>
                <textarea
                  rows={4}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <button
                type="button"
                onClick={() => alert(`Launched WhatsApp Campaign "${campaignTitle}" to ${users.length} recipients successfully via Cloud API!`)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                }}
              >
                <Send size={16} />
                <span>Send WhatsApp Broadcast Now ({users.length} Recipients)</span>
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          <div style={{ backgroundColor: '#DCFCE7', padding: '1.5rem', borderRadius: '20px', border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              💬 WhatsApp Customer Phone Screen Preview
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '1rem', borderRadius: '16px', border: '1px solid #CBD5E1', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#166534', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                  ML
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534' }}>MilkyLush Official Verified</div>
              </div>

              <div style={{ backgroundColor: '#E2F4E9', padding: '0.85rem', borderRadius: '12px', fontSize: '0.85rem', color: '#1E293B', lineHeight: 1.4 }}>
                {messageTemplate}
                <div style={{ fontSize: '0.7rem', color: '#059669', textAlign: 'right', marginTop: '6px', fontWeight: 700 }}>
                  11:52 AM • Verified WhatsApp Business
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'whatsapp-notifications' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Automated WhatsApp Notification Triggers
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { title: 'Doorstep Drop Completed (with Photo Verification)', trigger: 'Triggered when delivery partner completes drop with photo proof', template: '✅ Hello {Name}, your morning Milk Drop of 1 L Farm Fresh Milk is completed at your doorstep! View photo proof: {ProofUrl}', active: true },
              { title: 'Order Out For Delivery', trigger: 'Triggered when rider starts route', template: '🛵 Hello {Name}, your MilkyLush delivery is out with our partner {RiderName}. Arriving before 7:00 AM.', active: true },
              { title: 'Subscription Low Wallet Alert', trigger: 'Triggered when balance falls below ₹100', template: '⚠️ Dear {Name}, your wallet balance is low (₹{Balance}). Please recharge to ensure uninterrupted morning milk drops.', active: true },
            ].map((t) => (
              <div key={t.title} style={{ padding: '1rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1E293B' }}>{t.title}</div>
                  <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>ACTIVE</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '8px' }}>{t.trigger}</div>
                <div style={{ backgroundColor: '#FFFFFF', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', color: '#334155', border: '1px solid #CBD5E1' }}>
                  {t.template}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'customer-cohorts' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Customer Segments &amp; Cohort Analytics
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>SEGMENT COHORT</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>CUSTOMER COUNT</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>AVG MONTHLY SPEND</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'VIP Daily Subscribers (100% Retention)', count: `${users.length} Users`, spend: '₹2,100 / mo', action: 'Send Loyalty Reward WhatsApp' },
                { name: 'Weekend Curd & Paneer Buyers', count: '120 Users', spend: '₹850 / mo', action: 'Send Cross-Sell Discount' },
                { name: 'Inactive / Paused Subscriptions', count: '18 Users', spend: '₹0 / mo', action: 'Send Re-activation Voucher' },
              ].map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{c.count}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{c.spend}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button type="button" onClick={() => alert(`Action initiated for segment: ${c.name}`)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#166534', border: '1px solid #166534', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
                      {c.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
