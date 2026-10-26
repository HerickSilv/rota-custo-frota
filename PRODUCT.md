# Product

<!-- impeccable:product-schema 1 -->

> Registro **inferido do briefing** (o usuário optou por pular entrevistas e esta construção rodou sem canal de pergunta).
> Fatos marcados *(inferido)* não foram confirmados por ele e devem ser revisados.

## Platform

web

## Stack

Decidida no briefing do projeto: React + Vite + TypeScript (strict) + Tailwind + MapLibre GL JS (tiles OpenFreeMap),
100% estático e client-side, publicado no GitHub Pages. Sem chave de API em lugar nenhum.

## Users

- Planejadores de transporte, analistas de logística e gestores de frota que precisam decidir rota e horário de uma
  viagem antes da saída, e justificar o custo da viagem *(inferido)*.
- Avaliadores de portfólio (recrutadores e líderes técnicos de empresas de logística, fintech e mobilidade) que abrem o
  link por poucos minutos para julgar domínio de negócio e acabamento *(inferido)*.

## Product Purpose

Planejar uma viagem de frota pelo Brasil em um só lugar: escolher origem, destino, veículo e horário de saída e ver a
rota no mapa **pintada pelo risco climático ao longo do trajeto**, mais um quadro de custo da viagem (combustível,
custo de capital e depreciação, manutenção, pedágio e motorista), com custo por km e total. Sucesso = a pessoa entende em
segundos qual das rotas compensa e quais trechos exigem atenção, e consegue ver de onde vem cada número.

## Positioning

Um planejador de rotas comum entrega distância e tempo. Este cruza, em uma só tela, três fontes públicas que normalmente
vivem separadas: o trajeto (OSRM), a previsão do tempo no horário em que o veículo estará em cada trecho (Open-Meteo) e a
economia do veículo (tabela FIPE e Selic do Banco Central, como custo de capital). Tudo com premissas visíveis e
editáveis.

## Operating Context

Uso em escritório, em tela grande ou no celular, geralmente no dia anterior à viagem ou no momento de cotar um frete.
O resultado costuma ir parar em uma conversa ("essa rota custa X e pega chuva forte entre 14h e 16h"), por isso o estado
da tela é compartilhável por URL.

## Capabilities and Constraints

- Rotas: OSRM público (servidor demo, sem SLA) atrás de uma interface `RouteProvider`, para troca futura.
- Clima: Open-Meteo, previsão de até 16 dias; amostragem de pontos ao longo da rota, casada com o horário estimado de chegada.
- Veículo: presets de frota com consumo editável; valor FIPE opcional (BrasilAPI) para custo de capital e depreciação.
- Preço do combustível: depende de fonte oficial (ANP); nenhum preço pode ser inventado; ver `docs/design.md`.
- Pedágio: **não existe API gratuita confiável**; é campo manual e a limitação é declarada.
- Sem dados internos de nenhuma empresa; sem contas de usuário; sem persistência de servidor.
- Terminologia: pt-BR ("combustível", "custo por km", "premissas", "saída", "chegada prevista").

## Evidence on Hand

Nenhuma de cliente. Todo número exibido vem de API pública no momento do uso ou de arquivo de referência com fonte e
data citadas. Não existem depoimentos, benchmarks de desempenho nem clientes e nenhum deve ser fabricado.

## Product Principles

1. Cada número mostra de onde veio e como foi calculado; premissa que muda o resultado fica visível e editável.
2. Incerteza é informação: previsão, preço e estimativas aparecem como faixa/rótulo, nunca como certeza.
3. O mapa é o protagonista; o painel serve ao mapa.
4. Degradar com clareza: se uma API cai, a parte que depende dela diz isso e o resto continua útil.
5. Comparar vence calcular: o valor está em ver as alternativas lado a lado.

## Accessibility & Inclusion

Contraste AA, uso completo por teclado (inclusive o campo de busca de cidades), risco climático nunca comunicado só por
cor (rótulos e padrões), `prefers-reduced-motion` respeitado, e mapa não é o único canal: tudo que o mapa mostra também
aparece em lista/texto.
