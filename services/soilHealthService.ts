/**
 * Soil Health: upload and track soil tests.
 * In Supabase SQL Editor, create the table:
 * create table soil_tests (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   test_date date not null,
 *   location text,
 *   ph numeric not null,
 *   nitrogen numeric not null,
 *   phosphorus numeric not null,
 *   potassium numeric not null,
 *   organic_matter numeric not null,
 *   other_nutrients jsonb,
 *   recommendations text,
 *   image_url text,
 *   created_at timestamptz default now()
 * );
 * alter table soil_tests enable row level security;
 * create policy "Users can manage own soil tests" on soil_tests for all using (auth.uid() = user_id);
 */
import { supabase } from './supabaseClient';
import type { SoilTest } from '../types';

const TABLE = 'soil_tests';

function rowToSoilTest(row: any): SoilTest {
  return {
    id: row.id,
    userId: row.user_id,
    testDate: row.test_date,
    location: row.location || '',
    pH: Number(row.ph),
    nitrogen: Number(row.nitrogen),
    phosphorus: Number(row.phosphorus),
    potassium: Number(row.potassium),
    organicMatter: Number(row.organic_matter),
    otherNutrients: row.other_nutrients ?? undefined,
    recommendations: row.recommendations || '',
    imageUrl: row.image_url ?? undefined,
  };
}

export async function saveSoilTest(userId: string, data: Omit<SoilTest, 'id' | 'userId'>): Promise<SoilTest> {
  const row = {
    user_id: userId,
    test_date: data.testDate,
    location: data.location,
    ph: data.pH,
    nitrogen: data.nitrogen,
    phosphorus: data.phosphorus,
    potassium: data.potassium,
    organic_matter: data.organicMatter,
    other_nutrients: data.otherNutrients ?? null,
    recommendations: data.recommendations,
    image_url: data.imageUrl ?? null,
  };
  const { data: inserted, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return rowToSoilTest(inserted);
}

export async function getSoilTestsByUser(userId: string): Promise<SoilTest[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('test_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToSoilTest);
}

export async function getSoilTestById(id: string, userId: string): Promise<SoilTest | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return rowToSoilTest(data);
}

export async function deleteSoilTest(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
