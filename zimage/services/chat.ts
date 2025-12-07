export interface GenerateChatParams {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  apiKey: string;
  model?: string;
}

export async function generateChat({ messages, apiKey, model }: GenerateChatParams): Promise<string> {
  const { DEFAULT_CHAT_ENDPOINT, DEEPSEEK_MODEL_ID, DEFAULT_SYSTEM_PROMPT } = await import('../constants');
  const sendMessages = messages[0]?.role === 'system'
    ? messages
    : ([{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...messages]);
  const response = await fetch(DEFAULT_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || DEEPSEEK_MODEL_ID,
      messages: sendMessages,
      stream: false
    })
  });

  if (!response.ok) {
    let json: any = null;
    let text = '';
    try { json = await response.json(); } catch {}
    if (!json) { try { text = await response.text(); } catch {} }
    const status = response.status;
    const code = json?.error?.code || json?.code;
    const type = json?.error?.type || json?.type;
    const message = json?.error?.message || json?.message || text || 'Unknown error';
    const requestId = json?.request_id || json?.requestId || '';
    const detail = `Chat error ${status}${code ? ` [${code}]` : ''}${type ? ` (${type})` : ''}: ${message}${requestId ? ` | req: ${requestId}` : ''}`;
    throw new Error(detail);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('Empty response content');
  return content;
}

export interface GenerateChatStreamParams {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}

export async function generateChatStream({ messages, apiKey, model, maxTokens, signal, onChunk }: GenerateChatStreamParams): Promise<string> {
  const { DEFAULT_CHAT_ENDPOINT, DEEPSEEK_MODEL_ID, DEFAULT_SYSTEM_PROMPT, DEFAULT_MAX_CHAT_TOKENS } = await import('../constants');
  const sendMessages = messages[0]?.role === 'system' ? messages : ([{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...messages]);
  const response = await fetch(DEFAULT_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || DEEPSEEK_MODEL_ID,
      messages: sendMessages,
      stream: true,
      max_tokens: maxTokens || DEFAULT_MAX_CHAT_TOKENS
    }),
    signal
  });

  if (!response.ok) {
    let json: any = null;
    let text = '';
    try { json = await response.json(); } catch {}
    if (!json) { try { text = await response.text(); } catch {} }
    const status = response.status;
    const code = json?.error?.code || json?.code;
    const type = json?.error?.type || json?.type;
    const message = json?.error?.message || json?.message || text || 'Unknown error';
    const requestId = json?.request_id || json?.requestId || '';
    const detail = `Chat error ${status}${code ? ` [${code}]` : ''}${type ? ` (${type})` : ''}: ${message}${requestId ? ` | req: ${requestId}` : ''}`;
    throw new Error(detail);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content || data?.output_text || data?.text || '';
    if (!content) throw new Error('Empty response content');
    if (onChunk) onChunk(content);
    return content;
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed === 'data: [DONE]') return;
    const payloadStr = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
    let obj: any = null;
    try { obj = JSON.parse(payloadStr); } catch { obj = null; }
    if (!obj) return;
    const piece = obj?.choices?.[0]?.delta?.content ?? obj?.choices?.[0]?.message?.content ?? obj?.output_text ?? obj?.text ?? '';
    if (piece) {
      fullText += piece;
      if (onChunk) onChunk(piece);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) flushLine(line);
  }
  if (buffer) flushLine(buffer);
  return fullText;
}
