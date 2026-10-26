# Decisões de design e de engenharia

Este documento registra **o que foi decidido, por quê, o que foi descartado e o que ainda é limitação**. É a referência para
entender as escolhas do projeto. Os fatos marcados como *premissa* são estimativas editáveis na interface, não dados oficiais.

## 1. Produto

- **Pergunta que o app responde:** qual rota de uma viagem de frota compensa, quanto ela custa e em que trechos o clima
  atrapalha no horário em que o veículo estará ali.
- **Modo:** Operate (ferramenta de tarefa) com a tela de resultado tratada como quadro de horários. O mapa é o protagonista
  no desktop; o painel serve ao mapa.
- **Sem conta, sem servidor, sem chave de API.** Tudo roda no navegador. O estado da tela vai na URL, para compartilhar.

## 2. Fontes de dados

| Dado | Fonte | Chave | Limite / observação | Como é usado |
|---|---|---|---|---|
| Rotas (até 3 alternativas) | OSRM, servidor público de demonstração (`router.project-osrm.org`) | não | Sem SLA. Atrás da interface `RouteProvider` para troca futura. | Geometria, distância e duração. |
| Previsão horária | Open-Meteo (`api.open-meteo.com`) | não | Até 16 dias. Uma chamada por rota, com até 12 pontos. | Chuva (mm/h), rajada (km/h) e código WMO no horário estimado de passagem. |
| Busca de cidades | Open-Meteo Geocoding | não | Só cidades do Brasil. | Origem e destino, com UF e fuso. |
| Combustível | ANP, Síntese Semanal de Preços, edição 42/2026 (semana de 11/10 a 17/10/2026) | não | Publicação semanal. Transcrita manualmente. | Preço médio de revenda da capital de cada UF de origem e destino. |
| Custo de capital | Meta Selic, série 432 do Banco Central (SGS) | não | Usa o último valor com vigência até hoje. | Taxa de custo de capital sobre o valor do veículo. |
| Valor do veículo | Tabela FIPE, API Parallelum v2 | não | 500 consultas por dia por IP. | Preenche o valor de mercado (opcional). |
| Pedágio | **não há fonte** | — | Nenhuma API pública gratuita confiável. | Campo manual, zero por padrão. |

### Verificação da referência de combustível

O `public/data/fuel-reference.json` foi conferido contra o PDF oficial da ANP (síntese 42/2026), em 26/10/2026. A conferência
foi visual, página a página (páginas 3, 5 e 7 do PDF, com as tabelas de capitais de gasolina C, etanol hidratado e diesel B S10):
**81 de 81 valores batem** (27 UFs × 3 combustíveis), e as médias nacionais (R$ 6,53 / R$ 4,11 / R$ 7,34) também batem.
A transcrição é manual: a atualização é feita a cada nova síntese, e o campo `source` do arquivo cita o documento,
a semana e a data da transcrição. A ANP não é consultada em tempo de execução.

Limitação: o preço é o de **revenda na capital**, não a média estadual nem o preço do posto da rota. Quando só uma UF é
conhecida, usa-se ela; quando nenhuma é, usa-se a média nacional, e a interface diz qual base foi usada.

## 3. Decisões técnicas e motivos

**3.1 Sem backend.** Todas as fontes são públicas e aceitam chamada do navegador (CORS aberto). Um servidor só adicionaria
custo, ponto de falha e um lugar para guardar segredo que não existe. O CSP restringe `connect-src` aos hosts exatos.

**3.2 Interface `RouteProvider`.** O OSRM demo não tem SLA e pode cair ou limitar uso. A interface isola a troca por
OpenRouteService, Valhalla ou OSRM próprio sem tocar no restante. *Descartado:* acoplar o app ao formato do OSRM.

**3.3 Previsão amostrada, não por ponto a ponto.** A rota é dividida em até 12 pontos (um a cada ~90 km). Cada ponto recebe
o horário estimado de chegada (distância proporcional à duração, velocidade média constante). Cada trecho assume o pior
estado de seus dois extremos: visão conservadora. *Descartado:* consultar cada quilômetro, que estouraria o limite da API
e não ganha precisão que a previsão de 16 dias já não tenha.

**3.4 Limiares de risco.** Chuva: moderada a partir de 2,5 mm/h e forte a partir de 7,6 mm/h (escala da OMM). Rajada: atenção
a partir de 50 km/h e alto risco a partir de 70 km/h. São **parâmetros de apoio à decisão**, não alertas meteorológicos
oficiais, e estão em `src/lib/risk.ts` com a justificativa.

**3.5 Recomendação com critério explícito.** Primeiro o menor risco climático; entre rotas empatadas, o menor custo total;
persistindo o empate, a mais rápida. O critério é mostrado na tela. *Descartado:* um índice único ponderando risco e custo,
que esconderia a troca entre eles.

**3.6 Custo com premissas visíveis.** Combustível = litros × preço. Depreciação e custo de capital = valor do veículo ÷
km anual × taxa × km (só se houver valor do veículo). Manutenção = R$/km. Motorista = R$/h × duração. Pedágio = manual.
Os valores de consumo e manutenção vêm do tipo de veículo (premissa), depreciação (15% a.a.) e motorista (R$ 30/h) são
**premissas editáveis, não dados oficiais**. Todo campo editado fica marcado e pode ser restaurado.

