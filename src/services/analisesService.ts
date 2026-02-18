import { isLocalDataMode } from './dataProvider';
import { getAllAnalysesLocal } from './localDb';
import { supabaseClient } from '../supabase/supabaseClient';

export async function getAnalises() {
  if (isLocalDataMode) {
    return getAllAnalysesLocal();
  }

  const { data, error } = await supabaseClient.from('analises_solo').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function getAnalisesSupabase() {
  return getAnalises();
}
