import React from 'react';
import { Home, ScanLine, Sprout, Store, Leaf, TestTube, PiggyBank, CalendarDays } from 'lucide-react';
import { AppView, Language } from '../types';
import { getLabel } from '../translations';

interface NavigationProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  language: Language;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, language }) => {
  const navItems = [
    { id: AppView.HOME, icon: Home, label: getLabel(language, 'dashboard') },
    { id: AppView.CROP_PLANNER, icon: CalendarDays, label: getLabel(language, 'cropPlanner') },
    { id: AppView.VERIFY, icon: ScanLine, label: getLabel(language, 'verifyInput') },
    { id: AppView.ADVISORY, icon: Sprout, label: getLabel(language, 'cropAdvisory') },
    { id: AppView.MARKET, icon: Store, label: getLabel(language, 'marketPrices') },
    { id: AppView.SOIL_HEALTH, icon: TestTube, label: getLabel(language, 'soilHealthNav') },
    { id: AppView.SAVE_MONEY, icon: PiggyBank, label: getLabel(language, 'saveMoney') },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe px-4 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-green-700 bg-green-50 translate-y-[-4px]' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'block' : 'hidden sm:block'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex-col z-50">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
           <div className="bg-green-600 p-2 rounded-lg">
            <Leaf className="text-white" size={24} />
           </div>
           <div>
             <h1 className="text-xl font-bold text-gray-900 tracking-tight">{getLabel(language, 'appName')}</h1>
             <p className="text-xs text-gray-500">{getLabel(language, 'appTagline')}</p>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
             const isActive = currentView === item.id;
             return (
               <button
                 key={item.id}
                 onClick={() => setView(item.id)}
                 className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ${
                   isActive 
                     ? 'bg-green-50 text-green-700 font-semibold shadow-sm border border-green-100' 
                     : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                 }`}
               >
                 <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                 <span className="text-sm">{item.label}</span>
                 {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-600" />}
               </button>
             );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
           <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
              <p className="text-xs opacity-80 mb-1">Need Help?</p>
              <p className="text-sm font-bold">Kisan Call Center</p>
              <p className="text-lg font-bold mt-1">1800-180-1551</p>
           </div>
        </div>
      </div>
    </>
  );
};