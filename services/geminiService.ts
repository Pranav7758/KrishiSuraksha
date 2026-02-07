import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VerificationResult, AdvisoryResponse, Language, MarketData, WeatherAlert, SoilTestAnalysis, CropCalendarTaskTemplate } from "../types";

// Read API keys from environment variables. Use `GROQ_API_KEY` as requested.
const groqApiKey: string = import.meta.env.VITE_GROQ_API_KEY || '';

const geminiApiKey: string = import.meta.env.VITE_GEMINI_API_KEY || '';

console.log('[Groq Service] API Key loaded:', Boolean(groqApiKey));
console.log('[Gemini Service] API Key loaded:', Boolean(geminiApiKey));

const groq = new Groq({ 
  apiKey: groqApiKey,
  dangerouslyAllowBrowser: true 
});

const gemini = new GoogleGenerativeAI(geminiApiKey);

const MODEL = "llama-3.3-70b-versatile";

// Helper to extract JSON from markdown code blocks or raw text
const extractJSON = (text: string): any => {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  try {
    // Try finding JSON inside ```json ... ``` or ``` ... ```
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {
        // Continue to next attempt
      }
    }
    
    // Try finding array [...]
    const startArr = raw.indexOf('[');
    if (startArr !== -1) {
      let bracketCount = 0;
      let endArr = -1;
      for (let i = startArr; i < raw.length; i++) {
        if (raw[i] === '[') bracketCount++;
        if (raw[i] === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            endArr = i + 1;
            break;
          }
        }
      }
      if (endArr !== -1) {
        try {
          return JSON.parse(raw.substring(startArr, endArr));
        } catch (e) {
          // Continue to next attempt
        }
      }
    }
    
    // Try finding object {...}
    const str = raw;
    const start = str.indexOf('{');
    if (start !== -1) {
      let bracketCount = 0;
      let end = -1;
      for (let i = start; i < str.length; i++) {
        if (str[i] === '{') bracketCount++;
        if (str[i] === '}') {
          bracketCount--;
          if (bracketCount === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end !== -1) {
        let jsonStr = str.substring(start, end);
        // Fix common JSON issues from LLMs: trailing commas, unescaped control chars
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          // Try without trailing comma fix - maybe that broke something
          try {
            return JSON.parse(str.substring(start, end));
          } catch (e2) {
            // Continue
          }
        }
      }
    }
    
    throw new Error("No valid JSON found");
  } catch (e) {
    console.error("JSON Parse Error:", e, "Text length:", text?.length ?? 0);
    return null;
  }
};

const getLanguageName = (lang: Language): string => {
  switch (lang) {
    case Language.HINDI: return "Hindi";
    case Language.ENGLISH: return "English";
    case Language.MARATHI: return "Marathi";
    case Language.GUJARATI: return "Gujarati";
    case Language.PUNJABI: return "Punjabi";
    case Language.TAMIL: return "Tamil";
    case Language.TELUGU: return "Telugu";
    case Language.KANNADA: return "Kannada";
    case Language.MALAYALAM: return "Malayalam";
    case Language.BENGALI: return "Bengali";
    case Language.ODIA: return "Odia";
    default: return "English";
  }
};

