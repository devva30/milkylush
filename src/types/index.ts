export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  imageUrl: string;
  images?: string[];
  isSubscriptionEnabled: boolean;
  fatPercentage: string;
  shelfLife: string;
  farmSource: string;
  nutrients: Record<string, string>;
  rating: number;
  displayOrder?: number;
  offerTag?: string;
  isFeatured?: boolean;
  inStock?: boolean;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'coming_soon';
  stockQuantity?: number;
  guaranteeNote?: string;
  hubIds?: string[];
  outOfStockHubs?: string[];
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  walletBalance: number;
  ecoCreditsEarned: number;
  plasticSaved: number;
  emptyBottlesReturned: number;
  savedAddresses: string[];
  activeAddressIndex: number;
  hubId?: string;
  bottlesAtHome?: number;
  password?: string;
  createdAt?: string;
  assignedDeliveryAgentId?: string;
  assignedDeliveryAgentName?: string;
}

export type UserProfile = User;

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  isSubscription: boolean;
  subscriptionFrequency?: string;
  subscriptionCustomDays?: number[];
  subscriptionTiming?: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  proofImageUrl?: string;
  assignedPartner?: string;
  assignedRiderId?: string;
  assignedRiderEmail?: string;
  items: CartItem[];
  orderDate: string;
  estimatedDelivery?: string;
  totalAmount: number;
  status: 'packed' | 'outForDelivery' | 'delivered' | 'cancelled' | 'pending' | 'assigned';
  isSubscriptionDelivery?: boolean;
  orderType?: 'one-time' | 'subscription' | string;
  subscriptionId?: string;
  updatedAt?: string | number;
  bottlesReturned?: number;
  bottleCreditsApplied?: number;
  deliveryAgentId?: string;
  hubId?: string;
  address?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  userName?: string;
  customerName?: string;
  customerPhone?: string;
  product: Product;
  productName?: string;
  frequency: 'daily' | 'alternateDays' | 'customDays';
  customDays: number[];
  quantity: number;
  timing: 'morning' | 'evening';
  startDate: string;
  status: 'active' | 'paused' | 'cancelled';
  pausedDates: string[];
  vacationStart?: string;
  vacationEnd?: string;
  planDuration?: string;
  endDate?: string;
  prepaidAmountPaid?: number;
  hubId?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
}

export interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  tag: string;
  imageUrl: string;
  displayOrder: number;
  iconName: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  assignedZone?: string;
  vehicle?: string;
  hubId?: string;
  assignedHubId?: string;
  isOnline: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface Hub {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: string;
  longitude: string;
  serviceRadiusKm: number;
  isActive: boolean;
  deliverySlots: string[];
}

export interface Banner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  active: boolean;
  targetProductId?: string;
}

export interface DeliveryProof {
  id: string;
  orderId: string;
  customerName: string;
  agentName: string;
  photoUrl: string;
  deliveredAt: string;
  status: 'verified' | 'pending';
  hubId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  details: string;
  hubId?: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: 'wallet_recharge' | 'order_payment' | 'bottle_credit' | 'refund';
  status: 'success' | 'pending' | 'failed';
  date: string;
  paymentMethod: string;
  referenceId: string;
  hubId?: string;
}

export interface PrepaidPackage {
  id: string;
  name: string;
  title?: string;
  durationDays: number;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  badgeLabel?: string;
  displayOrder?: number;
  isRecommended?: boolean;
  isActive?: boolean;
  description?: string;
  hubId?: string;
  productId?: string;
  productName?: string;
}

export interface BottleRecordItem {
  id: string;
  customerId?: string;
  customerName: string;
  phone: string;
  address: string;
  route?: string;
  assignedRider?: string;
  issuedCount: number;
  returnedCount: number;
  pendingCount: number;
  damagedCount: number;
  lastCollectedDate: string;
  hubId?: string;
}

export interface AdminAuditLogItem {
  id: string;
  timestamp: string;
  adminName: string;
  adminEmail: string;
  adminRole: 'Super Admin' | 'Hub Manager' | 'Inventory Lead' | 'Finance Admin';
  category: 'Security & Login' | 'Catalog & Pricing' | 'Hub Operations' | 'Financials & Refunds' | 'User Roles';
  actionSummary: string;
  targetEntity: string;
  ipAddress: string;
  deviceSession: string;
  payloadJson?: string;
  hubId?: string;
}

export interface Farmer {
  id: string;
  code: string;
  name: string;
  phone: string;
  village: string;
  hubId: string;
  dailySupplyLiters: number;
  bankAccount?: string;
  ifscCode?: string;
  upiId?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface MilkProcurementItem {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerCode: string;
  date: string;
  quantityLiters: number;
  fatPercent: number;
  snfPercent: number;
  ratePerLiter: number;
  totalPayout: number;
  hubId: string;
  collectionPerson: string;
  paymentStatus: 'pending' | 'paid';
  createdAt: string;
}

export type TabType = 
  | 'dashboard' 
  | 'todays-deliveries' 
  | 'all-deliveries' 
  | 'analysis' 
  | 'orders' 
  | 'subscriptions' 
  | 'customers' 
  | 'service-area' 
  | 'products' 
  | 'delivery' 
  | 'user-control' 
  | 'payments' 
  | 'mobile-control' 
  | 'refer-earn' 
  | 'prepaid-subscriptions' 
  | 'manage-subscriptions'
  | 'bottle-management'
  | 'audit-logs' 
  | 'delivered-history' 
  | 'admin-access' 
  | 'settings'
  | 'portal-gateway';


