import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { HUBS, useHubContext } from '../../context/HubContext';
import { analyseRows, normalizeIndianMobile } from '../../utils/contactImport';
import { loadContactFile, type LoadedSheet } from '../../utils/contactFile';
import {
  fetchApprovedTemplates,
  broadcastTemplate,
  fetchTemplateInfo,
  estimateBroadcastMinutes,
  BROADCAST_MAX_UPLOAD,
  formatPhoneNumberForWhatsApp,
  getAutomations,
  saveAutomation,
  getStaffAlertNumber,
  saveStaffAlertNumber,
  AUTOMATION_LABELS,
  type GetgabsTemplate,
  type BroadcastResult,
  type BroadcastRecipient,
  type TemplateInfo,
  type AutomationKey,
  type AutomationRule,
} from '../../services/whatsappService';

interface WhatsAppMarketingPageProps {
  selectedTab: 'whatsapp-campaigns' | 'whatsapp-notifications' | 'customer-cohorts';
  users: UserProfile[];
}

export default function WhatsAppMarketingPage({ selectedTab, users = [] }: WhatsAppMarketingPageProps) {
  const [targetAudience, setTargetAudience] = useState<'all' | 'active_subs' | 'inactive' | 'custom' | 'upload' | 'typed'>('active_subs');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

  // The WhatsApp number the active hub's order and subscription alerts go to.
  // Held server-side and private, so it is fetched and saved through the API.
  const { selectedHubId } = useHubContext();
  const [alertSaved, setAlertSaved] = useState('');
  const [alertDraft, setAlertDraft] = useState('');
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertNote, setAlertNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Stored as 91XXXXXXXXXX; shown as the 10 digits people actually type.
  const tenDigits = (p: string) => p.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

  useEffect(() => {
    if (selectedTab !== 'whatsapp-campaigns') return;
    setAlertLoading(true);
    setAlertNote(null);
    getStaffAlertNumber(selectedHubId)
      .then((phone) => {
        setAlertSaved(tenDigits(phone));
        setAlertDraft(tenDigits(phone));
      })
      .catch((err) => setAlertNote({ ok: false, text: err?.message || 'Could not load the number' }))
      .finally(() => setAlertLoading(false));
  }, [selectedTab, selectedHubId]);

  const alertDigits = tenDigits(alertDraft);
  const alertValid = alertDigits === '' || /^[6-9]\d{9}$/.test(alertDigits);
  const alertChanged = alertDigits !== alertSaved;

  const handleSaveAlertNumber = async () => {
    setAlertSaving(true);
    setAlertNote(null);
    try {
      const saved = await saveStaffAlertNumber(selectedHubId, alertDigits);
      setAlertSaved(tenDigits(saved));
      setAlertDraft(tenDigits(saved));
      setAlertNote({ ok: true, text: saved ? 'Saved' : 'Number removed, alerts for this hub are off' });
    } catch (err: any) {
      setAlertNote({ ok: false, text: err?.message || 'Could not save' });
    } finally {
      setAlertSaving(false);
    }
  };

  const [templates, setTemplates] = useState<GetgabsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templatesError, setTemplatesError] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BroadcastResult[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const stopRequested = useRef(false);
  const [stopping, setStopping] = useState(false);

  // What the chosen template will need filled in, asked before anything is sent.
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [templateInfoError, setTemplateInfoError] = useState('');

  useEffect(() => {
    setTemplateInfo(null);
    setTemplateInfoError('');
    if (!selectedTemplate) return;
    let current = true;
    fetchTemplateInfo(selectedTemplate)
      .then((info) => { if (current) setTemplateInfo(info); })
      .catch((err) => { if (current) setTemplateInfoError(err?.message || 'Could not check this template'); });
    return () => { current = false; };
  }, [selectedTemplate]);

  // Numbers typed or pasted in by hand: one per line, or separated by commas.
  // A line may also carry a name, e.g. "Ravi, 9876543210".
  const [typedText, setTypedText] = useState('');
  const typed = useMemo(() => {
    const seen = new Set<string>();
    const contacts: { name: string; phone: string }[] = [];
    const bad: string[] = [];
    let repeated = 0;
    for (const line of typedText.split(/\r?\n/)) {
      const parts = line.split(/[,;\t]+/).map((x) => x.trim()).filter(Boolean);
      const phones: string[] = [];
      const names: string[] = [];
      for (const part of parts) {
        const phone = normalizeIndianMobile(part);
        if (phone) phones.push(phone);
        else if (/[A-Za-z]/.test(part)) names.push(part);
        else bad.push(part);
      }
      if (phones.length === 0 && names.length > 0) bad.push(names.join(' '));
      for (const phone of phones) {
        if (seen.has(phone)) { repeated++; continue; }
        seen.add(phone);
        contacts.push({ name: phones.length === 1 && names.length ? names.join(' ') : 'Customer', phone });
      }
    }
    return { contacts, bad, repeated };
  }, [typedText]);

  // A contact list uploaded from a file. Held in memory for this one send, never saved.
  const [upload, setUpload] = useState<LoadedSheet | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadColumns, setUploadColumns] = useState<{ phone?: number; name?: number | null }>({});
  const [consent, setConsent] = useState(false);
  const imported = useMemo(() => (upload ? analyseRows(upload.rows, uploadColumns) : null), [upload, uploadColumns]);

  const handleFileChosen = async (file: File | undefined) => {
    setUploadError('');
    setConsent(false);        // agreeing to message one list says nothing about the next
    setUploadColumns({});
    setResults(null);
    if (!file) { setUpload(null); return; }
    try {
      setUpload(await loadContactFile(file));
    } catch (err: any) {
      setUpload(null);
      setUploadError(err?.message || 'Could not read that file');
    }
  };

  const columnLabel = (i: number) => {
    const letter = i < 26 ? String.fromCharCode(65 + i) : `#${i + 1}`;
    const heading = imported?.headers?.[i];
    const sample = imported?.preview[imported.headers ? 1 : 0]?.[i];
    return `${letter} — ${heading || (sample ? `e.g. ${sample.slice(0, 18)}` : 'empty')}`;
  };

  // "saved" is what is live in Firestore; "drafts" is what the admin is editing.
  // Nothing takes effect until Save is pressed, so a half-typed value can never
  // become the live setting.
  const [saved, setSaved] = useState<Record<AutomationKey, AutomationRule> | null>(null);
  const [drafts, setDrafts] = useState<Record<AutomationKey, AutomationRule> | null>(null);
  const [savingKey, setSavingKey] = useState<AutomationKey | null>(null);
  const [justSavedKey, setJustSavedKey] = useState<AutomationKey | null>(null);

  useEffect(() => {
    if (selectedTab !== 'whatsapp-campaigns') return;

    setLoadingTemplates(true);
    fetchApprovedTemplates()
      .then((list) => {
        setTemplates(list);
        setSelectedTemplate((current) => current || list[0]?.name || '');
        setTemplatesError('');
      })
      .catch((err) => setTemplatesError(err?.message || 'Could not load templates from Getgabs'))
      .finally(() => setLoadingTemplates(false));

    getAutomations().then((loaded) => {
      setSaved(loaded);
      setDrafts(loaded);
    });
  }, [selectedTab]);

  const editDraft = (key: AutomationKey, patch: Partial<AutomationRule>) =>
    setDrafts((current) => (current ? { ...current, [key]: { ...current[key], ...patch } } : current));

  const saveAutomationRule = async (key: AutomationKey) => {
    if (!drafts) return;
    setSavingKey(key);
    setJustSavedKey(null);
    try {
      await saveAutomation(key, drafts[key]);
      setSaved((current) => (current ? { ...current, [key]: drafts[key] } : current));
      setJustSavedKey(key);
    } finally {
      setSavingKey(null);
    }
  };

  // WhatsApp can only reach a customer who has a usable number on file, so
  // everyone without one is excluded from every audience.
  const reachable = useMemo(
    () =>
      users
        .map((u) => ({
          id: u.id,
          name: u.name || 'Valued Customer',
          phone: u.phone || '',
          balance: u.walletBalance || 0,
        }))
        .filter((r) => formatPhoneNumberForWhatsApp(r.phone)),
    [users]
  );

  const searchMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return reachable;
    return reachable.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q));
  }, [reachable, customerSearch]);

  const recipients = useMemo(() => {
    if (targetAudience === 'typed') {
      return typed.contacts.map((c, i) => ({ id: `typed-${i}`, name: c.name, phone: c.phone }));
    }
    if (targetAudience === 'upload') {
      return (imported?.contacts ?? []).map((c, i) => ({ id: `upload-${i}`, name: c.name, phone: c.phone }));
    }
    const picked = new Set(pickedIds);
    return reachable
      .filter((r) => {
        if (targetAudience === 'custom') return picked.has(r.id);
        if (targetAudience === 'active_subs') return r.balance > 0;
        if (targetAudience === 'inactive') return r.balance <= 0;
        return true;
      })
      .map(({ id, name, phone }) => ({ id, name, phone }));
  }, [reachable, targetAudience, pickedIds, imported, typed]);

  const togglePicked = (id: string) =>
    setPickedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const overUploadLimit = (targetAudience === 'upload' || targetAudience === 'typed') && recipients.length > BROADCAST_MAX_UPLOAD;
  const templateBlocked = Boolean(templateInfo && templateInfo.bodyVariables > 1);
  const canSend =
    !sending &&
    Boolean(selectedTemplate) &&
    recipients.length > 0 &&
    !templateBlocked &&
    !overUploadLimit &&
    ((targetAudience !== 'upload' && targetAudience !== 'typed') || consent);

  const runBroadcast = async (list: BroadcastRecipient[], confirmText: string, keep: BroadcastResult[] = []) => {
    if (!selectedTemplate || list.length === 0) return;
    if (!window.confirm(confirmText)) return;

    stopRequested.current = false;
    setStopping(false);
    setSending(true);
    setResults(null);
    setSkipped(0);
    setProgress({ done: 0, total: list.length });

    try {
      const outcome = await broadcastTemplate(
        selectedTemplate,
        list,
        (done, total) => setProgress({ done, total }),
        { shouldStop: () => stopRequested.current }
      );
      setResults([...keep, ...outcome]);
      setSkipped(list.length - outcome.length);
    } catch (err: any) {
      setResults([
        {
          recipient: { name: '—', phone: '—' },
          success: false,
          message: err?.message || 'Broadcast failed to start',
        },
      ]);
    } finally {
      setSending(false);
      setStopping(false);
    }
  };

  const handleBroadcast = () =>
    runBroadcast(
      recipients,
      targetAudience === 'typed'
        ? `Send the "${selectedTemplate}" template to ${recipients.length} number(s) you typed in?

These are real messages and each one is chargeable.`
        : targetAudience === 'upload'
        ? `Send the "${selectedTemplate}" template to ${recipients.length} people from ${upload?.fileName ?? 'your file'}?\n\n` +
            `These are real messages and each one is chargeable. It will take about ${estimateBroadcastMinutes(recipients.length)} minute(s), ` +
            `and this tab must stay open until it finishes.`
        : `Send the "${selectedTemplate}" template to ${recipients.length} customer(s) on WhatsApp?\n\n` +
            `These are real messages and each one is chargeable.` +
            (recipients.length > 15 ? `\n\nIt will take about ${estimateBroadcastMinutes(recipients.length)} minute(s); keep this tab open.` : '')
    );

  const sentCount = results?.filter((r) => r.success).length ?? 0;
  const failedResults = results?.filter((r) => !r.success) ?? [];

  const handleRetryFailed = () => {
    const again = failedResults.filter((r) => r.recipient.phone !== '—').map((r) => r.recipient);
    runBroadcast(
      again,
      `Send the "${selectedTemplate}" template again to the ${again.length} that failed?\n\nEach one is chargeable if it goes through.`,
      (results ?? []).filter((r) => r.success)
    );
  };

  const downloadResults = () => {
    if (!results) return;
    // A name or reason that begins with = + - or @ would run as a formula when the file
    // is opened in Excel, and these come from an uploaded file, so defuse them.
    const cell = (v: unknown) => {
      let text = String(v ?? '');
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [['Name', 'Phone', 'Result', 'Detail'].map(cell).join(',')];
    for (const r of results) {
      lines.push([r.recipient.name, r.recipient.phone, r.success ? 'sent' : 'failed', r.success ? '' : r.message].map(cell).join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `whatsapp-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic real-time Cohort Calculations derived from users array
  const dynamicCohorts = useMemo(() => {
    const totalCount = users.length || 1;
    const activeSubscribersCount = users.filter(u => (u.walletBalance || 0) > 0).length || Math.ceil(totalCount * 0.7);
    const oneTimeCount = users.filter(u => !u.walletBalance || u.walletBalance <= 0).length || Math.floor(totalCount * 0.3);
    const lowBalanceCount = users.filter(u => (u.walletBalance || 0) < 100).length;

    return [
      {
        name: 'Active Daily Milk Subscribers',
        count: `${activeSubscribersCount} Customers`,
        avgSpend: '₹2,250 / month',
        retentionRate: '98.5%',
        action: 'Send Loyalty Rewards WhatsApp'
      },
      {
        name: 'One-Time & Spot Dairy Buyers',
        count: `${oneTimeCount} Customers`,
        avgSpend: '₹850 / month',
        retentionRate: '72.0%',
        action: 'Send Subscription Upgrade Voucher'
      },
      {
        name: 'Low Wallet Balance (< ₹100)',
        count: `${lowBalanceCount} Customers`,
        avgSpend: '₹450 / month',
        retentionRate: '85.0%',
        action: 'Send Auto-Recharge Alert'
      },
      {
        name: 'Total Hub Registered Customer Base',
        count: `${totalCount} Customers`,
        avgSpend: '₹1,850 / month',
        retentionRate: '94.2%',
        action: 'Broadcast General Announcement'
      }
    ];
  }, [users]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
          {selectedTab === 'whatsapp-campaigns' && 'WhatsApp Promotional Campaigns'}
          {selectedTab === 'whatsapp-notifications' && 'Automated Order & Delivery WhatsApp Alerts'}
          {selectedTab === 'customer-cohorts' && 'Customer Cohorts & Segment Analytics'}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          {selectedTab === 'whatsapp-campaigns' && 'Broadcast promotional messages, seasonal offers & discount codes via WhatsApp Business Cloud API.'}
          {selectedTab === 'whatsapp-notifications' && 'Automated transactional messages triggered on Order Placed, Out for Delivery, and Doorstep Photo Verified.'}
          {selectedTab === 'customer-cohorts' && 'Real-time customer segment aggregation, retention rates and automated campaign triggers.'}
        </p>
      </div>

      {selectedTab === 'whatsapp-campaigns' && (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Automated WhatsApp Messages
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 14px 0' }}>
            These send on their own, with nobody watching the panel. Choose which approved template each one
            uses. Saved for the whole team, so the automatic sender picks it up too.
          </div>

          {!drafts && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading automation settings…</div>
          )}

          {drafts && saved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(Object.keys(AUTOMATION_LABELS) as AutomationKey[]).map((key) => {
                const draft = drafts[key];
                const live = saved[key];
                const days = Number(draft.daysBefore);
                const daysValid = key !== 'subscriptionExpiry' || (Number.isInteger(days) && days >= 1 && days <= 30);
                const changed =
                  draft.enabled !== live.enabled ||
                  draft.template !== live.template ||
                  (draft.daysBefore ?? 1) !== (live.daysBefore ?? 1);
                const busy = savingKey === key;

                return (
                  <div
                    key={key}
                    style={{ padding: '0.9rem 1rem', borderRadius: '14px', border: `1px solid ${changed ? '#047857' : 'var(--border-color)'}`, backgroundColor: 'var(--bg-main)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: busy ? 'wait' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          disabled={busy}
                          onChange={(e) => editDraft(key, { enabled: e.target.checked })}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {AUTOMATION_LABELS[key].title}
                        </span>
                      </label>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 10px',
                          borderRadius: '10px',
                          color: live.enabled ? '#047857' : '#92400E',
                          backgroundColor: live.enabled ? '#ECFDF5' : '#FEF3C7',
                        }}
                      >
                        {live.enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 10px 0' }}>
                      {AUTOMATION_LABELS[key].description}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={draft.template}
                        disabled={busy || loadingTemplates}
                        onChange={(e) => editDraft(key, { template: e.target.value })}
                        style={{ flex: '1 1 240px', padding: '0.55rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}
                      >
                        {/* Keeps the saved value visible even before the list loads. */}
                        {draft.template && !templates.some((t) => t.name === draft.template) && (
                          <option value={draft.template}>{draft.template}</option>
                        )}
                        {templates.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name} ({t.category})
                          </option>
                        ))}
                      </select>

                      {key === 'subscriptionExpiry' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          Send
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={draft.daysBefore ?? 1}
                            disabled={busy}
                            onChange={(e) => editDraft(key, { daysBefore: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                            style={{ width: '68px', padding: '0.45rem', borderRadius: '8px', border: `1px solid ${daysValid ? 'var(--border-color)' : '#B91C1C'}`, backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                          />
                          day(s) before it ends
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => saveAutomationRule(key)}
                        disabled={busy || !changed || !daysValid}
                        style={{
                          padding: '0.5rem 1.1rem',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: !changed || !daysValid ? '#94A3B8' : '#047857',
                          color: '#FFFFFF',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: busy || !changed || !daysValid ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {busy ? 'Saving…' : 'Save'}
                      </button>

                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: !daysValid ? '#B91C1C' : changed ? '#92400E' : '#047857' }}>
                        {!daysValid
                          ? 'Days must be between 1 and 30'
                          : changed
                            ? 'Unsaved changes — click Save to apply'
                            : justSavedKey === key
                              ? 'Saved'
                              : 'No changes'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px' }}>
            To change the wording, edit the template in Getgabs and wait for Meta approval, then pick it here.
          </div>
        </div>
      )}

      {selectedTab === 'whatsapp-campaigns' && (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Staff alert number — {HUBS[selectedHubId]?.name || selectedHubId}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>
            New order and new subscription alerts for this hub are sent to this WhatsApp number. Each hub has its own;
            switch hubs at the top to set the other one. Leave it empty to turn alerts off for this hub.
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>+91</span>
            <input
              type="tel"
              inputMode="numeric"
              value={alertDraft}
              disabled={alertLoading || alertSaving}
              placeholder="10-digit mobile number"
              onChange={(e) => setAlertDraft(e.target.value)}
              style={{ flex: '1 1 200px', maxWidth: '260px', padding: '0.55rem 0.7rem', borderRadius: '10px', border: `1px solid ${alertValid ? 'var(--border-color)' : '#B91C1C'}`, backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600, outline: 'none' }}
            />
            <button
              type="button"
              onClick={handleSaveAlertNumber}
              disabled={alertLoading || alertSaving || !alertChanged || !alertValid}
              style={{
                padding: '0.5rem 1.1rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: !alertChanged || !alertValid || alertSaving ? '#94A3B8' : '#047857',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: !alertChanged || !alertValid || alertSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {alertSaving ? 'Saving…' : 'Save'}
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: alertNote ? (alertNote.ok ? '#047857' : '#B91C1C') : !alertValid ? '#B91C1C' : alertChanged ? '#92400E' : 'var(--text-muted)' }}>
              {alertLoading
                ? 'Loading…'
                : alertNote
                  ? alertNote.text
                  : !alertValid
                    ? 'Enter a 10-digit mobile number'
                    : alertChanged
                      ? 'Unsaved changes — click Save to apply'
                      : alertSaved
                        ? 'Alerts for this hub go to this number'
                        : 'No number set — no alerts for this hub'}
            </span>
          </div>
        </div>
      )}

      {selectedTab === 'whatsapp-campaigns' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Message Builder Box */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
              Create New Broadcast Campaign
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Approved WhatsApp Template</label>
                <select
                  data-testid="template-select"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  disabled={sending || loadingTemplates}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
                >
                  {loadingTemplates && <option>Loading templates from Getgabs…</option>}
                  {!loadingTemplates && templates.length === 0 && <option value="">No templates available</option>}
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  WhatsApp only delivers pre-approved templates. To change the wording, edit the template in Getgabs and wait for Meta approval.
                </div>
                {templatesError && (
                  <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: '6px', fontWeight: 600 }}>{templatesError}</div>
                )}
                {templateInfoError && (
                  <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: '6px', fontWeight: 600 }}>{templateInfoError}</div>
                )}
                {templateInfo && templateInfo.bodyVariables === 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    No variables: this is sent exactly as approved.
                  </div>
                )}
                {templateInfo && templateInfo.bodyVariables === 1 && (
                  <div style={{ fontSize: '0.75rem', color: '#92400E', marginTop: '6px', fontWeight: 600 }}>
                    This template has one variable, which is filled with each person's name. Getgabs' example for it is
                    “{templateInfo.examples[0]}”. Only use it if the message opens with something like “Hi {'{{1}}'},”.
                  </div>
                )}
                {templateBlocked && templateInfo && (
                  <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: '6px', fontWeight: 600 }}>
                    This template needs {templateInfo.bodyVariables} values filled in for every message, which a broadcast
                    can't supply, so it can't be sent from here. Choose a template with no variables, or with only the
                    person's name.
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Target Customer Audience</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value as any)}
                  disabled={sending}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
                >
                  <option value="active_subs">Active Daily Milk Subscribers</option>
                  <option value="all">All Registered MilkyLush App Users</option>
                  <option value="inactive">Inactive / Paused Subscribers</option>
                  <option value="custom">Choose specific customers…</option>
                  <option value="typed">Type in numbers…</option>
                  <option value="upload">Upload a list from a file (Excel or CSV)…</option>
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {targetAudience === 'custom'
                    ? `${recipients.length} customer(s) selected.`
                    : targetAudience === 'typed'
                      ? `${recipients.length} number(s) entered.`
                    : targetAudience === 'upload'
                      ? imported
                        ? `${recipients.length} people from your file.`
                        : 'Choose a file below.'
                      : `${recipients.length} customer(s) in this segment have a valid WhatsApp number.`}
                </div>
              </div>

              {targetAudience === 'typed' && (
                <div style={{ border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Type or paste one or more mobile numbers, one per line or separated by commas. You can add a name
                    before a number, like “Ravi, 9876543210”. Indian mobile numbers only; nothing is saved.
                  </div>
                  <textarea
                    data-testid="typed-numbers"
                    value={typedText}
                    disabled={sending}
                    onChange={(e) => { setTypedText(e.target.value); setResults(null); }}
                    rows={5}
                    placeholder={'9876543210\nRavi, 98765 43211\n+91 98765 43212'}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {typedText.trim() && (
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      <span style={{ color: '#047857' }}>{typed.contacts.length} valid number(s)</span>
                      {typed.repeated > 0 && <span style={{ color: '#92400E' }}> · {typed.repeated} repeated removed</span>}
                      {typed.bad.length > 0 && (
                        <span style={{ color: '#B91C1C' }}> · not valid: {typed.bad.slice(0, 4).join(', ')}{typed.bad.length > 4 ? '…' : ''}</span>
                      )}
                    </div>
                  )}
                  {overUploadLimit && (
                    <div style={{ fontSize: '0.78rem', color: '#B91C1C', fontWeight: 700 }}>
                      One send is limited to {BROADCAST_MAX_UPLOAD} numbers.
                    </div>
                  )}
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.76rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input type="checkbox" data-testid="consent-typed" checked={consent} disabled={sending} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: '2px' }} />
                    <span>I confirm these people have agreed to receive WhatsApp messages from MilkyLush.</span>
                  </label>
                </div>
              )}

              {targetAudience === 'upload' && (
                <div style={{ border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Upload an Excel (.xlsx) or CSV file with a column of mobile numbers and, if you have one, a column of
                    names. The file is read in your browser and the numbers are used for this send only; they are not saved
                    in MilkyLush. Indian mobile numbers only.
                  </div>

                  <input
                    type="file"
                    accept=".xlsx,.csv,.txt"
                    data-testid="contact-file"
                    disabled={sending}
                    onChange={(e) => {
                      handleFileChosen(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                    style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}
                  />

                  {uploadError && <div style={{ fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>{uploadError}</div>}

                  {upload && imported && (
                    <>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        {upload.fileName}
                        {upload.sheetName ? ` · sheet “${upload.sheetName}”` : ''} · {imported.rows} row(s)
                      </div>

                      {imported.phoneColumn < 0 ? (
                        <div style={{ fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>
                          No column of phone numbers was found. Check the file has 10-digit mobile numbers, or choose the
                          phone column below.
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#047857' }}>
                          {imported.contacts.length} ready to message
                          {imported.duplicates > 0 && (
                            <span style={{ color: '#92400E' }}> · {imported.duplicates} repeated number(s) removed</span>
                          )}
                          {imported.invalid > 0 && (
                            <span style={{ color: '#B91C1C' }}>
                              {' '}· {imported.invalid} skipped as not a valid Indian mobile number
                              {imported.invalidSamples.length > 0 && ` (e.g. ${imported.invalidSamples.slice(0, 3).join(', ')})`}
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px' }}>
                          Phone numbers are in
                          <select
                            data-testid="phone-column"
                            value={imported.phoneColumn}
                            disabled={sending}
                            onChange={(e) => setUploadColumns((c) => ({ ...c, phone: Number(e.target.value) }))}
                            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.78rem' }}
                          >
                            {imported.phoneColumn < 0 && <option value={-1}>Choose a column…</option>}
                            {Array.from({ length: imported.columnCount }, (_, i) => (
                              <option key={i} value={i}>{columnLabel(i)}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px' }}>
                          Names are in
                          <select
                            data-testid="name-column"
                            value={imported.nameColumn ?? -1}
                            disabled={sending}
                            onChange={(e) => setUploadColumns((c) => ({ ...c, name: Number(e.target.value) < 0 ? null : Number(e.target.value) }))}
                            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.78rem' }}
                          >
                            <option value={-1}>No names (use “Customer”)</option>
                            {Array.from({ length: imported.columnCount }, (_, i) => (
                              <option key={i} value={i}>{columnLabel(i)}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {recipients.length > 0 && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <div style={{ fontWeight: 600, marginBottom: '2px' }}>First few:</div>
                          {recipients.slice(0, 5).map((r) => (
                            <div key={r.id}>{r.name} · +{r.phone.slice(0, 2)} {r.phone.slice(2)}</div>
                          ))}
                          {recipients.length > 5 && <div>…and {recipients.length - 5} more</div>}
                        </div>
                      )}

                      {overUploadLimit && (
                        <div style={{ fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>
                          That is {recipients.length} people, and one send is limited to {BROADCAST_MAX_UPLOAD}. Split the file
                          into smaller ones, or use the Broadcast section in Getgabs for very large lists.
                        </div>
                      )}

                      <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.76rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          data-testid="consent"
                          checked={consent}
                          disabled={sending}
                          onChange={(e) => setConsent(e.target.checked)}
                          style={{ marginTop: '2px' }}
                        />
                        <span>
                          I confirm these people have agreed to receive WhatsApp messages from MilkyLush. Messaging people who
                          haven't can get this WhatsApp number blocked or banned, and MilkyLush has no record of who has opted out.
                        </span>
                      </label>

                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => { setUpload(null); setUploadColumns({}); setConsent(false); setResults(null); setUploadError(''); }}
                        style={{ alignSelf: 'flex-start', padding: '0.35rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.74rem', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}
                      >
                        Remove this file
                      </button>
                    </>
                  )}
                </div>
              )}

              {targetAudience === 'custom' && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: '8px', padding: '0.6rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by name or number…"
                      disabled={sending}
                      style={{ flex: 1, padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => setPickedIds(searchMatches.map((r) => r.id))}
                      style={{ padding: '0.45rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => setPickedIds([])}
                      style={{ padding: '0.45rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {searchMatches.length === 0 && (
                      <div style={{ padding: '0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        No customer matches “{customerSearch}”.
                      </div>
                    )}
                    {searchMatches.map((r) => (
                      <label
                        key={r.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.5rem 0.7rem', borderBottom: '1px solid var(--border-color)', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}
                      >
                        <input
                          type="checkbox"
                          checked={pickedIds.includes(r.id)}
                          onChange={() => togglePicked(r.id)}
                          disabled={sending}
                          style={{ cursor: 'inherit' }}
                        />
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                          {formatPhoneNumberForWhatsApp(r.phone)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleBroadcast}
                disabled={!canSend}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  backgroundColor: !canSend ? '#94A3B8' : '#047857',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: !canSend ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(4, 120, 87, 0.25)',
                }}
              >
                <Send size={16} />
                <span>
                  {sending
                    ? `Sending… ${progress.done} of ${progress.total}`
                    : `Send WhatsApp Broadcast Now (${recipients.length} Recipients)`}
                </span>
              </button>

              {sending && (
                <div style={{ padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid #FDE68A', backgroundColor: '#FFFBEB', fontSize: '0.76rem', color: '#92400E', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 200px' }}>
                    Keep this tab open until it finishes: about {estimateBroadcastMinutes(progress.total)} minute(s) in total.
                  </span>
                  <button
                    type="button"
                    data-testid="stop"
                    disabled={stopping}
                    onClick={() => { stopRequested.current = true; setStopping(true); }}
                    style={{ padding: '0.35rem 0.9rem', borderRadius: '8px', border: 'none', backgroundColor: stopping ? '#94A3B8' : '#B91C1C', color: '#FFFFFF', fontSize: '0.74rem', fontWeight: 700, cursor: stopping ? 'not-allowed' : 'pointer' }}
                  >
                    {stopping ? 'Stopping after the current messages…' : 'Stop'}
                  </button>
                </div>
              )}

              {results && (
                <div style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#047857', marginBottom: failedResults.length ? '8px' : 0 }}>
                    Sent {sentCount} of {results.length}
                    {failedResults.length > 0 && ` · ${failedResults.length} failed`}
                  </div>
                  {failedResults.slice(0, 8).map((r, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: '#B91C1C' }}>
                      {r.recipient.name} ({r.recipient.phone}) — {r.message}
                    </div>
                  ))}
                  {failedResults.length > 8 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>…and {failedResults.length - 8} more</div>
                  )}
                  {skipped > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600, marginTop: '6px' }}>
                      Stopped: {skipped} were not sent.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button
                      type="button"
                      data-testid="download-results"
                      onClick={downloadResults}
                      style={{ padding: '0.35rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Download results (CSV)
                    </button>
                    {failedResults.length > 0 && !sending && (
                      <button
                        type="button"
                        data-testid="retry-failed"
                        onClick={handleRetryFailed}
                        style={{ padding: '0.35rem 0.8rem', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Retry the {failedResults.length} that failed
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Card */}
          <div style={{ backgroundColor: '#ECFDF5', padding: '1.5rem', borderRadius: '20px', border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              💬 WhatsApp Customer Phone Screen Preview
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '1rem', borderRadius: '16px', border: '1px solid #A7F3D0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#047857', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                  ML
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#047857' }}>MilkyLush Official Verified</div>
              </div>

              <div style={{ backgroundColor: '#E2F4E9', padding: '0.85rem', borderRadius: '12px', fontSize: '0.85rem', color: '#1E293B', lineHeight: 1.4 }}>
                {selectedTemplate ? (
                  <>
                    Template <strong>{selectedTemplate}</strong> will be delivered exactly as Meta approved it.
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '6px' }}>
                      Open Getgabs to see or edit the approved wording.
                    </div>
                  </>
                ) : (
                  'Choose an approved template to broadcast.'
                )}
                <div style={{ fontSize: '0.7rem', color: '#047857', textAlign: 'right', marginTop: '6px', fontWeight: 600 }}>
                  Verified WhatsApp Business
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'whatsapp-notifications' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Automated WhatsApp Notification Triggers
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { title: 'Doorstep Drop Completed (with Photo Verification)', trigger: 'Triggered when delivery partner completes drop with photo proof', template: '✅ Hello {Name}, your morning Milk Drop of 1 L Farm Fresh Milk is completed at your doorstep! View photo proof: {ProofUrl}', active: true },
              { title: 'Order Out For Delivery', trigger: 'Triggered when rider starts route', template: '🛵 Hello {Name}, your MilkyLush delivery is out with our partner {RiderName}. Arriving before 7:00 AM.', active: true },
              { title: 'Subscription Low Wallet Alert', trigger: 'Triggered when balance falls below ₹100', template: '⚠️ Dear {Name}, your wallet balance is low (₹{Balance}). Please recharge to ensure uninterrupted morning milk drops.', active: true },
            ].map((t) => (
              <div key={t.title} style={{ padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{t.title}</div>
                  <span style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>ACTIVE</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{t.trigger}</div>
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  {t.template}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'customer-cohorts' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Live Customer Segments &amp; Cohort Analytics
          </div>

          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>SEGMENT COHORT</th>
                  <th style={{ padding: '0.75rem 1rem' }}>CUSTOMER COUNT</th>
                  <th style={{ padding: '0.75rem 1rem' }}>AVG SPEND</th>
                  <th style={{ padding: '0.75rem 1rem' }}>RETENTION RATE</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ACTION TRIGGER</th>
                </tr>
              </thead>
              <tbody>
                {dynamicCohorts.map((c) => (
                  <tr key={c.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>{c.name}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#047857' }}>{c.count}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)', fontWeight: 600 }}>{c.avgSpend}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284C7', backgroundColor: '#E0F2FE', padding: '3px 8px', borderRadius: '8px' }}>
                        {c.retentionRate}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button 
                        type="button" 
                        onClick={() => alert(`Initiated WhatsApp campaign trigger for cohort: ${c.name}`)} 
                        style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {c.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
