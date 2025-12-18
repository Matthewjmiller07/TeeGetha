
import React, { useState, useEffect } from 'react';
import { AppStep, FamilyMember, STYLES, SHIRT_COLORS, ShippingDetails, PaymentDetails } from './types';
import { IS_TEST_MODE, TEST_ASSETS, API_BASE_URL } from './config';
import { StepIndicator } from './components/StepIndicator';
import { Button } from './components/Button';
import { ShirtMockup, PrintifyShirtMockup } from './components/ShirtMockup';
import { PrintifyShirtMockup as NewPrintifyShirtMockup } from './components/PrintifyShirtMockup';
import { analyzeGroupPhoto, generateStylizedMember, generateFamilyShirtPreview, AnalyzedPerson } from './services/geminiService';
import { createPrintOrder, processPayment } from './services/printService';
import { Upload, Users, Sparkles, ShoppingCart, Share2, ArrowRight, Trash2, Plus, Download, CreditCard, RefreshCw, ChevronLeft, MapPin, CheckCircle, Package } from 'lucide-react';

// API Key Selection Component
const ApiKeySelection = ({ onSelect }: { onSelect: () => void }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Sparkles size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup Required</h2>
      <p className="text-gray-600 mb-6 leading-relaxed">
        To generate high-quality custom designs with <b>Gemini 3 Pro</b>, you must connect a Google Cloud project with billing enabled.
      </p>
      
      <Button onClick={onSelect} className="w-full justify-center py-3 mb-6 text-lg shadow-lg shadow-indigo-200">
        Connect Google Cloud Project
      </Button>
      
      <p className="text-xs text-gray-500">
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600 transition-colors">
          Learn about Gemini API billing
        </a>
      </p>
    </div>
  </div>
);

