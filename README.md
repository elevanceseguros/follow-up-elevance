# Follow-up Elevance

MVP interno para recuperar leads parados da Elevance Seguros.

## O que já existe

- Painel Next.js simples com leads recentes.
- Endpoint `POST /api/followup/intake` para o n8n enviar leads parados.
- Classificação com Claude.
- Envio de WhatsApp via Z-API em `POST /api/followup/send`.
- Webhook básico da Z-API em `POST /api/zapi/webhook` para pausar follow-up quando o cliente responde.
- Schema Supabase em `supabase/schema.sql`.

## Variáveis necessárias

Copie `.env.example` para `.env.local` no desenvolvimento e configure as mesmas variáveis na Vercel.

Nunca commitar chaves reais.

## Supabase

Execute o conteúdo de `supabase/schema.sql` no SQL Editor do Supabase.

## n8n

Depois criaremos o workflow para chamar:

`POST /api/followup/intake`

Header:

`x-elevance-secret: valor-do-N8N_WEBHOOK_SECRET-ou-APP_SECRET`

Body exemplo:

```json
{
  "nome": "João",
  "telefone": "5511999999999",
  "produto": "plano_saude",
  "status": "vou_pensar",
  "ultimaMensagemCliente": "vou pensar e te aviso",
  "ultimaMensagemEnviada": "Segue sua proposta personalizada...",
  "origem": "whatsapp"
}
```

## Áudio

O Whisper entra no n8n antes do intake: áudio recebido -> transcrição -> enviar `transcricaoAudio` no body.
