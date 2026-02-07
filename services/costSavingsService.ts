/**
 * Cost Savings: money-saving tips for farmers and savings tracking.
 * In Supabase SQL Editor, create the table:
 *
 * create table farmer_savings (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   tip_type text not null,
 *   tip_description text not null,
 *   amount_saved_rs numeric not null,
 *   location text,
 *   created_at timestamptz default now()
 * );
 * alter table farmer_savings enable row level security;
 * create policy "Users manage own savings" on farmer_savings for all using (auth.uid() = user_id);
 */
import { supabase } from './supabaseClient';
import type { CostSavingsTip, CostSavingsTipCategory, FarmerSaving, WeatherAlert, MarketData, SoilTest } from '../types';
import { Language } from '../types';

const TABLE = 'farmer_savings';
const LOCAL_KEY_PREFIX = 'krishi_savings_';

let tipIdCounter = 0;
function genTipId(): string {
  return `tip-${++tipIdCounter}-${Date.now()}`;
}

function rowToFarmerSaving(row: any): FarmerSaving {
  return {
    id: row.id,
    userId: row.user_id,
    tipType: row.tip_type,
    tipDescription: row.tip_description,
    amountSavedRs: Number(row.amount_saved_rs),
    location: row.location ?? undefined,
    createdAt: row.created_at,
  };
}