// Helper to crop image
const cropImageFromDataUrl = (dataUrl: string, box: number[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');

      // Box is [ymin, xmin, ymax, xmax] in 0-1000 scale
      const [ymin, xmin, ymax, xmax] = box;
      
      // Add a little padding (15%) around the face/person
      const wRaw = xmax - xmin;
      const hRaw = ymax - ymin;
      
      const padX = wRaw * 0.15;
      const padY = hRaw * 0.2; // slightly more vertical padding for torso

      const x = Math.max(0, (xmin - padX) / 1000 * img.width);
      const y = Math.max(0, (ymin - padY) / 1000 * img.height);
      const w = Math.min(img.width - x, (wRaw + padX * 2) / 1000 * img.width);
      const h = Math.min(img.height - y, (hRaw + padY * 2) / 1000 * img.height);

      // Make it square-ish if possible for better portraits
      const size = Math.max(w, h);
      canvas.width = size;
      canvas.height = size;

      // Fill white background just in case
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);

      // Draw image centered in square
      const offsetX = (size - w) / 2;
      const offsetY = (size - h) / 2;

      ctx.drawImage(img, x, y, w, h, offsetX, offsetY, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const removeBackground = async (image: string): Promise<string> => {
  const endpoint = API_BASE_URL ? `${API_BASE_URL}/api/remove-background` : '/api/remove-background';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`remove-background failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.url || image;
};

const addTextToImage = async (baseUrlOrDataUrl: string, text: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      ctx.drawImage(img, 0, 0);

      const fontSize = Math.floor(canvas.height * 0.1);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const x = canvas.width / 2;
      const y = canvas.height - canvas.height * 0.05;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = Math.max(2, fontSize * 0.08);
      ctx.fillStyle = 'white';

      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
    img.src = baseUrlOrDataUrl;
  });
};

// Roster row component with local state to avoid focus loss while typing
interface RosterRowProps {
  member: FamilyMember;
  onUpdate: (id: string, field: keyof FamilyMember, value: any) => void;
  onRemove: (id: string) => void;
  onChangePhoto: (e: React.ChangeEvent<HTMLInputElement>, memberId: string) => void;
}

const RosterRow: React.FC<RosterRowProps> = ({ member, onUpdate, onRemove, onChangePhoto }) => {
  const [localName, setLocalName] = useState(member.name);
  const [localDescription, setLocalDescription] = useState(member.description);

  useEffect(() => {
    setLocalName(member.name);
    setLocalDescription(member.description);
  }, [member.id, member.name, member.description]);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
      {/* Image Upload for Individual */}
      <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
        {member.originalImage ? (
          <img src={member.originalImage} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <UserIcon />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => onChangePhoto(e, member.id)}
        />
        <div className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-bold">
          REPLACE PHOTO
        </div>
      </div>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Name</label>
          <input
            type="text"
            placeholder="Name"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => onUpdate(member.id, 'name', localName)}
            className="border rounded px-3 py-2 w-full text-sm font-medium"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">AI Prompt / Description</label>
          <input
            type="text"
            placeholder="Visual Description (e.g. 'Man with red glasses')"
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={() => onUpdate(member.id, 'description', localDescription)}
            className="border rounded px-3 py-2 w-full text-sm text-gray-600"
          />
        </div>
      </div>

      <button
        onClick={() => onRemove(member.id)}
        className="text-gray-400 hover:text-red-500 p-2"
        title="Remove"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.LANDING);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(STYLES[0].id);
  const [familyFrontStyleId, setFamilyFrontStyleId] = useState<string | null>(null);
  const [familyLabel, setFamilyLabel] = useState<string>('The Millers');
  const [familyFrontImage, setFamilyFrontImage] = useState<string | null>(null);
  const [familyCheckoutPreview, setFamilyCheckoutPreview] = useState<string | null>(null);
  const [isGeneratingFamilyPreview, setIsGeneratingFamilyPreview] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const [selectedShirtColor, setSelectedShirtColor] = useState(SHIRT_COLORS[0]);
  const [familyShirtType, setFamilyShirtType] = useState<'men' | 'women' | 'kids'>('men');
  
  // Checkout State
  const [shipping, setShipping] = useState<ShippingDetails>({
    fullName: 'Test User',
    addressLine1: '123 Family Lane',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    email: 'test@example.com',
  });
  const [payment, setPayment] = useState<PaymentDetails>({
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/30',
    cvc: '123',
  });
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; estimatedDelivery: string } | null>(null);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasSelected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasSelected);
        } else {
          setHasApiKey(!!process.env.API_KEY);
        }
      } catch (e) {
        console.error("Error checking API key:", e);
      } finally {
        setIsCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleBack = () => {
    const order = [AppStep.LANDING, AppStep.UPLOAD, AppStep.ROSTER, AppStep.DESIGN, AppStep.SHOP, AppStep.CHECKOUT, AppStep.SUCCESS];
    const currentIndex = order.indexOf(step);
    if (currentIndex > 0) {
      setStep(order[currentIndex - 1]);
    }
  };

  const handleStepClick = (targetStep: AppStep) => {
    const order = [AppStep.LANDING, AppStep.UPLOAD, AppStep.ROSTER, AppStep.DESIGN, AppStep.SHOP, AppStep.CHECKOUT, AppStep.SUCCESS];
    const currentIndex = order.indexOf(step);
    const targetIndex = order.indexOf(targetStep);
    
    // Allow going back to any previous step
    if (targetIndex <= currentIndex) {
      setStep(targetStep);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGroup: boolean, memberId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      
      if (isGroup) {
        setGroupPhoto(result);
        setIsAnalyzing(true);
        try {
          // Analyze group photo and get boxes
          const people: AnalyzedPerson[] = await analyzeGroupPhoto(result);
          
          const newMembers: FamilyMember[] = [];
          
          if (people.length > 0) {
            // Process each person detected
            for (let i = 0; i < people.length; i++) {
              const person = people[i];
              let avatarUrl = null;
              
              // Crop if box is valid
              if (person.box_2d && person.box_2d.length === 4) {
                 try {
                   avatarUrl = await cropImageFromDataUrl(result, person.box_2d);
                 } catch (err) {
                   console.error("Failed to crop", err);
                 }
              }

              newMembers.push({
                id: `mem-${Date.now()}-${i}`,
                name: `Member ${i + 1}`,
                role: 'Family',
                originalImage: avatarUrl, // Now populated with cropped face
                generatedImage: null,
                description: person.description,
                size: 'M',
                quantity: 1,
                shirtType: 'MEN',
                shirtColorName: selectedShirtColor.name,
                styleId: selectedStyleId,
              });
            }
          }

          if (newMembers.length > 0) {
            setMembers(newMembers);
          } else {
              setMembers([{
                 id: `mem-${Date.now()}`,
                 name: 'Member 1',
                 originalImage: result, // Fallback to full image if no faces detected
                 generatedImage: null,
                 description: 'A cheerful family member',
                 size: 'M',
                 quantity: 1,
                 shirtType: 'MEN',
                 shirtColorName: selectedShirtColor.name,
                 styleId: selectedStyleId,
              }]);
          }
          setStep(AppStep.ROSTER);
        } catch (error) {
           console.error(error);
           alert("Failed to analyze image. Please ensure your API key has the correct permissions.");
        } finally {
          setIsAnalyzing(false);
        }
      } else if (memberId) {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, originalImage: result } : m));
      }
    };
    reader.readAsDataURL(file);
  };

  const addMember = () => {
    setMembers([...members, {
      id: `mem-${Date.now()}`,
      name: `Member ${members.length + 1}`,
      originalImage: null,
      generatedImage: null,
      description: '',
      size: 'M',
      quantity: 1,
      shirtType: 'MEN',
      shirtColorName: selectedShirtColor.name,
      styleId: selectedStyleId,
    }]);
  };

  const removeMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  // Fixed updateMember to use functional state update to prevent stale closures
  const updateMember = (id: string, field: keyof FamilyMember, value: any) => {
    setMembers(prevMembers => prevMembers.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // Experimental: try to derive each member's back image from the stylized family image
  // by running segmentation on the stylized art, cropping it, then running
  // background removal + text overlay. If detection fails or the counts
  // don't match, we fall back to per-member generation.
  const tryGenerateBacksFromStylizedFamily = async (stylizedFamilyImage: string): Promise<boolean> => {
    try {
      // Gemini analyzeGroupPhoto expects inline image bytes (base64 data URL), not an HTTP URL.
      // If generateStylizedMember returned a URL (e.g. from Replicate), skip this
      // experimental path and fall back to the per-member generation pipeline.
      if (!stylizedFamilyImage.startsWith('data:')) {
        return false;
      }

      const people: AnalyzedPerson[] = await analyzeGroupPhoto(stylizedFamilyImage);
      if (!people || people.length === 0 || people.length !== members.length) {
        return false;
      }

      // Ensure all have valid boxes first
      if (people.some(p => !p.box_2d || p.box_2d.length !== 4)) {
        return false;
      }

      const updatedMembers: FamilyMember[] = await Promise.all(members.map(async (member, index) => {
        const firstName = (member.name || '').trim().split(' ')[0] || 'Family Member';
        try {
          const cropped = await cropImageFromDataUrl(stylizedFamilyImage, people[index].box_2d);
          const bgRemoved = await removeBackground(cropped);
          const withName = await addTextToImage(bgRemoved, firstName);
          return { ...member, generatedImage: withName };
        } catch (e) {
          console.error('Failed to derive back from stylized family for member', member.id, e);
          return member;
        }
      }));

      setMembers(updatedMembers);
      return true;
    } catch (e) {
      console.error('analyzeGroupPhoto on stylized family failed, falling back:', e);
      return false;
    }
  };

  const generateDesignForMember = async (member: FamilyMember) => {
    const effectiveStyleId = member.styleId || selectedStyleId;
    const style = STYLES.find(s => s.id === effectiveStyleId) || STYLES[0];
    
    setIsGenerating(prev => ({ ...prev, [member.id]: true }));
    
    try {
      const firstName = (member.name || '').trim().split(' ')[0] || 'Family Member';
      const labelForPrompt = familyLabel.trim() || 'our family shirt design';
      const baseDescription = (member.description || `A portrait of ${firstName}`) +
        `. Match the art style, clothing, and overall look of the family front illustration for "${labelForPrompt}". ` +
        `Only show this one person, no extra characters or additional people. Use a simple, clear background suitable for the back of a t-shirt.`;
      // Use the cropped image (member.originalImage) for generation
      const raw = await generateStylizedMember(member.originalImage || groupPhoto, baseDescription, style.promptModifier);
      const bgRemoved = await removeBackground(raw);
      const withName = await addTextToImage(bgRemoved, firstName);
      updateMember(member.id, 'generatedImage', withName);
    } catch (e: any) {
      console.error("Generation error:", e);
      if (e.message && (e.message.includes("Requested entity was not found") || e.message.includes("PERMISSION_DENIED") || e.status === 403)) {
        setHasApiKey(false);
        alert("Authorization failed or API key invalid. Please select your Google Cloud Project again.");
      } else {
        alert("Failed to generate image. Please try again.");
      }
    } finally {
      setIsGenerating(prev => ({ ...prev, [member.id]: false }));
    }
  };

  const generateFamilyFront = async () => {
    if (!groupPhoto) return;
    const effectiveStyleId = familyFrontStyleId || selectedStyleId;
    const style = STYLES.find(s => s.id === effectiveStyleId) || STYLES[0];
    try {
      const label = familyLabel.trim() || 'Our Family';
      const description = `A stylized family portrait illustration of the whole family, designed for the front of a t-shirt. ` +
        `Show exactly the people from the supplied photo and do not add any new or extra characters.`;
      const raw = await generateStylizedMember(groupPhoto, description, style.promptModifier);

      // Experimental: attempt to derive member backs from the stylized family image.
      // If this succeeds, each member will already have a generatedImage based on
      // the same family artwork; if it fails, we'll fall back to per-member
      // generation inside generateAll.
      await tryGenerateBacksFromStylizedFamily(raw);

      const bgRemoved = await removeBackground(raw);
      const withLabel = await addTextToImage(bgRemoved, label);
      setFamilyFrontImage(withLabel);
    } catch (e) {
      console.error('Failed to generate family front image', e);
      alert('Failed to generate family front image. Please try again.');
    }
  };

  const generateAll = async () => {
     if (groupPhoto && !familyFrontImage) {
       await generateFamilyFront();
     }
     for (const member of members) {
         if (!member.generatedImage) {
             await generateDesignForMember(member);
         }
     }
  };

  const getTotalCost = () => {
    return members.reduce((acc, m) => acc + (m.quantity * 25), 0);
  };

  const getColorHexForMember = (member: FamilyMember): string => {
    const name = member.shirtColorName;
    if (name) {
      const match = SHIRT_COLORS.find(c => c.name === name);
      if (match) return match.hex;
    }
    return selectedShirtColor.hex;
  };

  const handleGenerateFamilyCheckoutPreview = async () => {
    if (!groupPhoto || !familyFrontImage || isGeneratingFamilyPreview) return;
    setIsGeneratingFamilyPreview(true);
    try {
      const label = familyLabel.trim() || 'Our Family';
      const preview = await generateFamilyShirtPreview(groupPhoto, familyFrontImage, label);
      setFamilyCheckoutPreview(preview);
    } catch (e) {
      console.error('Failed to generate family checkout preview', e);
      alert('Could not generate the family shirt preview. Please try again.');
    } finally {
      setIsGeneratingFamilyPreview(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingOrder(true);
    try {
      // 1. Process Payment
      await processPayment(getTotalCost(), payment);
      
      // 2. Send to Print Service
      const result = await createPrintOrder(
        members,
        shipping,
        selectedShirtColor.name,
        familyFrontImage || groupPhoto
      );
      setOrderResult(result);
      setStep(AppStep.SUCCESS);
    } catch (error) {
      alert("Payment failed or invalid details. Please check your card info.");
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // --- Views ---

  const LandingView = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="bg-indigo-50 p-4 rounded-full mb-6">
        <Users size={48} className="text-indigo-600" />
      </div>
      <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
        KinConnect <span className="text-indigo-600">Design</span>
      </h1>
      <p className="text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
        Create unforgettable family reunion t-shirts in minutes. 
        Upload your photos, let our AI stylize them into amazing designs, 
        and order direct-to-garment prints for the whole crew.
      </p>

      <Button onClick={() => setStep(AppStep.UPLOAD)} className="text-lg px-10 py-4 shadow-xl shadow-indigo-200">
        Start New Project <ArrowRight className="ml-2" />
      </Button>
    </div>
  );

  const UploadView = () => (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
          <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
          <h2 className="text-3xl font-bold text-gray-800">Start Project</h2>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer group relative">
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => handleFileUpload(e, true)}
          />
          <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <Users size={32} className="text-indigo-600" />
          </div>
          <h3 className="font-bold text-xl mb-2">Upload Group Photo</h3>
          <p className="text-gray-500 text-sm">We'll detect family members and suggest avatars for everyone based on the photo.</p>
          {isAnalyzing && <p className="text-indigo-600 font-medium mt-4 animate-pulse">Analyzing photo...</p>}
        </div>

        <div 
          onClick={() => {
            setMembers([{
                id: `mem-${Date.now()}`,
                name: 'Member 1',
                originalImage: null,
                generatedImage: null,
                description: '',
                size: 'M',
                quantity: 1,
                shirtType: 'MEN',
                shirtColorName: selectedShirtColor.name,
            }]);
            setStep(AppStep.ROSTER);
          }}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center text-center hover:border-teal-500 hover:bg-teal-50 transition-colors cursor-pointer group"
        >
          <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <Plus size={32} className="text-teal-600" />
          </div>
          <h3 className="font-bold text-xl mb-2">Build from Scratch</h3>
          <p className="text-gray-500 text-sm">Add family members one by one and upload individual photos later.</p>
        </div>
      </div>
    </div>
  );

  const RosterView = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
            <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Review Roster</h2>
                <p className="text-gray-500 text-sm">We found {members.length} people. Add names and check their photos.</p>
            </div>
        </div>
        <Button variant="outline" onClick={addMember} className="text-sm">
          <Plus size={16} /> Add Member
        </Button>
      </div>

      <div className="grid gap-4 mb-8">
        {members.map((member) => (
          <RosterRow
            key={member.id}
            member={member}
            onUpdate={updateMember}
            onRemove={removeMember}
            onChangePhoto={(e, memberId) => handleFileUpload(e, false, memberId)}
          />
        ))}
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={() => setStep(AppStep.DESIGN)} disabled={members.length === 0}>
          Next: Choose Style <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );

  const DesignView = () => (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center mb-4">
             <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
             <h2 className="text-3xl font-bold text-gray-900">Choose Art Style</h2>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3">
          {STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => setSelectedStyleId(style.id)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-1 border-2 ${
                selectedStyleId === style.id 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' 
                  : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200'
              }`}
            >
               <span>{style.name}</span>
               {selectedStyleId === style.id && <Sparkles size={12} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col gap-2 text-indigo-800 flex-1">
             <div className="flex items-start gap-2">
               <Sparkles size={20} className="mt-[2px]" />
               <span className="font-medium text-sm md:text-base">
                 Choose how you want each shirt to look. The style you pick here is the default, and you can override it for the family front and for each person.
               </span>
             </div>
             <div className="text-xs text-indigo-900/80">
               Front style: <b>{STYLES.find(s => s.id === (familyFrontStyleId || selectedStyleId))?.name}</b>
             </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1">
              <label className="text-xs font-bold text-indigo-900 uppercase mb-1 block">Family Label (front of shirt)</label>
              <input
                type="text"
                value={familyLabel}
                onChange={(e) => setFamilyLabel(e.target.value)}
                placeholder="The Millers"
                className="border border-indigo-200 rounded px-3 py-2 w-full text-sm bg-white"
              />
            </div>
            <div className="flex flex-col gap-2 items-stretch">
              <label className="text-xs font-bold text-indigo-900 uppercase mb-1 block">Front Style</label>
              <select
                value={familyFrontStyleId || selectedStyleId}
                onChange={(e) => setFamilyFrontStyleId(e.target.value)}
                className="border border-indigo-200 rounded px-2 py-1 text-xs bg-white"
              >
                {STYLES.map(style => (
                  <option key={style.id} value={style.id}>{style.name}</option>
                ))}
              </select>
              <Button variant="outline" onClick={generateFamilyFront} disabled={!groupPhoto || Object.values(isGenerating).some(Boolean)}>
                Generate Family Front
              </Button>
              {familyFrontImage && (
                <span className="text-[11px] text-indigo-700 font-medium">Family front image ready</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={generateAll} disabled={Object.values(isGenerating).some(Boolean)}>
            Generate All Designs
          </Button>
        </div>
      </div>

      {familyFrontImage && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Front Preview</h3>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 inline-block">
            <div className={`aspect-square w-64 relative ${STYLES.find(s=>s.id === selectedStyleId)?.previewColor} flex items-center justify-center overflow-hidden bg-opacity-20`}>
              <div className="w-[85%] h-[85%] relative">
                <NewPrintifyShirtMockup
                  type={familyShirtType}
                  size="M"
                  color={selectedShirtColor.name}
                  image={familyFrontImage}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {members.map(member => (
          <div key={member.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`aspect-square relative ${STYLES.find(s=>s.id === selectedStyleId)?.previewColor} flex items-center justify-center overflow-hidden bg-opacity-20`}>
              
              {/* Realistic Shirt Mockup */}
              <div className="w-[85%] h-[85%] relative">
                  <NewPrintifyShirtMockup 
                    type={(member.shirtType || 'MEN').toLowerCase() as 'men' | 'women' | 'kids'}
                    size={member.size || 'M'}
                    color={member.shirtColorName || selectedShirtColor.name}
                    image={member.generatedImage}
                    className="w-full h-full"
                  />
                  
                  {/* Placeholder state inside the shirt area if no image */}
                  {!member.generatedImage && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center p-4 bg-white/90 rounded-xl shadow-sm backdrop-blur-sm">
                            {member.originalImage && (
                                <img src={member.originalImage} className="w-10 h-10 rounded-full mx-auto mb-2 object-cover opacity-50 grayscale" alt="ref" />
                            )}
                            <p className="text-[10px] text-gray-500 font-bold uppercase">{selectedStyleId}</p>
                            <p className="text-[10px] text-gray-400">Waiting...</p>
                        </div>
                    </div>
                  )}
              </div>

              {/* Loader Overlay */}
              {isGenerating[member.id] && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                   <Sparkles className="animate-spin text-indigo-500 mb-2" size={32} />
                   <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Designing...</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-white">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900">{member.name}</h3>
                <button 
                  onClick={() => generateDesignForMember(member)}
                  className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                  disabled={isGenerating[member.id]}
                >
                  <RefreshCw size={12} /> {member.generatedImage ? 'Regenerate' : 'Generate'}
                </button>
              </div>
              <p className="text-xs text-gray-500 line-clamp-1 mb-2">{member.description}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[11px] text-gray-400">Style</span>
                <select
                  value={member.styleId || selectedStyleId}
                  onChange={(e) => updateMember(member.id, 'styleId', e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-[11px] bg-white flex-1"
                >
                  {STYLES.map(style => (
                    <option key={style.id} value={style.id}>{style.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex justify-between items-center bg-gray-50 p-6 rounded-2xl">
         <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">Preview Shirt Color:</span>
            <div className="flex gap-2">
                {SHIRT_COLORS.map((c) => (
                    <button 
                        key={c.name}
                        onClick={() => setSelectedShirtColor(c)}
                        className={`w-8 h-8 rounded-full border shadow-sm ${c.class} ${selectedShirtColor.name === c.name ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                        title={c.name}
                    />
                ))}
            </div>
         </div>
         <Button onClick={() => setStep(AppStep.SHOP)} className="px-8">
            Go to Shop <ArrowRight size={16} />
         </Button>
      </div>
    </div>
  );

  const getColorOptionsForType = (shirtType: 'MEN' | 'WOMEN' | 'KIDS' | undefined): string[] => {
    if (shirtType === 'WOMEN') {
      return ['Black', 'White'];
    }
    // MEN and KIDS share the same visible color options; kids ignore color in mapping
    return ['Black', 'Solid Athletic Grey'];
  };

  const ShopView = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
          <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
          <h2 className="text-3xl font-bold">Order Summary</h2>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-medium text-gray-500">Design</th>
              <th className="p-4 font-medium text-gray-500">Member</th>
              <th className="p-4 font-medium text-gray-500">Shirt Type</th>
              <th className="p-4 font-medium text-gray-500">Color</th>
              <th className="p-4 font-medium text-gray-500">Size</th>
              <th className="p-4 font-medium text-gray-500">Qty</th>
              <th className="p-4 font-medium text-gray-500 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="p-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-50 overflow-hidden border border-gray-200 relative">
                     <NewPrintifyShirtMockup 
                        type={(member.shirtType || 'MEN').toLowerCase() as 'men' | 'women' | 'kids'}
                        size={member.size || 'M'}
                        color={member.shirtColorName || selectedShirtColor.name}
                        image={member.generatedImage || (IS_TEST_MODE ? TEST_ASSETS.checkerTest : null)}
                        className="w-full h-full"
                     />
                  </div>
                </td>
                <td className="p-4 font-medium">{member.name}</td>
                <td className="p-4">
                  <select
                    value={member.shirtType || 'MEN'}
                    onChange={(e) => {
                      const newType = e.target.value as 'MEN' | 'WOMEN' | 'KIDS';
                      const colors = getColorOptionsForType(newType);
                      updateMember(member.id, 'shirtType', newType);
                      if (!colors.includes(member.shirtColorName || '')) {
                        updateMember(member.id, 'shirtColorName', colors[0]);
                      }
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value="MEN">Men</option>
                    <option value="WOMEN">Women</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </td>
                <td className="p-4">
                  {(() => {
                    const type = member.shirtType || 'MEN';
                    const colors = getColorOptionsForType(type);
                    const current = member.shirtColorName || colors[0];
                    return (
                      <select
                        value={current}
                        onChange={(e) => updateMember(member.id, 'shirtColorName', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                      >
                        {colors.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    );
                  })()}
                </td>
                <td className="p-4">
                  <select 
                    value={member.size}
                    onChange={(e) => updateMember(member.id, 'size', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-4">
                  <input 
                    type="number" 
                    min="0"
                    value={member.quantity} 
                    onChange={(e) => updateMember(member.id, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </td>
                <td className="p-4 text-right text-gray-900 font-medium">
                  ${(member.quantity * 25).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="p-4 text-right font-bold text-gray-600">Total:</td>
              <td className="p-4 text-right font-bold text-xl text-indigo-600">${getTotalCost().toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between">
         <button 
           onClick={() => alert("Link copied to clipboard!")}
           className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
         >
            <Share2 size={18} /> Share Order Link
         </button>

         <Button 
            onClick={() => setStep(AppStep.CHECKOUT)}
            className="w-full md:w-auto text-lg px-8"
            disabled={getTotalCost() === 0}
         >
            Proceed to Checkout <ShoppingCart size={20} />
         </Button>
      </div>
    </div>
  );

  const CheckoutView = () => (
    <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
            <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
            <h2 className="text-3xl font-bold">Secure Checkout</h2>
        </div>
        
        {/* Mini order preview with shirt designs */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6">
          <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
            <Package size={16} className="text-indigo-600" />
            Order Preview
          </h3>
          <div className="flex flex-wrap gap-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 min-w-[140px]">
                <div className="w-14 h-14 rounded-lg bg-gray-50 overflow-hidden border border-gray-200 flex items-center justify-center">
                  <NewPrintifyShirtMockup
                    type={(member.shirtType || 'MEN').toLowerCase() as 'men' | 'women' | 'kids'}
                    size={member.size || 'M'}
                    color={member.shirtColorName || selectedShirtColor.name}
                    image={member.generatedImage}
                    className="w-full h-full"
                  />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-900">{member.name}</div>
                  <div className="text-gray-500">{member.size} · {member.quantity}x</div>
                </div>
              </div>
            ))}
          </div>

          {groupPhoto && familyFrontImage && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Family photo with shirts
                </span>
                <Button
                  variant="outline"
                  onClick={handleGenerateFamilyCheckoutPreview}
                  disabled={isGeneratingFamilyPreview}
                  className="h-7 px-3 text-xs"
                >
                  {isGeneratingFamilyPreview ? 'Generating…' : 'Generate Preview'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 items-start">
                <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                  <span className="font-semibold text-gray-700">Original photo</span>
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                    <img src={groupPhoto} alt="Original family" className="w-full h-full object-cover" />
                  </div>
                </div>
                {familyCheckoutPreview && (
                  <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                    <span className="font-semibold text-gray-700">Wearing reunion shirts</span>
                    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                      <img src={familyCheckoutPreview} alt="Family wearing shirts" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handlePlaceOrder} className="space-y-6">
            {/* Shipping */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-gray-800">
                    <MapPin size={20} className="text-indigo-600"/> Shipping Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                        <input required className="w-full border rounded-lg p-3" value={shipping.fullName} onChange={e=>setShipping({...shipping, fullName: e.target.value})} placeholder="John Doe" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input required type="email" className="w-full border rounded-lg p-3" value={shipping.email} onChange={e=>setShipping({...shipping, email: e.target.value})} placeholder="john@example.com" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
                        <input required className="w-full border rounded-lg p-3" value={shipping.addressLine1} onChange={e=>setShipping({...shipping, addressLine1: e.target.value})} placeholder="123 Family Lane" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City</label>
                        <input required className="w-full border rounded-lg p-3" value={shipping.city} onChange={e=>setShipping({...shipping, city: e.target.value})} placeholder="New York" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">State</label>
                            <input required className="w-full border rounded-lg p-3" value={shipping.state} onChange={e=>setShipping({...shipping, state: e.target.value})} placeholder="NY" />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ZIP</label>
                            <input required className="w-full border rounded-lg p-3" value={shipping.zip} onChange={e=>setShipping({...shipping, zip: e.target.value})} placeholder="10001" />
                         </div>
                    </div>
                </div>
            </div>

            {/* Payment */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                 <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-gray-800">
                    <CreditCard size={20} className="text-indigo-600"/> Payment Method
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Card Number</label>
                        <input required className="w-full border rounded-lg p-3" value={payment.cardNumber} onChange={e=>setPayment({...payment, cardNumber: e.target.value})} placeholder="0000 0000 0000 0000" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry</label>
                            <input required className="w-full border rounded-lg p-3" value={payment.expiry} onChange={e=>setPayment({...payment, expiry: e.target.value})} placeholder="MM/YY" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CVC</label>
                            <input required className="w-full border rounded-lg p-3" value={payment.cvc} onChange={e=>setPayment({...payment, cvc: e.target.value})} placeholder="123" />
                        </div>
                    </div>
                </div>
            </div>

            <Button className="w-full py-4 text-lg" isLoading={isProcessingOrder}>
                Pay ${getTotalCost().toFixed(2)} & Place Order
            </Button>
        </form>
    </div>
  );

  const SuccessView = () => (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-lg mx-auto">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={40} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600 mb-8">
              Thank you, {shipping.fullName}. Your custom family designs are being processed by our print partners.
          </p>
          
          {orderResult && (
              <div className="w-full bg-indigo-50 p-6 rounded-xl border border-indigo-100 mb-8 text-left">
                  <h3 className="font-bold text-sm text-indigo-800 uppercase mb-4">Order Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-indigo-600 text-sm">Order ID:</span>
                        <span className="font-mono font-bold text-gray-800">{orderResult.orderId}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-indigo-600 text-sm">Est. Delivery:</span>
                        <span className="font-bold text-gray-800">{orderResult.estimatedDelivery}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-indigo-600 text-sm">Total Paid:</span>
                        <span className="font-bold text-gray-800">${getTotalCost().toFixed(2)}</span>
                    </div>
                  </div>
              </div>
          )}

          <Button variant="outline" onClick={() => window.location.reload()}>
              Start Another Project
          </Button>
      </div>
  );

  // --- Main Layout ---

  if (isCheckingKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!hasApiKey) {
    return <ApiKeySelection onSelect={handleSelectKey} />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setStep(AppStep.LANDING)}
          >
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                <Users size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">KinConnect</span>
          </div>
          {step !== AppStep.LANDING && (
            <div className="text-sm text-gray-500 hidden md:block">
               Family Reunion 2024
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {step !== AppStep.SUCCESS && (
            <div 
               onClick={(e) => {
                  // Only allow clicking on StepIndicator if not in Success or Checkout processing
                  if (!isProcessingOrder) {
                    // Logic to find which step was clicked is inside StepIndicator? 
                    // Actually StepIndicator is currently just display. 
                    // To make it interactive we'd need to modify StepIndicator or wrap it.
                    // For now, reliance on Back button and Linear flow is safer to prevent skipping data entry.
                  }
               }}
            >
              <StepIndicator currentStep={step} />
            </div>
        )}
        
        <div className="animate-fade-in">
          {step === AppStep.LANDING && <LandingView />}
          {step === AppStep.UPLOAD && <UploadView />}
          {step === AppStep.ROSTER && <RosterView />}
          {step === AppStep.DESIGN && <DesignView />}
          {step === AppStep.SHOP && <ShopView />}
          {step === AppStep.CHECKOUT && <CheckoutView />}
          {step === AppStep.SUCCESS && <SuccessView />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12 bg-gray-50">
        <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} KinConnect Design. Powered by Google Gemini.
        </div>
      </footer>
    </div>
  );
}

const UserIcon = ({ className = "" }: { className?: string }) => (
  <svg className={`w-8 h-8 ${className}`} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);
