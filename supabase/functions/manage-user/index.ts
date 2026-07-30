import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization') || '';
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(url, serviceKey);
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) throw new Error('Sesión no válida.');
    const { data: caller } = await adminClient.from('profiles').select('role,active').eq('user_id', authData.user.id).single();
    if (!caller?.active || caller.role !== 'Administrador') throw new Error('Solo el administrador puede gestionar usuarios.');

    const { action, user } = await request.json();
    if (!['create','update','toggle'].includes(action)) throw new Error('Acción no permitida.');
    if (!['Administrador','Médico','Auxiliar'].includes(user.role)) throw new Error('Rol no permitido.');

    if (action === 'create') {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: user.email, password: user.password, email_confirm: true,
      });
      if (error) throw error;
      const { error: profileError } = await adminClient.from('profiles').insert({
        user_id: data.user.id, email: user.email, full_name: user.name, role: user.role, active: true,
      });
      if (profileError) throw profileError;
      return new Response(JSON.stringify({ ok: true, user_id: data.user.id }), { headers });
    }

    const changes = { email: user.email, full_name: user.name, role: user.role, active: user.active };
    const { error: profileError } = await adminClient.from('profiles').update(changes).eq('user_id', user.id);
    if (profileError) throw profileError;
    const authChanges: Record<string, unknown> = { email: user.email, ban_duration: user.active === false ? '876000h' : 'none' };
    if (user.password) authChanges.password = user.password;
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, authChanges);
    if (updateError) throw updateError;
    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers });
  }
});
