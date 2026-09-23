import { useState, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, 
  ChevronUp, ChevronDown 
} from 'lucide-react';
import type { Product } from '../types';
import { DEFAULT_CATALOG_PRODUCTS } from '../hooks/useMilkyLushData';

interface ProductsPageProps {
  selectedHubId?: string;
  products: Product[];
  onOpenAddProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onToggleStock: (productId: string, currentStock: boolean) => void;
  onDeleteProduct: (productId: string) => void;
  onSaveProduct?: (product: Partial<Product>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function getDiscountedPrice(price: number, offerTag?: string): number {
  if (!offerTag || !offerTag.trim()) return price;
  const tag = offerTag.trim();
  const pctMatch = tag.match(/(\d+)\s*%/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    if (pct > 0) return Math.round(price * (1 - pct / 100));
  }
  const flatMatch = tag.match(/(?:₹|rs\.?|flat)?\s*(\d+)\s*(?:off|discount)?/i);
  if (flatMatch) {
    const amt = parseFloat(flatMatch[1]);
    if (amt > 0 && amt < price) return Math.round(price - amt);
  }
  return price;
}

export default function ProductsPage({
  selectedHubId = 'hub_hosur_main',
  products,
  onToggleStock,
  onDeleteProduct,
  onSaveProduct,
  showToast,
}: ProductsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [categoriesList, setCategoriesList] = useState<string[]>([
    'All', 'Milk', 'Flavored Milk', 'Butter', 'Paneer', 'Curd', 'Ghee'
  ]);

  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>(['All', 'Milk', 'Flavored Milk', 'Butter', 'Paneer', 'Curd', 'Ghee']);
    categoriesList.forEach((c) => cats.add(c));
    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [products, categoriesList]);

  // Form state for Edit Product Specs
  const [formData, setFormData] = useState<Partial<Product> & { img2?: string; img3?: string; img4?: string }>({
    name: '',
    description: '',
    category: 'Milk',
    price: 110,
    unit: '750ml Glass Bottle',
    displayOrder: 1,
    fatPercentage: '6.5%',
    shelfLife: '48 Hours',
    farmSource: 'Green Valley Eco-Farms',
    offerTag: '',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop',
    img2: '',
    img3: '',
    img4: '',
    isSubscriptionEnabled: true,
    isFeatured: true,
    inStock: true,
    stockStatus: 'in_stock',
    stockQuantity: 20,
    nutrients: {}
  });

  const startEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setIsCreatingNew(false);
    const imgs = prod.images || [];
    const initialQty = prod.stockQuantity !== undefined ? prod.stockQuantity : (prod.inStock === false ? 0 : 20);
    const initialStatus = prod.stockStatus || (initialQty > 5 ? 'in_stock' : (initialQty > 0 ? 'limited_stock' : 'out_of_stock'));
    setFormData({
      ...prod,
      displayOrder: prod.displayOrder ?? 1,
      fatPercentage: prod.fatPercentage ?? '',
      shelfLife: prod.shelfLife ?? '',
      farmSource: prod.farmSource ?? '',
      offerTag: prod.offerTag ?? '',
      imageUrl: prod.imageUrl || imgs[0] || '',
      img2: imgs[1] || '',
      img3: imgs[2] || '',
      img4: imgs[3] || '',
      stockQuantity: initialQty,
      stockStatus: initialStatus,
      nutrients: prod.nutrients ? { ...prod.nutrients } : {}
    });
  };

