
import { FamilyMember, ShippingDetails, PaymentDetails } from '../types';
import { API_BASE_URL } from '../config';

/**
 * Sends an order plan to the backend, which maps items to Printify blueprints/variants.
 * Falls back to a local mock if API_BASE_URL is not configured.
 */
export const createPrintOrder = async (
  items: FamilyMember[],
  shipping: ShippingDetails,
  shirtColorName: string,
  familyImage?: string | null
): Promise<{ orderId: string; estimatedDelivery: string }> => {
  if (!API_BASE_URL) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const orderId = `POD-${Math.floor(Math.random() * 1000000)}`;
        const date = new Date();
        date.setDate(date.getDate() + 14);
        resolve({
          orderId,
          estimatedDelivery: date.toLocaleDateString(),
        });
      }, 2000);
    });
  }

  const endpoint = `${API_BASE_URL}/api/printify/order-test`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, shipping, shirtColorName, familyImage }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printify order-plan failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return {
    orderId: json.orderId || `POD-${Math.floor(Math.random() * 1000000)}`,
    estimatedDelivery: json.estimatedDelivery || new Date().toISOString().slice(0, 10),
  };
};

/**
 * Creates a Stripe PaymentIntent with order metadata
 */
export const createStripePayment = async (
  amount: number, 
  payment: PaymentDetails,
  items: any[],
  shipping: ShippingDetails,
  shirtColorName: string,
  familyImage?: string | null
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  const endpoint = `${API_BASE_URL}/api/stripe/create-payment-intent`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        items: JSON.stringify(items),
        shipping: JSON.stringify(shipping),
        shirtColorName,
        familyImage: familyImage || ''
      }
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe payment creation failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return {
    clientSecret: json.clientSecret,
    paymentIntentId: json.paymentIntentId
  };
};

/**
 * Mocks a payment gateway charge (Stripe/PayPal).
 */
export const processPayment = async (
  amount: number, 
  payment: PaymentDetails
): Promise<{ success: boolean; transactionId: string }> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (payment.cardNumber.length < 13) {
        reject(new Error("Invalid card number"));
        return;
      }
      
      resolve({
        success: true,
        transactionId: `TX-${Date.now().toString(36).toUpperCase()}`
      });
    }, 1500);
  });
};
