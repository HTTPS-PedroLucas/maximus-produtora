# Design system — Máximus Produtora

Referência dos tokens, componentes e regras de uso da identidade dentro do sistema de captações.
Tudo é definido em um único lugar: **`frontend/src/styles/tokens.css`**. Nenhum componente escreve
hexadecimal solto — se um valor não existir como token, crie o token primeiro.

---

## 1. Ativos da marca

Ficam em `frontend/public/brand/`, gerados a partir dos arquivos originais (que não foram alterados):

| Arquivo | Origem | Uso |
|---|---|---|
| `maximus-logo-on-dark.png` | `1.png` | **Versão principal** — assinatura completa para fundos escuros (todo o sistema) |
| `maximus-logo-on-light.png` | `2.png` | Versão preta — apenas fundos claros, documentos e exportações |
| `maximus-symbol.png` | recorte do símbolo em `1.png` | Barra lateral recolhida e espaços curtos |
| `maximus-ray-filled.png` | `raio completo.png` | Elemento decorativo preenchido (login, destaques) |
| `maximus-ray-outline.png` | `raio vazado.png` | Marca d'água e detalhes de fundo |
| `favicon.png` | símbolo | Ícone da aba |

Processamento aplicado: **apenas remoção das margens transparentes** e redimensionamento proporcional
(logos com 1400 px de largura, raios com 900 px, símbolo com 512 px). Nada foi cortado, distorcido,
redesenhado ou recolorido. O script usado está descrito no fim deste documento.

**Regras invioláveis**

- a palavra “Máximus” nunca é recriada com fonte comum — sempre a imagem oficial;
- as cores da logo não são alteradas, nem aplicados filtros sobre ela;
- o raio é decoração: não substitui a logo nem ícones funcionais (editar, excluir, calendário…);
- o raio não é rotacionado aleatoriamente nem deformado — só escala proporcional;
- capturas de redes sociais nunca entram na interface (serviram apenas de referência visual);
- a proporção é sagrada: `.brand-logo` traz `align-self: flex-start` porque contêineres flex em
  coluna esticam imagens de largura automática — foi o que deformou a logo do login antes da correção.
  No login ela é dimensionada pela **largura** (`clamp(210px, 20vw, 280px)`, altura automática).

---

## 2. Cores

### Marca

| Token | Valor | Uso |
|---|---|---|
| `--brand-purple` | `#A803D2` | Início do gradiente, luz roxa |
| `--brand-violet` | `#8500C8` | Variação profunda |
| `--brand-magenta` | `#D31397` | Meio do gradiente, foco, ícone ativo |
| `--brand-pink` | `#E71983` | Ícones e detalhes |
| `--brand-pink-on-dark` | `#F0559F` | **Texto e links** sobre superfícies escuras (5,7:1) |
| `--brand-coral` | `#F92657` | Fim do gradiente |
| `--brand-red` | `#FF294F` | Variação luminosa |

| Gradiente | Valor | Uso |
|---|---|---|
| `--brand-gradient` | `linear-gradient(135deg, #A803D2 0%, #D31397 52%, #F92657 100%)` | Assinatura: linhas, barras, números em destaque |
| `--brand-gradient-button` | `linear-gradient(135deg, #9D03C6, #C8118F 52%, #D91E52)` | Botões preenchidos — mesma família, um pouco mais profunda, para o texto branco ficar em AA (o coral puro fica em 3,9:1) |
| `--brand-gradient-line` | versão horizontal | Linhas de 2–3 px |
| `--brand-gradient-soft` | versão translúcida | Fundos de chip selecionado e avisos da marca |

### Estruturais

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#08070B` | Fundo geral |
| `--background-2` | `#0E0C12` | Barra lateral, topo, cabeçalhos de tabela e rodapés |
| `--surface` | `#151219` | Cartões e painéis |
| `--surface-elevated` | `#1C1721` | Campos, cartões internos |
| `--surface-interactive` | `#241C2A` | Hover e estado ativo |
| `--border` | `#33283A` | Contorno discreto |
| `--border-strong` | `#453551` | Contorno de destaque |
| `--text-primary` | `#F8F5F9` | Texto principal (17,2:1) |
| `--text-secondary` | `#B7ADB9` | Texto de apoio (8,6:1) |
| `--text-disabled` | `#8B8090` | Dicas e carimbos de data (4,9:1) |