  const startCreateProduct = () => {
    setIsCreatingNew(true);
    setEditingProduct(null);
    setFormData({
      id: `prod_${Date.now()}`,
      name: '',
      description: '',
      category: 'Milk',
      price: 110,
      unit: '750ml Glass Bottle',
      displayOrder: products.length + 1,
      fatPercentage: '6.5%',
      shelfLife: '48 Hours',
      farmSource: 'Green Valley Eco-Farms',
      offerTag: '',
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop',
      img2: '',
      img3: '',
      img4: '',
      isSubscriptionEnabled: true,
      isFeatured: false,
      inStock: true,
      stockStatus: 'in_stock',
      stockQuantity: 20,
      nutrients: {}
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Please enter a product name', 'error');
      return;
    }

    const imagesList = [
      formData.imageUrl,
      formData.img2,
      formData.img3,
      formData.img4,
    ].filter((u) => u && typeof u === 'string' && u.trim().length > 0) as string[];

    const finalNutrients: Record<string, string> = {};
    if (formData.nutrients) {
      Object.entries(formData.nutrients).forEach(([k, v]) => {
        if (v && String(v).trim().length > 0) {
          finalNutrients[k] = String(v).trim();
        }
      });
    }

    const qty = formData.stockQuantity !== undefined ? formData.stockQuantity : 20;
    let computedStatus = formData.stockStatus;
    if (computedStatus !== 'coming_soon') {
      if (qty > 5) computedStatus = 'in_stock';
      else if (qty > 0) computedStatus = 'limited_stock';
      else computedStatus = 'out_of_stock';
    }

    const isInStockBool = computedStatus === 'in_stock' || computedStatus === 'limited_stock';

    const payload: Partial<Product> = {
      ...formData,
      imageUrl: formData.imageUrl || (imagesList.length > 0 ? imagesList[0] : ''),
      images: imagesList,
      nutrients: finalNutrients,
      stockQuantity: qty,
      stockStatus: computedStatus,
      inStock: isInStockBool,
      hubIds: [selectedHubId],
    };
    delete (payload as any).img2;
    delete (payload as any).img3;
    delete (payload as any).img4;

    if (onSaveProduct) {
      onSaveProduct(payload);
    } else {
      showToast(`Saved specs for "${formData.name}"!`, 'success');
    }
    setEditingProduct(null);
    setIsCreatingNew(false);
  };

  // Render Full-Screen / Sub-View: Edit Product Specs matching Screenshots 3 & 4
  if (editingProduct || isCreatingNew) {
    const titleText = isCreatingNew ? 'Add New Product Specs' : `Edit ${editingProduct?.name} Specs`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        
        {/* Header Bar matching Screenshot 3 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => { setEditingProduct(null); setIsCreatingNew(false); }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#111827',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Back to Product Inventory
          </button>
          
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            {titleText}
          </h2>
        </div>

        {/* Edit Form Card matching Screenshots 3 & 4 */}
        <form onSubmit={handleSaveForm} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.75rem', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Product Name */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Product Name</label>
            <input 
              type="text" 
              value={formData.name || ''} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Fresh Organic Buffalo Milk"
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', fontWeight: 600 }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Description</label>
            <textarea 
              rows={3}
              value={formData.description || ''} 
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Creamy, rich, and high-fat organic buffalo milk..."
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {/* Product Category & New Category Option */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151' }}>Product Category</label>
              <button 
                type="button"
                onClick={() => setShowAddCategoryModal(true)}
                style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✨ + Create New Category
              </button>
            </div>
            <select 
              value={formData.category || 'Milk'} 
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', backgroundColor: '#FFFFFF', cursor: 'pointer', fontWeight: 600 }}
            >
              {categoriesList.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Price, Stock Quantity, Unit, Rank Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Catalog Price (₹)</label>
              <input 
                type="number" 
                value={formData.price || 0} 
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Stock Quantity (Units)</label>
              <input 
                type="number" 
                value={formData.stockQuantity !== undefined ? formData.stockQuantity : 20} 
                onChange={(e) => {
                  const q = Number(e.target.value);
                  let st = formData.stockStatus;
                  if (st !== 'coming_soon') {
                    if (q > 5) st = 'in_stock';
                    else if (q > 0) st = 'limited_stock';
                    else st = 'out_of_stock';
                  }
                  setFormData({ ...formData, stockQuantity: q, stockStatus: st, inStock: q > 0 && st !== 'coming_soon' });
                }}
                placeholder="20"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', fontWeight: 700, color: '#047857' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Unit Metric</label>
              <input 
                type="text" 
                value={formData.unit || ''} 
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="750ml Glass Bottle"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Display Sorting Rank</label>
              <input 
                type="number" 
                value={formData.displayOrder || 1} 
                onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none' }}
              />
            </div>
          </div>

          {/* Fat %, Shelf Life, Farm Source, Offer Tag Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Fat Percentage</label>
              <input 
                type="text" 
                value={formData.fatPercentage || ''} 
                onChange={(e) => setFormData({ ...formData, fatPercentage: e.target.value })}
                placeholder="e.g. 6.5%"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Shelf Life</label>
              <input 
                type="text" 
                value={formData.shelfLife || ''} 
                onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                placeholder="e.g. 48 Hours"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Dairy Farm Source</label>
              <input 
                type="text" 
                value={formData.farmSource || ''} 
                onChange={(e) => setFormData({ ...formData, farmSource: e.target.value })}
                placeholder="Green Valley Eco-Farms"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Offer Tags / Discounts</label>
              <input 
                type="text" 
                value={formData.offerTag || ''} 
                onChange={(e) => setFormData({ ...formData, offerTag: e.target.value })}
                placeholder="e.g. 10% OFF or ₹20 OFF"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', display: 'block', marginBottom: '4px' }}>🛡️ Guarantee Banner Note (Mobile Product Detail Screen)</label>
              <input 
                type="text" 
                value={formData.guaranteeNote || ''} 
                onChange={(e) => setFormData({ ...formData, guaranteeNote: e.target.value })}
                placeholder="e.g. Cold-chain guarantee - delivered under 4°C to ensure peak freshness"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5', fontSize: '0.85rem', outline: 'none', fontWeight: 600, color: '#064E3B' }}
              />
            </div>
          </div>

          {/* Product Images (Carousel - up to 4 Images) */}
          <div style={{ backgroundColor: '#F9FAFB', borderRadius: '14px', padding: '1.25rem', border: '1px solid #E5E7EB' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '0.25rem' }}>
              Product Carousel Images (up to 4 Images for Mobile App)
            </label>
            <div style={{ fontSize: '0.74rem', color: '#6B7280', marginBottom: '0.85rem' }}>
              Image 1 will serve as the primary product cover thumbnail. Add additional image URLs for the app carousel slider.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {/* Image 1 */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', display: 'block', marginBottom: '4px' }}>Image 1 (Primary Cover)</label>
                <input 
                  type="text" 
                  value={formData.imageUrl || ''} 
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              {/* Image 2 */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '4px' }}>Image 2 (Carousel)</label>
                <input 
                  type="text" 
                  value={formData.img2 || ''} 
                  onChange={(e) => setFormData({ ...formData, img2: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              {/* Image 3 */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '4px' }}>Image 3 (Carousel)</label>
                <input 
                  type="text" 
                  value={formData.img3 || ''} 
                  onChange={(e) => setFormData({ ...formData, img3: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              {/* Image 4 */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '4px' }}>Image 4 (Carousel)</label>
                <input 
                  type="text" 
                  value={formData.img4 || ''} 
                  onChange={(e) => setFormData({ ...formData, img4: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>
          </div>

          {/* Feature Checkboxes matching Screenshot 4 */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#111827', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.isSubscriptionEnabled !== false} 
                onChange={(e) => setFormData({ ...formData, isSubscriptionEnabled: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#047857' }}
              />
              <span>Allow Recurring Subscription Deliveries</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#111827', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.isFeatured === true} 
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#047857' }}
              />
              <span>Featured Product Highlight</span>
            </label>
          </div>

          {/* Stock Availability 4-Way Selector */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Stock Availability & Catalog Status (Auto-updates with Stock Quantity)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'in_stock', label: `🟢 In Stock (${formData.stockQuantity !== undefined ? formData.stockQuantity : 20})`, color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
                { id: 'limited_stock', label: `🟡 Limited Stock (${formData.stockQuantity !== undefined ? formData.stockQuantity : 5})`, color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
                { id: 'out_of_stock', label: '🔴 Out of Stock (0)', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
                { id: 'coming_soon', label: '🩶 Coming Soon (Gray)', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    let newQty = formData.stockQuantity !== undefined ? formData.stockQuantity : 20;
                    if (st.id === 'out_of_stock') newQty = 0;
                    else if (st.id === 'limited_stock' && newQty > 5) newQty = 5;
                    else if (st.id === 'in_stock' && newQty <= 5) newQty = 20;
                    const isInStock = st.id === 'in_stock' || st.id === 'limited_stock';
                    setFormData({ ...formData, stockStatus: st.id as any, stockQuantity: newQty, inStock: isInStock });
                  }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: formData.stockStatus === st.id ? `2px solid ${st.color}` : `1px solid ${st.border}`,
                    backgroundColor: formData.stockStatus === st.id ? st.bg : '#FFFFFF',
                    color: st.color,
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Operating Hub Assignment */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Operating Hub Assignment</label>
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

          {/* Nutritional Profile */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '0.65rem' }}>
              Nutritional Facts Table (Values per 100ml / 100g)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 700 }}>🥛 Calcium (Optional):</label>
                <input 
                  type="text" 
                  value={(formData.nutrients as any)?.Calcium ?? (formData.nutrients as any)?.calcium ?? ''} 
                  onChange={(e) => setFormData({ ...formData, nutrients: { ...formData.nutrients, Calcium: e.target.value } })}
                  placeholder="e.g. 135 mg / 100ml (Optional)"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.82rem', outline: 'none', marginTop: '3px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 700 }}>⚡ Energy (Optional):</label>
                <input 
                  type="text" 
                  value={(formData.nutrients as any)?.Energy ?? (formData.nutrients as any)?.energy ?? ''} 
                  onChange={(e) => setFormData({ ...formData, nutrients: { ...formData.nutrients, Energy: e.target.value } })}
                  placeholder="e.g. 98 Kcal / 100ml (Optional)"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.82rem', outline: 'none', marginTop: '3px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 700 }}>🧀 Fat Content (Optional):</label>
                <input 
                  type="text" 
                  value={(formData.nutrients as any)?.['Fat Content'] ?? (formData.nutrients as any)?.fat ?? ''} 
                  onChange={(e) => setFormData({ ...formData, nutrients: { ...formData.nutrients, 'Fat Content': e.target.value } })}
                  placeholder="e.g. 6.5% (Optional)"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.82rem', outline: 'none', marginTop: '3px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 700 }}>🧪 Phosphorus (Optional):</label>
                <input 
                  type="text" 
                  value={(formData.nutrients as any)?.Phosphorus ?? (formData.nutrients as any)?.phosphorus ?? ''} 
                  onChange={(e) => setFormData({ ...formData, nutrients: { ...formData.nutrients, Phosphorus: e.target.value } })}
                  placeholder="e.g. 90 mg (Optional)"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.82rem', outline: 'none', marginTop: '3px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 700 }}>🥩 Protein (Optional):</label>
                <input 
                  type="text" 
                  value={(formData.nutrients as any)?.Protein ?? (formData.nutrients as any)?.protein ?? ''} 
                  onChange={(e) => setFormData({ ...formData, nutrients: { ...formData.nutrients, Protein: e.target.value } })}
                  placeholder="e.g. 3.8 g / 100ml (Optional)"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.82rem', outline: 'none', marginTop: '3px' }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #E5E7EB', paddingTop: '1.25rem' }}>
            <button 
              type="button"
              onClick={() => { setEditingProduct(null); setIsCreatingNew(false); }}
              style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Save Product Specs
            </button>
          </div>

        </form>

      </div>
    );
  }

  const displayProducts: Product[] = (products && products.length > 0) ? products : DEFAULT_CATALOG_PRODUCTS;

  const filteredCatalog = displayProducts.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Header Bar matching Screenshot 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Product Inventory
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
            Manage dairy products, stock availability, pricing, and specs.
          </p>
        </div>

        <button 
          onClick={startCreateProduct}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Category Pills & Search Input matching Screenshot 2 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '0.85rem 1.25rem', border: '1px solid #E5E7EB', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {dynamicCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: selectedCategory === cat ? 'none' : '1px solid #E5E7EB',
                backgroundColor: selectedCategory === cat ? '#DCFCE7' : '#FFFFFF',
                color: selectedCategory === cat ? '#047857' : '#374151',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              {cat}
            </button>
          ))}

          <button 
            onClick={() => setShowAddCategoryModal(true)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            + Add Category
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem 0.45rem 34px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              fontSize: '0.82rem',
              color: '#111827',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Product Cards Grid matching Screenshot 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {filteredCatalog.map((prod) => (
          <div
            key={prod.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <div>
              {/* Product Cover Image with Red Offer Tag & SUBSCRIPTION OK badge */}
              <div style={{ width: '100%', height: '180px', overflow: 'hidden', position: 'relative', backgroundColor: '#F3F4F6' }}>
                <img
                  src={prod.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600'}
                  alt={prod.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Offer Tag - Solid Red Capsule Top-Left */}
                {prod.offerTag && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    zIndex: 2
                  }}>
                    {prod.offerTag}
                  </div>
                )}

                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  backgroundColor: '#044E35',
                  color: '#FFFFFF',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em'
                }}>
                  {prod.isSubscriptionEnabled ? 'SUBSCRIPTION OK' : 'ONE-TIME ONLY'}
                </div>

                {(prod.stockStatus === 'coming_soon' || prod.stockStatus === 'out_of_stock' || prod.inStock === false) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    backgroundColor: prod.stockStatus === 'coming_soon' ? '#475569' : '#DC2626',
                    color: '#FFFFFF',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    {prod.stockStatus === 'coming_soon' ? '🩶 COMING SOON' : '🔴 OUT OF STOCK'}
                  </div>
                )}
              </div>

              {/* Tags & Rank Row */}
              <div style={{ padding: '1rem 1.25rem 0.5rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                    {prod.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                    {prod.unit}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    Rank #{prod.displayOrder || 1}
                  </span>

                  {(() => {
                    const st = prod.stockStatus || (prod.inStock === false ? 'out_of_stock' : 'in_stock');
                    const qty = prod.stockQuantity !== undefined ? prod.stockQuantity : 20;
                    const badgeMap: Record<string, { text: string; color: string; bg: string }> = {
                      in_stock: { text: `🟢 In Stock (${qty})`, color: '#059669', bg: '#DCFCE7' },
                      limited_stock: { text: `🟡 Limited (${qty} left)`, color: '#B45309', bg: '#FEF3C7' },
                      out_of_stock: { text: '🔴 Out of Stock', color: '#DC2626', bg: '#FEE2E2' },
                      coming_soon: { text: '🩶 Coming Soon', color: '#475569', bg: '#F1F5F9' },
                    };
                    const b = badgeMap[st] || badgeMap.in_stock;
                    return (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: b.color,
                        backgroundColor: b.bg,
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}>
                        {b.text}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Title & Description */}
              <div style={{ padding: '0 1.25rem 0.5rem 1.25rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: '4px 0 6px 0' }}>
                  {prod.name}
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                  {prod.description}
                </p>
              </div>

              {/* Farm Specs Row */}
              <div style={{ padding: '0.5rem 1.25rem', fontSize: '0.75rem', color: '#6B7280', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>🐄 {prod.farmSource || 'Green Valley Eco-Farms'}</span>
                <span>🥛 {prod.fatPercentage || '6.5% Fat'}</span>
                <span>⌛ {prod.shelfLife || '48 Hours'}</span>
              </div>
            </div>

            {/* Price & Actions Row matching Screenshot 2 */}
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {(() => {
                  const discPrice = getDiscountedPrice(prod.price, prod.offerTag);
                  const hasDisc = discPrice < prod.price;
                  return (
                    <>
                      <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-title)' }}>
                        ₹{discPrice}
                      </span>
                      {hasDisc && (
                        <span style={{ fontSize: '0.85rem', color: '#9CA3AF', textDecoration: 'line-through', fontWeight: 600 }}>
                          ₹{prod.price}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* 4-way stock status dropdown toggle */}
                <select
                  value={prod.stockStatus || (prod.inStock === false ? 'out_of_stock' : 'in_stock')}
                  onChange={(e) => {
                    const newStatus = e.target.value as any;
                    const isInStock = newStatus === 'in_stock' || newStatus === 'limited_stock';
                    if (onSaveProduct) {
                      onSaveProduct({ ...prod, stockStatus: newStatus, inStock: isInStock });
                      showToast(`Updated "${prod.name}" status to ${newStatus}`, 'success');
                    } else {
                      onToggleStock(prod.id, !isInStock);
                    }
                  }}
                  style={{
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  <option value="in_stock">🟢 In Stock</option>
                  <option value="limited_stock">🟡 Limited Stock</option>
                  <option value="out_of_stock">🔴 Out of Stock</option>
                  <option value="coming_soon">🟣 Coming Soon</option>
                </select>

                <button
                  onClick={() => startEditProduct(prod)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    padding: '0.35rem 0.55rem',
                    cursor: 'pointer'
                  }}
                >
                  <Edit2 size={15} />
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(`Delete product "${prod.name}"?`)) {
                      onDeleteProduct(prod.id);
                      showToast(`Product "${prod.name}" deleted.`, 'info');
                    }
                  }}
                  style={{
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.55rem',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Add New Category Modal */}
      {showAddCategoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.5rem', maxWidth: '380px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, margin: 0, color: '#111827' }}>+ Add New Product Category</h3>
            <p style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '4px' }}>
              Create a new category for sorting catalog items.
            </p>
            <input 
              type="text"
              placeholder="e.g. Organic Juices"
              value={customCategoryInput}
              onChange={(e) => setCustomCategoryInput(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #E5E7EB', marginTop: '1rem', outline: 'none', fontSize: '0.9rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setShowAddCategoryModal(false)} className="btn-secondary" style={{ flex: 1, padding: '0.6rem', borderRadius: '8px' }}>Cancel</button>
              <button 
                onClick={() => {
                  if (customCategoryInput.trim()) {
                    setCategoriesList([...categoriesList, customCategoryInput.trim()]);
                    setSelectedCategory(customCategoryInput.trim());
                    showToast(`Added category "${customCategoryInput.trim()}"!`, "success");
                    setCustomCategoryInput('');
                    setShowAddCategoryModal(false);
                  }
                }}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', backgroundColor: '#047857', color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
