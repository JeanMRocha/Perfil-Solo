import { isLocalDataMode } from './dataProvider';
import { getAllAnalysesLocal, getAnalysesByUserLocal } from './localDb';
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

export async function getAnalisesByUser(userId: string) {
  if (isLocalDataMode) {
    return getAnalysesByUserLocal(userId);
  }

  const { data, error } = await supabaseClient
    .from('analises_solo')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (error) throw error;
  return data ?? [];
}
