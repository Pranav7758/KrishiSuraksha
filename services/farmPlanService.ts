/**
 * Farm Plan: CRUD for farm plans and calendar tasks.
 * Supabase SQL:
 *
 * create table farm_plans (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   crop text not null,
 *   land_acres numeric not null,
 *   sowing_date date not null,
 *   created_at timestamptz default now()
 * );
 * alter table farm_plans enable row level security;
 * create policy "Users manage own farm plans" on farm_plans for all using (auth.uid() = user_id);
 *
 * create table calendar_tasks (
 *   id text primary key,
 *   farm_plan_id uuid not null references farm_plans(id) on delete cascade,
 *   date date not null,
 *   stage text not null,
 *   title text not null,
 *   description text not null,
 *   quantity_hint text,
 *   completed boolean default false,
 *   completed_at timestamptz
 * );
 * alter table calendar_tasks enable row level security;
 * create policy "Users manage own tasks via farm plan" on calendar_tasks for all
 *   using (exists (select 1 from farm_plans fp where fp.id = farm_plan_id and fp.user_id = auth.uid()));
 */
import { supabase } from './supabaseClient';
import type { FarmPlan, CalendarTask } from '../types';

const FARM_PLANS_TABLE = 'farm_plans';
const CALENDAR_TASKS_TABLE = 'calendar_tasks';
const LOCAL_FARM_PLANS = 'krishi_farm_plans';
const LOCAL_CALENDAR_TASKS = 'krishi_calendar_tasks';

function rowToFarmPlan(row: any): FarmPlan {
  return {
    id: row.id,
    userId: row.user_id,
    crop: row.crop,
    landAcres: Number(row.land_acres),
    sowingDate: row.sowing_date,
    createdAt: row.created_at
  };
}

function rowToCalendarTask(row: any): CalendarTask {
  return {
    id: row.id,
    farmPlanId: row.farm_plan_id,
    date: row.date,
    stage: row.stage,
    title: row.title,
    description: row.description,
    quantityHint: row.quantity_hint ?? undefined,
    completed: Boolean(row.completed),
    completedAt: row.completed_at ?? undefined
  };
}

// --- Local storage helpers (offline fallback) ---
// Farm plans: user-scoped key to prevent cross-account leak
function getLocalPlansKey(userId: string) {
  return `${LOCAL_FARM_PLANS}_${userId}`;
}

