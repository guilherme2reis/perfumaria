const VERSAO = '1.3.0';
const STORAGE_KEY = 'perfumaria.lancamentos';
const STORAGE_EXPORTACAO = 'perfumaria.ultimaExportacao';
const STORAGE_CONFIG = 'perfumaria.config';

/** @typedef {{id:string, tipo:'entrada'|'saida', categoria:string, descricao:string, valor:number, data:string, criadoEm:number}} Lancamento */

/**
 * Opções de cada tipo de anotação, na ordem em que aparecem na tela.
 * Para incluir uma forma de pagamento ou um fornecedor, basta acrescentar aqui.
 */
const OPCOES = {
  entrada: [
    { nome: 'Dinheiro', icone: '💵' },
    { nome: 'PIX', icone: '📲' },
    { nome: 'Crédito', icone: '💳' },
    { nome: 'Débito', icone: '💳' },
  ],
  saida: [
    { nome: 'Natura', icone: '' },
    { nome: 'Boticário', icone: '' },
    { nome: 'Avon', icone: '' },
    { nome: 'Mary Kay', icone: '' },
    { nome: 'Mahogani', icone: '' },
    { nome: 'Outros', icone: '' },
  ],
};

const TEXTOS = {
  entrada: {
    novo: 'Nova venda',
    edicao: 'Corrigir venda',
    pergunta: 'Como recebeu?',
    faltaOpcao: 'Escolha como recebeu.',
    salvo: 'Venda salva!',
    nomeCsv: 'Entrada',
  },
  saida: {
    novo: 'Novo pagamento',
    edicao: 'Corrigir pagamento',
    pergunta: 'Para quem pagou?',
    faltaOpcao: 'Escolha para quem pagou.',
    salvo: 'Pagamento salvo!',
    nomeCsv: 'Saída',
  },
};

const TITULOS = {
  inicio: '🌸 PERFUMARIA',
  relatorios: 'Relatórios',
  compras: 'Compras por empresa',
  dados: 'Planilha',
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

/** Estado do formulário: o que está sendo anotado e para onde voltar ao terminar. */
const form = { tipo: 'entrada', categoria: null, id: null, voltarPara: 'inicio' };

/** Relatório aberto: 'dia' | 'mes' | 'ano' e uma data dentro do período mostrado. */
const relatorio = { tipo: 'dia', ref: hojeISO() };

/** Cópia em memória usada só quando o navegador não deixa gravar (aba privada, cota cheia). */
let memoria = null;

/* ==================== armazenamento ==================== */

/** @returns {Lancamento[]} */
function carregar() {
  try {
    const raw = memoria !== null ? memoria : localStorage.getItem(STORAGE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item, i) => ({
        id: String(item.id || gerarId()),
        tipo: item.tipo === 'saida' ? 'saida' : 'entrada',
        categoria: String(item.categoria || 'Outros'),
        descricao: String(item.descricao || ''),
        valor: Number(item.valor) || 0,
        data: String(item.data || ''),
        criadoEm: Number(item.criadoEm) || i,
      }))
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.data));
  } catch {
    return [];
  }
}

