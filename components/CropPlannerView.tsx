import React, { useState, useEffect } from 'react';
import { CalendarDays, Loader2, CheckCircle2, Circle, ChevronLeft, ChevronRight, Sprout, Trash2 } from 'lucide-react';
import { Language, FarmPlan, CalendarTask } from '../types';
import { getLabel } from '../translations';
import { generateCropCalendar } from '../services/geminiService';
import { mapTemplatesToTasks, getStaticFallbackTasks } from '../services/cropCalendarService';
import {
  createFarmPlan,
  getFarmPlansByUser,
  getCalendarTasksByFarmPlan,
  insertCalendarTasks,
  updateTaskCompletion,
  deleteFarmPlan
} from '../services/farmPlanService';

const CROPS = ['paddy', 'wheat', 'cotton', 'sugarcane', 'maize', 'potato'];
const SOILS = ['clayLoam', 'sandyLoam', 'blackSoil', 'redSoil', 'alluvial'];

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function getMonthStartPad(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface CropPlannerViewProps {
  user: { id: string } | null;
  language: Language;
  location: string;
  soilTests: { crop?: string }[];
  setView: (v: string) => void;
}

export const CropPlannerView: React.FC<CropPlannerViewProps> = ({
  user,
  language,
  location,
  soilTests,
  setView
}) => {
  const [plans, setPlans] = useState<FarmPlan[]>([]);
  const [activePlan, setActivePlan] = useState<FarmPlan | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    crop: 'paddy',
    landAcres: 1,
    sowingDate: new Date().toISOString().slice(0, 10),
    soilType: ''
  });

  useEffect(() => {
    if (!user?.id) return;
    setActivePlan(null);
    setPlans([]);
    setTasks([]);
    getFarmPlansByUser(user.id).then((p) => {
      setPlans(p);
      if (p.length > 0) {
        setActivePlan(p[0]);
        setShowSetup(false);
      } else {
        setShowSetup(true);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!activePlan || !user?.id) {
      setTasks([]);
      return;
    }
    getCalendarTasksByFarmPlan(activePlan.id, user.id).then(setTasks);
  }, [activePlan?.id, user?.id]);

  const handleSubmit = async () => {
    if (!user?.id) return;
    setGenerating(true);
    setError(null);
    try {
      const plan = await createFarmPlan(user.id, {
        crop: form.crop,
        landAcres: form.landAcres,
        sowingDate: form.sowingDate
      });
      let taskTemplates: { dayFromSowing: number; stage: string; title: string; description: string; quantityHint?: string }[];
      try {
        const res = await generateCropCalendar(
          form.crop,
          form.landAcres,
          form.sowingDate,
          location,
          form.soilType || undefined,
          language
        );
        taskTemplates = res.tasks;
      } catch {
        taskTemplates = getStaticFallbackTasks(form.crop, form.landAcres);
      }
      const newTasks = mapTemplatesToTasks(plan, taskTemplates);
      await insertCalendarTasks(newTasks, user.id);
      setPlans((prev) => [plan, ...prev]);
      setActivePlan(plan);
      setTasks(newTasks);
      setShowSetup(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!user?.id || !activePlan) return;
    if (!confirm(getLabel(language, 'deletePlanConfirm'))) return;
    const deletedId = activePlan.id;
    await deleteFarmPlan(deletedId, user.id);
    const remaining = plans.filter((p) => p.id !== deletedId);
    setPlans(remaining);
    setActivePlan(remaining[0] ?? null);
    setTasks([]);
    setShowSetup(remaining.length === 0);
  };

  const handleToggleComplete = async (task: CalendarTask) => {
    const next = !task.completed;
    await updateTaskCompletion(task.id, next, user?.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next, completedAt: next ? new Date().toISOString() : undefined } : t)));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const tasksByDate = tasks.reduce<Record<string, CalendarTask[]>>((acc, t) => {
    (acc[t.date] = acc[t.date] || []).push(t);
    return acc;
  }, {});

  const daysInMonth = getDaysInMonth(calendarMonth.year, calendarMonth.month);
  const padStart = getMonthStartPad(calendarMonth.year, calendarMonth.month);

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];
  const todayTasks = tasksByDate[todayStr] || [];
  const completedCount = tasks.filter((t) => t.completed).length;

  if (!user) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="text-amber-800 font-medium">{getLabel(language, 'login')} {getLabel(language, 'loginDesc')}</p>
        <button
          onClick={() => setView('HOME')}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-xl font-medium"
        >
          {getLabel(language, 'dashboard')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {showSetup ? (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <CalendarDays size={24} className="text-green-600" />
            {getLabel(language, 'cropPlanner')}
          </h2>
          <p className="text-gray-600 text-sm mb-6">{getLabel(language, 'cropPlannerDesc')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'selectCrop')}</label>
              <select
                value={form.crop}
                onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
              >
                {CROPS.map((c) => (
                  <option key={c} value={c}>
                    {getLabel(language, `crop_${c}` as 'crop_paddy')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'landAcres')}</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.landAcres}
                onChange={(e) => setForm((f) => ({ ...f, landAcres: parseFloat(e.target.value) || 1 }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{getLabel(language, 'sowingDate')}</label>
              <input
                type="date"
                value={form.sowingDate}
                onChange={(e) => setForm((f) => ({ ...f, sowingDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {getLabel(language, 'soil')} ({getLabel(language, 'optional')})
              </label>
              <select
                value={form.soilType}
                onChange={(e) => setForm((f) => ({ ...f, soilType: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
              >
                <option value="">{getLabel(language, 'general')}</option>
                {SOILS.map((s) => (
                  <option key={s} value={s}>
                    {getLabel(language, `soil_${s}` as 'soil_clayLoam')}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <div className="text-red-600 text-sm font-medium">{error}</div>
            )}
            <button
              onClick={handleSubmit}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-70 transition-all"
            >
              {generating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {getLabel(language, 'generatingCalendar')}
                </>
              ) : (
                <>
                  <Sprout size={20} />
                  {getLabel(language, 'createCropPlan')}
                </>
              )}
            </button>
            {plans.length > 0 && (
              <button
                onClick={() => setShowSetup(false)}
                className="w-full py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                {getLabel(language, 'viewExistingPlan')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays size={24} className="text-green-600" />
                {getLabel(language, 'cropPlanner')}
              </h2>
              {activePlan && (
                plans.length > 1 ? (
                  <select
                    value={activePlan.id}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      if (p) setActivePlan(p);
                    }}
                    className="text-sm font-medium bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getLabel(language, `crop_${p.crop}` as 'crop_paddy')} · {p.landAcres} {getLabel(language, 'acres')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {getLabel(language, `crop_${activePlan.crop}` as 'crop_paddy')} · {activePlan.landAcres} {getLabel(language, 'acres')}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">
                {completedCount}/{tasks.length} {getLabel(language, 'tasksCompleted')}
              </span>
              <button
                onClick={() => setShowSetup(true)}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-medium text-sm hover:bg-green-200"
              >
                + {getLabel(language, 'newPlan')}
              </button>
              {activePlan && (
                <button
                  onClick={handleDeletePlan}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-medium text-sm hover:bg-red-100 flex items-center gap-1"
                  title={getLabel(language, 'deletePlan')}
                >
                  <Trash2 size={16} />
                  {getLabel(language, 'deletePlan')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{monthLabel}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setCalendarMonth((m) =>
                        m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }
                      )
                    }
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() =>
                      setCalendarMonth((m) =>
                        m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }
                      )
                    }
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: padStart }, (_, i) => (
                  <div key={`pad-${i}`} className="aspect-square" />
                ))}
                {daysInMonth.map((d) => {
                  const dateStr = d.toISOString().slice(0, 10);
                  const dayTasks = tasksByDate[dateStr] || [];
                  const hasTasks = dayTasks.length > 0;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all ${
                        isSelected ? 'bg-green-600 text-white ring-2 ring-green-400' : ''
                      } ${!isSelected && isToday ? 'bg-green-100 text-green-800' : ''} ${
                        !isSelected && !isToday && hasTasks ? 'bg-green-50 text-green-700' : ''
                      } ${!isSelected && !isToday && !hasTasks ? 'text-gray-600 hover:bg-gray-100' : ''}`}
                    >
                      {d.getDate()}
                      {hasTasks && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4">
                {selectedDate ? formatDate(selectedDate) : getLabel(language, 'todayTask')}
              </h3>
              {(selectedDate ? selectedTasks : todayTasks).length === 0 ? (
                <p className="text-gray-500 text-sm">{getLabel(language, 'noTaskToday')}</p>
              ) : (
                <div className="space-y-3">
                  {(selectedDate ? selectedTasks : todayTasks).map((task) => (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className="mt-0.5 shrink-0"
                        >
                          {task.completed ? (
                            <CheckCircle2 size={20} className="text-green-600" />
                          ) : (
                            <Circle size={20} className="text-gray-400" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                          {task.quantityHint && (
                            <p className="text-xs text-green-700 mt-2 font-medium">{task.quantityHint}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