function getLocalFarmPlans(userId: string): FarmPlan[] {
  try {
    const raw = localStorage.getItem(getLocalPlansKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLocalFarmPlan(plan: FarmPlan): void {
  const all = getLocalFarmPlans(plan.userId);
  const idx = all.findIndex((p) => p.id === plan.id);
  if (idx >= 0) all[idx] = plan;
  else all.push(plan);
  localStorage.setItem(getLocalPlansKey(plan.userId), JSON.stringify(all));
}

// Calendar tasks: stored per user to prevent cross-account leak
function getLocalTasksKey(userId: string) {
  return `${LOCAL_CALENDAR_TASKS}_${userId}`;
}

function getLocalCalendarTasksForUser(userId: string): CalendarTask[] {
  try {
    const raw = localStorage.getItem(getLocalTasksKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getLocalCalendarTasks(farmPlanId: string, userId?: string): CalendarTask[] {
  if (!userId) return [];
  const all = getLocalCalendarTasksForUser(userId);
  return all.filter((t) => t.farmPlanId === farmPlanId);
}

function setLocalCalendarTasks(userId: string, tasks: CalendarTask[]): void {
  const farmPlanId = tasks[0]?.farmPlanId;
  if (!farmPlanId) return;
  const all = getLocalCalendarTasksForUser(userId);
  const filtered = all.filter((t) => t.farmPlanId !== farmPlanId);
  localStorage.setItem(getLocalTasksKey(userId), JSON.stringify([...filtered, ...tasks]));
}

function updateLocalTask(userId: string, task: CalendarTask): void {
  const all = getLocalCalendarTasksForUser(userId);
  const idx = all.findIndex((t) => t.id === task.id);
  if (idx >= 0) all[idx] = task;
  else all.push(task);
  localStorage.setItem(getLocalTasksKey(userId), JSON.stringify(all));
}

// --- Supabase operations ---
export async function createFarmPlan(userId: string, data: Omit<FarmPlan, 'id' | 'userId' | 'createdAt'>): Promise<FarmPlan> {
  const row = {
    user_id: userId,
    crop: data.crop,
    land_acres: data.landAcres,
    sowing_date: data.sowingDate
  };
  const { data: inserted, error } = await supabase
    .from(FARM_PLANS_TABLE)
    .insert(row)
    .select('*')
    .single();
  if (error) {
    const fallback: FarmPlan = {
      id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      crop: data.crop,
      landAcres: data.landAcres,
      sowingDate: data.sowingDate,
      createdAt: new Date().toISOString()
    };
    setLocalFarmPlan(fallback);
    return fallback;
  }
  return rowToFarmPlan(inserted);
}

export async function getFarmPlansByUser(userId: string): Promise<FarmPlan[]> {
  const { data, error } = await supabase
    .from(FARM_PLANS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return getLocalFarmPlans(userId);
  return (data || []).map(rowToFarmPlan);
}

export async function getCalendarTasksByFarmPlan(farmPlanId: string, userId?: string): Promise<CalendarTask[]> {
  const { data, error } = await supabase
    .from(CALENDAR_TASKS_TABLE)
    .select('*')
    .eq('farm_plan_id', farmPlanId)
    .order('date', { ascending: true });
  if (error && userId) return getLocalCalendarTasks(farmPlanId, userId);
  if (error) return [];
  return (data || []).map(rowToCalendarTask);
}

export async function getCalendarTasksByUser(userId: string): Promise<CalendarTask[]> {
  const plans = await getFarmPlansByUser(userId);
  const all: CalendarTask[] = [];
  for (const p of plans) {
    const tasks = await getCalendarTasksByFarmPlan(p.id, userId);
    all.push(...tasks);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTasksForDate(userId: string, date: string): Promise<CalendarTask[]> {
  const all = await getCalendarTasksByUser(userId);
  return all.filter((t) => t.date === date);
}

export async function insertCalendarTasks(tasks: CalendarTask[], userId: string): Promise<void> {
  if (tasks.length === 0) return;
  const rows = tasks.map((t) => ({
    id: t.id,
    farm_plan_id: t.farmPlanId,
    date: t.date,
    stage: t.stage,
    title: t.title,
    description: t.description,
    quantity_hint: t.quantityHint ?? null,
    completed: t.completed,
    completed_at: t.completedAt ?? null
  }));
  const { error } = await supabase.from(CALENDAR_TASKS_TABLE).insert(rows);
  if (error) setLocalCalendarTasks(userId, tasks);
}

export async function deleteFarmPlan(planId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(FARM_PLANS_TABLE)
    .delete()
    .eq('id', planId)
    .eq('user_id', userId);
  if (!error) {
    await supabase.from(CALENDAR_TASKS_TABLE).delete().eq('farm_plan_id', planId);
  }
  const plans = getLocalFarmPlans(userId);
  const filtered = plans.filter((p) => p.id !== planId);
  localStorage.setItem(getLocalPlansKey(userId), JSON.stringify(filtered));
  const allTasks = getLocalCalendarTasksForUser(userId);
  const filteredTasks = allTasks.filter((t) => t.farmPlanId !== planId);
  localStorage.setItem(getLocalTasksKey(userId), JSON.stringify(filteredTasks));
}

export async function updateTaskCompletion(taskId: string, completed: boolean, userId?: string): Promise<void> {
  const completedAt = completed ? new Date().toISOString() : null;
  const { data: existing } = await supabase
    .from(CALENDAR_TASKS_TABLE)
    .select('*')
    .eq('id', taskId)
    .single();
  if (existing) {
    const { error } = await supabase
      .from(CALENDAR_TASKS_TABLE)
      .update({ completed, completed_at: completedAt })
      .eq('id', taskId);
    if (!error) return;
  }
  if (userId) {
    const all = getLocalCalendarTasksForUser(userId);
    const t = all.find((x) => x.id === taskId);
    if (t) {
      t.completed = completed;
      t.completedAt = completedAt ?? undefined;
      updateLocalTask(userId, t);
    }
  }
}
