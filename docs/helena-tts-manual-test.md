# Teste manual: conversa por voz da Helena

## Escopo

Validar entrada e saída de voz no chat principal da Helena sem alterar o fluxo de chat, contexto, tool calling, MCP ou AI Router.

## Configuração ElevenLabs

Para usar a voz natural da Helena sem acesso ao painel Supabase, abra Settings -> Voz e salve uma chave ElevenLabs. A chave fica em `user_api_keys` associada ao usuário autenticado.

Como alternativa de infraestrutura, também é possível configurar secrets globais da Edge Function:

```bash
supabase secrets set ELEVENLABS_API_KEY="..."
supabase secrets set HELENA_ELEVENLABS_VOICE_ID="KHmfNHtEjHhLK9eER20w"
```

Se os secrets não estiverem configurados ou a chamada ao provedor falhar, o frontend tenta usar a Web Speech API do navegador como fallback.

## Casos

1. Abrir a tela Helena em navegador com Web Speech API.
2. Enviar uma mensagem simples.
3. Aguardar a resposta textual terminar.
4. Clicar em "Ouvir".
5. Confirmar que a resposta é reproduzida pela voz ElevenLabs quando os secrets estão configurados.
6. Durante a fala, testar "Pausar", "Continuar" e "Parar".
7. Ativar "Responder com voz".
8. Enviar nova mensagem e confirmar que a resposta é falada automaticamente após o streaming terminar.
9. Pedir uma ação, como criar uma tarefa, e confirmar que blocos `action` não são lidos em voz.
10. Clicar no botão de microfone, falar uma pergunta e confirmar que a transcrição aparece na área "Ouvindo".
11. Clicar novamente para parar e enviar a fala para o chat.
12. Confirmar que respostas iniciadas por voz são faladas automaticamente.
13. Remover temporariamente os secrets ou simular falha na função e confirmar fallback para Web Speech API.
14. Testar em navegador sem suporte a reprodução de áudio ou speech desabilitado e confirmar que a UI mostra indisponibilidade sem quebrar o chat.

## Resultado esperado

- O chat textual continua funcionando como antes.
- Ações continuam sendo processadas como antes.
- A entrada por voz apenas preenche/envia mensagens para o fluxo existente.
- O TTS é uma camada de saída sobre a resposta final da Helena.
- A Edge Function `helena-tts` mantém a chave ElevenLabs fora do bundle do navegador.
- Nenhuma mudança de banco, MCP, AI Router ou lógica de tool calling é necessária.
