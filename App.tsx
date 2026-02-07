import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { CameraCapture } from './components/CameraCapture';
import { Login } from './components/Login';
import { AppView, Language, VerificationResult, AdvisoryResponse, MarketData, WeatherAlert, AuthUser, SoilTest, SoilTestAnalysis, CostSavingsTip, FarmerSaving, CalendarTask } from './types';
import { verifyProductImage, verifyBatchCode, getCropAdvisory, getMarketData, getWeatherAlerts, getSoilTestAnalysis } from './services/geminiService';
import { getSoilTestsByUser, saveSoilTest, deleteSoilTest } from './services/soilHealthService';
import { getCostSavingsTips, saveFarmerSavingWithFallback, getTotalSavedByUserWithLocal, getSavingsHistoryByUserWithLocal } from './services/costSavingsService';
import { getTasksForDate, updateTaskCompletion } from './services/farmPlanService';
import { supabase } from './services/supabaseClient';
import { addToQueue, getQueue, removeFromQueue, QueuedRequest } from './services/queueService';
import { getLabel } from './translations';
import { initSpeechRecognition, startListening, stopListening, speakText, stopSpeaking, isVoiceSupported } from './services/voiceService';
import { onAuthStateChange } from './services/authService';
import { CropPlannerView } from './components/CropPlannerView';
import {  Volume2,
  CheckCircle2,
  AlertOctagon,
  WifiOff,
  RefreshCw,
  Database,
  ScanBarcode,
  ArrowRight,
  Keyboard,
  Camera,
  Search,
  Globe,
  ExternalLink,
  Sprout,
  Leaf,
  Store,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CloudRain,
  ThermometerSun,
  Snowflake,
  Zap,
  Mic,
  MicOff,
  Speaker,
  MapPin,
  CloudSun,
  Droplets,
  Wind,
  ShieldCheck,
  TrendingUp,
  Loader2,
  AlertTriangle,
  XCircle,
  Plus,
  TestTube,
  PiggyBank,
  Trash2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';

export default function App() {
  // Authentication State
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [view, setView] = useState<AppView>(AppView.HOME);
  // Default language set to Hindi as requested
  const [language, setLanguage] = useState<Language>(Language.HINDI);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  
  // Shared Location State - Default changed to Gujarat
  const [location, setLocation] = useState('Gujarat');

  // Verification State
  const [verifyMode, setVerifyMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualBatchCode, setManualBatchCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Advisory State
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryResult, setAdvisoryResult] = useState<AdvisoryResponse | null>(null);
  const [formData, setFormData] = useState({
    crop: 'paddy',
    stage: 'sowing',
    soil: 'clayLoam'
  });

  // Market State
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketItems, setMarketItems] = useState<MarketData[]>([]);
  const [expandedMarketItem, setExpandedMarketItem] = useState<string | null>(null);

  // Weather Alerts State
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Soil Health State
  const [soilTests, setSoilTests] = useState<SoilTest[]>([]);
  const [soilTestsLoading, setSoilTestsLoading] = useState(false);
  const [selectedSoilTest, setSelectedSoilTest] = useState<SoilTest | null>(null);
  const [showSoilForm, setShowSoilForm] = useState(false);
  const [soilSaving, setSoilSaving] = useState(false);
  const [soilForm, setSoilForm] = useState({
    testDate: new Date().toISOString().slice(0, 10),
    location: '',
    crop: '',
    pH: 7,
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    organicMatter: 0,
    recommendations: '',
  });
  const [soilAnalysis, setSoilAnalysis] = useState<SoilTestAnalysis | null>(null);
  const [soilAnalysisLoading, setSoilAnalysisLoading] = useState(false);
  const [soilAnalysisForTestId, setSoilAnalysisForTestId] = useState<string | null>(null);

  // Cost Savings State
  const [costSavingsTips, setCostSavingsTips] = useState<CostSavingsTip[]>([]);
  const [totalSaved, setTotalSaved] = useState<number>(0);
  const [savingsHistory, setSavingsHistory] = useState<FarmerSaving[]>([]);
  const [savingFollowed, setSavingFollowed] = useState<string | null>(null);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [savingsGoal, setSavingsGoal] = useState<number>(() => {
    try {
      const v = localStorage.getItem('krishi_savings_goal');
      return v ? Math.max(1000, parseInt(v, 10) || 10000) : 10000;
    } catch {
      return 10000;
    }
  });

  // Crop Planner / Today Tasks
  const [todayTasks, setTodayTasks] = useState<CalendarTask[]>([]);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState({ speechRecognition: false, textToSpeech: false });
  const [showMicFeedback, setShowMicFeedback] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const advisorySpeakingRef = useRef<boolean>(false);

  const crops = ['paddy', 'wheat', 'cotton', 'sugarcane', 'maize', 'potato'];
  const stages = ['sowing', 'vegetative', 'flowering', 'fruiting', 'harvest'];
  const soils = ['clayLoam', 'sandyLoam', 'blackSoil', 'redSoil', 'alluvial'];

  // Initialize Authentication on Mount
  useEffect(() => {
    const subscription = onAuthStateChange((authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Initialize Voice Support on Mount
  useEffect(() => {
    const support = isVoiceSupported();
    setVoiceSupported(support);
  }, []);

  // Network Listeners & Sync Logic
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setOfflineQueueCount(getQueue().length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch weather alerts on load and location/language change
  useEffect(() => {
    if (isOnline) {
      handleFetchWeatherAlerts();
    }
  }, [location, language, isOnline]);

  // Fetch default market data on load if view is MARKET
  useEffect(() => {
    if (view === AppView.MARKET && marketItems.length === 0 && isOnline) {
      handleFetchMarketRates();
    }
  }, [view, isOnline]);

  // Load soil tests when Soil Health view is active
  useEffect(() => {
    if (view === AppView.SOIL_HEALTH && user?.id) {
      setSoilTestsLoading(true);
      getSoilTestsByUser(user.id)
        .then(setSoilTests)
        .catch((e) => {
          console.error('Failed to load soil tests', e);
          setSoilTests([]);
          const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
          const is404 = msg.includes('404') || msg.includes('relation') || msg.includes('does not exist');
          if (is404) {
            alert(getLabel(language, 'loadSoilTestsError') + '\n\n' + getLabel(language, 'soilTableHint'));
          }
        })
        .finally(() => setSoilTestsLoading(false));
    }
  }, [view, user?.id, language]);

  // Fetch market data when Save Money view is active (for market tips)
  useEffect(() => {
    if (view === AppView.SAVE_MONEY && marketItems.length === 0 && isOnline) {
      handleFetchMarketRates();
    }
  }, [view, isOnline]);

  // Load today's tasks when Home view is active
  useEffect(() => {
    if (view === AppView.HOME && user?.id) {
      const today = new Date().toISOString().slice(0, 10);
      getTasksForDate(user.id, today).then(setTodayTasks).catch(() => setTodayTasks([]));
    } else {
      setTodayTasks([]);
    }
  }, [view, user?.id]);

  // Load cost savings tips and total when Save Money view is active
  useEffect(() => {
    if (view === AppView.SAVE_MONEY) {
      const tips = getCostSavingsTips(location, weatherAlerts, marketItems, soilTests, language);
      setCostSavingsTips(tips);
      if (user?.id) {
        getTotalSavedByUserWithLocal(user.id).then(setTotalSaved).catch(console.error);
        getSavingsHistoryByUserWithLocal(user.id, 15).then(setSavingsHistory).catch(console.error);
      } else {
        setTotalSaved(0);
        setSavingsHistory([]);
      }
    }
  }, [view, location, weatherAlerts, marketItems, soilTests, language, user?.id]);

  const processOfflineQueue = async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let processedCount = 0;

    for (const item of queue) {
      try {
        const result = await getCropAdvisory(item.data.crop, item.data.stage, item.data.soil, language);
        const { error } = await supabase.from('advisories').insert({
          crop: item.data.crop,
          stage: item.data.stage,
          soil_type: item.data.soil,
          advisory_json: result,
          created_at: new Date().toISOString(),
          is_offline_sync: true
        });

        if (!error) {
          removeFromQueue(item.id);
          processedCount++;
        }
      } catch (err) {
        console.error("Failed to sync item", item.id, err);
      }
    }

    setOfflineQueueCount(getQueue().length);
    setIsSyncing(false);
  };

  const handleFetchWeatherAlerts = async () => {
    setWeatherLoading(true);
    try {
      const alerts = await getWeatherAlerts(location, language);
      setWeatherAlerts(alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleFetchMarketRates = async () => {
    if (!isOnline) return;
    setMarketLoading(true);
    try {
      const data = await getMarketData(location, language);
      if (data && data.length > 0) {
        setMarketItems(data);
      } else {
        console.warn("No market data returned");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMarketLoading(false);
    }
  };

  const handleSaveSoilTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSoilSaving(true);
    try {
      const saved = await saveSoilTest(user.id, {
        testDate: soilForm.testDate,
        location: soilForm.location,
        pH: soilForm.pH,
        nitrogen: soilForm.nitrogen,
        phosphorus: soilForm.phosphorus,
        potassium: soilForm.potassium,
        organicMatter: soilForm.organicMatter,
        recommendations: soilForm.recommendations,
      });
      setSoilTests((prev) => [saved, ...prev]);
      setShowSoilForm(false);
      setSoilForm({
        testDate: new Date().toISOString().slice(0, 10),
        location: '',
        crop: '',
        pH: 7,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        organicMatter: 0,
        recommendations: '',
      });
      setSelectedSoilTest(saved);
      setSoilAnalysis(null);
      setSoilAnalysisForTestId(null);
      if (isOnline) {
        setSoilAnalysisLoading(true);
        try {
          const analysis = await getSoilTestAnalysis(
            {
              pH: saved.pH,
              nitrogen: saved.nitrogen,
              phosphorus: saved.phosphorus,
              potassium: saved.potassium,
              organicMatter: saved.organicMatter,
              location: saved.location || undefined,
              crop: soilForm.crop || undefined,
            },
            language
          );
          setSoilAnalysis(analysis);
          setSoilAnalysisForTestId(saved.id);
        } catch (e) {
          console.error('Soil analysis failed', e);
        } finally {
          setSoilAnalysisLoading(false);
        }
      }
    } catch (err) {
      console.error('Save soil test failed', err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : '';
      const is404 = msg.includes('404') || msg.includes('relation') || msg.includes('does not exist');
      alert(getLabel(language, 'saveTestError') + (is404 ? '\n\n' + getLabel(language, 'soilTableHint') : ''));
    } finally {
      setSoilSaving(false);
    }
  };

  const handleFetchSoilAnalysis = async (t: SoilTest) => {
    if (!isOnline) return;
    setSoilAnalysisLoading(true);
    setSoilAnalysis(null);
    try {
      const analysis = await getSoilTestAnalysis(
        {
          pH: t.pH,
          nitrogen: t.nitrogen,
          phosphorus: t.phosphorus,
          potassium: t.potassium,
          organicMatter: t.organicMatter,
          location: t.location || undefined,
        },
        language
      );
      setSoilAnalysis(analysis);
      setSoilAnalysisForTestId(t.id);
    } catch (e) {
      console.error('Soil analysis failed', e);
    } finally {
      setSoilAnalysisLoading(false);
    }
  };

  const handleDeleteSoilTest = async (test: SoilTest) => {
    if (!user?.id) return;
    if (!confirm(getLabel(language, 'deleteSoilTestConfirm'))) return;
    try {
      await deleteSoilTest(test.id, user.id);
      setSoilTests((prev) => prev.filter((st) => st.id !== test.id));
      setSelectedSoilTest(null);
      setSoilAnalysis(null);
      setSoilAnalysisForTestId(null);
    } catch (e) {
      console.error('Delete soil test failed', e);
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
      const is404 = msg.includes('404') || msg.includes('relation') || msg.includes('does not exist');
      alert(getLabel(language, 'deleteSoilTestError') + (is404 ? '\n\n' + getLabel(language, 'soilTableHint') : ''));
    }
  };

  const handleSaveFarmerSaving = async (tip: CostSavingsTip) => {
    if (!user?.id) return;
    const amount = tip.estimatedSavings;
    setSavingFollowed(tip.id);
    try {
      const saved = await saveFarmerSavingWithFallback(user.id, tip.category, tip.title, amount, location);
      setTotalSaved((prev) => prev + amount);
      setSavingsHistory((prev) => [saved, ...prev.slice(0, 14)]);
      setSaveSuccessToast(`${getLabel(language, 'savingRecorded')} +₹${amount.toLocaleString('en-IN')}`);
      setTimeout(() => setSaveSuccessToast(null), 3000);
    } catch (e) {
      console.error('Save farmer saving failed', e);
      alert(getLabel(language, 'saveSavingError'));
    } finally {
      setSavingFollowed(null);
    }
  };

  const handleImageCapture = async (input: string | File) => {
    if (!isOnline) {
      alert("Verification requires an internet connection to access the online fraud database.");
      return;
    }
    setVerifying(true);
    setVerificationResult(null);

    try {
      let base64 = "";

      if (typeof input === 'string') {
        base64 = input;
      } else {
        base64 = await new Promise<string>((resolve, reject) => {
           const reader = new FileReader();
           reader.onloadend = () => {
             if (reader.result) resolve(reader.result as string);
             else reject(new Error("Failed to read file"));
           };
           reader.onerror = reject;
           reader.readAsDataURL(input);
        });
      }

      setSelectedImage(base64);
      const base64Data = base64.split(',')[1];
      // Pass selected language to AI
      const result = await verifyProductImage(base64Data, language);
      setVerificationResult(result);

    } catch (error) {
      console.error("Image processing error:", error);
      alert("Failed to process image. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBatchCode.trim()) return;
    
    if (!isOnline) {
      alert("Online verification requires an internet connection.");
      return;
    }

    setVerifying(true);
    setVerificationResult(null);
    setSelectedImage(null); 
    
    try {
      // Pass selected language to AI
      const result = await verifyBatchCode(manualBatchCode, language);
      setVerificationResult(result);
    } catch (err) {
      console.error(err);
      alert("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleAdvisorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvisoryLoading(true);

    if (!isOnline) {
      addToQueue(formData);
      setOfflineQueueCount(prev => prev + 1);
      setAdvisoryLoading(false);
      alert("You are offline. Request saved! We will generate the advisory when you are back online.");
      return;
    }

    try {
      // Pass selected language to AI
      const result = await getCropAdvisory(formData.crop, formData.stage, formData.soil, language);
      setAdvisoryResult(result);
      await supabase.from('advisories').insert({
        crop: formData.crop,
        stage: formData.stage,
        soil_type: formData.soil,
        advisory_json: result,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error fetching advisory", err);
    } finally {
      setAdvisoryLoading(false);
    }
  };

  // Voice Handlers
  const startVoiceForBatchCode = () => {
    if (!voiceSupported.speechRecognition) {
      alert('Voice input not supported on your device');
      return;
    }

    const recognition = initSpeechRecognition({
      language,
      onResultCallback: (text: string) => {
        // Clean and format batch code
        const cleanCode = text.toUpperCase().replace(/\s/g, '-').substring(0, 20);
        setManualBatchCode(cleanCode);
        setShowMicFeedback(false);
      },
      onErrorCallback: (error: string) => {
        console.error('Voice error:', error);
        setShowMicFeedback(false);
      },
      onListeningChange: (listening: boolean) => {
        setIsListening(listening);
        setShowMicFeedback(listening);
      }
    });

    recognitionRef.current = recognition;
    startListening(recognition);
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      stopListening(recognitionRef.current);
      setIsListening(false);
      setShowMicFeedback(false);
    }
  };

  const readAdvisoryAloud = async () => {
    if (!voiceSupported.textToSpeech) {
      alert('Text-to-speech not supported on your device');
      return;
    }

    if (!advisoryResult) return;

    advisorySpeakingRef.current = true;

    const advisoryText = `
      फसल: ${advisoryResult?.crop || 'N/A'}
      अवस्था: ${advisoryResult?.stage || 'N/A'}
      
      खाद सिफारिश: ${advisoryResult?.recommendations?.fertilizer || 'N/A'}
      खुराक: ${advisoryResult?.recommendations?.dosage || 'N/A'}
      
      कीट नियंत्रण: ${advisoryResult?.recommendations?.pestControl || 'N/A'}
      
      लागत बचत सुझाव: ${advisoryResult?.recommendations?.costSavingTip || 'N/A'}
      
      मिट्टी स्वास्थ्य: ${advisoryResult?.recommendations?.soilHealthImpact || 'N/A'}
      
      मौसम जोखिम: ${advisoryResult.weatherRisk}
    `;

    speakText(advisoryText, language);
  };

  const renderHome = () => (
    <div className="space-y-6 animate-in fade-in">
      {!isOnline && (
        <div className="bg-gray-900 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <WifiOff size={20} className="text-gray-400" />
            <div>
              <p className="font-semibold text-sm">{getLabel(language, 'offline')}</p>
              <p className="text-xs text-gray-400">{getLabel(language, 'offlineDesc')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Weather Alerts Banner */}
      {weatherAlerts.length > 0 && (
         <div className="space-y-4">
           {weatherAlerts.map((alert, idx) => {
             const isSevere = alert.severity === 'HIGH' || alert.severity === 'EXTREME';
             const bgColor = isSevere ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
             const titleColor = isSevere ? 'text-red-900' : 'text-yellow-900';
             const textColor = isSevere ? 'text-red-800' : 'text-yellow-800';
             const iconColor = isSevere ? 'text-red-600' : 'text-yellow-600';

             return (
               <div key={idx} className={`${bgColor} border rounded-2xl p-5 flex gap-4 items-start shadow-sm relative overflow-hidden transition-all hover:scale-[1.01] duration-300`}>
                 {/* Severity indicator bar */}
                 <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSevere ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                 
                 <div className="bg-white/60 p-2.5 rounded-full shrink-0 shadow-sm">
                   {alert.type === 'RAIN' || alert.type === 'STORM' ? <CloudRain className={iconColor} size={28} /> :
                    alert.type === 'HEAT' ? <ThermometerSun className={iconColor} size={28} /> :
                    alert.type === 'FROST' ? <Snowflake className={iconColor} size={28} /> :
                    <AlertTriangle className={iconColor} size={28} />}
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between items-start">
                       <h4 className={`font-bold text-lg ${titleColor}`}>{alert.title}</h4>
                       <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md shadow-sm ${isSevere ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                         {alert.severity}
                       </span>
                    </div>
                    <p className={`text-sm mt-1 mb-3 font-medium ${textColor} leading-relaxed`}>{alert.description}</p>
                    <div className="bg-white/60 p-3 rounded-xl border border-white/50">
                       <div className="flex items-center gap-2 mb-1">
                          <Zap size={14} className={titleColor} />
                          <p className={`text-xs font-bold uppercase ${titleColor}`}>{getLabel(language, 'actionRequired')}</p>
                       </div>
                       <p className={`text-sm font-semibold ${textColor}`}>{alert.action}</p>
                    </div>
                 </div>
               </div>
             );
           })}
         </div>
      )}

      {/* Today's Task Card */}
      {user?.id && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays size={20} className="text-green-600" />
              {getLabel(language, 'todayTask')}
            </h3>
            {todayTasks.length > 0 && (
              <button
                onClick={() => setView(AppView.CROP_PLANNER)}
                className="text-sm font-medium text-green-600 hover:text-green-700"
              >
                {getLabel(language, 'cropPlanner')} →
              </button>
            )}
          </div>
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500">
              <CalendarDays size={32} className="text-gray-300 mb-2" />
              <p className="text-sm">{getLabel(language, 'noTaskToday')}</p>
              <button
                onClick={() => setView(AppView.CROP_PLANNER)}
                className="mt-3 px-4 py-2 bg-green-100 text-green-700 rounded-xl font-medium text-sm hover:bg-green-200"
              >
                {getLabel(language, 'createCropPlan')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/80"
                >
                  <button
                    onClick={async () => {
                      const next = !task.completed;
                      await updateTaskCompletion(task.id, next, user?.id);
                      setTodayTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, completed: next, completedAt: next ? new Date().toISOString() : undefined } : t
                        )
                      );
                    }}
                    className="shrink-0 mt-0.5"
                  >
                    {task.completed ? (
                      <CheckCircle2 size={20} className="text-green-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{task.description}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setView(AppView.CROP_PLANNER)}
                className="w-full py-2 text-sm font-medium text-green-600 hover:text-green-700"
              >
                {getLabel(language, 'cropPlanner')} →
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-500 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2 bg-blue-700/30 px-3 py-1 rounded-full w-fit backdrop-blur-sm">
                 <MapPin size={14} className="text-blue-100" />
                 <h2 className="text-blue-50 text-xs font-bold uppercase tracking-wider">{location}</h2>
              </div>
              <div className="text-5xl font-bold mb-2">32°C</div>
              <div className="text-blue-100 text-lg flex items-center gap-2 font-medium">
                 <CloudSun size={24} className="text-yellow-300" />
                 Partly Cloudy
              </div>
            </div>
            <div className="text-right hidden sm:block">
               <p className="text-sm text-blue-100 font-medium opacity-80">Monday, 24 Oct</p>
            </div>
          </div>
          <div className="mt-8 flex gap-8 border-t border-white/20 pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm"><Droplets size={20} className="text-blue-50" /></div>
              <div>
                 <p className="text-xs text-blue-200 uppercase font-bold tracking-wider">{getLabel(language, 'humidity')}</p>
                 <p className="font-bold text-lg">65%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm"><Wind size={20} className="text-blue-50" /></div>
              <div>
                 <p className="text-xs text-blue-200 uppercase font-bold tracking-wider">{getLabel(language, 'wind')}</p>
                 <p className="font-bold text-lg">12km/h</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
           <div>
              <h3 className="font-bold text-gray-800 mb-4">{getLabel(language, 'quickActions')}</h3>
              <div className="space-y-3">
                <button onClick={() => setView(AppView.CROP_PLANNER)} className="w-full flex items-center gap-3 p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all active:scale-95 text-left group border border-emerald-100">
                   <div className="bg-white p-2 rounded-lg shadow-sm group-hover:shadow"><CalendarDays size={20} /></div>
                   <div className="flex-1">
                      <p className="font-bold text-sm">{getLabel(language, 'cropPlanner')}</p>
                      <p className="text-xs opacity-70">{getLabel(language, 'todayTask')}</p>
                   </div>
                   <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </button>
                <button onClick={() => setView(AppView.VERIFY)} className="w-full flex items-center gap-3 p-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-all active:scale-95 text-left group border border-red-100">
                   <div className="bg-white p-2 rounded-lg shadow-sm group-hover:shadow"><ShieldCheck size={20} /></div>
                   <div className="flex-1">
                      <p className="font-bold text-sm">{getLabel(language, 'verifyInput')}</p>
                      <p className="text-xs opacity-70">{getLabel(language, 'scanQR')}</p>
                   </div>
                   <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </button>
                <button onClick={() => setView(AppView.ADVISORY)} className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl transition-all active:scale-95 text-left group border border-green-100">
                   <div className="bg-white p-2 rounded-lg shadow-sm group-hover:shadow"><TrendingUp size={20} /></div>
                   <div className="flex-1">
                      <p className="font-bold text-sm">{getLabel(language, 'getAdvisory')}</p>
                      <p className="text-xs opacity-70">{getLabel(language, 'reduceCosts')}</p>
                   </div>
                   <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </button>
                <button onClick={() => setView(AppView.SOIL_HEALTH)} className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-all active:scale-95 text-left group border border-amber-100">
                   <div className="bg-white p-2 rounded-lg shadow-sm group-hover:shadow"><TestTube size={20} /></div>
                   <div className="flex-1">
                      <p className="font-bold text-sm">{getLabel(language, 'soilHealthNav')}</p>
                      <p className="text-xs opacity-70">{getLabel(language, 'uploadSoilTest')}</p>
                   </div>
                   <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </button>
              </div>
           </div>
        </div>

        <div className="md:col-span-3">
          <div className="flex justify-between items-center mb-4 px-1">
             <h3 className="font-bold text-gray-800 text-lg">{getLabel(language, 'localAlerts')}</h3>
             {weatherLoading && (
               <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                 <Loader2 className="animate-spin" size={12} /> Updating...
               </div>
             )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Dynamic Alerts or Fallback */}
             {weatherAlerts.length === 0 && !weatherLoading && (
               <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5 flex gap-4 items-center shadow-sm col-span-1 md:col-span-2">
                 <div className="bg-white p-3 rounded-full shrink-0 shadow-sm">
                   <CloudSun className="text-green-600" size={24} />
                 </div>
                 <div>
                   <h4 className="font-bold text-green-900">{getLabel(language, 'noAlerts')}</h4>
                   <p className="text-sm text-green-700 font-medium">Weather conditions appear normal for {location}.</p>
                 </div>
               </div>
             )}

             {/* Keeping the static ones as 'News'/Community alerts alongside dynamic weather alerts */}
             <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="bg-white p-2 rounded-full shrink-0 shadow-sm">
                <AlertTriangle className="text-orange-600" size={24} />
              </div>
              <div>
                <h4 className="font-bold text-orange-900 group-hover:text-orange-700 transition-colors">{getLabel(language, 'alertFakeTitle')}</h4>
                <p className="text-sm text-orange-800 mt-1 leading-relaxed">
                  {getLabel(language, 'alertFakeDesc')}
                </p>
                <button className="mt-3 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition-colors uppercase tracking-wide flex items-center gap-1">
                  {getLabel(language, 'readMore')} <ArrowRight size={12} />
                </button>
              </div>
            </div>
             
          </div>
        </div>

      </div>
    </div>
  );

  const renderVerify = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
          
          <div className="inline-flex items-center justify-center p-3 bg-green-100 text-green-700 rounded-full mb-4">
             <ScanBarcode size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{getLabel(language, 'inputAuth')}</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            {getLabel(language, 'authDesc')}
          </p>

          <div className="bg-gray-100 p-1 rounded-xl flex mb-8 max-w-xs mx-auto">
            <button 
              onClick={() => setVerifyMode('CAMERA')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                verifyMode === 'CAMERA' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Camera size={16} /> {getLabel(language, 'scan')}
            </button>
            <button 
              onClick={() => setVerifyMode('MANUAL')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                verifyMode === 'MANUAL' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Keyboard size={16} /> {getLabel(language, 'manual')}
            </button>
          </div>
          
          {verifyMode === 'CAMERA' ? (
            <>
              {!selectedImage ? (
                <CameraCapture onCapture={handleImageCapture} isLoading={verifying} language={language} />
              ) : (
                <div className="relative rounded-2xl overflow-hidden mb-6 bg-black group shadow-lg">
                  <img src={selectedImage} alt="Captured" className="w-full h-80 object-contain opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setSelectedImage(null); setVerificationResult(null); }}
                        className="bg-white text-gray-900 px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform"
                      >
                        {getLabel(language, 'scan')}
                      </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="max-w-xs mx-auto py-8">
               <form onSubmit={handleManualSubmit} className="space-y-4">
                 <div className="text-left">
                    <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'batchNo')}</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="e.g. AZ-2024-X12" 
                        value={manualBatchCode}
                        onChange={(e) => setManualBatchCode(e.target.value.toUpperCase())}
                        disabled={isListening}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 font-mono text-lg uppercase focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100"
                      />
                      {voiceSupported.speechRecognition && (
                        <button
                          type="button"
                          onClick={isListening ? stopVoiceInput : startVoiceForBatchCode}
                          className={`px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                            isListening 
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse' 
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                      )}
                    </div>
                    {showMicFeedback && isListening && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <span className="text-sm text-blue-700 font-medium">Listening...</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Look for "BATCH" or "LOT" on the back of the bag or speak it aloud.</p>
                 </div>
                 <button 
                   type="submit"
                   disabled={verifying || !manualBatchCode}
                   className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                 >
                   {verifying ? <Loader2 className="animate-spin" /> : <><Search size={18} /> {getLabel(language, 'verifyCode')}</>}
                 </button>
               </form>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {verifying && (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="relative mb-6">
               <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-20"></div>
               <Loader2 className="animate-spin text-green-600 relative z-10" size={64} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">{getLabel(language, 'verifying')}</h3>
            <p className="text-gray-500 mt-2 text-center max-w-xs">
              Checking government databases...
            </p>
          </div>
        )}

        {verificationResult && (
          <div className={`p-8 rounded-3xl border shadow-lg h-full transition-all duration-500 flex flex-col ${
            verificationResult.status === 'GENUINE' ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 
            verificationResult.status === 'SUSPICIOUS' || verificationResult.status === 'FAKE' ? 'bg-gradient-to-br from-red-50 to-white border-red-200' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-full ${
                  verificationResult.status === 'GENUINE' ? 'bg-green-100 text-green-700' : 
                  verificationResult.status === 'UNKNOWN' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'
              }`}>
                  {verificationResult.status === 'GENUINE' ? <CheckCircle2 size={32} /> : 
                   verificationResult.status === 'UNKNOWN' ? <AlertOctagon size={32} /> : <XCircle size={32} />}
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider opacity-60">{getLabel(language, 'status')}</p>
                <h3 className={`text-3xl font-black ${
                   verificationResult.status === 'GENUINE' ? 'text-green-800' : 
                   verificationResult.status === 'UNKNOWN' ? 'text-gray-800' : 'text-red-800'
                }`}>
                  {verificationResult.status}
                </h3>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <div className="bg-white/80 p-4 rounded-xl border border-gray-100 shadow-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide font-bold">{getLabel(language, 'detected')}</span>
                <p className="text-lg font-semibold text-gray-900">{verificationResult.productName}</p>
                <p className="text-sm text-gray-600">{verificationResult.manufacturer}</p>
              </div>
              
              <div className="bg-white/80 p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-bold">
                        {verifyMode === 'CAMERA' ? getLabel(language, 'extractedBatch') : getLabel(language, 'enteredBatch')}
                    </span>
                    <p className="text-lg font-mono font-bold text-gray-800 tracking-wide">{verificationResult.batchCode || 'Not Read'}</p>
                </div>
                {verificationResult.batchCode && verificationResult.batchCode !== 'N/A' && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                        {verifyMode === 'CAMERA' ? 'OCR' : 'MANUAL'}
                    </span>
                )}
              </div>

              {/* Online Intelligence Section */}
              {verificationResult.onlineEvidence && (
                 <div className={`p-4 rounded-xl border shadow-sm ${
                   verificationResult.status === 'FAKE' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
                 }`}>
                   <div className="flex gap-2 items-center mb-2">
                     <Globe size={16} className={verificationResult.status === 'FAKE' ? 'text-red-600' : 'text-blue-600'} />
                     <span className={`text-xs font-bold uppercase tracking-wide ${
                       verificationResult.status === 'FAKE' ? 'text-red-700' : 'text-blue-700'
                     }`}>{getLabel(language, 'onlineIntel')}</span>
                   </div>
                   <p className="text-sm text-gray-800 leading-relaxed">
                     {verificationResult.onlineEvidence}
                   </p>
                   
                   {/* Sources List */}
                   {verificationResult.sources && verificationResult.sources.length > 0 && (
                     <div className="mt-3 pt-3 border-t border-gray-200/50">
                       <p className="text-[10px] text-gray-500 mb-2 font-bold uppercase">{getLabel(language, 'refSources')}</p>
                       <ul className="space-y-1">
                         {verificationResult.sources.slice(0, 3).map((source, i) => (
                           <li key={i}>
                             <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate">
                               <ExternalLink size={10} /> {source.title}
                             </a>
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>
              )}

              <div className="bg-white/80 p-4 rounded-xl border border-gray-100 shadow-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide font-bold">{getLabel(language, 'analysis')}</span>
                <p className="text-sm text-gray-800 mt-2 leading-relaxed">
                  {verificationResult.reasoning}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {!verifying && !verificationResult && (
           <div className="h-full flex items-center justify-center text-gray-400 p-8 border-2 border-dashed border-gray-200 rounded-3xl">
              <div className="text-center">
                 <ScanBarcode size={48} className="mx-auto mb-4 opacity-50" />
                 <p>Result will appear here</p>
              </div>
           </div>
        )}
      </div>
    </div>
  );

  const renderAdvisory = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
           <div className="inline-flex items-center justify-center p-3 bg-green-100 text-green-700 rounded-full mb-4">
              <Sprout size={32} />
           </div>
           <h2 className="text-2xl font-bold text-gray-900 mb-2">{getLabel(language, 'advisoryTitle')}</h2>
           <p className="text-gray-500 mb-6 max-w-sm">
             {getLabel(language, 'advisoryDesc')}
           </p>

           <form onSubmit={handleAdvisorySubmit} className="space-y-4">
              <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'crop')}</label>
                 <select 
                    value={formData.crop}
                    onChange={(e) => setFormData({...formData, crop: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                 >
                    {crops.map(c => (
                      <option key={c} value={c}>
                        {getLabel(language, `crop_${c}` as any)}
                      </option>
                    ))}
                 </select>
              </div>

              <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'stage')}</label>
                 <select 
                    value={formData.stage}
                    onChange={(e) => setFormData({...formData, stage: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                 >
                   {stages.map(s => (
                      <option key={s} value={s}>
                        {getLabel(language, `stage_${s}` as any)}
                      </option>
                    ))}
                 </select>
              </div>

              <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'soil')}</label>
                 <select 
                    value={formData.soil}
                    onChange={(e) => setFormData({...formData, soil: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                 >
                   {soils.map(s => (
                      <option key={s} value={s}>
                        {getLabel(language, `soil_${s}` as any)}
                      </option>
                    ))}
                 </select>
              </div>

              <button 
                 type="submit"
                 disabled={advisoryLoading}
                 className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors mt-2"
              >
                 {advisoryLoading ? <Loader2 className="animate-spin" /> : <>{getLabel(language, 'genAdvisory')} <ArrowRight size={18} /></>}
              </button>
           </form>
        </div>
      </div>

      <div className="space-y-6">
        {advisoryResult ? (
          <div className="bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden h-full flex flex-col">
              <div className="bg-gradient-to-r from-green-700 to-green-600 p-6 text-white flex items-center justify-between">
                 <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="bg-white/20 p-2 rounded-lg"><Leaf size={20} /></div>
                       <h3 className="text-xl font-bold">{getLabel(language, 'advisoryTitle')}</h3>
                    </div>
                    <div className="flex gap-4 text-green-100 text-sm">
                       <span className="bg-white/10 px-2 py-1 rounded">{advisoryResult.crop}</span>
                       <span className="bg-white/10 px-2 py-1 rounded">{advisoryResult.stage}</span>
                    </div>
                 </div>
                 {voiceSupported.textToSpeech && (
                    <button
                      onClick={readAdvisoryAloud}
                      className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg transition-all active:scale-95 flex items-center justify-center"
                      title="Read advisory aloud"
                    >
                      <Speaker size={20} />
                    </button>
                 )}
              </div>
              
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                 
                 {/* Weather Risk */}
                 <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                     <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <CloudRain size={16} className="text-blue-600" /> {getLabel(language, 'weatherRisk')}
                     </h4>
                     <p className="text-gray-800 text-sm">{advisoryResult.weatherRisk}</p>
                 </div>

                 {/* Fertilizer */}
                 <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                    <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                       <Droplets size={16} className="text-green-600" /> {getLabel(language, 'fertilizer')}
                    </h4>
                    <p className="text-gray-800 font-medium">{advisoryResult?.recommendations?.fertilizer || 'Data unavailable'}</p>
                    <p className="text-sm text-gray-600 mt-1 bg-white p-2 rounded-lg border border-green-100 inline-block">
                       <span className="font-bold">Dosage:</span> {advisoryResult?.recommendations?.dosage || 'N/A'}
                    </p>
                 </div>

                 {/* 7-Day Schedule */}
                 {advisoryResult.schedule && advisoryResult.schedule.length > 0 && (
                   <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                      <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                         <CalendarDays size={16} className="text-purple-600" /> {getLabel(language, 'actionSchedule')}
                      </h4>
                      <div className="space-y-3 relative">
                         {/* Timeline Line */}
                         <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-purple-200"></div>
                         
                         {advisoryResult.schedule.map((item, idx) => (
                           <div key={idx} className="relative pl-8">
                              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-purple-400 flex items-center justify-center z-10">
                                 <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                              </div>
                              <p className="text-xs font-bold text-purple-700">{item.day}</p>
                              <p className="text-sm text-gray-800">{item.activity}</p>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}

                 {/* Pest Control */}
                 <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                    <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                       <AlertTriangle size={16} className="text-red-600" /> {getLabel(language, 'pestControl')}
                    </h4>
                    <p className="text-gray-800">{advisoryResult?.recommendations?.pestControl || 'Data unavailable'}</p>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                       <h4 className="font-bold text-blue-900 mb-2 text-xs uppercase tracking-wide">{getLabel(language, 'costTip')}</h4>
                       <p className="text-sm text-gray-700 leading-relaxed">
                          {advisoryResult?.recommendations?.costSavingTip || 'Data unavailable'}
                       </p>
                    </div>
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                       <h4 className="font-bold text-amber-900 mb-2 text-xs uppercase tracking-wide">{getLabel(language, 'soilHealth')}</h4>
                       <p className="text-sm text-gray-700 leading-relaxed">
                          {advisoryResult?.recommendations?.soilHealthImpact || 'Data unavailable'}
                       </p>
                    </div>
                 </div>

                 {advisoryResult.warnings && advisoryResult.warnings.length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                       <h4 className="font-bold text-orange-900 mb-2 text-xs uppercase tracking-wide flex items-center gap-2">
                         <AlertOctagon size={14} /> {getLabel(language, 'warnings')}
                       </h4>
                       <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                          {advisoryResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                       </ul>
                    </div>
                 )}
              </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 border-2 border-dashed border-gray-200 rounded-3xl min-h-[400px]">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                 <Sprout size={32} className="opacity-50" />
              </div>
              <p className="font-medium text-gray-500">No advisory generated yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs text-center">Select your crop details and click "Generate Advisory" to see AI recommendations.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderMarket = () => {
    return (
      <div className="animate-in fade-in space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
             <div>
                <h2 className="text-2xl font-bold text-gray-800">{getLabel(language, 'localMarket')}</h2>
                <p className="text-gray-500">{getLabel(language, 'marketDesc')}</p>
             </div>
             
             <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
               <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={getLabel(language, 'locationLabel')}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full"
                  />
               </div>
               <button 
                 onClick={handleFetchMarketRates}
                 disabled={marketLoading || !isOnline}
                 className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
               >
                 {marketLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                 {marketLoading ? getLabel(language, 'fetchingRates') : getLabel(language, 'refreshRates')}
               </button>
             </div>
           </div>

           {!isOnline && (
              <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl mb-4 text-sm flex items-center gap-2">
                 <WifiOff size={16} /> Internet required for real-time rates.
              </div>
           )}

           {/* Results Grid */}
           {marketItems.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketItems.map((item, idx) => {
                  const isExpanded = expandedMarketItem === item.item;
                  return (
                    <div key={idx} className={`bg-white rounded-2xl p-5 border shadow-sm transition-all duration-300 relative overflow-hidden group ${
                      isExpanded ? 'border-blue-200 ring-2 ring-blue-50 row-span-2' : 'border-gray-100 hover:shadow-md'
                    }`}>
                      {/* Decorative bg blob */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                      
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h3 className="font-bold text-lg text-gray-900">{item.item}</h3>
                                  <p className="text-gray-500 text-xs">{getLabel(language, 'avgPrice')}</p>
                              </div>
                              <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                  item.trend === 'up' ? 'bg-red-50 text-red-600' : 
                                  item.trend === 'down' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                              }`}>
                                  <TrendingUp size={12} className={item.trend === 'down' ? 'rotate-180' : item.trend === 'stable' ? 'hidden' : ''} />
                                  {getLabel(language, `trend_${item.trend}` as any) || item.trend}
                              </div>
                          </div>
                          
                          <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-3xl font-bold text-gray-900">₹{item.avgPrice}</span>
                            <span className="text-sm text-gray-500">/ {item.unit || 'Quintal'}</span>
                          </div>

                          <button 
                            onClick={() => setExpandedMarketItem(isExpanded ? null : item.item)}
                            className="w-full text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg mb-4 flex items-center justify-center gap-1 transition-colors"
                          >
                            {isExpanded ? <>{getLabel(language, 'hideChart')} <ChevronUp size={14}/></> : <>{getLabel(language, 'viewChart')} <ChevronDown size={14}/></>}
                          </button>

                          {/* Chart Section */}
                          {isExpanded && item.priceHistory && (
                            <div className="h-40 w-full mb-4 animate-in fade-in">
                                <p className="text-xs text-gray-400 mb-2 font-semibold">{getLabel(language, 'priceTrend')}</p>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={item.priceHistory}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                      <XAxis dataKey="date" hide />
                                      <YAxis hide domain={['auto', 'auto']} />
                                      <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                      />
                                      <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={{r: 3, fill: '#2563eb'}} />
                                  </LineChart>
                                </ResponsiveContainer>
                            </div>
                          )}

                          <div className="space-y-3">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{getLabel(language, 'bestPrices')}</p>
                              {item.vendors.map((vendor, vIdx) => (
                                  <div key={vIdx} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                      <div className="flex items-center gap-2">
                                          <Store size={14} className="text-blue-600 shrink-0" />
                                          <span className="text-gray-700 font-medium truncate max-w-[120px]" title={vendor.name}>{vendor.name}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          {vendor.distance !== 'N/A' && <span className="text-gray-400 text-xs">{vendor.distance}</span>}
                                          <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">₹{vendor.price}</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                    </div>
                  );
                })}
             </div>
           ) : (
             !marketLoading && (
               <div className="flex flex-col items-center justify-center p-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                  <Store size={48} className="mb-4 opacity-50" />
                  <p>No market data available for this location.</p>
                  <p className="text-sm">Try searching for a specific district (e.g., "Nashik", "Guntur").</p>
               </div>
             )
           )}
           
           <div className="mt-6 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
              <Globe size={12} /> {getLabel(language, 'sourceWeb')}
           </div>
        </div>
      </div>
    );
  };

  const renderSoilHealth = () => {
    if (selectedSoilTest) {
      const t = selectedSoilTest;
      return (
        <div className="animate-in fade-in space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => { setSelectedSoilTest(null); setSoilAnalysis(null); setSoilAnalysisForTestId(null); }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              <ArrowRight size={16} className="rotate-180" /> {getLabel(language, 'backToTests')}
            </button>
            <button
              onClick={() => handleDeleteSoilTest(t)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              title={getLabel(language, 'deleteTest')}
            >
              <Trash2 size={16} /> {getLabel(language, 'deleteTest')}
            </button>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-3 rounded-xl">
                <TestTube className="text-amber-700" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{getLabel(language, 'soilHealthTitle')}</h2>
                <p className="text-sm text-gray-500">{t.testDate} · {t.location || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-medium">{getLabel(language, 'phLabel')}</p>
                <p className="text-lg font-bold text-gray-900">{t.pH}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-medium">{getLabel(language, 'nitrogenLabel')}</p>
                <p className="text-lg font-bold text-gray-900">{t.nitrogen}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-medium">{getLabel(language, 'phosphorusLabel')}</p>
                <p className="text-lg font-bold text-gray-900">{t.phosphorus}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-medium">{getLabel(language, 'potassiumLabel')}</p>
                <p className="text-lg font-bold text-gray-900">{t.potassium}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-medium">{getLabel(language, 'organicMatterLabel')}</p>
                <p className="text-lg font-bold text-gray-900">{t.organicMatter}%</p>
              </div>
            </div>

            {soilAnalysisLoading ? (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl">
                <Loader2 className="animate-spin text-green-600 mb-4" size={40} />
                <p className="text-sm text-gray-600">{getLabel(language, 'generatingAnalysis')}</p>
              </div>
            ) : soilAnalysis && soilAnalysisForTestId === t.id ? (
              <div className="space-y-5">
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                  <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                    <Leaf size={16} /> {getLabel(language, 'analysisSummary')}
                  </h4>
                  <p className="text-gray-800 text-sm leading-relaxed">{soilAnalysis.summary}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['pH', 'nitrogen', 'phosphorus', 'potassium', 'organicMatter'] as const).map((key) => {
                    const ns = soilAnalysis.nutrientStatus[key];
                    if (!ns) return null;
                    const statusColor = ns.status === 'optimal' || ns.status === 'sufficient' || ns.status === 'good' || ns.status === 'moderate'
                      ? 'bg-green-50 border-green-100'
                      : ns.status === 'deficient' || ns.status === 'low' || ns.status === 'high' || ns.status === 'excess'
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-gray-50 border-gray-100';
                    return (
                      <div key={key} className={`p-4 rounded-2xl border ${statusColor}`}>
                        <p className="text-xs font-bold text-gray-700 uppercase mb-1">{getLabel(language, (key === 'pH' ? 'phLabel' : `${key}Label`) as any) || key}</p>
                        <p className="text-sm font-medium text-gray-800 mb-1">{ns.interpretation}</p>
                        <p className="text-sm text-gray-700">{ns.action}</p>
                      </div>
                    );
                  })}
                </div>
                {soilAnalysis.fertilizerRecommendations?.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <Droplets size={16} /> {getLabel(language, 'fertilizer')}
                    </h4>
                    <div className="space-y-3">
                      {soilAnalysis.fertilizerRecommendations.map((fr, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-blue-100">
                          <p className="font-semibold text-gray-900">{fr.name}</p>
                          <p className="text-sm text-gray-700"><span className="font-medium">Dosage:</span> {fr.dosage}</p>
                          <p className="text-sm text-gray-600"><span className="font-medium">Timing:</span> {fr.timing}</p>
                          {fr.notes && <p className="text-sm text-gray-500 mt-1">{fr.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {soilAnalysis.suitableCrops?.length > 0 && (
                  <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                    <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                      <Sprout size={16} /> {getLabel(language, 'suitableCrops')}
                    </h4>
                    <p className="text-sm text-gray-800">{soilAnalysis.suitableCrops.join(', ')}</p>
                  </div>
                )}
                {soilAnalysis.profitableCrops && soilAnalysis.profitableCrops.length > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                    <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                      <TrendingUp size={16} /> {getLabel(language, 'profitableCrops')}
                    </h4>
                    <p className="text-xs text-emerald-700 mb-3">{getLabel(language, 'profitableCropsDesc')}</p>
                    <div className="space-y-3">
                      {soilAnalysis.profitableCrops.map((p, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-emerald-100">
                          <p className="font-bold text-gray-900">{p.crop}</p>
                          <p className="text-sm text-gray-700 mt-1">{p.profitNote}</p>
                          {p.estimatedMargin && (
                            <p className="text-sm font-semibold text-emerald-700 mt-1">{getLabel(language, 'estimatedMargin')}: {p.estimatedMargin}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {soilAnalysis.farmManagement && soilAnalysis.farmManagement.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                      <CalendarDays size={16} /> {getLabel(language, 'farmManagement')}
                    </h4>
                    <p className="text-xs text-indigo-700 mb-2">{getLabel(language, 'farmManagementDesc')}</p>
                    <ul className="list-disc list-inside text-sm text-gray-800 space-y-2">
                      {soilAnalysis.farmManagement.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {soilAnalysis.improvementTips?.length > 0 && (
                  <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100">
                    <h4 className="font-bold text-cyan-900 mb-2 flex items-center gap-2">
                      <TrendingUp size={16} /> {getLabel(language, 'improvementTips')}
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                      {soilAnalysis.improvementTips.map((tip, i) => <li key={i}>{tip}</li>)}
                    </ul>
                  </div>
                )}
                {soilAnalysis.warnings?.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                      <AlertOctagon size={16} /> {getLabel(language, 'warnings')}
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                      {soilAnalysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {!isOnline ? (
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800">
                    <WifiOff size={16} className="inline mr-2" /> {getLabel(language, 'offline')} {getLabel(language, 'soilAnalysisOffline')}
                  </div>
                ) : (
                  <button
                    onClick={() => handleFetchSoilAnalysis(t)}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl"
                  >
                    <Leaf size={20} /> {getLabel(language, 'getSoilAnalysis')}
                  </button>
                )}
                {t.recommendations && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-600 font-bold mb-2">{getLabel(language, 'recommendationsLabel')} (manual)</p>
                    <p className="text-sm text-gray-800">{t.recommendations}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (showSoilForm) {
      return (
        <div className="animate-in fade-in space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-3 rounded-xl">
                <TestTube className="text-green-700" size={28} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{getLabel(language, 'addTest')}</h2>
            </div>
            <form onSubmit={handleSaveSoilTest} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'testDate')}</label>
                  <input
                    type="date"
                    value={soilForm.testDate}
                    onChange={(e) => setSoilForm((f) => ({ ...f, testDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'soilLocation')}</label>
                  <input
                    type="text"
                    value={soilForm.location}
                    onChange={(e) => setSoilForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder={location}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'targetCrop')} ({getLabel(language, 'optional')})</label>
                  <select
                    value={soilForm.crop}
                    onChange={(e) => setSoilForm((f) => ({ ...f, crop: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
                  >
                    <option value="">{getLabel(language, 'general')}</option>
                    {crops.map(c => (
                      <option key={c} value={c}>{getLabel(language, `crop_${c}` as any)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'phLabel')}</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={14}
                    value={soilForm.pH || ''}
                    onChange={(e) => setSoilForm((f) => ({ ...f, pH: Number(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'nitrogenLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={soilForm.nitrogen || ''}
                    onChange={(e) => setSoilForm((f) => ({ ...f, nitrogen: Number(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'phosphorusLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={soilForm.phosphorus || ''}
                    onChange={(e) => setSoilForm((f) => ({ ...f, phosphorus: Number(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'potassiumLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={soilForm.potassium || ''}
                    onChange={(e) => setSoilForm((f) => ({ ...f, potassium: Number(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'organicMatterLabel')}</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={100}
                    value={soilForm.organicMatter || ''}
                    onChange={(e) => setSoilForm((f) => ({ ...f, organicMatter: Number(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'recommendationsLabel')}</label>
                <textarea
                  value={soilForm.recommendations}
                  onChange={(e) => setSoilForm((f) => ({ ...f, recommendations: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. Add lime for pH, apply NPK as per deficiency"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSoilForm(false)}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                >
                  {getLabel(language, 'backToTests')}
                </button>
                <button
                  type="submit"
                  disabled={soilSaving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {soilSaving ? <Loader2 className="animate-spin" size={20} /> : null}
                  {getLabel(language, 'saveTest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }
    return (
      <div className="animate-in fade-in space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-3 rounded-xl">
                <TestTube className="text-amber-700" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{getLabel(language, 'soilHealthTitle')}</h2>
                <p className="text-sm text-gray-500">{getLabel(language, 'soilHealthDesc')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowSoilForm(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl"
            >
              <Plus size={20} /> {getLabel(language, 'addTest')}
            </button>
          </div>
          {soilTestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-green-600" size={40} />
            </div>
          ) : soilTests.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500">
              <TestTube size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-medium">{getLabel(language, 'noSoilTests')}</p>
              <button
                onClick={() => setShowSoilForm(true)}
                className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl"
              >
                <Plus size={18} /> {getLabel(language, 'addTest')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {soilTests.map((st) => (
                <div
                  key={st.id}
                  className="group w-full p-4 rounded-xl border border-gray-200 hover:border-green-200 hover:bg-green-50/50 transition-all flex items-center justify-between"
                >
                  <button
                    onClick={() => setSelectedSoilTest(st)}
                    className="flex-1 text-left flex items-center justify-between min-w-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-gray-700">pH {st.pH}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{st.testDate}</p>
                        <p className="text-sm text-gray-500">{st.location || '—'}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 shrink-0 ml-2">{getLabel(language, 'viewTest')} →</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSoilTest(st); }}
                    className="shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
                    title={getLabel(language, 'deleteTest')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSaveMoney = () => (
    <div className="animate-in fade-in space-y-6">
      {saveSuccessToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={22} />
          <span className="font-bold">{saveSuccessToast}</span>
        </div>
      )}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-3 rounded-xl">
            <PiggyBank size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{getLabel(language, 'saveMoney')}</h2>
            <p className="text-emerald-100 text-sm">{getLabel(language, 'saveMoneyDesc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-sm text-emerald-100 mb-1">{getLabel(language, 'totalSaved')}</p>
            <p className="text-3xl font-black">₹{totalSaved.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-sm text-emerald-100 mb-1">{getLabel(language, 'savingsGoal')}</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-black">{Math.min(100, Math.round((totalSaved / savingsGoal) * 100))}%</p>
              <p className="text-emerald-200 text-sm mb-1">→ ₹{savingsGoal.toLocaleString('en-IN')}</p>
            </div>
            <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalSaved / savingsGoal) * 100)}%` }} />
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[5000, 10000, 25000, 50000].map((g) => (
                <button
                  key={g}
                  onClick={() => { setSavingsGoal(g); localStorage.setItem('krishi_savings_goal', String(g)); }}
                  className={`text-xs px-2 py-1 rounded ${savingsGoal === g ? 'bg-white text-emerald-700 font-bold' : 'bg-white/20 hover:bg-white/30'}`}
                >
                  ₹{(g / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </div>
        </div>
        {totalSaved >= 1000 && totalSaved < 5000 && (
          <p className="text-emerald-100 text-sm mt-2 flex items-center gap-2">
            <span className="bg-amber-400 text-amber-900 px-2 py-0.5 rounded font-bold text-xs">{getLabel(language, 'achievementMilestone')}</span>
            ₹1,000 saved!
          </p>
        )}
        {totalSaved >= 5000 && (
          <p className="text-emerald-100 text-sm mt-2 flex items-center gap-2">
            <span className="bg-amber-400 text-amber-900 px-2 py-0.5 rounded font-bold text-xs">{getLabel(language, 'achievementMilestone')}</span>
            ₹5,000+ saved – great progress!
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-900 text-lg">{getLabel(language, 'costSavingsTips')}</h3>
        {costSavingsTips.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500 border-2 border-dashed border-gray-200">
            <PiggyBank size={48} className="mx-auto mb-3 opacity-50" />
            <p>{getLabel(language, 'noCostTips')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {costSavingsTips.map((tip) => (
              <div
                key={tip.id}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{tip.title}</h4>
                    <p className="text-sm text-gray-700 mb-2">{tip.description}</p>
                    {tip.reason && (
                      <p className="text-xs text-emerald-600 font-medium mb-2">{tip.reason}</p>
                    )}
                    <p className="text-sm text-gray-600">{tip.action}</p>
                    <p className="text-xs font-bold text-emerald-700 mt-2">
                      {getLabel(language, 'costSavingsEstimated')}: ₹{tip.estimatedSavings.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSaveFarmerSaving(tip)}
                    disabled={!!savingFollowed}
                    className="shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl disabled:opacity-50 transition-colors text-sm"
                  >
                    {savingFollowed === tip.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {getLabel(language, 'iFollowedThis')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {savingsHistory.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">{getLabel(language, 'recentSavings')}</h3>
          <div className="space-y-2">
            {savingsHistory.map((s) => (
              <div key={s.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-800">{s.tipDescription}</p>
                <span className="font-bold text-emerald-600">+₹{s.amountSavedRs.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">{getLabel(language, 'appName')}</p>
        </div>
      </div>
    );
  }

  // Show Login if not authenticated
  if (!user) {
    return <Login language={language} setLanguage={setLanguage} onLoginSuccess={() => setIsLoading(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans">
      <Navigation currentView={view} setView={setView} language={language} />
      
      {/* Main Content Area - Shifted on Desktop for Sidebar */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Header language={language} setLanguage={setLanguage} user={user} onLogout={() => setUser(null)} />
        
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 pb-24 md:pb-8">
          {view === AppView.HOME && renderHome()}
          {view === AppView.CROP_PLANNER && (
            <CropPlannerView
              user={user}
              language={language}
              location={location}
              soilTests={soilTests}
              setView={(v) => setView(v as AppView)}
            />
          )}
          {view === AppView.VERIFY && renderVerify()}
          {view === AppView.ADVISORY && renderAdvisory()}
          {view === AppView.MARKET && renderMarket()}
          {view === AppView.SOIL_HEALTH && renderSoilHealth()}
          {view === AppView.SAVE_MONEY && renderSaveMoney()}
        </main>
      </div>
    </div>
  );
}