### Semânticas — não usam o gradiente

| Estado | Token | Cor |
|---|---|---|
| Concluído | `--success` | verde `#34D399` |
| Atenção | `--warning` | âmbar `#FBBF24` |
| Erro / exclusão | `--danger` / `--danger-strong` | vermelho `#F2545B` / `#DC2F37` |
| Informação | `--info` | azul `#60A5FA` |
| Ação principal | `--brand-gradient-button` | roxo → magenta → coral |

Como o coral da marca está perto do vermelho, **todo botão destrutivo é vermelho sólido, com ícone de
lixeira, texto explícito e confirmação antes de executar**.

### Cores dos clientes

A cor da Máximus identifica o produto; a cor de cada cliente identifica a captação — uma nunca
substitui a outra. `lib/colors.js` deriva as variações a partir do valor salvo no banco:

| Variável | Como é calculada | Onde aparece |
|---|---|---|
| `--client-color` | cor do banco, clareada só se necessário para atingir 3:1 no tema escuro (`vividTone`) | contorno, barra lateral do cartão, ponto na tabela |
| `--client-raw` | valor exato salvo | referência |
| `--client-soft` | 12% de opacidade | fundo do cartão |
| `--client-softer` | 6% | fundos amplos |
| `--client-border` | 55% | contorno de 1,5 px |
| `--client-text` | clareada até 4,5:1 (`textTone`) | horário e nome em destaque |

O seletor de cores (`ColorPicker`) oferece uma paleta pensada para o fundo escuro, mas aceita
qualquer cor pelo seletor livre — cores escuras continuam legíveis por causa do ajuste acima.

---

## 3. Tipografia

| Token | Fonte | Uso |
|---|---|---|
| `--font-display` | **Barlow Condensed** 500/600/700/800 | Títulos, números, métricas, dias da semana, “VÍDEO 01”, rótulos curtos |
| `--font-ui` | **Montserrat** 400/500/600/700 | Botões, formulários, horários, nomes, roteiros, tabelas, mensagens |

Carregadas com **Fontsource** (`@fontsource/...`), hospedadas junto do build — sem requisição externa
e sem troca visível de fonte no carregamento.

Escala: `--text-xs 0.72rem` · `--text-sm 0.8` · `--text-base 0.875` · `--text-md 0.95` · `--text-lg 1.1`
· `--display-sm 1.35` · `--display-md 1.75` · `--display-lg 2.3` · `--display-xl 3`.

Caixa alta só em títulos curtos, rótulos e etiquetas. **Roteiros, observações e textos longos usam
Montserrat em caixa normal.**

---

## 4. Formas, sombras e movimento

| Elemento | Raio |
|---|---|
| Cartões principais, tabelas, cabeçalhos | `--radius-lg` 16px |
| Cartões internos, métricas, cartões de captação | `--radius-md` 12px |
| Campos, botões, chips | `--radius-sm` 10px |
| Etiquetas e botões de ícone | `--radius-xs` 6px |
| Modais | `--radius-xl` 20px |
| Aros de avatar e pílulas | `--radius-pill` |

Sombras: `--shadow-sm`, `--shadow`, `--shadow-lg` (escuras, para separar superfícies).
Brilho colorido só em: botão principal (`--glow-brand`), hover do botão principal
(`--glow-brand-strong`) e foco de teclado (`--glow-focus`).

Movimento: `--transition-fast 150ms`, `--transition 190ms`, `--transition-slow 220ms`.
Hover desloca no máximo 1px. Não há animação infinita nem brilho pulsando.
`prefers-reduced-motion` desliga transições e animações.

---

## 5. Componentes

### Marca — `components/brand/index.jsx`

| Componente | Props | Observações |
|---|---|---|
| `BrandLogo` | `variant` (`dark`\|`light`), `size` (`sm`\|`md`\|`lg`\|`xl`) | `alt="Máximus Produtora"` por padrão |
| `BrandSymbol` | `size` | Decorativo por padrão (`aria-hidden`) |
| `BrandRay` | `variant` (`filled`\|`outline`), `className`, `style` | Elemento gráfico visível |
| `BrandWatermark` | `variant`, `intensity` (`subtle` 3,5% · padrão 6% · `visible` 10%) | Sempre no fundo, `position: absolute` |
| `BrandGlow` | `color`, `size`, `top/left/right/bottom`, `opacity` | Luz difusa via gradiente radial |
| `BrandBackground` | `variant` (`header`\|`login`\|`empty`), `watermark`, `vignette` | Conjunto pronto de luzes |

