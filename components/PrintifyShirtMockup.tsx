import React, { useState, useEffect } from 'react';
import { getProductImages, PRINTIFY_COLORS } from '../services/printifyCatalogService';

interface Props {
  type: 'men' | 'women' | 'kids';
  size: string;
  color: string;
  image: string | null;
  className?: string;
}

export const PrintifyShirtMockup: React.FC<Props> = ({ 
  type, 
  size, 
  color, 
  image, 
  className = "" 
}) => {
  const [catalogImages, setCatalogImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true);
        const images = await getProductImages(type, color);
        setCatalogImages(images);
        setError(null);
      } catch (err) {
        setError('Failed to load catalog images');
        console.error('Error loading catalog images:', err);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, [type, color]);

  // Get the main catalog image or fallback
  const catalogImage = catalogImages[0] || null;

  return (
    <div className={`relative ${className} flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden`}>
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-500 text-sm p-4 text-center">
          {error}
        </div>
      )}

      {/* Printify Catalog Image as Background */}
      {catalogImage && !loading && (
        <div className="relative w-full h-full">
          <img 
            src={catalogImage} 
            alt={`${type} ${color} shirt`}
            className="w-full h-full object-contain"
            style={{ maxHeight: '400px' }}
          />
          
          {/* Design Overlay */}
          {image && (
            <div
              className="absolute top-[20%] left-[27%] w-[46%] h-[50%] flex items-center justify-center overflow-hidden z-10 pointer-events-none"
              style={{
                transform: 'perspective(1000px) rotateY(0deg) scale(0.8)',
              }}
            >
              <img 
                src={image} 
                alt="Custom Design" 
                className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-lg"
                style={{ 
                  filter: color.toLowerCase() === 'black' || color.toLowerCase() === 'navy' 
                    ? 'brightness(1.1) contrast(1.1)' 
                    : 'contrast(1.05)',
                  transform: 'translateZ(0)',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Fallback to SVG if no catalog image */}
      {!catalogImage && !loading && !error && (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
          <svg 
            viewBox="0 0 512 512" 
            className="w-32 h-32 mb-4"
            style={{ color: '#e5e7eb' }}
          >
            <path 
              fill="currentColor" 
              d="M378.5,64.5c-16.8,19.8-42.2,32.2-69.5,32.2s-52.7-12.4-69.5-32.2c-7.9,0-15.6,0.6-23.2,1.7
                c-3.1,0.5-24.8,3.9-39.2,6.3c-7.8,1.3-15.6,2.2-22.7,2.2c-23.8,0-43.6-14.8-51.6-36.6l-10.7-29.2c-3.5-9.5-12.6-15.8-22.7-15.8
                c-4.9,0-9.7,1.5-13.8,4.3l-28.5,19.6c-13,9-17.5,26.2-10.9,40.6l28.6,62.2c7.6,16.6,23.3,28.1,41.4,30.3l5,0.6v283.4
                c0,16.5,13.4,30,30,30h278.3c16.5,0,30-13.4,30-30V150.5l5.5-0.7c18.1-2.2,33.7-13.8,41.4-30.3l28.6-62.2
                c6.6-14.4,2.1-31.7-10.9-40.6l-28.5-19.6c-4.1-2.8-8.9-4.3-13.8-4.3c-10.1,0-19.2,6.3-22.7,15.8l-10.7,29.2
                c-8,21.8-27.8,36.6-51.6,36.6c-7,0-14.9-0.9-22.7-2.2c-14.5-2.4-36.1-5.8-39.2-6.3C394.1,65.1,386.4,64.5,378.5,64.5z"
            />
          </svg>
          <p className="text-sm">No catalog image available</p>
          {image && (
            <img 
              src={image} 
              alt="Design" 
              className="mt-4 max-w-32 max-h-32 object-contain"
            />
          )}
        </div>
      )}

      {/* Product Info Badge */}
      <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded px-2 py-1 text-xs font-medium text-gray-700">
        {type.charAt(0).toUpperCase() + type.slice(1)} • {size} • {color}
      </div>
    </div>
  );
};
