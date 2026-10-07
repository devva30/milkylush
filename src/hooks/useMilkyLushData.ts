import { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { sendWelcomeToNewCustomer, NOTHING_TO_DO } from '../services/whatsappService';
import type { Product, User, Order, Subscription, DeliveryAgent, Banner, OnboardingSlide, PrepaidPackage, AdminAuditLogItem, BottleRecordItem } from '../types';

export const DEFAULT_CATALOG_PRODUCTS: Product[] = [];
/*
const OLD_PRODUCTS = [

    name: 'Raw Cow Milk (1L)',
    description: 'Raw, Organic farm-fresh unpasteurized cow milk delivered in eco glass bottles.',
    category: 'Milk',
    price: 76,
    unit: '1L Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    isGlassBottle: true,
    fatPercentage: '3.8%',
    shelfLife: '48 Hours',
    farmSource: 'MilkyLush Eco Farm',
    nutrients: { Calcium: '125 mg / 100ml', Protein: '3.4 g / 100ml', Fat: '3.8%' },
    rating: 4.9,
    displayOrder: 1,
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_raw_milk_500ml',
    name: 'Raw Cow Milk (500ml)',
    description: 'Raw, Organic farm-fresh unpasteurized cow milk delivered in eco glass bottles.',
    category: 'Milk',
    price: 38,
    unit: '500ml Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    isGlassBottle: true,
    fatPercentage: '3.8%',
    shelfLife: '48 Hours',
    farmSource: 'MilkyLush Eco Farm',
    nutrients: { Calcium: '125 mg / 100ml', Protein: '3.4 g / 100ml', Fat: '3.8%' },
    rating: 4.9,
    displayOrder: 2,
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_desi_ghee_500ml',
    name: 'Desi Ghee (500ml)',
    description: 'Pure Ghee made from traditional bilona churned fresh cream.',
    category: 'Ghee',
    price: 599,
    originalPrice: 649,
    unit: '500ml Glass Jar',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    fatPercentage: '99.8%',
    shelfLife: '12 Months',
    farmSource: 'Vedic Bilona Haven',
    rating: 5.0,
    displayOrder: 3,
    offerTag: 'SPECIAL OFFER • 8% OFF',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_desi_ghee_250ml',
    name: 'Desi Ghee (250ml)',
    description: 'Pure Ghee made from traditional bilona churned fresh cream.',
    category: 'Ghee',
    price: 299,
    originalPrice: 325,
    unit: '250ml Glass Jar',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    fatPercentage: '99.8%',
    shelfLife: '12 Months',
    farmSource: 'Vedic Bilona Haven',
    rating: 5.0,
    displayOrder: 4,
    offerTag: 'SPECIAL OFFER • 8% OFF',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_curd_500ml',
    name: 'Curd',
    description: 'Set Curd naturally prepared in clay pots.',
    category: 'Curd',
    price: 49,
    unit: '500ml',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    isGlassBottle: false,
    shelfLife: '5 Days',
    farmSource: 'MilkyLush Dairy Kitchen',
    rating: 4.8,
    displayOrder: 5,
    offerTag: 'Coming Soon',
    inStock: false,
  },
  {
    id: 'prod_fresh_paneer_200g',
    name: 'Fresh Paneer (200g)',
    description: 'Soft Malai Paneer made fresh daily.',
    category: 'Paneer',
    price: 159,
    originalPrice: 179,
    unit: '200g Eco Pack',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    shelfLife: '5 Days',
    farmSource: 'MilkyLush Dairy Kitchen',
    rating: 4.9,
    displayOrder: 6,
    offerTag: 'SPECIAL OFFER • 11% OFF',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_coconut_oil_1l',
    name: 'Wood Pressed Coconut Oil (1L)',
    description: 'Pure & Natural cold-pressed unrefined virgin coconut oil.',
    category: 'Oils',
    price: 599,
    originalPrice: 699,
    unit: '1L Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    rating: 4.9,
    displayOrder: 7,
    offerTag: 'SPECIAL OFFER • 14% OFF',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_groundnut_oil_1l',
    name: 'Wood Pressed Groundnut Oil (1L)',
    description: 'Pure & Natural cold-pressed groundnut oil.',
    category: 'Oils',
    price: 399,
    originalPrice: 499,
    unit: '1L Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    rating: 4.8,
    displayOrder: 8,
    offerTag: 'SPECIAL OFFER • 20% OFF',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_mustard_oil_1l',
    name: 'Wood Pressed Mustard Oil',
    description: 'Pure & Natural cold-pressed authentic mustard oil.',
    category: 'Oils',
    price: 199,
    unit: '1L Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    rating: 4.7,
    displayOrder: 9,
    offerTag: 'Coming Soon',
    inStock: false,
  },
  {
    id: 'prod_scrubber_pack',
    name: 'Eco-friendly Scrubber',
    description: 'Sustainable Choice natural coconut coir kitchen scrubber.',
    category: 'Eco Essentials',
    price: 29,
    unit: 'Pack of 5',
    imageUrl: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    isGlassBottle: false,
    rating: 4.9,
    displayOrder: 10,
    offerTag: 'Coming Soon',
    inStock: false,
  }
];
*/

export const DEFAULT_PREPAID_PACKAGES: PrepaidPackage[] = [
  {
    id: 'pkg_15days',
    name: '15 Days Starter Pack',
    title: '15 Days Starter Pack',
    price: 1650,
    durationDays: 15,
    discountPercent: 0,
    badgeLabel: '',
    displayOrder: 1,
    isRecommended: false,
    isActive: true,
    hubId: 'all',
  },
  {
    id: 'pkg_30days',
    name: '30 Days Gold Monthly Plan',
    title: '30 Days Gold Monthly Plan',
    price: 2970,
    durationDays: 30,
    discountPercent: 10,
    badgeLabel: '10% OFF',
    displayOrder: 2,
    isRecommended: true,
    isActive: true,
    hubId: 'all',
  },
  {
    id: 'pkg_90days',
    name: '90 Days Elite Value Plan',
    title: '90 Days Elite Value Plan',
    price: 8415,
    durationDays: 90,
    discountPercent: 15,
    badgeLabel: '15% OFF',
    displayOrder: 3,
    isRecommended: false,
    isActive: true,
    hubId: 'all',
  },
];

export function useMilkyLushData(selectedHubId: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const [onboardingSlides, setOnboardingSlides] = useState<OnboardingSlide[]>([]);
  const [prepaidPackages, setPrepaidPackages] = useState<PrepaidPackage[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [bottleRecords, setBottleRecords] = useState<BottleRecordItem[]>([]);
  const [farmers, setFarmers] = useState<import('../types').Farmer[]>([]);
  const [milkProcurements, setMilkProcurements] = useState<import('../types').MilkProcurementItem[]>([]);

  const [deliverySettings, setDeliverySettings] = useState<{
    address: string;
    hubLatitude: string;
    hubLongitude: string;
    radiusKm: string;
  }>({
    address: 'Electronic City, Bengaluru',
    hubLatitude: '12.8676977',
    hubLongitude: '77.6667214',
    radiusKm: '5.0',
  });
  const [loading, setLoading] = useState<boolean>(true);

  const isCurrentHosur = selectedHubId.includes('hosur');

  useEffect(() => {
    const unsubFarmers = onSnapshot(collection(db, 'farmers'), (snapshot) => {
      const items: import('../types').Farmer[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as import('../types').Farmer);
      });
      setFarmers(items);
    });

    const unsubProcurement = onSnapshot(collection(db, 'milk_procurement'), (snapshot) => {
      const items: import('../types').MilkProcurementItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as import('../types').MilkProcurementItem);
      });
      items.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setMilkProcurements(items);
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      items.sort((a, b) => {
        const diff = (Number(a.displayOrder) || 999) - (Number(b.displayOrder) || 999);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
      setProducts(items);
    });

    // Customers already registered when this panel opened, and customers whose
    // signup this panel witnessed. Most user docs have no usable createdAt, so
    // new signups are identified by tracking them here rather than by timestamp.
    const existingUserIds = new Set<string>();
    const newSignupIds = new Set<string>();
    let primedExistingUsers = false;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items: User[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as User);
      });
      setUsers(items);

      // The first snapshot is the existing customer base. Recording it, and
      // greeting nobody, is what stops those customers being messaged.
      if (!primedExistingUsers) {
        snapshot.forEach((docSnap) => existingUserIds.add(docSnap.id));
        primedExistingUsers = true;
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;

        const userId = change.doc.id;
        if (existingUserIds.has(userId)) continue;
        if (change.type === 'added') newSignupIds.add(userId);
        if (!newSignupIds.has(userId)) continue;

        const user = change.doc.data() as User & {
          welcomeWhatsappStatus?: string;
          welcomeWhatsappSent?: boolean;
        };
        if (user.welcomeWhatsappStatus || user.welcomeWhatsappSent) continue;

        // A manual signup has a phone and gets WhatsApp; a Google signup has only
        // an email and gets the welcome mail. With neither there is nothing to
        // send yet, so wait: the next update re-delivers this document.
        if (!(user.phone || (user as any).phoneNumber || (user as any).mobile || user.email)) continue;

        sendWelcomeToNewCustomer(userId)
          .then(({ sent, channel, reason }) => {
            if (sent) console.log(`[MilkyLush] welcome ${channel} sent to ${user.name}`);
            else if (reason !== NOTHING_TO_DO) {
              console.warn(`[MilkyLush] welcome ${channel} failed for ${user.name}: ${reason}`);
            }
          })
          .catch((err) => console.error('[MilkyLush] welcome error:', err));
      }
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const items: Order[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      items.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setOrders(items);
    });

    const unsubSubs = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      const items: Subscription[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Subscription);
      });
      setSubscriptions(items);
    });

    const unsubBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      const items: Banner[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Banner);
      });
      items.sort((a, b) => (Number(a.displayOrder) || 99) - (Number(b.displayOrder) || 99));
      setBanners(items);
    });

    const unsubAgents = onSnapshot(collection(db, 'delivery_agents'), (snapshot) => {
      const items: DeliveryAgent[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as DeliveryAgent);
      });
      setDeliveryAgents(items);
    });

    const unsubOnboarding = onSnapshot(collection(db, 'onboarding'), (snapshot) => {
      const items: OnboardingSlide[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as OnboardingSlide);
      });
      items.sort((a, b) => (Number(a.displayOrder) || 99) - (Number(b.displayOrder) || 99));
      setOnboardingSlides(items);
    });

    const unsubPackages = onSnapshot(collection(db, 'subscription_plans'), async (snapshot) => {
      const items: PrepaidPackage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.title || data.name || 'Plan',
          title: data.title || data.name || 'Plan',
          price: data.price || 0,
          durationDays: data.durationDays || 30,
          discountPercent: data.discountPercent !== undefined ? data.discountPercent : (data.discountPercentage || 0),
          badgeLabel: data.badgeLabel || data.badgeText || '',
          displayOrder: data.displayOrder || 1,
          isRecommended: !!data.isRecommended,
          isActive: data.active !== undefined ? data.active : (data.isActive ?? true),
          hubId: data.hubId || 'all',
        } as PrepaidPackage);
      });

      const existingIds = items.map((i) => i.id);
      for (const pkg of DEFAULT_PREPAID_PACKAGES) {
        if (!existingIds.includes(pkg.id)) {
          try {
            const planData = {
              id: pkg.id,
              title: pkg.title,
              name: pkg.name,
              price: pkg.price,
              durationDays: pkg.durationDays,
              discountPercent: pkg.discountPercent,
              discountPercentage: pkg.discountPercent,
              badgeLabel: pkg.badgeLabel,
              badgeText: pkg.badgeLabel,
              displayOrder: pkg.displayOrder,
              isRecommended: pkg.isRecommended,
              active: pkg.isActive,
              isActive: pkg.isActive,
              hubId: pkg.hubId,
            };
            await setDoc(doc(db, 'subscription_plans', pkg.id), planData);
            await setDoc(doc(db, 'prepaid_packages', pkg.id), pkg);
          } catch (e) {
            console.error('Error seeding missing prepaid package:', e);
          }
        }
      }

      items.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
      setPrepaidPackages(items);
    });

    const unsubAuditLogs = onSnapshot(collection(db, 'admin_audit_logs'), (snapshot) => {
      const items: AdminAuditLogItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as AdminAuditLogItem);
      });
      setAdminAuditLogs(items);
    });

    const unsubBottleRecords = onSnapshot(collection(db, 'bottle_tracking'), (snapshot) => {
      const items: BottleRecordItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as BottleRecordItem);
      });
      setBottleRecords(items);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', `delivery_${selectedHubId}`), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDeliverySettings({
          address: data.address || (isCurrentHosur ? 'Plot 45, Sipcot Industrial Complex Phase 1, Hosur - 635126' : 'Building 12, Electronics City Phase 1, Bengaluru, Karnataka 560100'),
          hubLatitude: data.hubLatitude !== undefined ? String(data.hubLatitude) : (isCurrentHosur ? '12.742253' : '12.8676977'),
          hubLongitude: data.hubLongitude !== undefined ? String(data.hubLongitude) : (isCurrentHosur ? '77.824213' : '77.6667214'),
          radiusKm: data.radiusKm !== undefined ? String(data.radiusKm) : (isCurrentHosur ? '15.0' : '5.0'),
        });
      } else {
        setDeliverySettings({
          address: isCurrentHosur ? 'Plot 45, Sipcot Industrial Complex Phase 1, Hosur - 635126' : 'Building 12, Electronics City Phase 1, Bengaluru, Karnataka 560100',
          hubLatitude: isCurrentHosur ? '12.742253' : '12.8676977',
          hubLongitude: isCurrentHosur ? '77.824213' : '77.6667214',
          radiusKm: isCurrentHosur ? '15.0' : '5.0',
        });
      }
      setLoading(false);
    });

    return () => {
      unsubFarmers();
      unsubProcurement();
      unsubProducts();
      unsubUsers();
      unsubOrders();
      unsubSubs();
      unsubBanners();
      unsubAgents();
      unsubOnboarding();
      unsubPackages();
      unsubAuditLogs();
      unsubBottleRecords();
      unsubSettings();
    };
  }, [selectedHubId, isCurrentHosur]);

  // Hub Scoped Collections
  const hubOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.hubId) return o.hubId === selectedHubId;
      const addr = (o.address || '').toLowerCase();
      const isHosurAddr = addr.includes('hosur') || addr.includes('tamil nadu') || addr.includes('tn');
      return isCurrentHosur ? isHosurAddr : !isHosurAddr;
    });
  }, [orders, selectedHubId, isCurrentHosur]);

  const hubUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.hubId) return u.hubId === selectedHubId;
      const addrList = (u.savedAddresses || []).join(' ').toLowerCase();
      const isHosurAddr = addrList.includes('hosur') || addrList.includes('tamil nadu') || addrList.includes('tn');
      return isCurrentHosur ? isHosurAddr : !isHosurAddr;
    });
  }, [users, selectedHubId, isCurrentHosur]);

  const hubSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => {
      if (s.hubId) return s.hubId === selectedHubId;
      const addr = (s.deliveryAddress || '').toLowerCase();
      const isHosurAddr = addr.includes('hosur') || addr.includes('tamil nadu') || addr.includes('tn');
      return isCurrentHosur ? isHosurAddr : !isHosurAddr;
    });
  }, [subscriptions, selectedHubId, isCurrentHosur]);

  const hubDeliveryAgents = useMemo(() => {
    return deliveryAgents.filter((a) => {
      if (a.hubId || a.assignedHubId) return (a.hubId || a.assignedHubId) === selectedHubId;
      const zone = (a.assignedZone || a.name || '').toLowerCase();
      const isHosurZone = zone.includes('hosur') || zone.includes('tn');
      return isCurrentHosur ? isHosurZone : !isHosurZone;
    });
  }, [deliveryAgents, selectedHubId, isCurrentHosur]);

  const hubFarmers = useMemo(() => {
    return farmers.filter((f) => {
      if (!f.hubId || f.hubId === 'all') return true;
      return f.hubId === selectedHubId;
    });
  }, [farmers, selectedHubId]);

  const hubMilkProcurements = useMemo(() => {
    return milkProcurements.filter((m) => {
      if (!m.hubId || m.hubId === 'all') return true;
      return m.hubId === selectedHubId;
    });
  }, [milkProcurements, selectedHubId]);

  const hubBanners = useMemo(() => {
    return banners.filter((b) => {
      const hIds = (b as any).hubIds || (b as any).hubs || [];
      if (!hIds || hIds.length === 0 || hIds.includes('all')) return true;
      return hIds.includes(selectedHubId);
    });
  }, [banners, selectedHubId]);

  const hubProducts = useMemo(() => {
    return products.filter((p) => {
      const outOfStock = (p as any).outOfStockHubs || [];
      if (outOfStock.includes(selectedHubId)) return false;
      const hIds = (p as any).hubIds || [];
      if (!hIds || hIds.length === 0 || hIds.includes('all')) return true;
      return hIds.includes(selectedHubId);
    });
  }, [products, selectedHubId]);

  const hubPrepaidPackages = useMemo(() => {
    return prepaidPackages.filter((pkg) => {
      const pkgHub = (pkg as any).hubId || (pkg as any).assignedHubId;
      if (!pkgHub || pkgHub === 'all') return true;
      return pkgHub === selectedHubId;
    });
  }, [prepaidPackages, selectedHubId]);

  const totalRevenue = useMemo(() => {
    return hubOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [hubOrders]);

  return {
    products,
    users,
    orders,
    subscriptions,
    banners,
    deliveryAgents,
    onboardingSlides,
    prepaidPackages,
    adminAuditLogs,
    bottleRecords,
    farmers,
    milkProcurements,
    deliverySettings,
    hubOrders,
    hubUsers,
    hubSubscriptions,
    hubDeliveryAgents,
    hubFarmers,
    hubMilkProcurements,
    hubBanners,
    hubProducts,
    hubPrepaidPackages,
    totalRevenue,
    loading,
  };
}