**3.7 Custo de capital pela Selic.** É o rendimento que o dinheiro imobilizado no veículo deixaria de ter. Usa a meta,
não o CDI, por ser a taxa de referência pública mais estável e de fácil conferência.

**3.8 FIPE pela Parallelum, não pela BrasilAPI.** A BrasilAPI expõe o preço só com o código FIPE já conhecido; não há como
navegar marca → modelo → ano para o usuário escolher. A API Parallelum v2 oferece essa navegação e, nos testes de 26/10/2026,
respondeu normalmente. O custo é o limite de 500 consultas por dia por IP, sinalizado na tela.

**3.9 Mapa claro sobre painel escuro.** O painel é "asfalto" (grafite) porque concentra leitura de números e tabelas. O mapa
é o estilo claro OpenFreeMap *positron*, para a rota colorida de risco se destacar. Fontes Barlow Condensed (números e
títulos) e Inter (texto corrido) são self-hosted via `@fontsource`.

**3.10 Risco nunca só por cor.** Cada estado tem cor, ícone e rótulo textual. Trecho sem previsão é tracejado no mapa e
aparece como "Sem previsão" na lista. A tabela de horários é a versão textual do mapa.

**3.11 Lista de rotas como radiogroup.** Setas movem a seleção (roving tabindex). A combinação de combobox ARIA com lista de
resultados segue o padrão WAI-ARIA para autocomplete de lista; o status de resultados é anunciado por região `aria-live`.

**3.12 MapLibre em chunk separado.** O mapa é ~1 MB (gzip ~290 kB). Carregado sob demanda, o painel aparece antes e o
bundle inicial fica em ~366 kB. O worker do MapLibre é registrado com `setWorkerUrl` apontando para o arquivo com hash do
Vite; sem isso o worker não carrega em produção.

**3.13 URL compartilhável validada com Zod.** A URL carrega origem, destino, veículo e saída (coordenadas, nome, UF e fuso).
Tudo vindo da query string é validado: coordenada em faixa, fuso IANA válido, UF da lista, veículo do conjunto conhecido.
Parâmetro inválido é descartado sem quebrar a página.

**3.14 Premissas fora da URL.** Preço, consumo, valor do veículo e demais premissas **não** vão para a URL. Motivo: a URL
fica curta e legível, e a premissa editada é uma decisão do usuário que não deve viajar sem ele perceber. *Consequência:*
abrir um link compartilhado mostra os valores padrão, não os editados.

**3.15 Sem validação de cidade por raio.** A busca restringe o país a Brasil. Não há validação de que a rota existe entre
duas cidades além do que o OSRM responde.

## 4. Alternativas descartadas (resumo)

- **Servidor próprio para proxy das APIs:** desnecessário, todas aceitam CORS; adicionaria segredo a proteger.
- **Consulta de clima por quilômetro:** estouraria limites e não traz precisão útil.
- **Índice único risco + custo:** esconde a decisão.
- **Pedágio por scraping:** frágil e contra termos de uso de concessionárias. Mantido como campo manual.
- **Preço de combustível por posto:** não há fonte pública aberta e atualizada por posto. Usa-se a referência da capital.
- **Paleta categórica de 6 cores para o custo:** não passa no teste de todos os pares de daltonismo; uso uma rampa azul com rótulo.

## 5. Limitações conhecidas

- OSRM demo sem SLA: rotas podem falhar em horários de pico. A interface mostra o erro e oferece nova tentativa.
- Previsão só até 16 dias. Saídas além disso aparecem como "Sem previsão", com aviso.
- Velocidade média constante para estimar a chegada em cada ponto (não modela parada, trânsito ou fiscalização).
- Preço de combustível é da capital, semanal e transcrito à mão. Não reflete o posto do trajeto.
- Pedágio não é calculado. Zero na tela significa "não incluído", não "sem pedágio".
- FIPE limitada a 500 consultas por dia por IP.
- Premissas (consumo, manutenção, depreciação, motorista) são estimativas por tipo de veículo.
- Premissas editadas não viajam na URL (ver 3.14).
- Não há verificação em navegadores reais além do Chrome headless com WebGL por software.

## 6. Segurança

- Nenhum segredo no front-end; nenhuma chave de API.
- Sem `dangerouslySetInnerHTML`; todo texto de API é renderizado como texto.
- CSP por `<meta>` no build de produção, com `connect-src` restrito aos hosts usados (ver `vite.config.ts`).
  A CSP foi validada no `vite preview` sem violações no console.
- Dados externos validados com Zod antes do uso; item inválido é descartado e a seção degrada com mensagem.
- Workflows com `permissions: contents: read` no topo; só o job de deploy recebe `pages: write` e `id-token: write`.
- Dependabot para npm e GitHub Actions. `npm audit` sem vulnerabilidades na data da construção.

## 7. Fora do escopo

Contas de usuário, histórico de viagens, comparação de mais de três rotas, rotas com paradas intermediárias, previsão
além de 16 dias, integração com sistemas internos de frota.
