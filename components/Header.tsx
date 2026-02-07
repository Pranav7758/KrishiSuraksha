import React, { useState } from 'react';
import { Leaf, Globe, LogOut } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { Language, AuthUser } from '../types';
import { getLabel } from '../translations';
import { signOut } from '../services/authService';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ language, setLanguage, user, onLogout }) => {
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  
  const languages = [
    { code: Language.HINDI, label: 'हिन्दी (Hindi)' },
    { code: Language.ENGLISH, label: 'English' },
    { code: Language.MARATHI, label: 'मराठी (Marathi)' },
    { code: Language.GUJARATI, label: 'ગુજરાતી (Gujarati)' },
    { code: Language.PUNJABI, label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: Language.TAMIL, label: 'தமிழ் (Tamil)' },
    { code: Language.TELUGU, label: 'తెలుగు (Telugu)' },
    { code: Language.KANNADA, label: 'ಕನ್ನಡ (Kannada)' },
    { code: Language.MALAYALAM, label: 'മലയാളം (Malayalam)' },
    { code: Language.BENGALI, label: 'বাংলা (Bengali)' },
    { code: Language.ODIA, label: 'ଓଡ଼ିଆ (Odia)' },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
      setShowLogoutMenu(false);
      onLogout?.();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  const getUserInitials = () => {
    if (!user?.email) return 'K';
    const name = user?.user_metadata?.name || user.email;
    return name.charAt(0).toUpperCase();
  };
  

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        {/* Mobile Logo Only */}
        <div className="md:hidden flex items-center gap-2">
           <div className="bg-green-600 p-1.5 rounded-lg">
             <Leaf className="text-white" size={20} />
           </div>
           <span className="font-bold text-gray-900">{getLabel(language, 'appName')}</span>
        </div>

        {/* Desktop Title / Context */}
        <div className="hidden md:block">
           <h2 className="text-xl font-semibold text-gray-800">{getLabel(language, 'appName')}</h2>
           <p className="text-xs text-gray-500">{getLabel(language, 'appTagline')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <NotificationPanel userId={user?.id ?? null} language={language} />
          <div className="relative">
            <Globe size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="pl-9 pr-8 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full text-sm font-medium text-gray-700 appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500 text-xs">
              ▼
            </div>
          </div>
          
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className="w-10 h-10 bg-green-100 hover:bg-green-200 rounded-full flex items-center justify-center border border-green-200 text-green-700 font-bold transition-colors"
                title={user.email}
              >
                {getUserInitials()}
              </button>
              
              {showLogoutMenu && (
                <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-gray-200 z-50 min-w-max">
                  <div className="p-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">{getLabel(language, 'user')}</p>
                    <p className="text-sm font-bold text-gray-900 truncate max-w-xs">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    <LogOut size={16} />
                    {getLabel(language, 'logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center border border-green-200 text-green-700 font-bold">
              K
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