const labels: Record<CostSavingsTipCategory, { hi: Record<string, string>; mr: Record<string, string>; gu: Record<string, string>; en: Record<string, string> }> = {
  SPRAY: {
    hi: {
      title: 'आज या कल स्प्रे न करें',
      description: 'बारिश की संभावना है। कीटनाशक/उर्वरक बारिश से धुल जाएंगे।',
      action: 'बारिश के बाद स्प्रे करें।',
    },
    mr: {
      title: 'आज किंवा उद्या स्प्रे करू नका',
      description: 'पावसाची शक्यता आहे। कीटकनाशक/खत पावसाने धुवून जाईल।',
      action: 'पावसानंतर स्प्रे करा।',
    },
    gu: {
      title: 'આજ અથવા આવતીકાલ સ્પ્રે ન કરો',
      description: 'વરસાદની શક્યતા છે. કીટનાશક/ખાતર વરસાદથી ધોવાઈ જશે.',
      action: 'વરસાદ પછી સ્પ્રે કરો.',
    },
    en: {
      title: "Don't spray today or tomorrow",
      description: 'Rain expected. Pesticide/fertilizer will wash off.',
      action: 'Spray after rain.',
    },
  },
  IRRIGATION: {
    hi: {
      title: 'आज सिंचाई छोड़ें',
      description: 'बारिश आने वाली है। पानी और बिजली बचाएं।',
      action: 'बारिश के बाद देखें।',
    },
    mr: {
      title: 'आज सिंचन सोडा',
      description: 'पाऊस येत आहे। पाणી आणि वीज वाचवा।',
      action: 'पावसानंतर तपासा।',
    },
    gu: {
      title: 'આજ સિંચાઈ છોડો',
      description: 'વરસાદ આવી રહ્યો છે. પાણી અને વીજળી બચાવો.',
      action: 'વરસાદ પછી તપાસો.',
    },
    en: {
      title: 'Skip irrigation today',
      description: 'Rain forecast. Save water and electricity.',
      action: 'Check after rain.',
    },
  },
  FERTILIZER: {
    hi: {
      title: 'यूरिया/उर्वरक आज न डालें',
      description: 'भारी बारिश की संभावना। लीचिंग हो सकती है।',
      action: 'बारिश के बाद डालें।',
    },
    mr: {
      title: 'युरिया/खत आज टाकू नका',
      description: 'जोरदार पाऊसाची शक्यता। लीचिंग होऊ शकते।',
      action: 'पावसानंतर टाका।',
    },
    gu: {
      title: 'યુરિયા/ખાતર આજ ન મૂકો',
      description: 'ભારે વરસાદની શક્યતા. લીચિંગ થઈ શકે છે.',
      action: 'વરસાદ પછી મૂકો.',
    },
    en: {
      title: 'Delay fertilizer application',
      description: 'Heavy rain expected. Leaching possible.',
      action: 'Apply after rain.',
    },
  },
  MARKET: {
    hi: {
      title: 'अभी बेचें - दाम ऊपर',
      description: 'मूल्य बढ़ रहे हैं। अभी बेचकर ज़्यादा मुनाफा।',
      action: 'स्थानीय मंडी में बेचें।',
    },
    mr: {
      title: 'आता विक्री करा - भाव वाढत आहेत',
      description: 'किमती वाढत आहेत। आता विक्री करून जास्त नफा।',
      action: 'स्थानिक बाजार समितीत विक्री करा।',
    },
    gu: {
      title: 'હમણાં વેચો - ભાવ વધી રહ્યા છે',
      description: 'કિંમતો વધી રહી છે. હમણાં વેચી વધુ નફો કરો.',
      action: 'સ્થાનિક મંડીમાં વેચો.',
    },
    en: {
      title: 'Sell now - prices rising',
      description: 'Prices going up. Sell now for better profit.',
      action: 'Sell at local mandi.',
    },
  },
  INPUT: {
    hi: {
      title: 'मौसम से पहले खरीदें',
      description: 'बीज/उर्वरक सीज़न से पहले सस्ते मिलते हैं।',
      action: 'अगले सीज़न से पहले खरीदें।',
    },
    mr: {
      title: 'हंगामा आधी खरेदी करा',
      description: 'बियाणे/खत हंगामा आधी स्वस्त मिळतात।',
      action: 'पुढच्या हंगामा आधी खरेदी करा।',
    },
    gu: {
      title: 'હંગામા પહેલાં ખરીદો',
      description: 'બીજ/ખાતર સીઝન શરૂ થતા પહેલાં સસ્તું મળે છે.',
      action: 'આગામી સીઝન પહેલાં ખરીદો.',
    },
    en: {
      title: 'Buy inputs before season',
      description: 'Seeds/fertilizer cheaper before season starts.',
      action: 'Purchase before next season.',
    },
  },
  SOIL: {
    hi: {
      title: 'अतिरिक्त फास्फोरस की ज़रूरत नहीं',
      description: 'मिट्टी परीक्षण के अनुसार फास्फोरस पर्याप्त। डीएपी बचाएं।',
      action: 'केवल ज़रूरी उर्वरक डालें।',
    },
    mr: {
      title: 'अतिरिक्त फॉस्फरसची गरज नाही',
      description: 'मृदा चाचणीनुसार फॉस्फरस पुरेसे। डीएपी वाचवा।',
      action: 'फक्त गरजेचे खत टाका।',
    },
    gu: {
      title: 'અતિરિક્ત ફોસ્ફરસની જરૂર નથી',
      description: 'માટી પરીક્ષણ મુજબ ફોસ્ફરસ પૂરતું. ડીએપી બચાવો.',
      action: 'ફક્ત જરૂરી ખાતર મૂકો.',
    },
    en: {
      title: "Don't need extra phosphorus",
      description: 'Soil test shows sufficient P. Save on DAP.',
      action: 'Apply only needed fertilizer.',
    },
  },
  ORGANIC: {
    hi: {
      title: 'पहले नीम स्प्रे आज़माएं',
      description: 'जैविक कीटनाशक से कीमती रसायन बचाएं।',
      action: 'नीम तेल 5 मिली/लीटर छिड़कें।',
    },
    mr: {
      title: 'प्रथम निंब स्प्रे वापरा',
      description: 'जैविक कीटकनाशकाने महाग रसायने वाचवा।',
      action: 'निंब तेल ५ मिली/लीटर फवारा।',
    },
    gu: {
      title: 'પહેલા નીમ સ્પ્રે અજમાવો',
      description: 'જૈવિક કીટનાશકથી રસાયણો બચાવો.',
      action: 'નીમ તેલ 5 મિલી/લીટર છંટકાવ કરો.',
    },
    en: {
      title: 'Try neem spray first',
      description: 'Organic pesticide saves chemical cost.',
      action: 'Spray neem oil 5 ml/litre.',
    },
  },
  VERIFY: {
    hi: {
      title: 'खरीदने से पहले जांचें',
      description: 'नकली बीज/उर्वरक से बचें। बैच कोड सत्यापित करें।',
      action: 'वेरिफाई मॉड्यूल में स्कैन करें।',
    },
    mr: {
      title: 'खरेदी आधी तपासा',
      description: 'बनावट बियाणे/खतापासून बचा। बॅच कोड प्रमाणित करा।',
      action: 'प्रमाणित मॉड्यूलमध्ये स्कॅन करा।',
    },
    gu: {
      title: 'ખરીદતા પહેલાં ચકાસો',
      description: 'નકલી બીજ/ખાતરથી બચો. બેચ કોડ ચકાસો.',
      action: 'ચકાસણી મોડ્યુલમાં સ્કેન કરો.',
    },
    en: {
      title: 'Verify before buying',
      description: 'Avoid fake seeds/fertilizer. Verify batch code.',
      action: 'Scan in Verify module.',
    },
  },
};

