import React, { useState, useEffect } from 'react';
import { Bell, Droplets, Leaf, AlertCircle } from 'lucide-react';
import { Language, CalendarTask } from '../types';
import { getLabel } from '../translations';
import { getTasksForDate } from '../services/farmPlanService';

const todayStr = () => new Date().toISOString().slice(0, 10);
const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

interface NotificationPanelProps {
  userId: string | null;
  language: Language;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ userId, language }) => {
  const [open, setOpen] = useState(false);
  const [todayTasks, setTodayTasks] = useState<CalendarTask[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<CalendarTask[]>([]);

  useEffect(() => {
    if (!userId) {
      setTodayTasks([]);
      setTomorrowTasks([]);
      return;
    }
    Promise.all([
      getTasksForDate(userId, todayStr()),
      getTasksForDate(userId, tomorrowStr())
    ]).then(([today, tomorrow]) => {
      setTodayTasks(today.filter((t) => !t.completed));
      setTomorrowTasks(tomorrow);
    });
  }, [userId]);

  const count = todayTasks.length + tomorrowTasks.length;

  const getIcon = (task: CalendarTask) => {
    const title = (task.title || '').toLowerCase();
    if (title.includes('irrigation') || title.includes('सिंचाई') || title.includes('watering')) return Droplets;
    if (title.includes('fertilizer') || title.includes('खाद') || title.includes('यूरिया') || title.includes('DAP')) return Leaf;
    return AlertCircle;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 text-gray-700 transition-colors"
        title={getLabel(language, 'notificationPanel')}
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-[400px] overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{getLabel(language, 'notificationPanel')}</h3>
            </div>
            <div className="p-2">
              {todayTasks.length === 0 && tomorrowTasks.length === 0 ? (
                <p className="p-4 text-gray-500 text-sm text-center">{getLabel(language, 'noNotifications')}</p>
              ) : (
                <>
                  {todayTasks.length > 0 && (
                    <div className="mb-3">
                      <p className="px-2 py-1 text-xs font-bold text-green-700 uppercase">{getLabel(language, 'todayTask')}</p>
                      {todayTasks.map((task) => {
                        const Icon = getIcon(task);
                        return (
                          <div
                            key={task.id}
                            className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 border-l-2 border-green-500 bg-green-50/50"
                          >
                            <Icon size={18} className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{task.title}</p>
                              <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {tomorrowTasks.length > 0 && (
                    <div>
                      <p className="px-2 py-1 text-xs font-bold text-amber-700 uppercase">{getLabel(language, 'tomorrowTask')}</p>
                      {tomorrowTasks.map((task) => {
                        const Icon = getIcon(task);
                        return (
                          <div
                            key={task.id}
                            className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 border-l-2 border-amber-400 bg-amber-50/50"
                          >
                            <Icon size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{task.title}</p>
                              <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
