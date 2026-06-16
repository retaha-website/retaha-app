import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

// 1x1 transparent GIF (base64 decoded to bytes)
const TRANSPARENT_GIF = new Uint8Array([
  71,73,70,56,57,97,1,0,1,0,0,0,0,59
]);

export const GET: APIRoute = async ({ params }) => {
  const sendId = params.send_id;
  if (!sendId) return new Response(TRANSPARENT_GIF, { headers: { 'Content-Type': 'image/gif' } });

  try {
    const sb = createSupabaseServiceRoleInstance();
    const { data } = await sb
      .from('marketing_sends')
      .select('id, campaign_id, opened_at')
      .eq('id', sendId)
      .maybeSingle();

    if (data && !data.opened_at) {
      await sb.from('marketing_sends').update({ opened_at: new Date().toISOString() }).eq('id', sendId);
      if (data.campaign_id) {
        await sb.rpc('mc_inc_open', { p_campaign_id: data.campaign_id });
      }
    }
  } catch (err) {
    console.warn('[track/open] error:', (err as Error).message);
  }

  return new Response(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
};