function getLabels(cat: CostSavingsTipCategory, lang: Language) {
  if (lang === Language.HINDI) return labels[cat].hi;
  if (lang === Language.MARATHI) return labels[cat].mr;
  if (lang === Language.GUJARATI) return labels[cat].gu;
  return labels[cat].en;
}

export function getCostSavingsTips(
  location: string,
  weatherAlerts: WeatherAlert[],
  marketItems: MarketData[],
  soilTests: SoilTest[],
  language: Language
): CostSavingsTip[] {
  const tips: CostSavingsTip[] = [];
  const hi = language === Language.HINDI;
  const mr = language === Language.MARATHI;
  const gu = language === Language.GUJARATI;

  const hasRainOrStorm = weatherAlerts.some(
    (a) => a.type === 'RAIN' || a.type === 'STORM'
  );

  if (hasRainOrStorm) {
    const sprayL = getLabels('SPRAY', language);
    tips.push({
      id: genTipId(),
      category: 'SPRAY',
      title: sprayL.title,
      description: sprayL.description,
      action: sprayL.action,
      estimatedSavings: 1250,
      reason: hi ? 'बारिश की संभावना' : mr ? 'पावसाची शक्यता' : gu ? 'વરસાદની શક્યતા' : 'Rain expected',
    });

    const fertL = getLabels('FERTILIZER', language);
    tips.push({
      id: genTipId(),
      category: 'FERTILIZER',
      title: fertL.title,
      description: fertL.description,
      action: fertL.action,
      estimatedSavings: 2000,
      reason: hi ? 'भारी बारिश संभावित' : mr ? 'जोरदार पाऊस संभाव्य' : gu ? 'ભારે વરસાદની શક્યતા' : 'Heavy rain expected',
    });

    const irrL = getLabels('IRRIGATION', language);
    tips.push({
      id: genTipId(),
      category: 'IRRIGATION',
      title: irrL.title,
      description: irrL.description,
      action: irrL.action,
      estimatedSavings: 350,
      reason: hi ? 'बारिश आने वाली' : mr ? 'पाऊस येत आहे' : gu ? 'વરસાદની આગાહી' : 'Rain forecast',
    });
  }

  const upTrendItems = marketItems.filter((m) => m.trend === 'up');
  if (upTrendItems.length > 0) {
    const item = upTrendItems[0];
    const marketL = getLabels('MARKET', language);
    tips.push({
      id: genTipId(),
      category: 'MARKET',
      title: (hi ? `${item.item} अभी बेचें` : mr ? `${item.item} आता विक्री करा` : gu ? `${item.item} હમણાં વેચો` : `Sell ${item.item} now`),
      description: marketL.description,
      action: marketL.action,
      estimatedSavings: 1250,
      reason: (hi ? `${item.item} दाम ऊपर` : mr ? `${item.item} भाव वाढत आहेत` : gu ? `${item.item} ભાવ વધી રહ્યા` : `${item.item} prices up`),
    });
  }

  const latestSoil = soilTests[0];
  if (latestSoil && (latestSoil.phosphorus >= 22 || latestSoil.nitrogen >= 250)) {
    const soilL = getLabels('SOIL', language);
    tips.push({
      id: genTipId(),
      category: 'SOIL',
      title: soilL.title,
      description: soilL.description,
      action: soilL.action,
      estimatedSavings: 1150,
      reason: hi ? 'मिट्टी परीक्षण पर आधारित' : mr ? 'मृदा चाचणीवर आधारित' : gu ? 'માટી પરીક્ષણ પર આધારિત' : 'Based on soil test',
    });
  }

  const inputL = getLabels('INPUT', language);
  tips.push({
    id: genTipId(),
    category: 'INPUT',
    title: inputL.title,
    description: inputL.description,
    action: inputL.action,
    estimatedSavings: 1000,
  });

  const organicL = getLabels('ORGANIC', language);
  tips.push({
    id: genTipId(),
    category: 'ORGANIC',
    title: organicL.title,
    description: organicL.description,
    action: organicL.action,
    estimatedSavings: 550,
  });

  const verifyL = getLabels('VERIFY', language);
  tips.push({
    id: genTipId(),
    category: 'VERIFY',
    title: verifyL.title,
    description: verifyL.description,
    action: verifyL.action,
    estimatedSavings: 2750,
  });

  return tips;
}