### Interface — `components/ui/index.jsx`

`Field`, `Loading`, `EmptyState`, `ProgressBar`, `PageHeader`, `SectionHeader`, `MetricCard`,
`ClientAvatar`, `MemberAvatar` (com `ring` opcional em gradiente), `ColorPicker`, `ImageField`.
Modais em `components/ui/Modal.jsx` e `ConfirmDialog.jsx`.

### Classes utilitárias principais

`.btn` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` / `.btn-icon` / `.btn-sm` / `.btn-lg`,
`.input` / `.select` / `.textarea` / `.checkbox` / `.field`, `.card` / `.card-pad`,
`.badge` (+ `-success`, `-warning`, `-danger`, `-info`, `-brand`), `.alert` (+ variações),
`.progress`, `.avatar` (+ `-sm`, `-lg`, `-round`, `.avatar-ring`), `.eyebrow`, `.gradient-text`.

---

## 6. Onde a identidade aparece (e onde não aparece)

| Aparece | Como |
|---|---|
| Login | Logo grande, luzes roxa/magenta/coral, raio preenchido, vinheta, título condensado |
| Barra lateral | Logo no topo, item ativo com linha em gradiente e ícone magenta, bloco institucional com raio vazado |
| Topo | Linha fina em gradiente, título da página em condensada |
| Cabeçalho de página (`PageHeader`) | Luz difusa no topo + linha em gradiente |
| Métricas | Número em condensada, barra lateral em gradiente, percentual da semana com texto em gradiente |
| Agenda | Dia atual com linha em gradiente; estados vazios com raio vazado |
| Vídeos | Linha superior em gradiente e “VÍDEO 01” em condensada |
| Sugestão de rota | Fundo com luz suave e raio vazado |
| Avatares de quem grava | Aro fino em gradiente |
| Excluir na lousa | Ícone de lixeira no rodapé do cartão, em vermelho semântico apenas no hover, com confirmação |

| Não aparece | Motivo |
|---|---|
| Atrás de roteiros, campos, listas, tabelas e horários | Leitura em primeiro lugar |
| Como fundo de todas as colunas ou cartões | Evita poluição visual |
| Como cor de estado (concluído/erro/aviso) | Estados usam cores semânticas reconhecíveis |
| Substituindo a cor do cliente | A cor do cliente é a identificação da captação |
| Em contorno neon grosso | A assinatura é uma linha de 2–3 px |

---

## 7. Acessibilidade

- Contraste verificado (WCAG AA): texto principal 17,2:1 · secundário 8,6:1 · desativado 4,9:1 ·
  branco sobre o gradiente dos botões 4,9–6,4:1 · verde 9,7:1 · âmbar 11,1:1 · vermelho 5,5:1 · azul 7,3:1.
- Cor do cliente ajustada automaticamente para 3:1 (contornos) e 4,5:1 (texto).
- Foco visível em todos os controles (`outline` magenta de 2px + `--glow-focus` nos campos).
- Estados nunca dependem só de cor: “Concluída” tem ícone e texto; conflitos têm alerta escrito.
- Rótulos sempre visíveis nos formulários (placeholder é complemento, não substituto).
- Alvos de toque com no mínimo 44–48px de altura na navegação móvel.
- Imagens da marca têm `alt` descritivo (logo) ou `aria-hidden` (decorativas).
- `prefers-reduced-motion` respeitado.

---

## 8. Responsividade

| Largura | Comportamento |
|---|---|
| ≥ 1320px | Agenda em 5 colunas, métricas em 6, barra lateral fixa |
| 1180–1320px | Métricas em 3 colunas |
| 900–1180px | Agenda em 3 colunas |
| 768–900px | Agenda em 2 colunas, barra lateral vira navegação inferior, topo mostra a logo |
| ≤ 640px | Agenda em lista vertical por dia, métricas 2 a 2, modais colados na base da tela |

Testado em 1440×900, 1024×768, 768×1024 e 390×844 — sem rolagem horizontal em nenhuma página.

---

## 9. Como os ativos foram preparados

```js
// sharp: recorte das margens transparentes + redimensionamento proporcional
const info = await analyze(file);              // varre o alpha e acha o bounding box
await sharp(src)
  .extract({ left, top, width, height })       // remove só o transparente
  .resize({ width: alvo, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(destino);
```

O símbolo isolado foi obtido detectando o vão natural entre o símbolo e o lettering (perfil de alpha
por coluna), sem cortar nenhuma parte visível. Os arquivos originais permanecem intactos na pasta
`ELEMENTOS MAXIMUS PRODUTORA.pdf/` de origem.

---

## 10. Capturas de referência

Geradas com o navegador em modo headless depois da personalização (`docs/screenshots/`):

| Tela | Computador | Celular |
|---|---|---|
| Login | `01-login-desktop.png` | `09-login-mobile.png` |
| Agenda semanal | `02-agenda-desktop.png` (1440) · `07-agenda-laptop.png` (1024) · `08-agenda-tablet.png` (768) | `10-agenda-mobile.png` |
| Dia da agenda | `03-dia-desktop.png` | `12-dia-mobile.png` |
| Roteiros da captação | `04-roteiros-desktop.png` | `11-roteiros-mobile.png` |
| Clientes | `05-clientes-desktop.png` | — |
| Configurações | `06-configuracoes-desktop.png` | — |
| Modal de captação | `13-modal-captacao.png` | — |
| Barra lateral recolhida | `14-sidebar-recolhida.png` | — |
| Foco por teclado | `15-foco-teclado.png` | — |
| **Tema claro** | `16-agenda-claro.png` · `17-configuracoes-claro.png` · `18-login-claro.png` · `20-dia-claro.png` | — |

---

## 11. Temas: escuro e claro

O **escuro é o padrão** da Máximus. O **claro** é uma opção de cada pessoa, em
*Configurações → Aparência*, útil em ambientes muito iluminados e em apresentações.
A escolha fica salva no navegador (`localStorage: maximus_theme`) e é aplicada antes da primeira
pintura da tela por um script no `index.html` — não há piscada branca ao carregar.

Como funciona:

| Peça | Onde |
|---|---|
| Estado do tema | `context/ThemeContext.jsx` — `useTheme()` e `useClientStyle()` |
| Tokens do tema claro | `styles/tokens.css` → bloco `:root[data-theme='light']` |
| Logo | `BrandLogo` usa `variant="auto"`: versão clara no escuro, versão preta no claro |
| Cores dos clientes | `useClientStyle()` recalcula os tons contra a superfície do tema (clareia no escuro, escurece no claro) |

Tokens redefinidos no tema claro:

| Token | Escuro | Claro |
|---|---|---|
| `--background` | `#08070B` | `#F2F0F6` |
| `--background-2` | `#0E0C12` | `#F8F6FB` |
| `--surface` | `#151219` | `#FFFFFF` |
| `--surface-elevated` | `#1C1721` | `#FAF8FD` |
| `--surface-interactive` | `#241C2A` | `#F0EBF7` |
| `--border` / `--border-strong` | `#33283A` / `#453551` | `#E0D9EA` / `#C6BAD4` |
| `--text-primary` | `#F8F5F9` | `#17131D` |
| `--text-secondary` | `#B7ADB9` | `#564D61` |
| `--text-disabled` | `#8B8090` | `#7B7185` |
| `--brand-pink-on-dark` | `#F0559F` | `#C2107A` |
| `--success` / `--warning` / `--danger` / `--info` | `#34D399` / `#FBBF24` / `#F2545B` / `#60A5FA` | `#0F7A4F` / `#96590A` / `#C02730` / `#1F66D0` |

As cores da marca e o gradiente **não mudam** entre os temas; só as superfícies, o texto, as
sombras e a intensidade das luzes (`--glow-*`, bem mais discretas no claro).

Contraste verificado no tema claro: texto principal 18,3:1 · secundário 8,0:1 · desativado 4,6:1 ·
verde 5,4:1 · âmbar 5,6:1 · vermelho 5,9:1 · azul 5,4:1 · rosa 5,8:1 · branco sobre o gradiente
dos botões 4,9–6,4:1 — todos em AA ou acima.

Para acrescentar um terceiro tema, basta um novo bloco `:root[data-theme='...']` com os mesmos
tokens; nenhum componente precisa mudar.
