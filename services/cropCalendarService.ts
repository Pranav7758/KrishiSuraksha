/**
 * Crop Calendar: maps AI-generated task templates to CalendarTask[] with actual dates.
 * Static fallback when AI is unavailable.
 */
import type { FarmPlan, CalendarTask, CropCalendarTaskTemplate } from '../types';

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Add days to ISO date string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Map AI task templates to CalendarTask[] with real dates */
export function mapTemplatesToTasks(
  farmPlan: FarmPlan,
  templates: CropCalendarTaskTemplate[]
): CalendarTask[] {
  return templates.map((t) => ({
    id: generateId(),
    farmPlanId: farmPlan.id,
    date: addDays(farmPlan.sowingDate, t.dayFromSowing),
    stage: t.stage,
    title: t.title,
    description: t.description,
    quantityHint: t.quantityHint,
    completed: false,
    completedAt: undefined
  }));
}

/** Static fallback: dense tasks every 2-4 days. NO long gaps between activities. */
export function getStaticFallbackTasks(crop: string, landAcres: number): CropCalendarTaskTemplate[] {
  const q = (n: number) => `~${Math.round(n * landAcres)} kg`;
  const tasks: CropCalendarTaskTemplate[] = [
    // Land prep phase - fill gap before sowing
    { dayFromSowing: -14, stage: 'Land prep', title: 'पहली जुताई', description: 'गहरी जुताई करें। पुरानी जड़ें हटाएं।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: -12, stage: 'Land prep', title: 'खरपतवार साफ़ करें', description: 'खेत से खरपतवार निकालें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: -10, stage: 'Land prep', title: 'दूसरी जुताई', description: 'मिट्टी भुरभुरी करें। समतल करें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: -7, stage: 'Land prep', title: 'खेत तैयारी पूर्ण', description: 'अंतिम जुताई। मिट्टी समतल करें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: -5, stage: 'Land prep', title: 'बीज तैयारी', description: 'बीज खरीदें। गुणवत्ता जांचें।', quantityHint: `${landAcres} एकड़ के लिए` },
    { dayFromSowing: -3, stage: 'Land prep', title: 'बीज उपचार', description: 'बीज में फफूंदनाशक लगाएं।', quantityHint: `दवा के निर्देश अनुसार` },
    // Sowing
    { dayFromSowing: 0, stage: 'Sowing', title: 'बुवाई', description: 'बीज बोएं। उचित दूरी रखें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 2, stage: 'Sowing', title: 'बुवाई निरीक्षण', description: 'बीज ठीक बोया गया है जांचें।', quantityHint: '-' },
    { dayFromSowing: 4, stage: 'Vegetative', title: 'अंकुरण जांच', description: 'अंकुरण शुरू हुआ जांचें। गैप भराई जरूरत जांचें।', quantityHint: '-' },
    { dayFromSowing: 6, stage: 'Vegetative', title: 'गैप भराई (जरूरत हो तो)', description: 'जहां अंकुर नहीं निकले वहां दोबारा बीज डालें।', quantityHint: '-' },
    { dayFromSowing: 7, stage: 'Vegetative', title: 'पहली सिंचाई', description: 'पहली सिंचाई करें। मिट्टी नम रखें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 10, stage: 'Vegetative', title: 'पहली निराई', description: 'छोटी खरपतवार हटाएं।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 14, stage: 'Vegetative', title: 'फसल निरीक्षण', description: 'कीट और रोग की जांच करें।', quantityHint: '-' },
    { dayFromSowing: 17, stage: 'Vegetative', title: 'दूसरी सिंचाई', description: 'दूसरी सिंचाई। पानी भरपूर।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 21, stage: 'Vegetative', title: 'पहला उर्वरक', description: 'यूरिया या DAP लगाएं। स्प्रे या ब्रॉडकास्ट।', quantityHint: `${q(25)} Urea for ${landAcres} acres` },
    { dayFromSowing: 24, stage: 'Vegetative', title: 'दूसरी निराई', description: 'खरपतवार निकालें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 28, stage: 'Vegetative', title: 'तीसरी सिंचाई', description: 'तीसरी सिंचाई।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 31, stage: 'Vegetative', title: 'मिट्टी नमी जांच', description: 'सिंचाई की जरूरत जांचें।', quantityHint: '-' },
    { dayFromSowing: 35, stage: 'Vegetative', title: 'चौथी सिंचाई', description: 'चौथी सिंचाई करें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 38, stage: 'Vegetative', title: 'जल निकासी जांच', description: 'खेत में पानी जमा न हो।', quantityHint: '-' },
    { dayFromSowing: 42, stage: 'Vegetative', title: 'तीसरी निराई', description: 'खरपतवार निकालें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 45, stage: 'Flowering', title: 'दूसरा उर्वरक', description: 'Potash या NPK लगाएं। फूल आने से पहले।', quantityHint: `${q(20)} for ${landAcres} acres` },
    { dayFromSowing: 49, stage: 'Flowering', title: 'पांचवीं सिंचाई', description: 'फूल आने के समय सिंचाई।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 52, stage: 'Flowering', title: 'कीट निरीक्षण', description: 'कीट या रोग की जांच।', quantityHint: '-' },
    { dayFromSowing: 56, stage: 'Fruiting', title: 'कीटनाशक स्प्रे', description: 'नीम तेल या अनुशंसित स्प्रे।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 60, stage: 'Fruiting', title: 'छठी सिंचाई', description: 'दाना भरने के समय सिंचाई।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 63, stage: 'Fruiting', title: 'फसल सुरक्षा जांच', description: 'कीट/रोग पर नजर रखें।', quantityHint: '-' },
    { dayFromSowing: 70, stage: 'Fruiting', title: 'सिंचाई बंद (पकने से पहले)', description: 'पकने के 10-15 दिन पहले सिंचाई बंद।', quantityHint: '-' },
    { dayFromSowing: 75, stage: 'Harvest', title: 'पकने की जांच', description: 'दाने पक गए जांचें।', quantityHint: '-' },
    { dayFromSowing: 80, stage: 'Harvest', title: 'कटाई तैयारी', description: 'कटाई के औजार तैयार करें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 85, stage: 'Harvest', title: 'कटाई शुरू', description: 'फसल काटें।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 90, stage: 'Harvest', title: 'थ्रेशिंग / सुखाना', description: 'दाना अलग करें या सुखाएं।', quantityHint: `${landAcres} एकड़` },
    { dayFromSowing: 95, stage: 'Harvest', title: 'कटाई पूर्ण', description: 'फसल की कटाई पूरी करें। भंडारण तैयार करें।', quantityHint: `${landAcres} एकड़` }
  ];

  const cropDays: Record<string, number> = {
    paddy: 110,
    wheat: 120,
    cotton: 150,
    sugarcane: 300,
    maize: 90,
    potato: 90
  };
  const totalDays = cropDays[crop] ?? 110;

  // Extend harvest tasks for longer crops
  if (totalDays > 100) {
    const last = tasks[tasks.length - 1];
    if (last && last.dayFromSowing < totalDays - 5) {
      tasks.push({
        dayFromSowing: totalDays - 5,
        stage: 'Harvest',
        title: 'कटाई अंतिम',
        description: 'बची हुई फसल काटें।',
        quantityHint: `${landAcres} एकड़`
      });
    }
  }
  return tasks;
}
