// Printify Catalog Service for getting product images

const PRINTIFY_API_TOKEN = import.meta.env.VITE_PRINTIFY_API_TOKEN || '';
const PRINTIFY_SHOP_ID = import.meta.env.VITE_PRINTIFY_SHOP_ID || '';

interface PrintifyVariant {
  id: number;
  title: string;
  options: {
    size: string;
    color: string;
  };
  image?: string;
  price: number;
}

interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  images: string[];
  variants: PrintifyVariant[];
}

// Product blueprint IDs from your .env
const PRODUCT_BLUEPRINTS = {
  men: import.meta.env.VITE_PRINTIFY_BLUEPRINT_ID_MEN || '12',
  women: import.meta.env.VITE_PRINTIFY_BLUEPRINT_ID_WOMEN || '9', 
  kids: import.meta.env.VITE_PRINTIFY_BLUEPRINT_ID_KIDS || '81'
};

export async function getPrintifyCatalog(type: 'men' | 'women' | 'kids'): Promise<PrintifyProduct[]> {
  if (!PRINTIFY_API_TOKEN || !PRINTIFY_SHOP_ID) {
    console.warn('Printify credentials not found');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.printify.com/v1/catalog/blueprints/${PRODUCT_BLUEPRINTS[type]}/products.json`,
      {
        headers: {
          'Authorization': `Bearer ${PRINTIFY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Printify API error: ${response.status}`);
    }

    const products = await response.json();
    return products.slice(0, 10); // Limit to first 10 products
  } catch (error) {
    console.error('Error fetching Printify catalog:', error);
    return [];
  }
}

export async function getProductImages(type: 'men' | 'women' | 'kids', color: string): Promise<string[]> {
  const products = await getPrintifyCatalog(type);
  
  if (products.length === 0) {
    return [];
  }

  // Find first product with the requested color
  const product = products.find(p => 
    p.variants.some(v => v.options.color.toLowerCase() === color.toLowerCase())
  ) || products[0];

  return product.images || [];
}

export function getVariantImage(variants: PrintifyVariant[], size: string, color: string): string | null {
  const variant = variants.find(v => 
    v.options.size.toLowerCase() === size.toLowerCase() && 
    v.options.color.toLowerCase() === color.toLowerCase()
  );
  
  return variant?.image || null;
}

// Color mappings for Printify
export const PRINTIFY_COLORS = {
  men: {
    'Black': 'Black',
    'White': 'White', 
    'Athletic Grey': 'Heather Grey',
    'Navy': 'Navy',
    'Red': 'Red'
  },
  women: {
    'Black': 'Black',
    'White': 'White',
    'Athletic Grey': 'Heather Grey', 
    'Pink': 'Pink',
    'Navy': 'Navy'
  },
  kids: {
    'Black': 'Black',
    'White': 'White',
    'Athletic Grey': 'Heather Grey',
    'Blue': 'Royal Blue',
    'Pink': 'Pink'
  }
};
