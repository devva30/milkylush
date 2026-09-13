import { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product, User, Order, Subscription, DeliveryAgent, Banner, OnboardingSlide, PrepaidPackage, AdminAuditLogItem, BottleRecordItem } from '../types';

export const DEFAULT_CATALOG_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Fresh Organic Buffalo Milk',
    description: 'Creamy, rich, and high-fat organic buffalo milk sourced daily from eco-dairy farms.',
    category: 'Milk',
    price: 110,
    unit: '750ml Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    fatPercentage: '6.5%',
    shelfLife: '48 Hours',
    farmSource: 'Green Valley Eco-Farms',
    nutrients: { Calcium: '135 mg / 100ml', Energy: '98 Kcal / 100ml', 'Fat Content': '6.5%', Phosphorus: '90 mg', Protein: '3.8 g / 100ml' },
    rating: 4.9,
    displayOrder: 1,
    offerTag: '10% OFF',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_2',
    name: 'Pure Desi Cow A2 Milk',
    description: 'Farm-fresh A2 Desi Cow milk, 100% natural and unadulterated in glass bottle.',
    category: 'Milk',
    price: 95,
    unit: '1000ml Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    fatPercentage: '4.2%',
    shelfLife: '48 Hours',
    farmSource: 'Gir Cow Sanctuary',
    nutrients: { Calcium: '120 mg / 100ml', Energy: '68 Kcal / 100ml', 'Fat Content': '4.2%', Protein: '3.4 g / 100ml' },
    rating: 4.8,
    displayOrder: 2,
    offerTag: 'POPULAR',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_3',
    name: 'Fresh Artisanal Paneer',
    description: 'Soft, fresh, hand-churned cottage cheese made daily from pure whole milk.',
    category: 'Paneer',
    price: 140,
    unit: '200g Eco Pack',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    fatPercentage: 'Protein Rich',
    shelfLife: '5 Days',
    farmSource: 'MilkyLush Dairy Kitchen',
    nutrients: { Protein: '18 g / 100g', Calcium: '208 mg / 100g' },
    rating: 4.9,
    displayOrder: 3,
    offerTag: 'FRESH DAILY',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_4',
    name: 'Pure Organic Cow Ghee',
    description: 'Traditional Bilona method golden cow ghee with rich aroma and granular texture.',
    category: 'Ghee',
    price: 650,
    unit: '500ml Glass Jar',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    fatPercentage: '99.8%',
    shelfLife: '12 Months',
    farmSource: 'Vedic Bilona Haven',
    nutrients: { Energy: '899 Kcal / 100g', 'Fat Content': '99.8%' },
    rating: 5.0,
    displayOrder: 4,
    offerTag: 'BILONA METHOD',
    isFeatured: true,
    inStock: true,
  },
  {
    id: 'prod_5',
    name: 'Thick Malai Curd',
    description: 'Traditional thick set curd with natural cream top made in clay pots.',
    category: 'Curd',
    price: 60,
    unit: '500g Eco Pot',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    fatPercentage: '4.5%',
    shelfLife: '7 Days',
    farmSource: 'MilkyLush Dairy Kitchen',
    nutrients: { Calcium: '150 mg / 100g', Protein: '4.2 g / 100g' },
    rating: 4.7,
    displayOrder: 5,
    offerTag: 'PROBIOTIC',
    isFeatured: false,
    inStock: true,
  },
  {
    id: 'prod_6',
    name: 'Royal Badam Flavored Milk',
    description: 'Chilled whole milk infused with real California almonds, saffron, and cardamom.',
    category: 'Flavored Milk',
    price: 50,
    unit: '200ml Glass Bottle',
    imageUrl: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1577805947697-89e18249d767?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: true,
    fatPercentage: '3.5%',
    shelfLife: '7 Days',
    farmSource: 'MilkyLush Specialty',
    nutrients: { Energy: '110 Kcal / 100ml', Protein: '3.5 g / 100ml' },
    rating: 4.9,
    displayOrder: 6,
    offerTag: 'REAL ALMONDS',
    isFeatured: false,
    inStock: true,
  },
  {
    id: 'prod_7',
    name: 'Fresh Farm Table Butter',
    description: 'Unsalted, pure yellow farm butter churned from fresh cream.',
    category: 'Butter',
    price: 160,
    unit: '250g Eco Pack',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop',
    images: ['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop'],
    isSubscriptionEnabled: false,
    fatPercentage: '80%',
    shelfLife: '30 Days',
    farmSource: 'Green Valley Eco-Farms',
    nutrients: { Energy: '717 Kcal / 100g', 'Fat Content': '80%' },
    rating: 4.8,
    displayOrder: 7,
    offerTag: 'FRESH CHURNED',
    isFeatured: false,
    inStock: true,
  }
];

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

  const isCurrentHosur = selectedHubId === 'hub_hosur_main';

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
      if (items.length === 0) {
        setProducts(DEFAULT_CATALOG_PRODUCTS);
      } else {
        items.sort((a, b) => {
          const diff = (Number(a.displayOrder) || 999) - (Number(b.displayOrder) || 999);
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name);
        });
        setProducts(items);
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items: User[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as User);
      });
      setUsers(items);
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

    const unsubSettings = onSnapshot(doc(db, 'settings', 'delivery'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDeliverySettings({
          address: data.address || '',
          hubLatitude: data.hubLatitude !== undefined ? String(data.hubLatitude) : '12.8676977',
          hubLongitude: data.hubLongitude !== undefined ? String(data.hubLongitude) : '77.6667214',
          radiusKm: data.radiusKm !== undefined ? String(data.radiusKm) : '5.0',
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
  }, []);

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
    const sourceProducts = products.length > 0 ? products : DEFAULT_CATALOG_PRODUCTS;
    return sourceProducts.filter((p) => {
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
