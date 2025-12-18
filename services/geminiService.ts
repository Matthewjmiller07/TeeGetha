
import { GoogleGenAI, Type } from '@google/genai';
import { API_BASE_URL, GEMINI_API_KEY, IS_TEST_MODE, TEST_ASSETS } from '../config';

export interface AnalyzedPerson {
  description: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

const TEST_MEMBER_DESCRIPTIONS = [
  'Smiling family member with glasses',
  'Happy sibling wearing a blue shirt',
  'Grandparent with a warm smile',
  'Energetic cousin with curly hair'
];

let testDesignIndex = 0;

// Heuristic checkerboard background remover.
// Assumes the background is a light gray/white/black checker pattern.
// We detect near-neutral (low-saturation) very light or very dark pixels and make them transparent.
const stripCheckerboardBackground = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(dataUrl);
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const isBackgroundPixel = (r: number, g: number, b: number) => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min; // saturation proxy

        const isNeutral = diff < 15; // r,g,b very similar -> gray/white/black
        const isVeryLight = max > 220;
        const isVeryDark = max < 35;

        return isNeutral && (isVeryLight || isVeryDark);
      };

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (isBackgroundPixel(r, g, b)) {
          data[i + 3] = 0; // alpha = 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      try {
        const cleaned = canvas.toDataURL('image/png');
        resolve(cleaned);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const removeBackgroundViaApi = async (imageDataUrl: string): Promise<string> => {
  try {
    const base = API_BASE_URL || '';
    const endpoint = `${base}/api/remove-background`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    if (!res.ok) {
      console.error('remove-background API failed', res.status);
      return imageDataUrl;
    }
    const json = await res.json();
    // Prefer cleaned URL if provided; fall back to original
    return typeof json.url === 'string' && json.url.length > 0 ? json.url : imageDataUrl;
  } catch (e) {
    console.error('removeBackgroundViaApi error', e);
    return imageDataUrl;
  }
};

/**
 * Analyzes a group photo to identify people and their locations.
 */
export const analyzeGroupPhoto = async (base64Image: string): Promise<AnalyzedPerson[]> => {
  if (IS_TEST_MODE) {
    return TEST_MEMBER_DESCRIPTIONS.map(description => ({
      description,
      box_2d: [0, 0, 1000, 1000]
    }));
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY in .env.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Remove data URL prefix
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Analyze this image. Detect all distinct human faces/people. For each person, provide a bounding box (ymin, xmin, ymax, xmax on a 0-1000 scale) and a brief visual description (e.g. 'Smiling man with beard')."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            people: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  box_2d: { 
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "Bounding box [ymin, xmin, ymax, xmax] with 0-1000 scale"
                  }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const result = JSON.parse(text);
    return result.people || [];

  } catch (error) {
    console.error("Analysis failed", error);
    return [];
  }
};

/**
 * Generates a stylized version of a person based on their original photo and a style prompt.
 */
export const generateStylizedMember = async (
  originalImage: string | null,
  description: string,
  stylePrompt: string
): Promise<string> => {
  if (IS_TEST_MODE) {
    // In test mode, always use the dedicated checkerboard test image so we can iterate
    // on background-removal without incurring Gemini costs.
    return TEST_ASSETS.checkerTest || TEST_ASSETS.designs[0];
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY in .env.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Use the description, but emphasize identity preservation if an image is provided.
  // Ask Gemini to return a design with a transparent background so it sits cleanly on the shirt mockup.
  const prompt = `Create a t-shirt graphic design based on this person: "${description}". The style must be: ${stylePrompt}. Maintain the person's key facial features, hair, and expression but adapt them to the style. Return a square PNG with a completely transparent background around the character (no solid white box, no borders), suitable to be overlaid on a colored shirt. High quality.`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (originalImage) {
      const cleanBase64 = originalImage.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.unshift({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const raw = `data:image/png;base64,${part.inlineData.data}`;
        // First try deterministic background removal via external API;
        // fall back to local checkerboard heuristic if API fails.
        const cleanedViaApi = await removeBackgroundViaApi(raw);
        if (cleanedViaApi !== raw) return cleanedViaApi;
        return await stripCheckerboardBackground(raw);
      }
    }
    throw new Error("No image generated");

  } catch (error) {
    console.error("Generation failed", error);
    throw error;
  }
};

/**
 * Generates a realistic preview of the original family photo where everyone is
 * wearing the final t-shirts that use the provided front design image.
 *
 * Both images should be data URLs. The model is instructed to keep faces,
 * poses, and background as close as possible to the original photo, only
 * adjusting clothing to add matching t-shirts with the design on the chest.
 */
export const generateFamilyShirtPreview = async (
  originalGroupPhoto: string,
  frontDesignImage: string,
  labelForPrompt: string
): Promise<string> => {
  if (IS_TEST_MODE) {
    // In test mode, just echo back the original photo so the UI wiring can be tested
    // without incurring Gemini costs.
    return originalGroupPhoto;
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY in .env.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const basePrompt = `Take the family in the first photo and keep their faces, expressions, body poses, and background as close as possible to the original. ` +
    `Put each visible person in a short-sleeve t-shirt that uses the second image as a front chest print. ` +
    `Make it look like a real photo of the same family now wearing their matching \"${labelForPrompt}\" shirts. Do not add or remove people.`;

  const cleanGroup = originalGroupPhoto.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const cleanFront = frontDesignImage.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanGroup,
            },
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanFront,
            },
          },
          { text: basePrompt },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '1K',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error('No image generated for family shirt preview');
  } catch (error) {
    console.error('Family shirt preview generation failed', error);
    throw error;
  }
};
