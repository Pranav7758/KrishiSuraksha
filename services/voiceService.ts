import { Language } from '../types';

// Web Speech API Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type SpeechRecognition = any;

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Language to locale mapping for speech recognition
const languageLocales: Record<Language, string> = {
  [Language.HINDI]: 'hi-IN',
  [Language.ENGLISH]: 'en-US',
  [Language.MARATHI]: 'mr-IN',
  [Language.GUJARATI]: 'gu-IN',
  [Language.PUNJABI]: 'pa-IN',
  [Language.TAMIL]: 'ta-IN',
  [Language.TELUGU]: 'te-IN',
  [Language.KANNADA]: 'kn-IN',
  [Language.MALAYALAM]: 'ml-IN',
  [Language.BENGALI]: 'bn-IN',
  [Language.ODIA]: 'or-IN'
};

// Language to locale for TTS
const ttsBrowserLangs: Record<Language, string> = {
  [Language.HINDI]: 'hi-IN',
  [Language.ENGLISH]: 'en-US',
  [Language.MARATHI]: 'mr-IN',
  [Language.GUJARATI]: 'gu-IN',
  [Language.PUNJABI]: 'pa-IN',
  [Language.TAMIL]: 'ta-IN',
  [Language.TELUGU]: 'te-IN',
  [Language.KANNADA]: 'kn-IN',
  [Language.MALAYALAM]: 'ml-IN',
  [Language.BENGALI]: 'bn-IN',
  [Language.ODIA]: 'or-IN'
};

export interface VoiceOptions {
  language: Language;
  onResultCallback?: (text: string) => void;
  onErrorCallback?: (error: string) => void;
  onListeningChange?: (isListening: boolean) => void;
}

// Initialize Speech Recognition
export const initSpeechRecognition = (options: VoiceOptions) => {
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.error('Speech Recognition not supported in this browser');
    options.onErrorCallback?.('Voice input not supported on your device');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.language = languageLocales[options.language] || 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let interimTranscript = '';

  recognition.onstart = () => {
    interimTranscript = '';
    options.onListeningChange?.(true);
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        interimTranscript = '';
        options.onResultCallback?.(transcript);
      } else {
        interimTranscript = transcript;
      }
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('Speech recognition error:', event.error);
    options.onErrorCallback?.(event.error);
    options.onListeningChange?.(false);
  };

  recognition.onend = () => {
    options.onListeningChange?.(false);
  };

  return recognition;
};

// Start listening for voice input
export const startListening = (recognition: SpeechRecognition | null) => {
  if (recognition) {
    try {
      recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
    }
  }
};

// Stop listening
export const stopListening = (recognition: SpeechRecognition | null) => {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      console.error('Error stopping recognition:', e);
    }
  }
};

// Initialize Text-to-Speech
export const speakText = (text: string, language: Language = Language.ENGLISH) => {
  const synthesis = window.speechSynthesis;

  if (!synthesis) {
    console.error('Text-to-Speech not supported');
    return false;
  }

  // Cancel any ongoing speech
  synthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  (utterance as any).lang = ttsBrowserLangs[language] || 'en-US';
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1;
  utterance.volume = 1;

  synthesis.speak(utterance);
  return true;
};

// Stop speaking
export const stopSpeaking = () => {
  const synthesis = window.speechSynthesis;
  if (synthesis) {
    synthesis.cancel();
  }
};

// Check if browser supports voice
export const isVoiceSupported = (): { speechRecognition: boolean; textToSpeech: boolean } => {
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  const synthesis = window.speechSynthesis;

  return {
    speechRecognition: !!SpeechRecognition,
    textToSpeech: !!synthesis
  };
};

// Speak advisory with breakdown (read sections one by one)
export const speakAdvisoryInParts = async (
  fertilizer: string,
  dosage: string,
  pestControl: string,
  costTip: string,
  language: Language
) => {
  const synthesis = window.speechSynthesis;

  if (!synthesis) {
    console.error('Text-to-Speech not supported');
    return false;
  }

  const parts = [
    `अनुमोदित: ${fertilizer}`, // fertilizer label
    dosage,
    `कीट नियंत्रण: ${pestControl}`, // Pest control label
    `बचत सुझाव: ${costTip}` // Cost saving label
  ];

  for (const part of parts) {
    const utterance = new SpeechSynthesisUtterance(part);
    (utterance as any).lang = ttsBrowserLangs[language] || 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1;

    await new Promise((resolve) => {
      utterance.onend = () => resolve(null);
      synthesis.speak(utterance);
    });

    // Pause between sections
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return true;
};
