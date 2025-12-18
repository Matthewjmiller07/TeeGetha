export const IS_TEST_MODE = (import.meta.env.VITE_TEST_MODE ?? 'false').toString().toLowerCase() === 'true';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.API_KEY || '';
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export const TEST_ASSETS = {
  familyPhoto: '/test-assets/family-photo.jpg',
  designs: [
    '/test-assets/design-1.png',
    '/test-assets/design-2.png',
    '/test-assets/design-3.png',
    '/test-assets/design-4.png'
  ],
  checkerTest: '/test-assets/rav.png',
};
