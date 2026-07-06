# Teste manual: conversa por voz da Helena

## Escopo

Validar entrada e saída de voz no chat principal da Helena sem alterar o fluxo de chat, contexto, tool calling, MCP ou AI Router.

## Casos

1. Abrir a tela Helena em navegador com Web Speech API.
2. Enviar uma mensagem simples.
3. Aguardar a resposta textual terminar.
4. Clicar em "Ouvir".
5. Confirmar que a resposta é reproduzida em voz.
6. Durante a fala, testar "Pausar", "Continuar" e "Parar".
7. Ativar "Responder com voz".
8. Enviar nova mensagem e confirmar que a resposta é falada automaticamente após o streaming terminar.
9. Pedir uma ação, como criar uma tarefa, e confirmar que blocos `action` não são lidos em voz.
10. Clicar no botão de microfone, falar uma pergunta e confirmar que a transcrição aparece na área "Ouvindo".
11. Clicar novamente para parar e enviar a fala para o chat.
12. Confirmar que respostas iniciadas por voz são faladas automaticamente.
13. Testar em navegador sem suporte ou com speech desabilitado e confirmar que a UI mostra indisponibilidade sem quebrar o chat.

## Resultado esperado

- O chat textual continua funcionando como antes.
- Ações continuam sendo processadas como antes.
- A entrada por voz apenas preenche/envia mensagens para o fluxo existente.
- O TTS é apenas uma camada frontend sobre a resposta final da Helena.
- Nenhuma mudança de banco, MCP, AI Router ou Edge Function é necessária.