/** @param {Lancamento[]} lista */
function salvar(lista) {
  const json = JSON.stringify(lista);
  try {
    localStorage.setItem(STORAGE_KEY, json);
    memoria = null;
  } catch {
    // sem armazenamento os dados valem só até fechar o app, então avisa
    memoria = json;
    mostrarToast('O celular não deixou salvar. Envie a planilha!');
  }
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ultimaExportacao() {
  try {
    return Number(localStorage.getItem(STORAGE_EXPORTACAO)) || 0;
  } catch {
    return 0;
  }
}

function registrarExportacao() {
  try {
    localStorage.setItem(STORAGE_EXPORTACAO, String(Date.now()));
  } catch { /* só perde o lembrete */ }
  render();
}

/* ==================== datas e formatação ==================== */

function formatoMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Saldo com o sinal separado e bem visível: "− R$ 144,50". */
function formatoSaldo(valor) {
  return valor < 0 ? `− ${formatoMoeda(-valor)}` : formatoMoeda(valor);
}

/** Arredonda para centavos;o "+ 0" evita o "-R$ 0,00" que o zero negativo produz. */
function arredondar(valor) {
  return Math.round(valor * 100) / 100 + 0;
}

function isoDe(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Data de hoje em ISO usando o fuso do aparelho (toISOString usaria UTC). */
function hojeISO() {
  return isoDe(new Date());
}

function dataDe(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** "2026-10-01" -> "01/10/2026" */
function formatoData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Trecho da data que identifica o período: dia, mês ou ano. */
function chavePeriodo(iso, tipo) {
  return iso.slice(0, { dia: 10, mes: 7, ano: 4 }[tipo]);
}

function nomePeriodo(iso, tipo) {
  const d = dataDe(iso);
  if (tipo === 'ano') return String(d.getFullYear());
  if (tipo === 'mes') return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return `${DIAS_SEMANA[d.getDay()]}, ${formatoData(iso)}`;
}

/** Anda um período para frente ou para trás. */
function deslocarPeriodo(iso, tipo, passo) {
  const d = dataDe(iso);
  if (tipo === 'ano') return isoDe(new Date(d.getFullYear() + passo, 0, 1));
  if (tipo === 'mes') return isoDe(new Date(d.getFullYear(), d.getMonth() + passo, 1));
  return isoDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + passo));
}

// U+0300..U+036F = marcas de acento que a normalização NFD separa das letras
const REGEX_ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizarTexto(texto) {
  return String(texto == null ? '' : texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(REGEX_ACENTOS, '');
}

/** Só letras e números, para comparar cabeçalhos: "Valor (R$)" -> "valorr". */
function chaveSimples(texto) {
  return normalizarTexto(texto).replace(/[^a-z0-9]/g, '');
}

/* ==================== cálculos ==================== */

function resumir(lista) {
  const r = { entradas: 0, saidas: 0, saldo: 0, entrada: new Map(), saida: new Map() };

  for (const item of lista) {
    if (item.tipo === 'entrada') r.entradas += item.valor;
    else r.saidas += item.valor;
    r[item.tipo].set(item.categoria, (r[item.tipo].get(item.categoria) || 0) + item.valor);
  }

  r.entradas = arredondar(r.entradas);
  r.saidas = arredondar(r.saidas);
  r.saldo = arredondar(r.entradas - r.saidas);
  return r;
}

/**
 * Total de cada opção, sempre na ordem da tela e mostrando também as zeradas.
 * Categorias que só existem nos dados (vindas de uma planilha) entram no fim.
 */
function totaisPorOpcao(tipo, mapa) {
  const nomes = OPCOES[tipo].map((op) => op.nome);
  const extras = [...mapa.keys()].filter((nome) => !nomes.includes(nome)).sort();
  return [...nomes, ...extras].map((nome) => ({ nome, total: arredondar(mapa.get(nome) || 0) }));
}

/** Do mais recente para o mais antigo. */
function ordenarRecentes(lista) {
  return [...lista].sort((a, b) => (
    a.data === b.data ? b.criadoEm - a.criadoEm : b.data.localeCompare(a.data)
  ));
}

/** Agrupa pelo começo da data (10 letras = dia, 7 = mês), do mais recente para o mais antigo. */
function agruparPorData(lista, tamanho) {
  const grupos = new Map();
  for (const item of lista) {
    const chave = item.data.slice(0, tamanho);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  }
  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

/* ==================== navegação ==================== */

function viewAtual() {
  return document.body.dataset.view;
}

function mostrarView(view) {
  document.body.dataset.view = view;

  document.querySelectorAll('.view').forEach((secao) => {
    secao.classList.toggle('ativa', secao.id === `view-${view}`);
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('ativa', tab.dataset.ir === view);
  });

  if (TITULOS[view]) document.getElementById('titulo-view').textContent = TITULOS[view];
  window.scrollTo(0, 0);
}

/**
 * O histórico do navegador fica sempre [início] ou [início, outra tela]: assim o botão
 * "voltar" do celular leva ao início em vez de fechar o app no meio de uma anotação.
 */
function irPara(view) {
  const atual = viewAtual();
  if (view === atual) return;

  mostrarView(view);

  if (view === 'inicio') history.back();
  else if (atual === 'inicio') history.pushState({ view }, '');
  else history.replaceState({ view }, '');
}

/* ==================== peças de tela ==================== */

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

/** Bloco "Entrou / Saiu / Saldo". */
function renderTotais(container, resumo) {
  container.innerHTML = '';

  const entrou = el('div', 'total-linha');
  entrou.append(el('span', null, 'Entrou'), el('span', 'valor cor-entrada', `+ ${formatoMoeda(resumo.entradas)}`));

  const saiu = el('div', 'total-linha');
  saiu.append(el('span', null, 'Saiu'), el('span', 'valor cor-saida', `− ${formatoMoeda(resumo.saidas)}`));

  const saldo = el('div', `total-linha saldo${resumo.saldo < 0 ? ' negativo' : ''}`);
  saldo.append(el('span', null, 'Saldo'), el('span', 'valor', formatoSaldo(resumo.saldo)));

  container.append(entrou, saiu, saldo);
}

function renderCategorias(container, tipo, mapa) {
  container.innerHTML = '';
  for (const { nome, total } of totaisPorOpcao(tipo, mapa)) {
    const linha = el('div', `linha-categoria${total === 0 ? ' zerada' : ''}`);
    linha.append(el('span', null, nome), el('span', 'valor', formatoMoeda(total)));
    container.appendChild(linha);
  }
}

/** Linha tocável de uma lista. */
function criarItem({ nome, sub, valor, classeValor, valorSub, aoTocar }) {
  const li = document.createElement('li');
  const botao = el('button', 'item');
  botao.type = 'button';

  const textos = el('span', 'item-textos');
  textos.appendChild(el('span', 'item-nome', nome));
  if (sub) textos.appendChild(el('span', 'item-sub', sub));

  const valores = el('span', 'item-valores');
  valores.appendChild(el('span', `item-valor ${classeValor || ''}`, valor));
  if (valorSub) valores.appendChild(el('span', 'item-saldo', valorSub));

  botao.append(textos, valores);
  botao.addEventListener('click', aoTocar);
  li.appendChild(botao);
  return li;
}

function criarItemLancamento(item) {
  const entrada = item.tipo === 'entrada';
  return criarItem({
    nome: item.categoria,
    sub: [entrada ? 'Venda' : 'Pagamento', item.descricao].filter(Boolean).join(' · '),
    valor: `${entrada ? '+' : '−'} ${formatoMoeda(item.valor)}`,
    classeValor: entrada ? 'cor-entrada' : 'cor-saida',
    aoTocar: () => abrirFormulario(item.tipo, item),
  });
}

/* ==================== tela inicial ==================== */

function renderInicio(lista) {
  const hoje = hojeISO();
  const d = dataDe(hoje);
  document.getElementById('hoje-texto').textContent =
    `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;

  const doDia = ordenarRecentes(lista.filter((item) => item.data === hoje));
  renderTotais(document.getElementById('totais-hoje'), resumir(doDia));

  const ul = document.getElementById('lista-hoje');
  ul.innerHTML = '';
  for (const item of doDia) ul.appendChild(criarItemLancamento(item));

  document.getElementById('hoje-vazio').hidden = doDia.length > 0;
  document.getElementById('hoje-dica').hidden = doDia.length === 0;

  // lembra de enviar a planilha quando há anotações paradas há mais de um mês
  const base = ultimaExportacao() || Math.min(...lista.map((item) => item.criadoEm));
  document.getElementById('card-lembrete').hidden =
    lista.length === 0 || Date.now() - base < TRINTA_DIAS;
}

/* ==================== relatórios ==================== */

function itensDoRelatorio(lista) {
  const chave = chavePeriodo(relatorio.ref, relatorio.tipo);
  return lista.filter((item) => item.data.startsWith(chave));
}

function abrirRelatorio(tipo, ref) {
  relatorio.tipo = tipo;
  relatorio.ref = ref;
  renderRelatorio(carregar());
  window.scrollTo(0, 0);
}

function renderRelatorio(lista) {
  const { tipo, ref } = relatorio;
  const itens = itensDoRelatorio(lista);
  const resumo = resumir(itens);

  document.querySelectorAll('[data-relatorio]').forEach((aba) => {
    aba.classList.toggle('ativa', aba.dataset.relatorio === tipo);
  });

  document.getElementById('periodo-nome').textContent = nomePeriodo(ref, tipo);
  document.getElementById('periodo-proximo').disabled =
    chavePeriodo(ref, tipo) >= chavePeriodo(hojeISO(), tipo);

  renderTotais(document.getElementById('totais-relatorio'), resumo);
  renderCategorias(document.getElementById('relatorio-entradas'), 'entrada', resumo.entrada);
  renderCategorias(document.getElementById('relatorio-saidas'), 'saida', resumo.saida);

  const ul = document.getElementById('detalhe-lista');
  ul.innerHTML = '';
  document.getElementById('detalhe-vazio').hidden = itens.length > 0;
  document.getElementById('detalhe-titulo').textContent =
    { dia: 'Anotações do dia', mes: 'Dia a dia', ano: 'Mês a mês' }[tipo];

  if (tipo === 'dia') {
    for (const item of ordenarRecentes(itens)) ul.appendChild(criarItemLancamento(item));
    return;
  }

  // no mês cada linha é um dia; no ano, um mês. Tocar na linha abre aquele período.
  const tamanho = tipo === 'mes' ? 10 : 7;
  for (const [chave, grupo] of agruparPorData(itens, tamanho)) {
    const r = resumir(grupo);
    const refGrupo = tipo === 'mes' ? chave : `${chave}-01`;
    const d = dataDe(refGrupo);

    ul.appendChild(criarItem({
      nome: tipo === 'mes'
        ? `${chave.slice(8, 10)}/${chave.slice(5, 7)} · ${DIAS_SEMANA[d.getDay()].replace('-feira', '')}`
        : MESES[d.getMonth()],
      sub: `+ ${formatoMoeda(r.entradas)}   − ${formatoMoeda(r.saidas)}`,
      valor: formatoSaldo(r.saldo),
      classeValor: r.saldo < 0 ? 'cor-saida' : 'cor-entrada',
      valorSub: 'saldo',
      aoTocar: () => abrirRelatorio(tipo === 'mes' ? 'dia' : 'mes', refGrupo),
    }));
  }
}

/* ==================== envio pelo WhatsApp ==================== */

// acima disso a mensagem fica comprida demais para o WhatsApp; o resto vai na planilha
const MAX_LANCAMENTOS_TEXTO = 60;

function lerConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_CONFIG)) || {};
  } catch {
    return {};
  }
}

function gravarConfig(config) {
  try {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

/** Número cadastrado só com dígitos e com o 55 do Brasil: "(28) 99999-9999" -> "5528999999999". */
function foneWhatsApp() {
  const digitos = String(lerConfig().fone || '').replace(/\D/g, '');
  // 10 ou 11 dígitos = DDD + número, sem o código do país
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

/** "5528999999999" -> "(28) 99999-9999", para mostrar na tela para quem vai o relatório. */
function foneFormatado(fone) {
  const n = fone.startsWith('55') ? fone.slice(2) : fone;
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : fone;
}

/**
 * Abre a conversa direto no WhatsApp com a mensagem pronta, só falta tocar em enviar.
 * Sem número cadastrado, o WhatsApp pede para escolher a conversa.
 */
function enviarNoWhatsApp(texto) {
  window.location.href = `https://wa.me/${foneWhatsApp()}?text=${encodeURIComponent(texto)}`;
}

function renderDicasWhatsApp() {
  const fone = foneWhatsApp();
  const texto = fone
    ? `O botão verde abre a conversa com ${foneFormatado(fone)} no WhatsApp.`
    : '⚠️ Nenhum número cadastrado: o WhatsApp vai pedir para escolher a conversa. '
      + 'O número pode ser cadastrado na aba Planilha.';
  document.querySelectorAll('.dica-whats').forEach((dica) => { dica.textContent = texto; });
  document.getElementById('cfg-fone').value = lerConfig().fone || '';
}

function linhaLancamento(item) {
  const sinal = item.tipo === 'entrada' ? '➕' : '➖';
  const anotacao = item.descricao ? ` (${item.descricao})` : '';
  return `${sinal} ${formatoMoeda(item.valor)} ${item.categoria}${anotacao}`;
}

/** Lista as anotações em ordem, com o dia em cima de cada grupo quando o período tem vários dias. */
function linhasDeLancamentos(linhas, itens, separarPorDia) {
  const ordenados = [...itens].sort((a, b) => (
    a.data === b.data ? a.criadoEm - b.criadoEm : a.data.localeCompare(b.data)
  ));

  let diaAtual = '';
  for (const item of ordenados.slice(0, MAX_LANCAMENTOS_TEXTO)) {
    if (separarPorDia && item.data !== diaAtual) {
      diaAtual = item.data;
      linhas.push('', `📅 ${formatoData(item.data)}`);
    }
    linhas.push(linhaLancamento(item));
  }

  if (ordenados.length > MAX_LANCAMENTOS_TEXTO) {
    linhas.push('', `… e mais ${ordenados.length - MAX_LANCAMENTOS_TEXTO}. Veja a planilha completa.`);
  }
}

function linhasPorOpcao(linhas, titulo, tipo, mapa) {
  const comValor = totaisPorOpcao(tipo, mapa).filter(({ total }) => total > 0);
  if (comValor.length === 0) return;
  linhas.push('', titulo);
  for (const { nome, total } of comValor) linhas.push(`• ${nome}: ${formatoMoeda(total)}`);
}

/** Relatório em texto, com a formatação do WhatsApp (*negrito*, _itálico_). */
function textoDoRelatorio(lista) {
  const { tipo, ref } = relatorio;
  const itens = itensDoRelatorio(lista);
  const r = resumir(itens);
  const titulo = { dia: 'Relatório do dia', mes: 'Relatório do mês', ano: 'Relatório do ano' }[tipo];

  const linhas = [
    '*🌸 PERFUMARIA*',
    `${titulo} — ${nomePeriodo(ref, tipo)}`,
    '',
    `➕ Entrou: *${formatoMoeda(r.entradas)}*`,
    `➖ Saiu: *${formatoMoeda(r.saidas)}*`,
    `💰 Saldo: *${formatoSaldo(r.saldo)}*`,
  ];

  linhasPorOpcao(linhas, '_Entradas por pagamento:_', 'entrada', r.entrada);
  linhasPorOpcao(linhas, '_Saídas por empresa:_', 'saida', r.saida);

  if (tipo === 'ano' && itens.length > 0) {
    // no ano, um resumo por mês em vez de cada anotação
    linhas.push('', '_Mês a mês:_');
    for (const [mes, grupo] of agruparPorData(itens, 7).reverse()) {
      const rm = resumir(grupo);
      linhas.push(`• ${MESES[Number(mes.slice(5, 7)) - 1]}: ➕ ${formatoMoeda(rm.entradas)} ➖ ${formatoMoeda(rm.saidas)} = *${formatoSaldo(rm.saldo)}*`);
    }
  } else if (itens.length > 0) {
    linhas.push('', '_Lançamentos:_');
    linhasDeLancamentos(linhas, itens, tipo !== 'dia');
  }

  return linhas.join('\n');
}

/** Planilha só das anotações de um período: abre a lista de compartilhar ou salva no aparelho. */
async function enviarArquivo(itens, nomeArquivo) {
  if (itens.length === 0) {
    mostrarToast('Nada anotado neste período.');
    return;
  }

  const arquivo = new File([BOM + gerarCSV(itens)], nomeArquivo, { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Planilha da Perfumaria' });
    } catch { /* cancelou */ }
    return;
  }

  baixarArquivo(arquivo, nomeArquivo);
  mostrarToast('Planilha salva na pasta de downloads.');
}

function nomeArquivoRelatorio() {
  return `perfumaria-${chavePeriodo(relatorio.ref, relatorio.tipo)}.csv`;
}

/* ==================== compras por empresa ==================== */

/** Aba Compras: período 'mes' | 'ano' | 'tudo' e a empresa aberta (null = todas). */
const compras = { tipo: 'mes', ref: hojeISO(), empresa: null };

function textoQuantidade(n) {
  return n === 1 ? '1 pagamento' : `${n} pagamentos`;
}

/** "2026-09" -> "Setembro de 2026" */
function nomeMesAno(ym) {
  return `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
}

function nomePeriodoCompras() {
  return compras.tipo === 'tudo' ? 'Todo o período' : nomePeriodo(compras.ref, compras.tipo);
}

/** Pagamentos do período escolhido, só da empresa aberta quando há uma. */
function pagamentosDeCompras(lista) {
  const chave = compras.tipo === 'tudo' ? '' : chavePeriodo(compras.ref, compras.tipo);
  return lista.filter((item) => (
    item.tipo === 'saida'
    && item.data.startsWith(chave)
    && (!compras.empresa || item.categoria === compras.empresa)
  ));
}

function abrirCompras(tipo, ref, empresa) {
  compras.tipo = tipo;
  compras.ref = ref;
  compras.empresa = empresa;
  renderCompras(carregar());
  window.scrollTo(0, 0);
}

function criarBarra(fracao) {
  const barra = el('span', 'barra');
  const cheia = el('span', 'barra-cheia');
  cheia.style.width = `${Math.round(fracao * 100)}%`;
  barra.appendChild(cheia);
  return barra;
}

function renderCompras(lista) {
  const { tipo, ref, empresa } = compras;
  const pagamentos = pagamentosDeCompras(lista);
  const total = resumir(pagamentos).saidas;

  document.querySelectorAll('[data-compras]').forEach((aba) => {
    aba.classList.toggle('ativa', aba.dataset.compras === tipo);
  });

  document.getElementById('compras-periodo').hidden = tipo === 'tudo';
  if (tipo !== 'tudo') {
    document.getElementById('compras-periodo-nome').textContent = nomePeriodo(ref, tipo);
    document.getElementById('compras-proximo').disabled =
      chavePeriodo(ref, tipo) >= chavePeriodo(hojeISO(), tipo);
  }

  document.getElementById('compras-rotulo').textContent = empresa || 'Total pago às empresas';
  document.getElementById('compras-total').textContent = formatoMoeda(total);
  document.getElementById('compras-quantidade').textContent = textoQuantidade(pagamentos.length);

  document.getElementById('compras-lista-card').hidden = Boolean(empresa);
  document.getElementById('compras-empresa').hidden = !empresa;

  if (!empresa) {
    // todas as empresas, sempre na mesma ordem da tela de anotar, com a parte de cada uma
    const ul = document.getElementById('compras-lista');
    ul.innerHTML = '';

    for (const op of totaisPorOpcao('saida', resumir(pagamentos).saida)) {
      const quantidade = pagamentos.filter((item) => item.categoria === op.nome).length;
      const li = criarItem({
        nome: op.nome,
        sub: quantidade > 0
          ? `${textoQuantidade(quantidade)} · ${Math.round((op.total / total) * 100)}% do total`
          : 'Nenhum pagamento',
        valor: formatoMoeda(op.total),
        aoTocar: () => abrirCompras(tipo, ref, op.nome),
      });
      li.querySelector('.item-textos').appendChild(criarBarra(total > 0 ? op.total / total : 0));
      if (quantidade === 0) li.querySelector('.item').classList.add('zerada');
      ul.appendChild(li);
    }
    return;
  }

  // mês a mês só quando o período tem mais de um mês; tocar abre aquele mês
  const ulMeses = document.getElementById('compras-meses');
  ulMeses.innerHTML = '';
  document.getElementById('compras-meses-card').hidden = tipo === 'mes' || pagamentos.length === 0;

  if (tipo !== 'mes') {
    for (const [mes, grupo] of agruparPorData(pagamentos, 7)) {
      ulMeses.appendChild(criarItem({
        nome: tipo === 'ano' ? MESES[Number(mes.slice(5, 7)) - 1] : nomeMesAno(mes),
        sub: textoQuantidade(grupo.length),
        valor: formatoMoeda(resumir(grupo).saidas),
        aoTocar: () => abrirCompras('mes', `${mes}-01`, empresa),
      }));
    }
  }

  const ul = document.getElementById('compras-pagamentos');
  ul.innerHTML = '';
  document.getElementById('compras-pagamentos-vazio').hidden = pagamentos.length > 0;

  for (const item of ordenarRecentes(pagamentos)) {
    ul.appendChild(criarItem({
      nome: tipo === 'mes' ? formatoData(item.data).slice(0, 5) : formatoData(item.data),
      sub: item.descricao,
      valor: formatoMoeda(item.valor),
      aoTocar: () => abrirFormulario('saida', item),
    }));
  }
}

/** Compras em texto, com a formatação do WhatsApp (*negrito*, _itálico_). */
function textoDasCompras(lista) {
  const { tipo, empresa } = compras;
  const pagamentos = pagamentosDeCompras(lista);
  const r = resumir(pagamentos);

  const linhas = [
    '*🌸 PERFUMARIA*',
    `${empresa ? `Compras da ${empresa}` : 'Compras por empresa'} — ${nomePeriodoCompras()}`,
    '',
    `🛍️ Total pago: *${formatoMoeda(r.saidas)}* (${textoQuantidade(pagamentos.length)})`,
  ];

  const daEmpresa = (nome) => pagamentos.filter((item) => item.categoria === nome);
  const nomeDoMes = (mes) => (tipo === 'ano' ? MESES[Number(mes.slice(5, 7)) - 1] : nomeMesAno(mes));

  if (!empresa) {
    const comValor = totaisPorOpcao('saida', r.saida).filter(({ total }) => total > 0);
    if (comValor.length > 0) linhas.push('', '_Por empresa:_');
    for (const { nome, total } of comValor) {
      linhas.push(`• ${nome}: *${formatoMoeda(total)}* (${daEmpresa(nome).length})`);
    }
  }

  if (tipo !== 'mes') {
    // no ano e no "tudo", o mês a mês de cada empresa
    for (const { nome } of totaisPorOpcao('saida', r.saida).filter(({ total }) => total > 0)) {
      linhas.push('', empresa ? '_Mês a mês:_' : `_${nome} mês a mês:_`);
      for (const [mes, grupo] of agruparPorData(daEmpresa(nome), 7).reverse()) {
        linhas.push(`• ${nomeDoMes(mes)}: ${formatoMoeda(resumir(grupo).saidas)} (${grupo.length})`);
      }
    }
  }

  // cada pagamento: no mês, ou quando uma empresa está aberta
  if ((tipo === 'mes' || empresa) && pagamentos.length > 0) {
    linhas.push('', '_Pagamentos:_');
    linhasDeLancamentos(linhas, pagamentos, true);
  }

  return linhas.join('\n');
}

function nomeArquivoCompras() {
  const periodo = compras.tipo === 'tudo' ? 'tudo' : chavePeriodo(compras.ref, compras.tipo);
  const empresa = compras.empresa
    ? `-${normalizarTexto(compras.empresa).replace(/[^a-z0-9]+/g, '-')}`
    : '';
  return `perfumaria-compras${empresa}-${periodo}.csv`;
}

/* ==================== formulário ==================== */

function centavosDoCampo() {
  const digitos = document.getElementById('valor').value.replace(/\D/g, '').slice(0, 9);
  return digitos ? parseInt(digitos, 10) : 0;
}

/** Máscara de maquininha: os números entram pela direita e a vírgula se ajeita sozinha. */
function aplicarMascaraValor() {
  const centavos = centavosDoCampo();
  document.getElementById('valor').value = centavos > 0 ? formatoMoeda(centavos / 100) : '';
}

function renderOpcoes() {
  const container = document.getElementById('opcoes');
  container.innerHTML = '';

  const nomes = OPCOES[form.tipo].map((op) => op.nome);
  const opcoes = [...OPCOES[form.tipo]];
  // uma categoria que veio de planilha e não está na lista fixa também precisa aparecer
  if (form.categoria && !nomes.includes(form.categoria)) {
    opcoes.push({ nome: form.categoria, icone: '' });
  }

  for (const op of opcoes) {
    const botao = el('button', 'opcao', [op.icone, op.nome].filter(Boolean).join(' '));
    botao.type = 'button';
    botao.setAttribute('aria-pressed', String(op.nome === form.categoria));
    botao.addEventListener('click', () => {
      form.categoria = op.nome;
      renderOpcoes();
    });
    container.appendChild(botao);
  }
}

/** Abre o formulário para uma anotação nova ou, se vier um item, para corrigi-la. */
function abrirFormulario(tipo, item) {
  form.tipo = tipo;
  form.id = item ? item.id : null;
  form.categoria = item ? item.categoria : null;
  form.voltarPara = viewAtual();

  const textos = TEXTOS[tipo];
  const titulo = item ? textos.edicao : textos.novo;

  document.getElementById('pergunta-opcao').textContent = textos.pergunta;
  document.getElementById('valor').value = item ? formatoMoeda(item.valor) : '';
  document.getElementById('data').value = item ? item.data : hojeISO();
  document.getElementById('data').max = hojeISO();
  document.getElementById('descricao').value = item ? item.descricao : '';
  document.getElementById('btn-apagar').hidden = !item;
  renderOpcoes();

  irPara('lancar');
  document.getElementById('titulo-view').textContent = titulo;
}

function fecharFormulario() {
  irPara(form.voltarPara);
}

function salvarFormulario() {
  const valor = centavosDoCampo() / 100;
  const data = document.getElementById('data').value;
  const descricao = document.getElementById('descricao').value.trim();

  if (valor <= 0) {
    mostrarToast('Digite o valor.');
    document.getElementById('valor').focus();
    return;
  }

  if (!form.categoria) {
    mostrarToast(TEXTOS[form.tipo].faltaOpcao);
    return;
  }

  if (!data || data > hojeISO()) {
    mostrarToast('Confira o dia: não pode ser depois de hoje.');
    return;
  }

  const lista = carregar();
  const campos = { tipo: form.tipo, categoria: form.categoria, descricao, valor, data };

  if (form.id) {
    const indice = lista.findIndex((item) => item.id === form.id);
    if (indice >= 0) lista[indice] = { ...lista[indice], ...campos };
  } else {
    lista.push({ id: gerarId(), criadoEm: Date.now(), ...campos });
  }

  salvar(lista);
  render();
  fecharFormulario();
  mostrarToast(data === hojeISO()
    ? TEXTOS[form.tipo].salvo
    : `${TEXTOS[form.tipo].salvo.replace('!', '')} no dia ${formatoData(data).slice(0, 5)}!`);
}

async function apagarDoFormulario() {
  const ok = await confirmar('Apagar esta anotação?', 'Sim, apagar');
  if (!ok) return;

  salvar(carregar().filter((item) => item.id !== form.id));
  render();
  fecharFormulario();
  mostrarToast('Anotação apagada.');
}

/* ==================== confirmação e avisos ==================== */

let resolverModal = null;

/** Pergunta em letras grandes, no lugar da janelinha do navegador. */
function confirmar(mensagem, textoSim) {
  document.getElementById('modal-mensagem').textContent = mensagem;
  document.getElementById('modal-sim').textContent = textoSim;
  document.getElementById('modal').hidden = false;
  return new Promise((resolve) => { resolverModal = resolve; });
}

function fecharModal(resposta) {
  document.getElementById('modal').hidden = true;
  if (resolverModal) resolverModal(resposta);
  resolverModal = null;
}

function mostrarToast(mensagem) {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 3500);
}

/* ==================== planilha (CSV) ==================== */

// a última coluna repete o valor com sinal: somando-a no Excel sai o saldo do caixa
const CABECALHO_CSV = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Fluxo de caixa (R$)'];

// marca de início de arquivo UTF-8 que o Excel espera para exibir acentos corretamente
const BOM = '﻿';

function campoParaCSV(texto) {
  const s = String(texto == null ? '' : texto);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function numeroParaCSV(valor) {
  return valor.toFixed(2).replace('.', ',');
}

function gerarCSV(lista) {
  const ordenada = [...lista].sort((a, b) => (
    a.data === b.data ? a.criadoEm - b.criadoEm : a.data.localeCompare(b.data)
  ));

  const linhas = [CABECALHO_CSV.join(';')];

  for (const item of ordenada) {
    linhas.push([
      formatoData(item.data),
      TEXTOS[item.tipo].nomeCsv,
      item.categoria,
      item.descricao,
      numeroParaCSV(item.valor),
      numeroParaCSV(item.tipo === 'entrada' ? item.valor : -item.valor),
    ].map(campoParaCSV).join(';'));
  }

  return linhas.join('\r\n');
}

function nomeDaPlanilha() {
  return `perfumaria-${hojeISO()}.csv`;
}

function baixarPlanilha() {
  const lista = carregar();
  if (lista.length === 0) {
    mostrarToast('Ainda não há nada anotado.');
    return;
  }

  baixarArquivo(new Blob([BOM + gerarCSV(lista)], { type: 'text/csv;charset=utf-8;' }), nomeDaPlanilha());
  registrarExportacao();
  mostrarToast('Planilha salva na pasta de downloads.');
}

function baixarArquivo(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre a tela de compartilhar do celular (WhatsApp, e-mail…) com a planilha anexada. */
async function enviarPlanilha() {
  const lista = carregar();
  if (lista.length === 0) {
    mostrarToast('Ainda não há nada anotado.');
    return;
  }

  const arquivo = new File([BOM + gerarCSV(lista)], nomeDaPlanilha(), { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Planilha da Perfumaria' });
      registrarExportacao();
      return;
    } catch (erro) {
      if (erro.name === 'AbortError') return;
    }
  }

  // aparelho sem compartilhamento de arquivos: salva, e o envio é feito pelo próprio WhatsApp
  baixarPlanilha();
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
function parseNumero(texto) {
  if (texto == null) return NaN;
  let s = String(texto).trim().replace(/\s/g, '').replace(/r\$/gi, '');
  if (s === '') return NaN;

  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');

  if (temVirgula && temPonto) {
    // o separador que aparece por último é o decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  } else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" / "12.345.678": grupos de 3 dígitos são milhar, não decimal
    s = s.replace(/\./g, '');
  }

  return parseFloat(s);
}

/** Aceita dd/mm/aaaa e aaaa-mm-dd. */
function parseDataParaISO(texto) {
  const s = String(texto || '').trim();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;

  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

  return null;
}

const SINONIMOS_TIPO = {
  entrada: ['entrada', 'venda', 'receita', 'recebi'],
  saida: ['saida', 'pagamento', 'despesa', 'paguei'],
};

function parseTipo(texto) {
  const chave = chaveSimples(texto);
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS_TIPO)) {
    if (sinonimos.includes(chave)) return tipo;
  }
  return null;
}

/** "boticario" -> "Boticário": usa o nome oficial quando a categoria é conhecida. */
function parseCategoria(tipo, texto) {
  const bruto = String(texto || '').trim();
  const conhecida = OPCOES[tipo].find((op) => normalizarTexto(op.nome) === normalizarTexto(bruto));
  return conhecida ? conhecida.nome : (bruto || 'Outros');
}

/** Divide uma linha de CSV respeitando campos entre aspas. */
function dividirLinha(linha, separador) {
  const campos = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];

    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === separador && !dentroDeAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }

  campos.push(atual);
  return campos.map((campo) => campo.trim());
}

const SINONIMOS_COLUNA = {
  data: ['data', 'dia'],
  tipo: ['tipo'],
  categoria: ['categoria', 'forma', 'fornecedor'],
  descricao: ['descricao', 'anotacao', 'obs', 'observacao'],
  valor: ['valorr', 'valor', 'valorrs'],
};

/** Descobre em que coluna está cada campo. Devolve null se a linha não é cabeçalho. */
function mapearColunas(campos) {
  const indices = {};

  campos.forEach((campo, i) => {
    const chave = chaveSimples(campo);
    for (const [nome, sinonimos] of Object.entries(SINONIMOS_COLUNA)) {
      if (indices[nome] === undefined && sinonimos.includes(chave)) indices[nome] = i;
    }
  });

  return indices.data !== undefined && indices.valor !== undefined ? indices : null;
}

function parseCSV(texto) {
  const linhas = texto
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((linha) => linha.trim() !== '');

  if (linhas.length === 0) return { registros: [], invalidos: 0 };

  const separador = linhas[0].includes(';') ? ';' : ',';

  // sem cabeçalho reconhecível, assume a ordem das colunas da planilha exportada
  const cabecalho = mapearColunas(dividirLinha(linhas[0], separador));
  const indices = cabecalho || { data: 0, tipo: 1, categoria: 2, descricao: 3, valor: 4 };
  const inicio = cabecalho ? 1 : 0;

  const registros = [];
  let invalidos = 0;

  for (let i = inicio; i < linhas.length; i++) {
    const campos = dividirLinha(linhas[i], separador);
    const pegar = (idx) => (idx === undefined ? '' : campos[idx] || '');

    const data = parseDataParaISO(pegar(indices.data));
    const tipo = parseTipo(pegar(indices.tipo));
    const valor = parseNumero(pegar(indices.valor));

    if (!data || !tipo || !isFinite(valor) || valor <= 0) {
      invalidos++;
      continue;
    }

    registros.push({
      tipo,
      categoria: parseCategoria(tipo, pegar(indices.categoria)),
      descricao: pegar(indices.descricao),
      valor,
      data,
    });
  }

  return { registros, invalidos };
}

/** Identidade de uma anotação, usada para não importar duas vezes a mesma linha. */
function chaveLancamento(item) {
  return [
    item.data,
    item.tipo,
    normalizarTexto(item.categoria),
    normalizarTexto(item.descricao),
    item.valor.toFixed(2),
  ].join('|');
}

function importarCSV(texto) {
  const { registros, invalidos } = parseCSV(texto);
  const lista = carregar();

  // conta quantas cópias de cada anotação já existem: duas vendas iguais no mesmo dia
  // continuam entrando, e trazer a mesma planilha duas vezes não duplica nada
  const existentes = new Map();
  for (const item of lista) {
    const chave = chaveLancamento(item);
    existentes.set(chave, (existentes.get(chave) || 0) + 1);
  }

  let adicionados = 0;
  let ignorados = 0;

  for (const reg of registros) {
    const chave = chaveLancamento(reg);
    const repetidos = existentes.get(chave) || 0;

    if (repetidos > 0) {
      existentes.set(chave, repetidos - 1);
      ignorados++;
      continue;
    }

    lista.push({ id: gerarId(), criadoEm: Date.now() + adicionados, ...reg });
    adicionados++;
  }

  if (adicionados > 0) {
    salvar(lista);
    render();
  }

  return { adicionados, ignorados, invalidos, total: registros.length };
}

function mostrarStatusImportacao(mensagem, tipo) {
  const status = document.getElementById('status-importacao');
  status.textContent = mensagem;
  status.className = `status ${tipo}`;
  status.hidden = false;
}

function lerArquivoImportado(ev) {
  const arquivo = ev.target.files && ev.target.files[0];
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const r = importarCSV(String(leitor.result));
      if (r.total === 0) {
        mostrarStatusImportacao('Nenhuma anotação encontrada no arquivo.', 'erro');
      } else {
        const partes = [`${r.adicionados} anotação(ões) trazida(s)`];
        if (r.ignorados > 0) partes.push(`${r.ignorados} já existia(m)`);
        if (r.invalidos > 0) partes.push(`${r.invalidos} linha(s) com erro`);
        mostrarStatusImportacao(partes.join(' · '), r.adicionados > 0 || r.ignorados > 0 ? 'ok' : 'erro');
      }
    } catch {
      mostrarStatusImportacao('Não foi possível ler o arquivo. Confira se é a planilha do app.', 'erro');
    }
    ev.target.value = '';
  };
  leitor.onerror = () => {
    mostrarStatusImportacao('Não foi possível ler o arquivo.', 'erro');
    ev.target.value = '';
  };
  leitor.readAsText(arquivo, 'UTF-8');
}

async function apagarTudo() {
  const total = carregar().length;
  if (total === 0) {
    mostrarToast('Não há nada para apagar.');
    return;
  }

  const ok = await confirmar(
    `Apagar todas as ${total} anotações deste aparelho?\n\nNão dá para desfazer.`,
    'Sim, apagar tudo'
  );
  if (!ok) return;

  memoria = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXPORTACAO);
  } catch { /* nada salvo para remover */ }
  render();
  mostrarToast('Tudo foi apagado.');
}

/* ==================== inicialização ==================== */

function render() {
  const lista = carregar();
  renderInicio(lista);
  renderRelatorio(lista);
  renderCompras(lista);
  renderDicasWhatsApp();

  const ultima = ultimaExportacao();
  document.getElementById('ultima-exportacao').textContent = ultima
    ? `Último envio: ${formatoData(isoDe(new Date(ultima)))}`
    : '';
}

function init() {
  document.getElementById('versao').textContent = VERSAO;

  history.replaceState({ view: 'inicio' }, '');
  window.addEventListener('popstate', (ev) => {
    fecharModal(false);
    // o formulário não é reaberto pelo histórico: sem saber o que estava sendo anotado
    const view = ev.state && ev.state.view !== 'lancar' ? ev.state.view : 'inicio';
    if (!ev.state || ev.state.view === 'lancar') history.replaceState({ view: 'inicio' }, '');
    mostrarView(view);
  });

  document.querySelectorAll('[data-ir]').forEach((botao) => {
    botao.addEventListener('click', () => irPara(botao.dataset.ir));
  });

  document.getElementById('btn-nova-entrada').addEventListener('click', () => abrirFormulario('entrada'));
  document.getElementById('btn-nova-saida').addEventListener('click', () => abrirFormulario('saida'));

  document.getElementById('valor').addEventListener('input', aplicarMascaraValor);
  document.getElementById('form-lancamento').addEventListener('submit', (ev) => {
    ev.preventDefault();
    salvarFormulario();
  });
  document.getElementById('btn-cancelar').addEventListener('click', fecharFormulario);
  document.getElementById('btn-apagar').addEventListener('click', apagarDoFormulario);

  document.querySelectorAll('[data-relatorio]').forEach((aba) => {
    aba.addEventListener('click', () => abrirRelatorio(aba.dataset.relatorio, hojeISO()));
  });
  document.getElementById('periodo-anterior').addEventListener('click', () => {
    abrirRelatorio(relatorio.tipo, deslocarPeriodo(relatorio.ref, relatorio.tipo, -1));
  });
  document.getElementById('periodo-proximo').addEventListener('click', () => {
    abrirRelatorio(relatorio.tipo, deslocarPeriodo(relatorio.ref, relatorio.tipo, 1));
  });
  document.getElementById('btn-whats-relatorio').addEventListener('click', () => {
    enviarNoWhatsApp(textoDoRelatorio(carregar()));
  });
  document.getElementById('btn-arquivo-relatorio').addEventListener('click', () => {
    enviarArquivo(itensDoRelatorio(carregar()), nomeArquivoRelatorio());
  });

  document.querySelectorAll('[data-compras]').forEach((aba) => {
    aba.addEventListener('click', () => abrirCompras(aba.dataset.compras, hojeISO(), compras.empresa));
  });
  document.getElementById('compras-anterior').addEventListener('click', () => {
    abrirCompras(compras.tipo, deslocarPeriodo(compras.ref, compras.tipo, -1), compras.empresa);
  });
  document.getElementById('compras-proximo').addEventListener('click', () => {
    abrirCompras(compras.tipo, deslocarPeriodo(compras.ref, compras.tipo, 1), compras.empresa);
  });
  document.getElementById('compras-voltar').addEventListener('click', () => {
    abrirCompras(compras.tipo, compras.ref, null);
  });
  document.getElementById('btn-whats-compras').addEventListener('click', () => {
    enviarNoWhatsApp(textoDasCompras(carregar()));
  });
  document.getElementById('btn-arquivo-compras').addEventListener('click', () => {
    enviarArquivo(pagamentosDeCompras(carregar()), nomeArquivoCompras());
  });

  document.getElementById('btn-salvar-fone').addEventListener('click', () => {
    const fone = document.getElementById('cfg-fone').value.trim();
    const digitos = fone.replace(/\D/g, '').length;
    if (fone && digitos < 10) {
      mostrarToast('Digite o número com DDD.');
      return;
    }
    if (!gravarConfig({ ...lerConfig(), fone })) {
      mostrarToast('O celular não deixou salvar o número.');
      return;
    }
    renderDicasWhatsApp();
    mostrarToast(fone ? 'Número salvo!' : 'Número apagado.');
  });

  document.getElementById('btn-enviar-planilha').addEventListener('click', enviarPlanilha);
  document.getElementById('btn-baixar-planilha').addEventListener('click', baixarPlanilha);
  document.getElementById('btn-importar').addEventListener('click', () => {
    document.getElementById('input-arquivo').click();
  });
  document.getElementById('input-arquivo').addEventListener('change', lerArquivoImportado);
  document.getElementById('btn-apagar-tudo').addEventListener('click', apagarTudo);

  document.getElementById('modal-sim').addEventListener('click', () => fecharModal(true));
  document.getElementById('modal-nao').addEventListener('click', () => fecharModal(false));

  render();
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
