import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Zap, ZapOff, RotateCcw } from 'lucide-react';
import { Language } from '../types';
import { getLabel } from '../translations';

interface CameraCaptureProps {
  onCapture: (data: string | File) => void;
  isLoading: boolean;
  language?: Language;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, isLoading, language = Language.ENGLISH }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initialize Camera
  const startCamera = async () => {
    try {
      setError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsStreaming(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check permissions or try uploading a file.");
      setIsStreaming(false);
    }
  };

  // 2. Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsStreaming(false);
  };

  // 3. Switch Camera
  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
  };

  useEffect(() => {
    if (isStreaming) {
      startCamera();
    }
  }, [facingMode]);

  // 4. Bind Stream to Video Element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream, isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64Image = canvas.toDataURL('image/jpeg', 0.85);
        onCapture(base64Image);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCapture(e.target.files[0]);
    }
  };

  if (isStreaming) {
    return (
      <div className="relative bg-black rounded-3xl overflow-hidden aspect-[3/4] md:aspect-video shadow-2xl">
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        
        {/* Overlay Guides */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
             <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-0.5 -ml-0.5 rounded-tl-sm"></div>
             <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-0.5 -mr-0.5 rounded-tr-sm"></div>
             <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-0.5 -ml-0.5 rounded-bl-sm"></div>
             <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-0.5 -mr-0.5 rounded-br-sm"></div>
             <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
          </div>
          <p className="text-white/80 text-xs font-medium mt-4 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
            Align QR Code or Batch No. here
          </p>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-center">
           <button 
             onClick={stopCamera}
             className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors"
           >
             <X size={24} />
           </button>
           
           <button 
             onClick={capturePhoto}
             className="w-16 h-16 rounded-full bg-white border-4 border-green-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
           >
             <div className="w-12 h-12 rounded-full bg-green-500"></div>
           </button>
           
           <button 
             onClick={switchCamera}
             className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors"
           >
             <RotateCcw size={24} />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 flex items-center gap-2">
           <ZapOff size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={startCamera}
          disabled={isLoading}
          className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-8 bg-green-50 border-2 border-dashed border-green-300 rounded-2xl hover:bg-green-100 transition-colors group relative overflow-hidden"
        >
          <div className="bg-green-100 p-4 rounded-full mb-3 group-hover:bg-white transition-colors relative z-10">
            <Camera size={32} className="text-green-600" />
          </div>
          <span className="font-semibold text-green-800 relative z-10">{getLabel(language, 'openCamera')}</span>
          <span className="text-xs text-green-600 mt-1 relative z-10">{getLabel(language, 'scanLive')}</span>
          
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
               <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </button>

        <div className="col-span-2 md:col-span-1">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-colors"
            >
              <div className="bg-white p-3 rounded-xl shadow-sm mb-3">
                <ImageIcon size={28} className="text-gray-600" />
              </div>
              <span className="font-semibold text-gray-800">{getLabel(language, 'uploadImage')}</span>
              <span className="text-xs text-gray-500 mt-1">{getLabel(language, 'fromGallery')}</span>
            </button>
        </div>
      </div>
    </div>
  );
};