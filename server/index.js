import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json({ limit: '10mb' }));

const REPLICATE_TOKEN = process.env.BACKGROUND_REMOVAL_API_KEY || '';
// For cjwbw/rembg, Replicate requires a specific model version ID.
// Set BACKGROUND_REMOVAL_MODEL_VERSION in .env to the version from the Replicate UI.
const REMBG_VERSION = process.env.BACKGROUND_REMOVAL_MODEL_VERSION || '';

// Printify-related configuration
const PRINTIFY_TOKEN = process.env.PRINTIFY_API_TOKEN || '';
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID || '';
const PRINTIFY_PRINT_PROVIDER_ID = parseInt(process.env.PRINTIFY_PRINT_PROVIDER_ID || '0', 10);
const PRINTIFY_BLUEPRINT_ID_MEN = parseInt(process.env.PRINTIFY_BLUEPRINT_ID_MEN || '0', 10);
const PRINTIFY_BLUEPRINT_ID_WOMEN = parseInt(process.env.PRINTIFY_BLUEPRINT_ID_WOMEN || '0', 10);
const PRINTIFY_BLUEPRINT_ID_KIDS = parseInt(process.env.PRINTIFY_BLUEPRINT_ID_KIDS || '0', 10);
const PRINTIFY_TEST_IMAGE_URL = process.env.PRINTIFY_TEST_IMAGE_URL || '';
const PRINTIFY_SHIPPING_METHOD = parseInt(process.env.PRINTIFY_SHIPPING_METHOD || '1', 10);

function safeParseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to parse JSON env ${name}:`, e);
    return null;
  }
}

async function uploadImageToPrintify(image, fileName) {
  if (!PRINTIFY_TOKEN) {
    throw new Error('PRINTIFY_API_TOKEN is not set');
  }

  const url = 'https://api.printify.com/v1/uploads/images.json';
  const isHttpUrl = typeof image === 'string' && image.startsWith('http');
  const isDataUrl = typeof image === 'string' && image.startsWith('data:');

  const payload = { file_name: fileName || 'kinconnect-image.png' };

  if (isHttpUrl) {
    payload.url = image;
  } else if (isDataUrl) {
    const base64Part = image.split(',')[1] || '';
    payload.contents = base64Part;
  } else {
    // Assume direct URL as a fallback
    payload.url = image;
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Printify upload failed: ${resp.status} ${text}`);
  }

  const body = await resp.json();
  // Prefer preview_url, fall back to src if present
  return body.preview_url || body.src || image;
}

const PRINTIFY_VARIANTS_MEN = safeParseJsonEnv('PRINTIFY_VARIANTS_MEN') || {};
const PRINTIFY_VARIANTS_WOMEN = safeParseJsonEnv('PRINTIFY_VARIANTS_WOMEN') || {};
const PRINTIFY_VARIANT_MAP_KIDS = safeParseJsonEnv('PRINTIFY_VARIANT_MAP_KIDS') || {};

