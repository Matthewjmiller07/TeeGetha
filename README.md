# TeeGetha
Custom Shirts For Your Whole Family

<div align="center">
<img width="1200" height="475" alt="TeeGetha Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

TeeGetha is a custom t-shirt design platform that allows families to create personalized shirts with AI-powered background removal and Printify integration for automated printing and shipping.

## ✨ Features

- **AI-Powered Background Removal**: Automatically remove backgrounds from family photos
- **Custom Shirt Design**: Upload and customize designs for family members
- **Multiple Shirt Types**: Men's, Women's, and Kids' shirts with various sizes and colors
- **Stripe Payment Integration**: Secure payment processing with promo code support
- **Printify Integration**: Automated order fulfillment and shipping
- **Real-time Preview**: See your custom designs before ordering
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Matthewjmiller07/TeeGetha.git
   cd TeeGetha
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   # Gemini AI
   VITE_GEMINI_API_KEY=your_gemini_api_key
   
   # Stripe
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   
   # Printify
   PRINTIFY_API_TOKEN=your_printify_token
   PRINTIFY_SHOP_ID=your_printify_shop_id
   
   # Development
   VITE_API_BASE_URL=http://localhost:4000
   CLIENT_URL=http://localhost:3000
   TEST_MODE=true
   ```

4. **Run the application**
   ```bash
   # Start backend server
   npm run dev:server
   
   # Start frontend (in another terminal)
   npm run dev
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Stripe.js** - Payment processing

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Stripe** - Payment processing
- **Printify API** - Print-on-demand service
- **Gemini AI** - Background removal

### Infrastructure
- **Vercel** - Hosting and deployment
- **GitHub** - Version control

## 📦 Project Structure

```
TeeGetha/
├── components/          # React components
│   ├── Button.tsx      # Reusable button component
│   ├── ShirtMockup.tsx # Shirt preview component
│   └── StepIndicator.tsx # Progress indicator
├── server/             # Backend server
│   └── index.js        # Express server and API routes
├── services/           # API service functions
│   ├── geminiService.ts # Gemini AI integration
│   └── printService.ts  # Printify API integration
├── public/             # Static assets
│   └── test-assets/    # Test images and designs
├── App.tsx             # Main React component
├── types.ts            # TypeScript type definitions
└── vite.config.ts      # Vite configuration
```

## 💳 Payment Flow

1. **Customer selects shirts** and uploads designs
2. **Background removal** processes images automatically
3. **Stripe PaymentIntent** created with order metadata
4. **Customer completes payment** via Stripe Checkout
5. **Webhook receives payment confirmation**
6. **Printify order created** with `send_to_production: true`
7. **Order printed and shipped** to customer

### Test Mode
- Use Stripe test cards (e.g., `4242 4242 4242 4242`)
- Orders created as test orders in Printify
- No real charges or printing

### Production Mode
- Real Stripe payments
- Live Printify orders
- Automated fulfillment

## 🔧 API Endpoints

### Frontend → Backend
- `POST /api/remove-background` - Remove image backgrounds
- `POST /api/printify/plan-order` - Plan Printify order
- `POST /api/printify/test-order` - Create test order
- `POST /api/stripe/create-payment-intent` - Create Stripe payment

### Webhooks
- `POST /webhooks/stripe` - Handle Stripe events

## 🎨 Shirt Customization

### Available Types
- **Men's T-Shirts**: S, M, L, XL, 2XL
- **Women's T-Shirts**: S, M, L, XL, 2XL  
- **Kids' T-Shirts**: XS, S, M, L, XL

### Colors
- Black, White, Athletic Grey, and more

### Design Options
- Family photos with background removal
- Custom text and graphics
- Multiple design placements

## 🚀 Deployment

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on git push

### Environment Variables for Production
```env
VITE_API_BASE_URL=https://your-domain.vercel.app/api
CLIENT_URL=https://your-domain.vercel.app
CORS_ORIGIN=https://your-domain.vercel.app
TEST_MODE=false
STRIPE_SECRET_KEY=sk_live_your_live_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

## 🔑 API Setup

### Stripe
1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Dashboard → Developers → API keys
3. Set up webhook endpoint for payment events
4. Configure products and pricing

### Printify
1. Create account at [printify.com](https://printify.com)
2. Get API token from Settings → API
3. Set up shop and connect print providers
4. Configure products and variants

### Gemini AI
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Enable background removal API
3. Add key to environment variables

## 🧪 Testing

### Local Testing
```bash
# Run tests
npm test

# Test background removal
curl -X POST http://localhost:4000/api/remove-background \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/image.jpg"}'
```

### Stripe Webhook Testing
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks locally
stripe listen --forward-to localhost:4000/webhooks/stripe
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@teegetha.com
- 💬 GitHub Issues: [Create an issue](https://github.com/Matthewjmiller07/TeeGetha/issues)
- 📖 Documentation: [TeeGetha Docs](https://docs.teegetha.com)

## 🌟 Acknowledgments

- [Stripe](https://stripe.com) - Payment processing
- [Printify](https://printify.com) - Print-on-demand service
- [Google Gemini](https://ai.google.dev) - AI background removal
- [Vercel](https://vercel.com) - Hosting platform
- [React](https://reactjs.org) - UI framework

---

<div align="center">
Made with ❤️ for families everywhere
</div>
