/**
 * Admin Panel API Service & Multi-Hub Provider Interface
 * Decouples Web Admin Panel from direct Firebase calls and enables hub-scoped data retrieval (Bangalore vs. Hosur).
 */

export interface Hub {
  id: string;
  code: string;
  name: string;
  cityName: string;
  state: string;
  isActive: boolean;
}

export const DEFAULT_HUBS: Hub[] = [
  {
    id: 'hub_all',
    code: 'ALL',
    name: 'All Hubs & Locations',
    cityName: 'All',
    state: 'All',
    isActive: true,
  },
  {
    id: 'hub_blr_ecity',
    code: 'BLR_ECITY_01',
    name: 'Bangalore - Electronic City Hub',
    cityName: 'Bangalore',
    state: 'Karnataka',
    isActive: true,
  },
  {
    id: 'hub_hosur_main',
    code: 'HOS_MAIN_01',
    name: 'Hosur - Central Hub',
    cityName: 'Hosur',
    state: 'Tamil Nadu',
    isActive: true,
  },
];

export interface AdminApiService {
  getProducts(hubId: string): Promise<any[]>;
  updateProductPrice(productId: string, hubId: string, price: number, memberPrice: number): Promise<void>;
  getOrders(hubId: string): Promise<any[]>;
  getDeliveryAgents(hubId: string): Promise<any[]>;
  getAnalytics(hubId: string): Promise<any>;
}

class RestAdminApiService implements AdminApiService {
  private baseUrl: string;

  constructor(baseUrl = 'https://api.milkylush.com/api/v1/admin') {
    this.baseUrl = baseUrl;
    console.log(`[Admin API] Initialized with endpoint: ${this.baseUrl}`);
  }

  async getProducts(hubId: string): Promise<any[]> {
    console.log(`[Admin API] Fetching products for hub: ${hubId}`);
    return [];
  }

  async updateProductPrice(productId: string, hubId: string, price: number, memberPrice: number): Promise<void> {
    console.log(`[Admin API] Updating product ${productId} price for hub ${hubId} to ₹${price} (Member: ₹${memberPrice})`);
  }

  async getOrders(hubId: string): Promise<any[]> {
    console.log(`[Admin API] Fetching orders for hub: ${hubId}`);
    return [];
  }

  async getDeliveryAgents(hubId: string): Promise<any[]> {
    console.log(`[Admin API] Fetching delivery agents for hub: ${hubId}`);
    return [];
  }

  async getAnalytics(hubId: string): Promise<any> {
    console.log(`[Admin API] Fetching analytics metrics for hub: ${hubId}`);
    return {};
  }
}

export const adminApiService = new RestAdminApiService();