async function callReplicateRembg(image) {
  if (!REPLICATE_TOKEN) {
    throw new Error('BACKGROUND_REMOVAL_API_KEY is not set');
  }
  if (!REMBG_VERSION) {
    throw new Error('BACKGROUND_REMOVAL_MODEL_VERSION is not set');
  }

  const baseUrl = 'https://api.replicate.com/v1';

  const createRes = await fetch(`${baseUrl}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: REMBG_VERSION,
      input: { image },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Replicate create failed: ${createRes.status} ${text}`);
  }

  const prediction = await createRes.json();
  let url = prediction?.urls?.get;

  // Poll until completed
  const started = Date.now();
  while (true) {
    const statusRes = await fetch(url, {
      headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` },
    });
    const statusJson = await statusRes.json();

    if (statusJson.status === 'succeeded') {
      const out = statusJson.output;
      // Model outputs a single URL string or [url]
      if (Array.isArray(out)) return out[0];
      return out;
    }

    if (statusJson.status === 'failed' || statusJson.status === 'canceled') {
      throw new Error(`Replicate prediction failed with status ${statusJson.status}`);
    }

    if (Date.now() - started > 60_000) {
      throw new Error('Replicate prediction timeout');
    }

    await new Promise((r) => setTimeout(r, 1500));
  }
}

function classifyMemberGroup(member) {
  const textParts = [];
  if (member && typeof member.name === 'string') textParts.push(member.name.toLowerCase());
  if (member && typeof member.description === 'string') textParts.push(member.description.toLowerCase());
  const text = textParts.join(' ');

  const kidHints = ['kid', 'child', 'son', 'daughter', 'boy', 'girl', 'toddler', 'infant'];
  if (kidHints.some((w) => text.includes(w))) return 'KIDS';

  const womenHints = ['mom', 'mother', 'wife', 'her ', ' she ', 'sister', 'aunt', 'grandma', 'woman', 'girl'];
  if (womenHints.some((w) => text.includes(w))) return 'WOMEN';

  return 'MEN';
}

function resolveVariantId(member) {
  const size = member.size || 'M';
  const preferredColor = member.shirtColorName || 'Black';

  const explicitType = member.shirtType;
  const group = explicitType || classifyMemberGroup(member);

  if (group === 'KIDS') {
    const bySize = PRINTIFY_VARIANT_MAP_KIDS || {};
    return bySize[size] || null;
  }

  const variantsByColor = group === 'WOMEN' ? PRINTIFY_VARIANTS_WOMEN : PRINTIFY_VARIANTS_MEN;
  if (!variantsByColor || typeof variantsByColor !== 'object') return null;

  const colorEntry = variantsByColor[preferredColor] || variantsByColor['Black'] || variantsByColor['White'];
  if (!colorEntry) return null;
  return colorEntry[size] || null;
}

function resolveBlueprintIdForMember(member) {
  const explicitType = member.shirtType;
  const group = explicitType || classifyMemberGroup(member);
  if (group === 'KIDS' && PRINTIFY_BLUEPRINT_ID_KIDS) return PRINTIFY_BLUEPRINT_ID_KIDS;
  if (group === 'WOMEN' && PRINTIFY_BLUEPRINT_ID_WOMEN) return PRINTIFY_BLUEPRINT_ID_WOMEN;
  return PRINTIFY_BLUEPRINT_ID_MEN || 0;
}

// POST /api/remove-background { image: string }
app.post('/api/remove-background', async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Missing image in body' });
    }

    // image may be a data URL or an HTTP URL. Replicate accepts either.
    const cleanedUrl = await callReplicateRembg(image);
    return res.json({ url: cleanedUrl });
  } catch (err) {
    console.error('Background removal error:', err);
    return res.status(500).json({ error: err.message || 'Background removal failed' });
  }
});

// POST /api/printify/order-plan
// Body: { items: FamilyMember[], shipping: ShippingDetails, shirtColorName?: string }
// Uses env blueprint/variant maps to resolve which blueprint_id and variant_id should be used
// per line item, and returns a simulated order response plus debug info.
app.post('/api/printify/order-plan', async (req, res) => {
  try {
    const { items, shipping, shirtColorName, familyImage } = req.body || {};

    if (!Array.isArray(items) || !shipping) {
      return res.status(400).json({ error: 'Missing items or shipping' });
    }

    if (!PRINTIFY_SHOP_ID || !PRINTIFY_PRINT_PROVIDER_ID) {
      return res.status(500).json({ error: 'Printify env not fully configured' });
    }

    const lineItems = [];
    for (const raw of items) {
      const qty = typeof raw.quantity === 'number' ? raw.quantity : 1;
      if (qty <= 0) continue;

      const memberForResolution = {
        ...raw,
        shirtColorName: raw.shirtColorName || shirtColorName || 'Black',
      };

      const blueprintId = resolveBlueprintIdForMember(memberForResolution);
      const variantId = resolveVariantId(memberForResolution);
      if (!blueprintId || !variantId) continue;

      lineItems.push({
        name: raw.name || 'Member',
        quantity: qty,
        blueprint_id: blueprintId,
        variant_id: variantId,
        print_provider_id: PRINTIFY_PRINT_PROVIDER_ID,
        color: shirtColorName || 'Black',
        size: raw.size || 'M',
      });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid line items could be created from input' });
    }

    const now = new Date();
    const estimate = new Date(now.getTime());
    estimate.setDate(estimate.getDate() + 14);

    const orderId = `KC-PLAN-${Math.floor(Math.random() * 1_000_000)}`;

    return res.json({
      orderId,
      estimatedDelivery: estimate.toISOString().slice(0, 10),
      shopId: PRINTIFY_SHOP_ID,
      debug: {
        providerId: PRINTIFY_PRINT_PROVIDER_ID,
        lineItems,
        shippingSummary: {
          name: shipping.fullName,
          city: shipping.city,
          state: shipping.state,
          zip: shipping.zip,
          email: shipping.email,
        },
      },
    });
  } catch (err) {
    console.error('order-plan error:', err);
    return res.status(500).json({ error: err.message || 'Failed to build order plan' });
  }
});

// POST /api/printify/order-test
// Creates a real order in Printify with send_to_production=false so it appears in the
// dashboard but is not printed or charged.
app.post('/api/printify/order-test', async (req, res) => {
  try {
    const { items, shipping, shirtColorName, familyImage } = req.body || {};

    if (!Array.isArray(items) || !shipping) {
      return res.status(400).json({ error: 'Missing items or shipping' });
    }

    if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP_ID || !PRINTIFY_PRINT_PROVIDER_ID) {
      return res.status(500).json({ error: 'Printify auth/env not fully configured' });
    }

    const lineItems = [];

    // Upload shared family image once for all shirts (front print area).
    let familySrc = PRINTIFY_TEST_IMAGE_URL;
    try {
      if (familyImage) {
        familySrc = await uploadImageToPrintify(familyImage, 'family-front.png');
      } else if (PRINTIFY_TEST_IMAGE_URL) {
        familySrc = await uploadImageToPrintify(PRINTIFY_TEST_IMAGE_URL, 'family-front.png');
      }
    } catch (e) {
      console.error('Failed to upload family image to Printify, using fallback URL:', e);
      familySrc = PRINTIFY_TEST_IMAGE_URL || familySrc;
    }

    for (const raw of items) {
      const qty = typeof raw.quantity === 'number' ? raw.quantity : 1;
      if (qty <= 0) continue;

      const memberForResolution = {
        ...raw,
        shirtColorName: raw.shirtColorName || shirtColorName || 'Black',
      };

      const blueprintId = resolveBlueprintIdForMember(memberForResolution);
      const variantId = resolveVariantId(memberForResolution);
      if (!blueprintId || !variantId) continue;

      // Upload per-member image for the back side. Prefer generatedImage, fall back to originalImage.
      let memberSrc = familySrc;
      const candidateImage = raw.generatedImage || raw.originalImage || PRINTIFY_TEST_IMAGE_URL;
      try {
        if (candidateImage) {
          memberSrc = await uploadImageToPrintify(candidateImage, `${raw.name || 'member'}-back.png`);
        }
      } catch (e) {
        console.error('Failed to upload member image to Printify, using family image as fallback:', e);
        memberSrc = familySrc;
      }

      lineItems.push({
        print_provider_id: PRINTIFY_PRINT_PROVIDER_ID,
        blueprint_id: blueprintId,
        variant_id: variantId,
        quantity: qty,
        print_areas: {
          front: [
            {
              src: familySrc,
              scale: 1,
              x: 0.5,
              y: 0.5,
              angle: 0,
            },
          ],
          back: [
            {
              src: memberSrc,
              scale: 1,
              x: 0.5,
              y: 0.5,
              angle: 0,
            },
          ],
        },
      });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid Printify line items could be created' });
    }

    const [firstName, ...restName] = (shipping.fullName || '').split(' ');
    const lastName = restName.join(' ') || firstName || 'Customer';

    const payload = {
      external_id: `kinconnect-test-${Date.now()}`,
      label: 'KinConnect Test Order',
      line_items: lineItems,
      shipping_method: PRINTIFY_SHIPPING_METHOD || 1,
      send_shipping_notification: false,
      send_to_production: false,
      address_to: {
        first_name: firstName || 'Customer',
        last_name: lastName || 'Test',
        email: shipping.email,
        phone: shipping.phone || '',
        country: shipping.country || 'US',
        region: shipping.state,
        address1: shipping.addressLine1,
        city: shipping.city,
        zip: shipping.zip,
      },
    };

    const url = `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/orders.json`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await resp.json();
    if (!resp.ok) {
      console.error('Printify order error:', body);
      return res.status(resp.status).json({ error: 'Printify order failed', details: body });
    }

    return res.json({
      orderId: body.id || body.external_id,
      printifyResponse: body,
    });
  } catch (err) {
    console.error('order-test error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create Printify test order' });
  }
});

// POST /api/stripe/create-payment-intent
app.post('/api/stripe/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create PaymentIntent with metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('PaymentIntent creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create PaymentIntent' });
  }
});

// POST /webhooks/stripe - Handle Stripe webhook events
app.post('/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      
      // Extract order metadata from payment intent
      const metadata = paymentIntent.metadata || {};
      if (metadata.items && metadata.shipping) {
        try {
          const items = JSON.parse(metadata.items);
          const shipping = JSON.parse(metadata.shipping);
          const shirtColorName = metadata.shirtColorName || 'Black';
          const familyImage = metadata.familyImage;

          // Create actual Printify order (send_to_production = !TEST_MODE)
          await createPrintifyOrder(items, shipping, shirtColorName, familyImage, !process.env.TEST_MODE);
          console.log('Order sent to production for payment:', paymentIntent.id);
        } catch (orderError) {
          console.error('Failed to create order after successful payment:', orderError);
        }
      }
      break;

    case 'payment_intent.payment_failed':
      console.log('PaymentIntent failed:', event.data.object.id);
      break;

    case 'checkout.session.completed':
      console.log('Checkout session completed:', event.data.object.id);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

// Helper function to create actual Printify order
async function createPrintifyOrder(items, shipping, shirtColorName, familyImage, sendToProduction = false) {
  if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP_ID || !PRINTIFY_PRINT_PROVIDER_ID) {
    throw new Error('Printify auth/env not fully configured');
  }

  const lineItems = [];

  // Upload shared family image once for all shirts (front print area).
  let familySrc = PRINTIFY_TEST_IMAGE_URL;
  try {
    if (familyImage) {
      familySrc = await uploadImageToPrintify(familyImage, 'family-front.png');
    } else if (PRINTIFY_TEST_IMAGE_URL) {
      familySrc = await uploadImageToPrintify(PRINTIFY_TEST_IMAGE_URL, 'family-front.png');
    }
  } catch (e) {
    console.error('Failed to upload family image to Printify, using fallback URL:', e);
    familySrc = PRINTIFY_TEST_IMAGE_URL || familySrc;
  }

  for (const raw of items) {
    const qty = typeof raw.quantity === 'number' ? raw.quantity : 1;
    if (qty <= 0) continue;

    const memberForResolution = {
      ...raw,
      shirtColorName: raw.shirtColorName || shirtColorName || 'Black',
    };

    const blueprintId = resolveBlueprintIdForMember(memberForResolution);
    const variantId = resolveVariantId(memberForResolution);
    if (!blueprintId || !variantId) continue;

    // Upload per-member image for the back side. Prefer generatedImage, fall back to originalImage.
    let memberSrc = familySrc;
    const candidateImage = raw.generatedImage || raw.originalImage || PRINTIFY_TEST_IMAGE_URL;
    try {
      if (candidateImage) {
        memberSrc = await uploadImageToPrintify(candidateImage, `${raw.name || 'member'}-back.png`);
      }
    } catch (e) {
      console.error('Failed to upload member image to Printify, using family image as fallback:', e);
      memberSrc = familySrc;
    }

    lineItems.push({
      print_provider_id: PRINTIFY_PRINT_PROVIDER_ID,
      blueprint_id: blueprintId,
      variant_id: variantId,
      quantity: qty,
      print_areas: {
        front: [
          {
            src: familySrc,
            scale: 1,
            x: 0.5,
            y: 0.5,
            angle: 0,
          },
        ],
        back: [
          {
            src: memberSrc,
            scale: 1,
            x: 0.5,
            y: 0.5,
            angle: 0,
          },
        ],
      },
    });
  }

  if (lineItems.length === 0) {
    throw new Error('No valid Printify line items could be created');
  }

  const [firstName, ...restName] = (shipping.fullName || '').split(' ');
  const lastName = restName.join(' ') || firstName || 'Customer';

  const payload = {
    external_id: `kinconnect-paid-${Date.now()}`,
    label: sendToProduction ? 'KinConnect Order' : 'KinConnect Test Order',
    line_items: lineItems,
    shipping_method: PRINTIFY_SHIPPING_METHOD || 1,
    send_shipping_notification: sendToProduction,
    send_to_production: sendToProduction,
    address_to: {
      first_name: firstName || 'Customer',
      last_name: lastName || 'Order',
      email: shipping.email,
      phone: shipping.phone || '',
      country: shipping.country || 'US',
      region: shipping.state,
      address1: shipping.addressLine1,
      city: shipping.city,
      zip: shipping.zip,
    },
  };

  const url = `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/orders.json`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.json();
  if (!resp.ok) {
    console.error('Printify order error:', body);
    throw new Error('Printify order failed', body);
  }

  return {
    orderId: body.id || body.external_id,
    printifyResponse: body,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Serve React build files
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TeeGetha server listening on port ${PORT}`);
});
