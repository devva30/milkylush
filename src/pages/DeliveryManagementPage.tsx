import { useState, useEffect } from 'react';
import { count, getAggregateFromServer, query, where } from 'firebase/firestore';
import { hubCol } from '../data/hubs';
import { formatDateTime } from '../data/dates';
import { 
  Truck, MapPin, Phone, CheckCircle, Clock, Navigation, Plus, ArrowLeft, 
  ShieldCheck, Star, CheckCircle2, X 
} from 'lucide-react';
import type { DeliveryAgent, Order } from '../types';
import { useToast } from '../context/ToastContext';
import { createRider } from '../data/staff';
import type { HubId } from '../data/hubs';
import { useDeliveries } from '../data/deliveries';
import { todayKey } from '../data/dates';

interface DeliveryManagementPageProps {
  hubDeliveryAgents: DeliveryAgent[];
  /** Unused: today's drops are read here. */
  hubOrders?: Order[];
  selectedHubId?: string;
}

export default function DeliveryManagementPage({ hubDeliveryAgents, selectedHubId }: DeliveryManagementPageProps) {
  const { showToast } = useToast();
  // Today's drops of this hub (live)
  const todayDrops = useDeliveries((selectedHubId ?? 'hosur') as HubId, todayKey());
  const [selectedAgent, setSelectedAgent] = useState<DeliveryAgent | null>(null);
  const [lifetimeDrops, setLifetimeDrops] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedAgent) return;
    let alive = true;
    setLifetimeDrops(null);
    getAggregateFromServer(query(hubCol((selectedHubId ?? 'hosur') as HubId, 'deliveries'),
      where('riderUid', '==', selectedAgent.id), where('status', '==', 'delivered')), { n: count() })
      .then((a) => alive && setLifetimeDrops(a.data().n))
      .catch(() => alive && setLifetimeDrops(0));
    return () => { alive = false; };
  }, [selectedAgent, selectedHubId]);

  // Add Partner Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');
  const [formVehicleType, setFormVehicleType] = useState('Electric Scooter');
  const [formLicenseNumber, setFormLicenseNumber] = useState('');
  const [formLicenseValidity, setFormLicenseValidity] = useState('');
  const [formHubId, setFormHubId] = useState(selectedHubId || 'hub_hosur');

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('');
    setFormAddress('');
    setFormVehicleNumber('');
    setFormVehicleType('Electric Scooter');
    setFormLicenseNumber('');
    setFormLicenseValidity('');
    setFormHubId(selectedHubId || 'hub_hosur');
  };

  const getEffectiveHubId = (hubId?: string) => {
    if (!hubId) return 'hub_hosur';
    const lower = hubId.toLowerCase();
    if (lower.includes('bengaluru') || lower.includes('blr') || lower.includes('bangalore')) {
      return 'bengaluru';
    }
    return 'hub_hosur';
  };

  const activeHubId = getEffectiveHubId(selectedHubId);
  const targetHubName = activeHubId === 'bengaluru' 
    ? 'Bengaluru Electronic City Hub (Bengaluru)' 
    : 'Hosur Central Hub (Hosur)';

  const handleAddDeliveryPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail) {
      showToast("Name, Phone, and Email are required", "error");
      return;
    }
    setIsSaving(true);
    try {
      const { staffCode } = await createRider(selectedHubId as HubId, {
        name: formName, phone: formPhone, email: formEmail, password: formPassword, address: formAddress,
        vehicleNumber: formVehicleNumber, vehicleType: formVehicleType,
        licenseNumber: formLicenseNumber, licenseValidity: formLicenseValidity,
      });
      showToast(`Delivery Partner "${formName}" registered as ${staffCode}. Share the email and password with the rider.`, "success");
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setIsSaving(false);
    }
  };


  const displayAgents: DeliveryAgent[] = hubDeliveryAgents || [];

  const activeAgentsCount = displayAgents.filter(a => a.isOnline).length;
  const totalFleetCount = displayAgents.length;
  const outForDeliveryOrders = todayDrops.data.filter(d => d.status === 'out_for_delivery').length;
  const deliveredOrders = todayDrops.data.filter(d => d.status === 'delivered').length;

  // Render Dedicated Driver Profile Sub-View if selected
  if (selectedAgent) {
    const isOnline = selectedAgent.isOnline;
    const isHosur = selectedAgent.assignedHubId === 'hosur';
    const hubName = isHosur ? 'Hosur Central Hub (Sector 1 & 2)' : 'Bangalore Electronic City Hub (Phase 1)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        
        {/* Driver Profile Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <button 
              onClick={() => setSelectedAgent(null)}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.45rem 0.85rem', borderRadius: '10px', marginBottom: '0.75rem' }}
            >
              <ArrowLeft size={16} /> Back to Delivery Fleet Dispatch
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: isOnline ? '#047857' : '#6B7280',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)'
              }}>
                {selectedAgent.name.slice(0, 2).toUpperCase()}
              </div>

              <div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedAgent.name} Profile
                  <span className={`badge ${isOnline ? 'badge-success' : 'badge-neutral'}`}>
                    {isOnline ? '🟢 On Duty (Online)' : '⚪ Off Duty (Offline)'}
                  </span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Partner ID: <strong>{selectedAgent.id}</strong> • Assigned Zone: <strong>{hubName}</strong>
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <a 
              href={`tel:${selectedAgent.phone}`}
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.6rem 1.15rem', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#FFFFFF', textDecoration: 'none' }}
            >
              <Phone size={16} /> Call Executive Partner
            </a>
            <button 
              onClick={() => showToast(`Updated duty status for ${selectedAgent.name}!`, "info")}
              className="btn-secondary"
              style={{ padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}
            >
              Toggle Duty Status
            </button>
          </div>
        </div>

        {/* 2-Column Driver Profile Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.5rem' }}>
          
          {/* LEFT COLUMN: Performance & Morning Route Manifest */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Performance KPI Grid */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Executive Partner Key Metrics</span>
                <ShieldCheck size={16} style={{ color: 'var(--primary)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TODAY'S DELIVERIES</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>{todayDrops.data.filter(d => d.riderUid === selectedAgent.id).length} Doorsteps</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>LIFETIME DELIVERIES</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{lifetimeDrops === null ? '…' : lifetimeDrops.toLocaleString('en-IN')} Doorsteps</div>
                </div>

                <div style={{ backgroundColor: '#ECFDF5', padding: '0.85rem', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={13} fill="#047857" /> RATING SCORE
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>No ratings yet</div>
                </div>
              </div>
            </div>

            {/* Morning Route Manifest Table */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Today's Assigned Route Stops (05:30 AM - 07:30 AM)</span>
                <Truck size={16} style={{ color: 'var(--primary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {todayDrops.data.filter(d => d.riderUid === selectedAgent.id).length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No drops assigned to this rider today.</div>
                )}
                {todayDrops.data
                  .filter(d => d.riderUid === selectedAgent.id)
                  .sort((a, b) => a.stopSeq - b.stopSeq)
                  .map((d, i) => (
                  <div key={d.id} style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: d.status === 'delivered' ? '#D1FAE5' : '#FEF3C7', color: d.status === 'delivered' ? '#047857' : '#D97706', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>{d.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.addressText.slice(0, 40)} • {d.items.map(it => `${it.qty}x ${it.name}`).join(', ')}</div>
                      </div>
                    </div>
                    {d.status === 'delivered' ? (
                      <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Delivered {d.deliveredAt ? formatDateTime(d.deliveredAt).split(', ').pop() : ''}
                      </span>
                    ) : d.status === 'out_for_delivery' ? (
                      <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> On Route
                      </span>
                    ) : (
                      <span className="badge badge-neutral">{d.status.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Vehicle Info & Live GPS Map Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card: Vehicle & License Details */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.85rem' }}>
                Vehicle &amp; Driving License Info
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vehicle Type:</span>
                  <span style={{ fontWeight: 700 }}>⚡ Electric EV Scooter</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>License Plate:</span>
                  <span style={{ fontWeight: 800, color: 'var(--primary)' }}>KA-05-EB-4921</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Driving License:</span>
                  <span style={{ fontWeight: 700 }}>DL-2024-884920</span>
                </div>
              </div>
            </div>

            {/* Card: Live GPS Rider Tracking Map */}
            <div className="card-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Live Rider GPS Tracking</span>
                <Navigation size={15} style={{ color: 'var(--primary)' }} />
              </div>

              <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <iframe
                  title="Live Rider GPS"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${(selectedAgent as { latitude?: number }).latitude != null ? `${(selectedAgent as { latitude?: number }).latitude},${(selectedAgent as { longitude?: number }).longitude}` : isHosur ? '12.742253,77.824213' : '12.867697,77.666721'}&z=14&output=embed`}
                />
              </div>

              <button 
                onClick={() => showToast((selectedAgent as { latitude?: number }).latitude != null ? `Showing ${selectedAgent.name}'s last location from the rider app.` : `${selectedAgent.name} has not shared a location yet (rider app, on duty).`, "info")}
                className="btn-secondary" 
                style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Navigation size={14} /> Refresh Live GPS Location
              </button>
            </div>

          </div>

        </div>

      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header Matching Screenshot 4 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Active Delivery Fleet
            </h2>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '12px' }}>
              Total Fleet: {totalFleetCount} | Online: {activeAgentsCount}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Monitor executive delivery partners, track morning route progress, and view partner profiles.
          </p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '0.6rem 1.15rem', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <Plus size={16} /> Add Delivery Partner
        </button>
      </div>

      {/* 3 Fleet Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', backgroundColor: '#ECFDF5', color: '#047857' }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ON-DUTY FLEET</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeAgentsCount} Executive Partners</div>
          </div>
        </div>

        <div className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', backgroundColor: '#FEF3C7', color: '#B45309' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TRANSIT DISPATCH</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#B45309' }}>{outForDeliveryOrders} Orders On Route</div>
          </div>
        </div>

        <div className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', backgroundColor: '#D1FAE5', color: '#047857' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DELIVERED TODAY</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857' }}>{deliveredOrders} Doorsteps Fulfilled</div>
          </div>
        </div>
      </div>

      {/* Delivery Fleet Partners Table / Cards */}
      <div className="card-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>DRIVER NAME</th>
                <th>PHONE</th>
                <th>ASSIGNED ZONE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {displayAgents.map(agent => (
                <tr key={agent.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: agent.isOnline ? '#047857' : '#6B7280',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{agent.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {agent.id}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      <Phone size={14} style={{ color: 'var(--primary)' }} />
                      <span>{agent.phone}</span>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{agent.assignedHubId === 'hosur' ? 'Hosur Sector 1 & 2' : 'Bangalore Electronic City Phase 1'}</span>
                    </div>
                  </td>

                  <td>
                    <span className={`badge ${agent.isOnline ? 'badge-success' : 'badge-neutral'}`}>
                      {agent.isOnline ? 'On Duty' : 'Off Duty'}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => setSelectedAgent(agent)}
                        className="btn-secondary" 
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none' }}
                      >
                        View Profile
                      </button>
                      <button 
                        onClick={() => showToast(`Pinging live location for ${agent.name}...`, "info")}
                        className="btn-secondary" 
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Navigation size={13} /> Live Location
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {displayAgents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No delivery agents found for active hub.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Delivery Partner Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowAddModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.5rem',
            width: '100%', maxWidth: '500px', textAlign: 'left', boxShadow: 'var(--shadow-xl)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.4rem', color: '#111827', margin: 0 }}>
                Register New Delivery Partner
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddDeliveryPartner} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Partner Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Mobile Phone Number *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Email Address (for App Login) *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. ramesh@milkylush.com"
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Login Password *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Vehicle Reg. Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formVehicleNumber}
                    onChange={(e) => setFormVehicleNumber(e.target.value)}
                    placeholder="e.g. TN 29 AB 4521"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Vehicle Type</label>
                  <select
                    className="form-select"
                    value={formVehicleType}
                    onChange={(e) => setFormVehicleType(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="Electric Scooter">Electric Scooter</option>
                    <option value="Motorbike">Motorbike</option>
                    <option value="EV Mini Van">EV Mini Van</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Driving License</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formLicenseNumber}
                    onChange={(e) => setFormLicenseNumber(e.target.value)}
                    placeholder="e.g. DL-90823411"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>License Validity</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formLicenseValidity}
                    onChange={(e) => setFormLicenseValidity(e.target.value)}
                    placeholder="e.g. Valid till 2030"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Assigned Operations Hub (Auto-Assigned)</label>
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <MapPin size={16} style={{ color: '#047857' }} />
                  {targetHubName}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSaving}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', backgroundColor: '#044E35', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {isSaving ? 'Registering...' : 'Create Delivery Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
