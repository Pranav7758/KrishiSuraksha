export enum AppView {
  HOME = 'HOME',
  CROP_PLANNER = 'CROP_PLANNER',
  VERIFY = 'VERIFY',
  ADVISORY = 'ADVISORY',
  MARKET = 'MARKET',
  SOIL_HEALTH = 'SOIL_HEALTH',
  SAVE_MONEY = 'SAVE_MONEY'
}

export enum Language {
  HINDI = 'hi',
  ENGLISH = 'en',
  MARATHI = 'mr',
  GUJARATI = 'gu',
  PUNJABI = 'pa',
  TAMIL = 'ta',
  TELUGU = 'te',
  KANNADA = 'kn',
  MALAYALAM = 'ml',
  BENGALI = 'bn',
  ODIA = 'or'
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
  };
}

export interface VerificationResult {
  status: 'GENUINE' | 'SUSPICIOUS' | 'FAKE' | 'UNKNOWN';
  productName: string;
  manufacturer: string;
  batchCode?: string;
  confidence: number;
  reasoning: string;
  safetyCheck: string;
  onlineEvidence?: string; // Summary of web search findings
  sources?: { title: string; uri: string }[]; // URLs of articles/notices found
}

export interface AdvisoryResponse {
  crop: string;
  stage: string;
  recommendations: {
    fertilizer: string;
    dosage: string;
    pestControl: string;
    costSavingTip: string;
    soilHealthImpact: string;
  };
  schedule: { day: string; activity: string }[]; // New: 7-day schedule
  weatherRisk: string; // New: Weather impact assessment
  warnings: string[];
}

export interface MarketData {
  item: string;
  avgPrice: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  priceHistory: { date: string; price: number }[]; // New: For charts
  vendors: {
    name: string;
    price: number;
    distance: string;
    rating: number;
    isGovt: boolean;
  }[];
}

export interface WeatherAlert {
  type: 'RAIN' | 'DROUGHT' | 'FROST' | 'STORM' | 'HEAT' | 'NONE';
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  title: string;
  description: string;
  action: string;
}

export interface SoilTest {
  id: string;
  userId: string;
  testDate: string;
  location: string;
  pH: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  organicMatter: number;
  otherNutrients?: { [key: string]: number };
  recommendations: string;
  imageUrl?: string;
}

/** AI-generated detailed analysis from soil test data */
export interface SoilTestAnalysis {
  summary: string;
  nutrientStatus: {
    pH: { status: 'low' | 'optimal' | 'high'; interpretation: string; action: string };
    nitrogen: { status: 'deficient' | 'moderate' | 'sufficient' | 'excess'; interpretation: string; action: string };
    phosphorus: { status: 'deficient' | 'moderate' | 'sufficient' | 'excess'; interpretation: string; action: string };
    potassium: { status: 'deficient' | 'moderate' | 'sufficient' | 'excess'; interpretation: string; action: string };
    organicMatter: { status: 'low' | 'moderate' | 'good' | 'high'; interpretation: string; action: string };
  };
  fertilizerRecommendations: { name: string; dosage: string; timing: string; notes?: string }[];
  suitableCrops: string[];
  /** Crops ranked by estimated profit for this soil & location */
  profitableCrops?: { crop: string; profitNote: string; estimatedMargin?: string }[];
  /** Farm management: irrigation, tillage, crop rotation, pest management */
  farmManagement?: string[];
  improvementTips: string[];
  warnings: string[];
}

export type CostSavingsTipCategory = 'SPRAY' | 'IRRIGATION' | 'FERTILIZER' | 'MARKET' | 'INPUT' | 'SOIL' | 'ORGANIC' | 'VERIFY';

export interface CostSavingsTip {
  id: string;
  category: CostSavingsTipCategory;
  title: string;
  description: string;
  action: string;
  estimatedSavings: number;
  reason?: string;
}

export interface FarmerSaving {
  id: string;
  userId: string;
  tipType: string;
  tipDescription: string;
  amountSavedRs: number;
  location?: string;
  createdAt: string;
}

/** Farm plan created by user */
export interface FarmPlan {
  id: string;
  userId: string;
  crop: string;
  landAcres: number;
  sowingDate: string;
  createdAt: string;
}

/** AI-generated task template (day from sowing) */
export interface CropCalendarTaskTemplate {
  dayFromSowing: number;
  stage: string;
  title: string;
  description: string;
  quantityHint?: string;
}

/** Calendar task for a specific date */
export interface CalendarTask {
  id: string;
  farmPlanId: string;
  date: string;
  stage: string;
  title: string;
  description: string;
  quantityHint?: string;
  completed: boolean;
  completedAt?: string;
}
