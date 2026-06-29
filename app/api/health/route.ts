import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      APP_SECRET: Boolean(process.env.APP_SECRET),
      N8N_WEBHOOK_SECRET: Boolean(process.env.N8N_WEBHOOK_SECRET),
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      ANTHROPICAPIKEY: Boolean(process.env.ANTHROPICAPIKEY),
      ZAPI_INSTANCE_ID: Boolean(process.env.ZAPI_INSTANCE_ID),
      ZAPI_TOKEN: Boolean(process.env.ZAPI_TOKEN),
      ZAPI_CLIENT_TOKEN: Boolean(process.env.ZAPI_CLIENT_TOKEN)
    }
  });
}
