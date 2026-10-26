---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface: Planejador de viagem (tela única)

Modo: **Operate**. Visitante: planejador de frota (ou avaliador de portfólio) que monta uma viagem, compara rotas e lê custo e risco.
Tarefa: origem + destino + veículo + saída → comparar até 3 rotas → ler custo por km/total e trechos de risco → compartilhar por URL.
Restrições: 100% estático; APIs públicas; premissas visíveis; nada interno de empresa. Decisões não resolvidas: pedágio é manual; combustível vem de referência ANP.

## Direction contract

THESIS: o clima da viagem lido como um quadro de horários de rodoviária sobre um mapa de dia. A tela recusa o arranjo padrão
"mapa com cartão flutuante de métricas" e entrega o trecho de risco como linhas de horário (km, hora prevista, condição)
sincronizadas com o mapa.
OWN-WORLD: painel "asfalto" grafite (#12171C) sobre um mapa claro (OpenFreeMap positron); azul de placa de serviço como ação
primária, âmbar de sinal de advertência e verde/vermelho de estado só com significado; Barlow Condensed (herança da
sinalização rodoviária) para números e títulos de linha, Inter variável para texto corrido; numerais tabulares; linhas
finas de 1px, densidade de quadro de partidas, cantos de 6px; rota com contorno branco e a escolhida "acesa" enquanto as
alternativas ficam apagadas (disciplina do diagrama de metrô).
STORY: em 5 segundos a pessoa entende que há uma rota recomendada, quanto custa e onde pega chuva; em 30 segundos compara
alternativas e ajusta premissas; sai com um link que reproduz a tela.
FIRST VIEWPORT: desktop 1440x900: mapa ocupa tudo à direita (~68%); coluna de 420px à esquerda em asfalto com (1) busca
origem/destino + veículo + saída, (2) três rotas comparáveis como linhas de tabela com a recomendada acesa, (3) custo total e
custo/km em numerais grandes com a decomposição em barra segmentada. O quadro de horários do trecho (km | hora | condição)
fica logo abaixo e destaca o ponto no mapa ao passar/focar. Ação primária: "Calcular viagem" (azul), no fim do formulário.
No mobile o painel vira bottom sheet com três posições; o mapa fica utilizável.
FORM: forma = quadro de horários de rodoviária (candidata 7 da minha lista de 7 fundamentadas; challenger "midnight transit
diagram" avaliado como competitivo, sua disciplina de "linha escolhida acesa, contexto preservado" foi incorporada como
raise). seed: cc3b1cf0bdec7930
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