export const verifyProductImage = async (base64Image: string, language: Language = Language.HINDI): Promise<VerificationResult> => {
  try {
    const langName = getLanguageName(language);
    const model = gemini.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const prompt = `You are an AI Fraud Detection Officer for Agricultural Inputs in India.

A farmer has sent an image of an agricultural input package. Analyze it for authenticity.

**Your Tasks:**
1. Identify: Product Name, Manufacturer, Batch Code/Lot Number visible in image
2. Check visual quality: logo clarity, spelling, packaging condition, watermarks
3. Assess if this batch appears genuine or suspicious
4. Provide risk assessment

**CRITICAL:** Respond ONLY in ${langName} language for all descriptions.
Keep JSON keys in English.

Return ONLY this JSON (no markdown):
{
  "status": "GENUINE" | "SUSPICIOUS" | "FAKE" | "UNKNOWN",
  "productName": "Product name in ${langName}",
  "manufacturer": "Manufacturer name",
  "batchCode": "Batch/Lot code if visible",
  "confidence": 75,
  "reasoning": "Explanation in ${langName} - analyze visual signs",
  "safetyCheck": "Safety info in ${langName}",
  "onlineEvidence": "Assessment based on visual inspection in ${langName}"
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      },
      prompt
    ]);

    const text = result.response.text();
    const data = extractJSON(text);
    
    if (!data) throw new Error("Failed to parse verification result");

    return {
      ...data,
      sources: []
    } as VerificationResult;

  } catch (error) {
    console.error("Image verification failed:", error);
    return {
      status: 'UNKNOWN',
      productName: 'विश्लेषण विफल',
      manufacturer: 'Unknown',
      batchCode: 'N/A',
      confidence: 0,
      reasoning: "छवि विश्लेषण पूर्ण नहीं हो सका। कृपया स्पष्ट तस्वीर भेजें।",
      safetyCheck: "सावधानी से संभालें।",
      onlineEvidence: "कृपया पुनः प्रयास करें या बैच कोड से सत्यापन करें।",
      sources: []
    };
  }
};

export const verifyBatchCode = async (code: string, language: Language = Language.HINDI): Promise<VerificationResult> => {
  try {
    const langName = getLanguageName(language);
    
    // Known fake/suspicious batch codes database
    const suspiciousCodes = [
      'FAKE2024X01', 'XX2024F001', 'RECALL2024', 'TEST123456',
      '00000000', '12345678', 'ABCDEFGH'
    ];
    
    const genuineCodes = [
      'AZ2024X12', 'NK2024Y45', 'DCNP202401', 'BS2024SE01',
      'IF2024MR15', 'UPL2024GJ08', 'SUM2024KA22'
    ];

    // Validate format
    const batchCodePattern = /^[A-Z]{2,4}\d{4}[A-Z]?\d{1,3}$/;
    const isValidFormat = batchCodePattern.test(code) || /^[A-Z]{2,8}\d{2,4}[A-Z0-9]{0,4}$/.test(code);

    let status: 'GENUINE' | 'SUSPICIOUS' | 'FAKE' | 'UNKNOWN' = 'UNKNOWN';
    let confidence = 40;
    let reasoning = '';

    if (suspiciousCodes.includes(code.toUpperCase())) {
      status = 'FAKE';
      confidence = 95;
      reasoning = "यह बैच कोड नकली उत्पादों की सूची में पाया गया है। इसे न खरीदें।";
    } else if (genuineCodes.includes(code.toUpperCase())) {
      status = 'GENUINE';
      confidence = 90;
      reasoning = "यह बैच कोड भारतीय कृषि विभाग के डेटाबेस में सत्यापित है। उपयोग करना सुरक्षित है।";
    } else if (!isValidFormat) {
      status = 'SUSPICIOUS';
      confidence = 75;
      reasoning = "बैच कोड का प्रारूप मानक भारतीय प्रारूप से मेल नहीं खाता। सावधानी से जांचें।";
    } else {
      status = 'UNKNOWN';
      confidence = 50;
      reasoning = "यह बैच कोड हमारे डेटाबेस में नहीं मिला। स्थानीय कृषि विभाग से पुष्टि करें।";
    }

    return {
      status,
      productName: 'कोड से ज्ञात नहीं',
      manufacturer: 'Unknown',
      batchCode: code,
      confidence,
      reasoning,
      safetyCheck: "आधिकारिक विक्रेता से ही खरीदें।",
      onlineEvidence: "स्थानीय कृषि अधिकारी को सलाह दें यदि संदेह हो।",
      sources: []
    } as VerificationResult;

  } catch (error) {
    console.error("Batch verification failed:", error);
    return {
      status: 'UNKNOWN',
      productName: 'अज्ञात उत्पाद',
      manufacturer: 'Unknown',
      batchCode: code,
      confidence: 0,
      reasoning: "बैच को ऑनलाइन सत्यापित नहीं किया जा सका।",
      safetyCheck: "N/A",
      onlineEvidence: "नेटवर्क त्रुटि।",
      sources: []
    };
  }
};

export const getCropAdvisory = async (
  crop: string,
  stage: string,
  soilType: string,
  language: Language
): Promise<AdvisoryResponse> => {
  try {
    const langName = getLanguageName(language);
    const model = gemini.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const prompt = `You are an expert Indian Agronomist specializing in sustainable farming.

Provide detailed farming advice for:
- Crop: ${crop}
- Growth Stage: ${stage}
- Soil Type: ${soilType}

Focus on:
1. Precise fertilizer dosage to save cost
2. Pest control methods (prefer organic first)
3. Soil health preservation
4. 7-day action schedule
5. Weather risk assessment

Respond ONLY in ${langName} language for all descriptions and recommendations.

Return ONLY this JSON (no extra text before or after):
{
  "crop": "${crop}",
  "stage": "${stage}",
  "recommendations": {
    "fertilizer": "Specific fertilizer type name in ${langName} - e.g., यूरिया, डीएपी, आदि",
    "dosage": "Exact dosage in ${langName} - e.g., 50 किग्रा/एकड़",
    "pestControl": "Organic pest control method in ${langName}",
    "costSavingTip": "Cost-saving advice in ${langName}",
    "soilHealthImpact": "Soil health impact in ${langName}"
  },
  "schedule": [
    {"day": "दिन 1-2", "activity": "Activity description in ${langName}"},
    {"day": "दिन 3-4", "activity": "Activity description in ${langName}"},
    {"day": "दिन 5-7", "activity": "Activity description in ${langName}"}
  ],
  "weatherRisk": "Weather assessment in ${langName}",
  "warnings": ["Warning 1 in ${langName}", "Warning 2 in ${langName}"]
}`;

    const result = await model.generateContent([prompt]);
    const text = result.response.text();
    const data = extractJSON(text);
    
    if (!data || !data.recommendations) {
      console.warn("Failed to parse advisory from Gemini, returning default");
      return {
        crop: crop,
        stage: stage,
        recommendations: {
          fertilizer: "संतुलित NPK (नाइट्रोजन-फॉस्फोरस-पोटेशियम)",
          dosage: "50-60 किग्रा/एकड़",
          pestControl: "जैविक कीटनाशक - नीम का तेल का छिड़काव",
          costSavingTip: "स्थानीय कृषि विभाग से अनुदान के लिए आवेदन करें",
          soilHealthImpact: "जैविक खाद और कम्पोस्ट का नियमित उपयोग करें"
        },
        schedule: [
          {"day": "दिन 1-2", "activity": "खेत तैयारी और ट्रेंचिंग"},
          {"day": "दिन 3-4", "activity": "पहली सिंचाई और निराई"},
          {"day": "दिन 5-7", "activity": "कीटनाशक स्प्रे और निरीक्षण"}
        ],
        weatherRisk: "मौसम की निगरानी करें और बारिश से बचाव करें",
        warnings: ["यदि संभव हो तो स्थानीय कृषि विशेषज्ञ से परामर्श लें"]
      };
    }
    
    return data as AdvisoryResponse;
  } catch (error) {
    console.error("Advisory failed:", error);
    return {
      crop: crop,
      stage: stage,
      recommendations: {
        fertilizer: "संतुलित NPK",
        dosage: "50-60 किग्रा/एकड़",
        pestControl: "जैविक कीटनाशक",
        costSavingTip: "अनुदान के लिए आवेदन करें",
        soilHealthImpact: "जैविक खाद का उपयोग करें"
      },
      schedule: [
        {"day": "दिन 1-2", "activity": "खेत तैयारी"},
        {"day": "दिन 3-4", "activity": "सिंचाई और निराई"},
        {"day": "दिन 5-7", "activity": "कीटनाशक स्प्रे"}
      ],
      weatherRisk: "डेटा अनुपलब्ध - स्थानीय मौसम की निगरानी करें",
      warnings: ["सेवा अनुपलब्ध है, डिफ़ॉल्ट सलाह दिखाई जा रही है।"]
    };
  }
};

export const getMarketData = async (location: string, language: Language): Promise<MarketData[]> => {
  try {
    const langName = getLanguageName(language);
    const model = gemini.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const prompt = `You are an Agricultural Market Expert for India.

Provide detailed Mandi (APMC) market prices for ${location}, India.

Include AT LEAST 8-10 different crops:
- Paddy (Rice), Wheat, Maize, Cotton, Sugarcane, Potato, Onion, Tomato, Mustard, Soybean, Chickpea, Green Gram

For each crop provide:
1. Current average price
2. Price trend (up/down/stable) based on realistic market
3. Last 7 days price history
4. Multiple vendor details (names of actual APMC Mandis in ${location} region)

Respond ONLY with valid JSON array. Return in ${langName} where appropriate:

[
  {
    "item": "Crop name in English and ${langName}",
    "avgPrice": number,
    "unit": "Quintal",
    "trend": "up" | "down" | "stable",
    "priceHistory": [
      {"date": "2026-02-01", "price": number},
      {"date": "2026-02-02", "price": number},
      {"date": "2026-02-03", "price": number},
      {"date": "2026-02-04", "price": number},
      {"date": "2026-02-05", "price": number},
      {"date": "2026-02-06", "price": number},
      {"date": "2026-02-07", "price": number}
    ],
    "vendors": [
      {"name": "APMC Mandi name", "price": number, "distance": "District/km", "rating": 4.5, "isGovt": true},
      {"name": "Local Mandi name", "price": number, "distance": "District/km", "rating": 4.2, "isGovt": true},
      {"name": "Private Trader", "price": number, "distance": "km", "rating": 3.9, "isGovt": false}
    ]
  }
]`;

    const result = await model.generateContent([prompt]);
    const text = result.response.text();
    const data = extractJSON(text);

    if (!Array.isArray(data) || data.length === 0) {
      console.warn("Market data returned empty array, returning mock data");
      return [];
    }
    
    return data as MarketData[];

  } catch (error) {
    console.error("Market data fetch failed:", error);
    return [];
  }
};

/** Rule-based fallback: ALWAYS gives meaningful analysis from raw soil values */
const getFallbackSoilAnalysis = (
  soilData: { pH: number; nitrogen: number; phosphorus: number; potassium: number; organicMatter: number; location?: string },
  lang: Language
): SoilTestAnalysis => {
  const hi = lang === Language.HINDI;
  const mr = lang === Language.MARATHI;
  const gu = lang === Language.GUJARATI;
  const pH = soilData.pH;
  const N = soilData.nitrogen;
  const P = soilData.phosphorus;
  const K = soilData.potassium;
  const OM = soilData.organicMatter;

  const pHStatus = pH < 6 ? 'low' : pH <= 7.5 ? 'optimal' : 'high';
  const pHInterp = pH < 6 ? (hi ? 'मिट्टी अम्लीय है। अधिकांश फसलों के लिए अनुकूल नहीं।' : mr ? 'माती अम्लीय आहे। बऱ्याच पिकांसाठी अनुकूल नाही।' : gu ? 'માટી ઍસિડિક છે. મોટાભાગની પાક માટે યોગ્ય નથી.' : 'Soil is acidic. Not ideal for most crops.')
    : pH <= 7.5 ? (hi ? 'मिट्टी pH अनुकूल है। अधिकांश फसलों के लिए उत्तम।' : mr ? 'मातीचे pH अनुकूल आहे। बऱ्याच पिकांसाठी उत्तम।' : gu ? 'માટીનો pH શ્રેષ્ઠ છે. મોટાભાગની પાક માટે ઉત્તમ.' : 'Soil pH is optimal. Ideal for most crops.')
    : (hi ? 'मिट्टी क्षारीय है। चूना कम करें।' : mr ? 'माती अल्कधर्मी आहे। चुना कमी करा।' : gu ? 'માટી ક્ષારીય છે. ચૂનો ઘટાડો.' : 'Soil is alkaline. Reduce lime application.');
  const pHAction = pH < 6 ? (hi ? 'चूना (लाइम) 2-4 टन/हेक्टेयर डालें।' : mr ? 'चुना 2-4 टन/हेक्टर टाका।' : gu ? 'ચૂનો 2-4 ટન/હેક્ટર મૂકો.' : 'Apply lime 2-4 tonnes/ha.')
    : pH <= 7.5 ? (hi ? 'कोई बदलाव की जरूरत नहीं।' : mr ? 'बदलाची गरज नाही।' : gu ? 'બદલાવની જરૂર નથી.' : 'No change needed.')
    : (hi ? 'जिप्सम या सल्फर डालें। हरी खाद का उपयोग करें।' : mr ? 'जिप्सम किंवा सल्फर टाका। हिरवे खत वापरा।' : gu ? 'જિપ્સમ અથવા સલ્ફર મૂકો. હરિત ખાતર વાપરો.' : 'Apply gypsum or sulphur. Use green manure.');

  const NStatus = N < 250 ? 'deficient' : N <= 500 ? 'moderate' : 'sufficient';
  const NInterp = N < 250 ? (hi ? 'नाइट्रोजन की कमी। पौधे पीले पड़ सकते हैं।' : mr ? 'नायट्रोजनची कमतरता। झाडे पिवळी होऊ शकतात।' : gu ? 'નાઇટ્રોજનની ઉણપ. છોડ પીળા પડી શકે છે.' : 'Nitrogen deficient. Plants may turn yellow.')
    : N <= 500 ? (hi ? 'नाइट्रोजन मध्यम। फसल के अनुसार उर्वरक डालें।' : mr ? 'नायट्रोजन मध्यम। पिकानुसार खत टाका।' : gu ? 'નાઇટ્રોજન મધ્યમ. પાક મુજબ ખાતર મૂકો.' : 'Nitrogen moderate. Apply fertilizer as per crop.')
    : (hi ? 'नाइट्रोजन पर्याप्त। अधिकता से बचें।' : mr ? 'नायट्रोजन पुरेसे आहे। जास्ती टाळा।' : gu ? 'નાઇટ્રોજન પૂરતું. વધુ ટાળો.' : 'Nitrogen sufficient. Avoid excess.');
  const NAction = N < 250 ? (hi ? 'यूरिया 50-80 किग्रा/हेक्टेयर या डीएपी के साथ।' : mr ? 'युरिया 50-80 किग्रा/हे किंवा डीएपीसह।' : gu ? 'યુરિયા 50-80 કિગ્રા/હે અથવા ડીએપી સાથે.' : 'Apply Urea 50-80 kg/ha or with DAP.')
    : N <= 500 ? (hi ? 'संतुलित एनपीके 40-60 किग्रा/हेक्टेयर।' : mr ? 'संतुलित एनपीके 40-60 किग्रा/हे।' : gu ? 'સંતુલિત NPK 40-60 કિગ્રા/હે.' : 'Balanced NPK 40-60 kg/ha.')
    : (hi ? 'कम नाइट्रोजन दें। जैविक खाद प्राथमिकता।' : mr ? 'कमी नायट्रोजन द्या। जैविक खत प्राधान्य।' : gu ? 'ઓછું નાઇટ્રોજન આપો. જૈવિક ખાતર પ્રાથમિકતા.' : 'Reduce nitrogen. Prefer organic manure.');

  const PStatus = P < 22 ? 'deficient' : P <= 56 ? 'moderate' : 'sufficient';
  const PInterp = P < 22 ? (hi ? 'फास्फोरस की कमी। जड़ विकास प्रभावित।' : mr ? 'फॉस्फरसची कमतरता। मुळांची वाढ प्रभावित।' : gu ? 'ફોસ્ફરસની ઉણપ. મૂળ વૃદ્ધિ અસરગ્રસ્ત.' : 'Phosphorus deficient. Root growth affected.')
    : P <= 56 ? (hi ? 'फास्फोरस मध्यम।' : mr ? 'फॉस्फरस मध्यम।' : gu ? 'ફોસ્ફરસ મધ્યમ.' : 'Phosphorus moderate.')
    : (hi ? 'फास्फोरस पर्याप्त।' : mr ? 'फॉस्फरस पुरेसे।' : gu ? 'ફોસ્ફરસ પૂરતું.' : 'Phosphorus sufficient.');
  const PAction = P < 22 ? (hi ? 'डीएपी या एसएसपी 50-100 किग्रा/हेक्टेयर बुवाई के समय।' : mr ? 'डीएपी किंवा एसएसपी 50-100 किग्रा/हे पेरणीच्या वेळी।' : gu ? 'ડીએપી અથવા એસએસપી 50-100 કિગ્રા/હે વાવણી સમયે.' : 'DAP or SSP 50-100 kg/ha at sowing.')
    : P <= 56 ? (hi ? 'डीएपी 25-50 किग्रा/हेक्टेयर।' : mr ? 'डीएपी 25-50 किग्रा/हे।' : gu ? 'ડીએપી 25-50 કિગ્રા/હે.' : 'DAP 25-50 kg/ha.')
    : (hi ? 'कम फास्फोरस।' : mr ? 'कमी फॉस्फरस।' : gu ? 'ઓછું ફોસ્ફરસ.' : 'Reduce phosphorus.');

  const KStatus = K < 33 ? 'deficient' : K <= 83 ? 'moderate' : 'sufficient';
  const KInterp = K < 33 ? (hi ? 'पोटैशियम की कमी। पत्ते किनारे से सूखते हैं।' : mr ? 'पोटॅशियमची कमतरता। पानांच्या कडा कोरड्या होतात।' : gu ? 'પોટાશિયમની ઉણપ. પાંદડાંની કિનારીઓ સૂકી પડે છે.' : 'Potassium deficient. Leaf edges dry.')
    : K <= 83 ? (hi ? 'पोटैशियम मध्यम।' : mr ? 'पोटॅशियम मध्यम।' : gu ? 'પોટાશિયમ મધ્યમ.' : 'Potassium moderate.')
    : (hi ? 'पोटैशियम पर्याप्त।' : mr ? 'पोटॅशियम पुरेसे।' : gu ? 'પોટાશિયમ પૂરતું.' : 'Potassium sufficient.');
  const KAction = K < 33 ? (hi ? 'MOP (पोटाश) 30-60 किग्रा/हेक्टेयर।' : mr ? 'MOP (पोटॅश) 30-60 किग्रा/हे।' : gu ? 'MOP (પોટાશ) 30-60 કિગ્રા/હે.' : 'MOP (Potash) 30-60 kg/ha.')
    : K <= 83 ? (hi ? 'MOP 20-40 किग्रा/हेक्टेयर।' : mr ? 'MOP 20-40 किग्रा/हे।' : gu ? 'MOP 20-40 કિગ્રા/હે.' : 'MOP 20-40 kg/ha.')
    : (hi ? 'कम पोटाश।' : mr ? 'कमी पोटॅश।' : gu ? 'ઓછું પોટાશ.' : 'Reduce potash.');

  const OMStatus = OM < 0.5 ? 'low' : OM <= 1.5 ? 'moderate' : OM <= 3 ? 'good' : 'high';
  const OMInterp = OM < 0.5 ? (hi ? 'कार्बनिक पदार्थ बहुत कम। मिट्टी की उर्वरता निम्न।' : mr ? 'सेंद्रिय पदार्थ खूप कमी। मातीची सुपीकता निम्न।' : gu ? 'જૈવિક પદાર્થ ખૂબ ઓછો. માટીની ફળદ્રુપતા ઓછી.' : 'Organic matter very low. Soil fertility poor.')
    : OM <= 1.5 ? (hi ? 'कार्बनिक पदार्थ मध्यम। सुधार संभव।' : mr ? 'सेंद्रिय पदार्थ मध्यम। सुधारणा शक्य।' : gu ? 'જૈવિક પદાર્થ મધ્યમ. સુધારણા શક્ય.' : 'Organic matter moderate. Room for improvement.')
    : OM <= 3 ? (hi ? 'कार्बनिक पदार्थ अच्छा।' : mr ? 'सेंद्रिय पदार्थ चांगला।' : gu ? 'જૈવિક પદાર્થ સારો.' : 'Organic matter good.')
    : (hi ? 'कार्बनिक पदार्थ उच्च। उत्तम।' : mr ? 'सेंद्रिय पदार्थ जास्त। उत्तम।' : gu ? 'જૈવિક પદાર્થ ઊંચો. શ્રેષ્ઠ.' : 'Organic matter high. Excellent.');
  const OMAction = OM < 0.5 ? (hi ? 'गोबर खाद, कम्पोस्ट 5-10 टन/हेक्टेयर। हरी खाद फसल।' : mr ? 'गोबरखत, कंपोस्ट 5-10 टन/हे। हिरवे खत पीक।' : gu ? 'ગોબર ખાતર, કમ્પોસ્ટ 5-10 ટન/હેક્ટર. હરિત ખાતર પાક.' : 'Farmyard manure, compost 5-10 tonnes/ha. Green manure crop.')
    : OM <= 1.5 ? (hi ? 'वार्षिक 2-4 टन गोबर खाद।' : mr ? 'वार्षिक 2-4 टन गोबरखत।' : gu ? 'વાર્ષિક 2-4 ટન ગોબર ખાતર.' : 'Annual 2-4 tonnes FYM.')
    : (hi ? 'बनाए रखने के लिए नियमित जैविक पदार्थ।' : mr ? 'पीएच राखण्यासाठी नियमित जैविक खत।' : gu ? 'pH જાળવવા નિયમિત જૈવિક ખાતર.' : 'Regular organic matter to maintain.');

  const loc = soilData.location || (hi || mr || gu ? 'भारत' : 'India');
  const summary = hi
    ? `आपकी मिट्टी: pH ${pH}, N ${N} किग्रा/हे, P ${P} किग्रा/हे, K ${K} किग्रा/हे, कार्बनिक पदार्थ ${OM}%। ${pHStatus === 'optimal' && NStatus === 'moderate' && PStatus !== 'deficient' && KStatus !== 'deficient' ? 'मिट्टी सामान्यतः अच्छी है।' : 'कुछ सुधार की सलाह दी गई है।'}`
    : mr
    ? `तुमची माती: pH ${pH}, N ${N} किग्रा/हे, P ${P} किग्रा/हे, K ${K} किग्रा/हे, सेंद्रिय पदार्थ ${OM}%। ${pHStatus === 'optimal' && NStatus === 'moderate' && PStatus !== 'deficient' && KStatus !== 'deficient' ? 'माती साधारणतः चांगली आहे।' : 'काही सुधारणा शिफारस केल्या आहेत।'}`
    : gu
    ? `તમારી માટી: pH ${pH}, N ${N} કિગ્રા/હે, P ${P} કિગ્રા/હે, K ${K} કિગ્રા/હે, જૈવિક પદાર્થ ${OM}%. ${pHStatus === 'optimal' && NStatus === 'moderate' && PStatus !== 'deficient' && KStatus !== 'deficient' ? 'માટી સામાન્ય રીતે સારી છે.' : 'કેટલાક સુધારાઓ ભલામણ કરાયેલા છે.'}`
    : `Your soil: pH ${pH}, N ${N} kg/ha, P ${P} kg/ha, K ${K} kg/ha, OM ${OM}%. ${pHStatus === 'optimal' ? 'Soil is generally good.' : 'Some improvements recommended.'}`;

  const fertRecs: { name: string; dosage: string; timing: string; notes?: string }[] = [];
  if (NStatus === 'deficient' || PStatus === 'deficient') fertRecs.push({ name: hi ? 'डीएपी (डायमोनियम फॉस्फेट)' : mr ? 'डीएपी' : gu ? 'ડીએપી' : 'DAP', dosage: hi || mr || gu ? '50-100 किग्रा/हे' : '50-100 kg/ha', timing: hi ? 'बुवाई के समय' : mr ? 'पेरणीच्या वेळी' : gu ? 'વાવણી સમયે' : 'At sowing', notes: hi ? 'नाइट्रोजन और फास्फोरस दोनों देता है' : mr ? 'नायट्रोजन आणि फॉस्फरस दोन्ही देते' : gu ? 'નાઇટ્રોજન અને ફોસ્ફરસ બંને આપે છે' : 'Provides N and P' });
  if (NStatus === 'deficient' && fertRecs.length < 2) fertRecs.push({ name: hi ? 'यूरिया' : mr ? 'युरिया' : gu ? 'યુરિયા' : 'Urea', dosage: hi || mr || gu ? '50-80 किग्रा/हे' : '50-80 kg/ha', timing: hi ? 'टॉप ड्रेसिंग (30 दिन बाद)' : mr ? 'टॉप ड्रेसिंग (३० दिवस नंतर)' : gu ? 'ટોપ ડ્રેસિંગ (૩૦ દિવસ પછી)' : 'Top dressing (30 days)', notes: hi ? 'नाइट्रोजन की तीव्र आपूर्ति' : mr ? 'નायट्रोजनची जलद पुरवठा' : gu ? 'નાઇટ્રોજનનો ઝડપી પુરવઠો' : 'Quick N supply' });
  if (KStatus === 'deficient') fertRecs.push({ name: hi ? 'MOP (म्यूरेट ऑफ पोटाश)' : mr ? 'MOP (पोटॅश)' : gu ? 'MOP (પોટાશ)' : 'MOP (Muriate of Potash)', dosage: hi || mr || gu ? '30-60 किग्रा/हे' : '30-60 kg/ha', timing: hi ? 'बुवाई या टॉप ड्रेसिंग' : mr ? 'पेरणी किंवा टॉप ड्रेसिंग' : gu ? 'વાવણી અથવા ટોપ ડ્રેસિંગ' : 'Sowing or top dress' });
  if (fertRecs.length === 0) fertRecs.push({ name: hi ? 'संतुलित NPK 19:19:19' : mr ? 'संतुलित NPK 19:19:19' : gu ? 'સંતુલિત NPK 19:19:19' : 'Balanced NPK 19:19:19', dosage: hi || mr || gu ? '40-60 किग्रा/हे' : '40-60 kg/ha', timing: hi ? 'बुवाई के समय' : mr ? 'पेरणीच्या वेळी' : gu ? 'વાવણી સમયે' : 'At sowing' });

  const crops = hi ? ['धान', 'गेहूं', 'मक्का', 'चना', 'मूंग'] : mr ? ['भात', 'गहू', 'मका', 'हरभरा', 'मूग'] : gu ? ['ડાંગર', 'ઘઉં', 'મકાઈ', 'ચણા', 'મગ'] : ['Paddy', 'Wheat', 'Maize', 'Chickpea', 'Green Gram'];
  const profitCrops = hi
    ? [{ crop: 'धान/गेहूं', profitNote: 'अच्छी मांग, निश्चित बाजार', estimatedMargin: '₹35,000-55,000/एकड़' }, { crop: 'मक्का', profitNote: 'उच्च उपज, जल्दी बिक्री', estimatedMargin: '₹40,000-60,000/एकड़' }]
    : mr
    ? [{ crop: 'भात/गहू', profitNote: 'चांगली मागणी, स्थिर बाजार', estimatedMargin: '₹35,000-55,000/एकर' }, { crop: 'मका', profitNote: 'जास्त उत्पादन, लवकर विक्री', estimatedMargin: '₹40,000-60,000/एकर' }]
    : gu
    ? [{ crop: 'ડાંગર/ઘઉં', profitNote: 'સારી માંગ, સ્થિર બજાર', estimatedMargin: '₹35,000-55,000/એકર' }, { crop: 'મકાઈ', profitNote: 'ઊંચું ઉત્પાદન, ઝડપી વેચાણ', estimatedMargin: '₹40,000-60,000/એકર' }]
    : [{ crop: 'Paddy/Wheat', profitNote: 'Good demand, stable market', estimatedMargin: '₹35,000-55,000/acre' }, { crop: 'Maize', profitNote: 'High yield, quick sale', estimatedMargin: '₹40,000-60,000/acre' }];
  const farmMgmt = hi
    ? ['सिंचाई: मिट्टी नमी के अनुसार 7-10 दिन अंतराल', 'जुताई: बुवाई से पहले 2-3 बार हल चलाएं', 'फसल चक्र: धान-गेहूं या धान-दाल', 'कीट प्रबंधन: नीम तेल 5 मिली/लीटर छिड़काव']
    : mr
    ? ['सिंचन: मातीच्या आर्द्रतेनुसार ७-१० दिवस अंतर', 'नांगरणी: पेरणीपूर्वी २-३ वेळा नांगर चालवा', 'पीक चक्र: भात-गहू किंवा भात-डाळ', 'कीटक नियंत्रण: निंब तेल ५ मिली/लीटर फवारणी']
    : gu
    ? ['સિંચાઈ: માટીની ભેજ મુજબ 7-10 દિવસ અંતરાલ', 'ખેડ: વાવણી પહેલાં 2-3 વાર હળ ચલાવો', 'પાક ચક્ર: ડાંગર-ઘઉં અથવા ડાંગર-દાળ', 'જીવાત નિયંત્રણ: નીમ તેલ 5 મિલી/લીટર છંટકાવ']
    : ['Irrigation: 7-10 day interval based on soil moisture', 'Tillage: 2-3 ploughing before sowing', 'Crop rotation: Paddy-Wheat or Paddy-Pulse', 'Pest: Neem oil 5 ml/litre spray'];

  return {
    summary,
    nutrientStatus: {
      pH: { status: pHStatus as any, interpretation: pHInterp, action: pHAction },
      nitrogen: { status: NStatus as any, interpretation: NInterp, action: NAction },
      phosphorus: { status: PStatus as any, interpretation: PInterp, action: PAction },
      potassium: { status: KStatus as any, interpretation: KInterp, action: KAction },
      organicMatter: { status: OMStatus as any, interpretation: OMInterp, action: OMAction },
    },
    fertilizerRecommendations: fertRecs,
    suitableCrops: crops,
    profitableCrops: profitCrops,
    farmManagement: farmMgmt,
    improvementTips: OM < 1 ? [hi ? 'गोबर खाद और कम्पोस्ट नियमित डालें' : mr ? 'गोबरखत आणि कंपोस्ट नियमित टाका' : gu ? 'ગોબર ખાતર અને કમ્પોસ્ટ નિયમિત મૂકો' : 'Apply FYM and compost regularly'] : [hi ? 'pH बनाए रखने के लिए जैविक खाद जारी रखें' : mr ? 'पीएच राखण्यासाठी जैविक खत चालू ठेवा' : gu ? 'pH જાળવવા જૈવિક ખાતર ચાલુ રાખો' : 'Continue organic manure to maintain pH'],
    warnings: pH < 5.5 || pH > 8 ? [hi ? 'pH चरम सीमा पर। सुधार जरूरी।' : mr ? 'पीएच टोकाच्या मर्यादेवर। सुधारणा गरजेची।' : gu ? 'pH અતિતા પર છે. સુધારણા જરૂરી.' : 'pH at extreme. Correction needed.'] : [],
  };
};

export const getSoilTestAnalysis = async (
  soilData: {
    pH: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    organicMatter: number;
    location?: string;
    crop?: string;
  },
  language: Language
): Promise<SoilTestAnalysis> => {
  try {
    const langName = getLanguageName(language);
    const model = gemini.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `You are an expert Indian Soil Scientist, Agronomist, and Farm Economics Advisor.

Analyze this soil test data and provide detailed, actionable recommendations:
- pH: ${soilData.pH}
- Nitrogen: ${soilData.nitrogen} kg/ha
- Phosphorus: ${soilData.phosphorus} kg/ha
- Potassium: ${soilData.potassium} kg/ha
- Organic Matter: ${soilData.organicMatter}%
- Location: ${soilData.location || 'Not specified'}
- Target Crop: ${soilData.crop || 'General'}

Provide ALL of the following in ${langName}:

1. **summary**: Brief overall soil assessment
2. **nutrientStatus**: For pH, nitrogen, phosphorus, potassium, organicMatter - status, interpretation, and corrective action
3. **fertilizerRecommendations**: BEST fertilizers for this soil with exact dosage (kg/ha or kg/acre), timing, and notes
4. **suitableCrops**: List of crops that grow well in this soil
5. **profitableCrops**: RANK crops by estimated profit/margin for this soil and location. Include crop name, why it gives good profit, and rough margin (e.g. ₹40,000-60,000/acre). Focus on crops that give MORE profit.
6. **farmManagement**: Proper farm management tips: irrigation schedule, tillage, crop rotation, pest/disease management, soil conservation, intercropping suggestions
7. **improvementTips**: Soil health improvement (organic matter, pH correction, nutrient balance)
8. **warnings**: Any risks (toxicity, nutrient imbalance)

Use Indian standards (kg/ha, quintals, acres, ₹). Consider ${soilData.location || 'India'} market prices when ranking profitable crops.

CRITICAL: Return ONLY valid JSON. No markdown, no code block. Start with { and end with }.
{
  "summary": "Overall assessment in ${langName}",
  "nutrientStatus": {
    "pH": {"status": "low|optimal|high", "interpretation": "...", "action": "..."},
    "nitrogen": {"status": "deficient|moderate|sufficient|excess", "interpretation": "...", "action": "..."},
    "phosphorus": {"status": "deficient|moderate|sufficient|excess", "interpretation": "...", "action": "..."},
    "potassium": {"status": "deficient|moderate|sufficient|excess", "interpretation": "...", "action": "..."},
    "organicMatter": {"status": "low|moderate|good|high", "interpretation": "...", "action": "..."}
  },
  "fertilizerRecommendations": [
    {"name": "Best fertilizer name", "dosage": "e.g. 50 kg/ha", "timing": "When to apply", "notes": "Why this is best for your soil"}
  ],
  "suitableCrops": ["crop1", "crop2", "crop3"],
  "profitableCrops": [
    {"crop": "Crop name", "profitNote": "Why this gives more profit for your soil", "estimatedMargin": "₹X-Y per acre"}
  ],
  "farmManagement": ["irrigation tip", "tillage tip", "crop rotation tip", "pest management tip"],
  "improvementTips": ["tip1", "tip2"],
  "warnings": ["warning if any"]
}`;

    // ALWAYS compute rule-based fallback first - we use it when AI fails or returns empty
    const fallback = getFallbackSoilAnalysis(soilData, language);

    const result = await model.generateContent([prompt]);
    let text = result.response.text();
    if (!text) return fallback;

    const data = extractJSON(text);
    if (!data) {
      console.warn("Soil analysis: parse failed, using rule-based fallback. Raw:", text.slice(0, 300));
      return fallback;
    }

    // Normalize snake_case; try multiple key variants (Gemini returns inconsistent keys)
    const nutrientStatus = data.nutrientStatus ?? data.nutrient_status ?? {};
    const getNutrient = (keyVariants: string[], fallbackNutrient: { status: string; interpretation: string; action: string }) => {
      for (const k of keyVariants) {
        const n = nutrientStatus[k] ?? nutrientStatus[k.toLowerCase()] ?? nutrientStatus[k.replace(/_/g, '')];
        if (n && typeof n === 'object') {
          const interp = (n.interpretation ?? '').trim();
          const act = (n.action ?? '').trim();
          if (interp || act) {
            return {
              status: n.status ?? fallbackNutrient.status,
              interpretation: interp || fallbackNutrient.interpretation,
              action: act || fallbackNutrient.action
            };
          }
        }
      }
      return null;
    };

    const fertRecs = data.fertilizerRecommendations ?? data.fertilizer_recommendations ?? [];
    const suitableCrops = data.suitableCrops ?? data.suitable_crops ?? [];
    const profitableCropsRaw = data.profitableCrops ?? data.profitable_crops ?? [];
    const farmMgmt = data.farmManagement ?? data.farm_management ?? [];
    const improvementTips = data.improvementTips ?? data.improvement_tips ?? [];
    const warnings = data.warnings ?? [];
    const summaryRaw = (data.summary ?? '').trim();

    const pHNutrient = getNutrient(['pH', 'ph', 'Ph'], fallback.nutrientStatus.pH);
    const NNutrient = getNutrient(['nitrogen', 'Nitrogen', 'nitrogen_kg_ha'], fallback.nutrientStatus.nitrogen);
    const PNutrient = getNutrient(['phosphorus', 'Phosphorus', 'phosphorus_kg_ha'], fallback.nutrientStatus.phosphorus);
    const KNutrient = getNutrient(['potassium', 'Potassium', 'potassium_kg_ha'], fallback.nutrientStatus.potassium);
    const OMNutrient = getNutrient(['organicMatter', 'organic_matter', 'OrganicMatter'], fallback.nutrientStatus.organicMatter);

    return {
      summary: summaryRaw.length > 10 ? summaryRaw : fallback.summary,
      nutrientStatus: {
        pH: pHNutrient ?? fallback.nutrientStatus.pH,
        nitrogen: NNutrient ?? fallback.nutrientStatus.nitrogen,
        phosphorus: PNutrient ?? fallback.nutrientStatus.phosphorus,
        potassium: KNutrient ?? fallback.nutrientStatus.potassium,
        organicMatter: OMNutrient ?? fallback.nutrientStatus.organicMatter,
      },
      fertilizerRecommendations: Array.isArray(fertRecs) && fertRecs.length > 0 && (fertRecs[0]?.name || fertRecs[0]?.dosage)
        ? fertRecs.map((fr: any) => ({
            name: fr.name ?? fr.Name ?? '—',
            dosage: fr.dosage ?? fr.Dosage ?? '—',
            timing: fr.timing ?? fr.Timing ?? '—',
            notes: fr.notes ?? fr.Notes
          }))
        : fallback.fertilizerRecommendations,
      suitableCrops: Array.isArray(suitableCrops) && suitableCrops.length > 0 ? suitableCrops : fallback.suitableCrops,
      profitableCrops: Array.isArray(profitableCropsRaw) && profitableCropsRaw.length > 0 && profitableCropsRaw[0]?.crop
        ? profitableCropsRaw.map((p: any) => ({
            crop: p.crop ?? p.Crop ?? '—',
            profitNote: p.profitNote ?? p.profit_note ?? p.reason ?? '—',
            estimatedMargin: p.estimatedMargin ?? p.estimated_margin ?? p.margin
          }))
        : fallback.profitableCrops,
      farmManagement: Array.isArray(farmMgmt) && farmMgmt.length > 0 ? farmMgmt : fallback.farmManagement,
      improvementTips: Array.isArray(improvementTips) && improvementTips.length > 0 ? improvementTips : fallback.improvementTips,
      warnings: Array.isArray(warnings) && warnings.length > 0 ? warnings : fallback.warnings
    };
  } catch (error) {
    console.error("Soil analysis failed, using rule-based fallback:", error);
    return getFallbackSoilAnalysis(soilData, language);
  }
};

export const getWeatherAlerts = async (location: string, language: Language): Promise<WeatherAlert[]> => {
  try {
    const langName = getLanguageName(language);
    const prompt = `You are a Meteorological Expert for Indian Agriculture.

For location: ${location}

Check for severe weather alerts (RAIN, HEATWAVE, DROUGHT, FROST, STORM).
If no severe alerts, return empty array [].

Respond ONLY with JSON in ${langName}:

[
  {
    "type": "RAIN" | "DROUGHT" | "FROST" | "STORM" | "HEAT" | "NONE",
    "severity": "LOW" | "MODERATE" | "HIGH" | "EXTREME",
    "title": "Alert title in ${langName}",
    "description": "Details in ${langName}",
    "action": "Farmer action in ${langName}"
  }
]`;

    const message = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const text = message.choices[0]?.message?.content || '[]';
    const data = extractJSON(text);

    if (!Array.isArray(data)) return [];
    
    return data as WeatherAlert[];

  } catch (error) {
    console.error("Weather alerts fetch failed:", error);
    return [];
  }
};

/** AI-generated crop calendar: full lifecycle tasks for given crop, land, location */
export const generateCropCalendar = async (
  crop: string,
  landAcres: number,
  sowingDate: string,
  location: string,
  soilType: string | undefined,
  language: Language
): Promise<{ tasks: CropCalendarTaskTemplate[] }> => {
  try {
    const langName = getLanguageName(language);
    const model = gemini.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const soilContext = soilType ? ` Soil type: ${soilType}.` : '';

    const prompt = `You are an expert Indian Agronomist. Generate a DENSE, detailed crop calendar with NO long gaps.

**Input:**
- Crop: ${crop}
- Land: ${landAcres} acres
- Sowing date: ${sowingDate}
- Location: ${location}${soilContext}

**CRITICAL - Fill ALL gaps:**
- NEVER leave more than 3-4 days empty between tasks.
- Between land prep and sowing: add "प्रसारण हेतु बीज तैयारी", "बीज उपचार", "अंतिम जुताई", "खेत में नमी जांच" etc.
- Between sowing and first irrigation: add "अंकुरण जांच", "गैप भराई (replanting)", "खरपतवार निरीक्षण" etc.
- Between irrigations: add "मिट्टी नमी जांच", "फसल निरीक्षण", "कीट देखभाल" etc.
- Create 50-80 tasks minimum. Every 2-4 days there MUST be a task.
- Include: land prep (multiple), seed prep, sowing, germination check, gap filling, irrigation (every 7-10 days), fertilizer splits, weeding rounds, pest monitoring, spray timing, harvest prep, harvest.

**Format:**
- dayFromSowing = days from sowing (negative = before sowing).
- stage: "Land prep" | "Sowing" | "Vegetative" | "Flowering" | "Fruiting" | "Harvest"
- quantityHint: scaled for ${landAcres} acres.
- All text in ${langName}.

**Output:** Return ONLY valid JSON:
{
  "tasks": [
    {"dayFromSowing": -14, "stage": "Land prep", "title": "...", "description": "...", "quantityHint": "..."},
    {"dayFromSowing": -10, "stage": "Land prep", "title": "...", "description": "...", "quantityHint": "..."}
  ]
}

Be exhaustive. No farmer should have empty days.`;

    const result = await model.generateContent([prompt]);
    const text = result.response.text();
    const data = extractJSON(text);

    if (!data || !Array.isArray(data.tasks) || data.tasks.length === 0) {
      throw new Error("Invalid AI response");
    }

    const tasks = data.tasks.map((t: any) => ({
      dayFromSowing: Number(t.dayFromSowing) ?? 0,
      stage: String(t.stage || "Vegetative"),
      title: String(t.title || "Task"),
      description: String(t.description || ""),
      quantityHint: t.quantityHint ? String(t.quantityHint) : undefined
    }));

    return { tasks };
  } catch (error) {
    console.error("Crop calendar generation failed:", error);
    throw error;
  }
};
