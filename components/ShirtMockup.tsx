
import React from 'react';

interface Props {
  colorHex: string;
  image: string | null;
  className?: string;
}

export const ShirtMockup: React.FC<Props> = ({ colorHex, image, className = "" }) => {
  return (
    <div className={`relative ${className} flex items-center justify-center`}>
      <svg 
        viewBox="0 0 512 512" 
        className="w-full h-full drop-shadow-xl"
        style={{ color: colorHex }}
      >
        <defs>
          <filter id="fabric-texture" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.1 0" in="noise" result="coloredNoise" />
            <feComposite operator="in" in="coloredNoise" in2="SourceGraphic" result="composite" />
            <feBlend mode="multiply" in="composite" in2="SourceGraphic" />
          </filter>
          <mask id="shirt-mask">
             <path fill="white" d="M378.5,64.5c-16.8,19.8-42.2,32.2-69.5,32.2s-52.7-12.4-69.5-32.2c-7.9,0-15.6,0.6-23.2,1.7
		c-3.1,0.5-24.8,3.9-39.2,6.3c-7.8,1.3-15.6,2.2-22.7,2.2c-23.8,0-43.6-14.8-51.6-36.6l-10.7-29.2c-3.5-9.5-12.6-15.8-22.7-15.8
		c-4.9,0-9.7,1.5-13.8,4.3l-28.5,19.6c-13,9-17.5,26.2-10.9,40.6l28.6,62.2c7.6,16.6,23.3,28.1,41.4,30.3l5,0.6v283.4
		c0,16.5,13.4,30,30,30h278.3c16.5,0,30-13.4,30-30V150.5l5.5-0.7c18.1-2.2,33.7-13.8,41.4-30.3l28.6-62.2
		c6.6-14.4,2.1-31.7-10.9-40.6l-28.5-19.6c-4.1-2.8-8.9-4.3-13.8-4.3c-10.1,0-19.2,6.3-22.7,15.8l-10.7,29.2
		c-8,21.8-27.8,36.6-51.6,36.6c-7,0-14.9-0.9-22.7-2.2c-14.5-2.4-36.1-5.8-39.2-6.3C394.1,65.1,386.4,64.5,378.5,64.5z"/>
          </mask>
        </defs>
        
        {/* Shirt Base */}
        <path 
          fill="currentColor" 
          d="M378.5,64.5c-16.8,19.8-42.2,32.2-69.5,32.2s-52.7-12.4-69.5-32.2c-7.9,0-15.6,0.6-23.2,1.7
		c-3.1,0.5-24.8,3.9-39.2,6.3c-7.8,1.3-15.6,2.2-22.7,2.2c-23.8,0-43.6-14.8-51.6-36.6l-10.7-29.2c-3.5-9.5-12.6-15.8-22.7-15.8
		c-4.9,0-9.7,1.5-13.8,4.3l-28.5,19.6c-13,9-17.5,26.2-10.9,40.6l28.6,62.2c7.6,16.6,23.3,28.1,41.4,30.3l5,0.6v283.4
		c0,16.5,13.4,30,30,30h278.3c16.5,0,30-13.4,30-30V150.5l5.5-0.7c18.1-2.2,33.7-13.8,41.4-30.3l28.6-62.2
		c6.6-14.4,2.1-31.7-10.9-40.6l-28.5-19.6c-4.1-2.8-8.9-4.3-13.8-4.3c-10.1,0-19.2,6.3-22.7,15.8l-10.7,29.2
		c-8,21.8-27.8,36.6-51.6,36.6c-7,0-14.9-0.9-22.7-2.2c-14.5-2.4-36.1-5.8-39.2-6.3C394.1,65.1,386.4,64.5,378.5,64.5z"
        />
        
        {/* Shading / Texture Overlay */}
        <path 
             fill="black"
             opacity="0.1"
             filter="url(#fabric-texture)"
             d="M378.5,64.5c-16.8,19.8-42.2,32.2-69.5,32.2s-52.7-12.4-69.5-32.2c-7.9,0-15.6,0.6-23.2,1.7
		c-3.1,0.5-24.8,3.9-39.2,6.3c-7.8,1.3-15.6,2.2-22.7,2.2c-23.8,0-43.6-14.8-51.6-36.6l-10.7-29.2c-3.5-9.5-12.6-15.8-22.7-15.8
		c-4.9,0-9.7,1.5-13.8,4.3l-28.5,19.6c-13,9-17.5,26.2-10.9,40.6l28.6,62.2c7.6,16.6,23.3,28.1,41.4,30.3l5,0.6v283.4
		c0,16.5,13.4,30,30,30h278.3c16.5,0,30-13.4,30-30V150.5l5.5-0.7c18.1-2.2,33.7-13.8,41.4-30.3l28.6-62.2
		c6.6-14.4,2.1-31.7-10.9-40.6l-28.5-19.6c-4.1-2.8-8.9-4.3-13.8-4.3c-10.1,0-19.2,6.3-22.7,15.8l-10.7,29.2
		c-8,21.8-27.8,36.6-51.6,36.6c-7,0-14.9-0.9-22.7-2.2c-14.5-2.4-36.1-5.8-39.2-6.3C394.1,65.1,386.4,64.5,378.5,64.5z"
        />

        {/* Neck label area */}
        <path fill="#000000" opacity="0.1" d="M309,96.7c-27.3,0-52.7-12.4-69.5-32.2C222.7,84.3,197.3,96.7,170,96.7v10c27.3,0,52.7-12.4,69.5-32.2c16.8,19.8,42.2,32.2,69.5,32.2V96.7z"/>
      </svg>

      {/* Design Overlay */}
      <div
         className="absolute top-[20%] left-[27%] w-[46%] h-[50%] flex items-center justify-center overflow-hidden z-10 pointer-events-none"
      >
        {image && (
          <img 
            src={image} 
            alt="Design" 
            className="max-w-full max-h-full object-contain mix-blend-multiply" 
            style={{ filter: colorHex === '#111827' || colorHex === '#1e3a8a' || colorHex === '#dc2626' ? 'none' : 'contrast(1.1)' }}
          />
        )}
      </div>
    </div>
  );
};
