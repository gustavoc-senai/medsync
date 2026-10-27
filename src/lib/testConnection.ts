
import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { error } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Erro na consulta Supabase:", error.message);
    return false;
  }

  console.log("MedSync: consulta ao Supabase concluída.");
  return true;
}