export async function saveFarmerSaving(
  userId: string,
  tipType: string,
  tipDescription: string,
  amountSavedRs: number,
  location?: string
): Promise<FarmerSaving> {
  const row = {
    user_id: userId,
    tip_type: tipType,
    tip_description: tipDescription,
    amount_saved_rs: amountSavedRs,
    location: location ?? null,
  };
  const { data: inserted, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return rowToFarmerSaving(inserted);
}

/** Save to localStorage when Supabase table doesn't exist (404) */
function saveFarmerSavingLocal(
  userId: string,
  tipType: string,
  tipDescription: string,
  amountSavedRs: number,
  location?: string
): FarmerSaving {
  const key = LOCAL_KEY_PREFIX + userId;
  const existing: FarmerSaving[] = JSON.parse(localStorage.getItem(key) || '[]');
  const saved: FarmerSaving = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    tipType,
    tipDescription,
    amountSavedRs,
    location,
    createdAt: new Date().toISOString(),
  };
  existing.unshift(saved);
  localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
  return saved;
}

function getLocalSavingsByUser(userId: string): FarmerSaving[] {
  const key = LOCAL_KEY_PREFIX + userId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Save to Supabase; on failure (e.g. table missing), save locally and still return */
export async function saveFarmerSavingWithFallback(
  userId: string,
  tipType: string,
  tipDescription: string,
  amountSavedRs: number,
  location?: string
): Promise<FarmerSaving> {
  try {
    return await saveFarmerSaving(userId, tipType, tipDescription, amountSavedRs, location);
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
    if (msg.includes('404') || msg.includes('relation') || msg.includes('does not exist') || msg.includes('PGRST116')) {
      return saveFarmerSavingLocal(userId, tipType, tipDescription, amountSavedRs, location);
    }
    throw e;
  }
}

export async function getTotalSavedByUser(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('amount_saved_rs')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row.amount_saved_rs || 0), 0);
}

export async function getSavingsHistoryByUser(userId: string, limit = 10): Promise<FarmerSaving[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(rowToFarmerSaving);
}

/** Get total saved including localStorage fallback */
export async function getTotalSavedByUserWithLocal(userId: string): Promise<number> {
  let supabaseTotal = 0;
  try {
    supabaseTotal = await getTotalSavedByUser(userId);
  } catch {
    /* table may not exist */
  }
  const localSavings = getLocalSavingsByUser(userId);
  const localTotal = localSavings.reduce((s, x) => s + x.amountSavedRs, 0);
  return supabaseTotal + localTotal;
}

/** Get savings history merged from Supabase + localStorage */
export async function getSavingsHistoryByUserWithLocal(userId: string, limit = 15): Promise<FarmerSaving[]> {
  let supabaseHistory: FarmerSaving[] = [];
  try {
    supabaseHistory = await getSavingsHistoryByUser(userId, limit);
  } catch {
    /* table may not exist */
  }
  const localSavings = getLocalSavingsByUser(userId);
  const merged = [...supabaseHistory, ...localSavings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged.slice(0, limit);
}
