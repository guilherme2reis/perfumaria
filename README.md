# PERFUMARIA

App para anotar as **vendas** e os **pagamentos** de uma perfumaria e ver o fluxo de caixa
por dia, mês e ano. Feito para ser usado por uma pessoa de 70 anos: letras grandes, botões
grandes, poucas telas e nenhuma senha.

Página única, funciona no celular, instalável na tela de início e sem servidor — as anotações
ficam salvas no próprio aparelho (`localStorage`). Mesmo padrão do app
[GASTEI](https://github.com/guilherme2reis/GASTEI).

## Como se usa

| Tela | O que faz |
| --- | --- |
| **Início** | Dois botões: **RECEBI** (anotar uma venda) e **PAGUEI** (anotar um pagamento). Embaixo, o resumo de hoje — entrou, saiu, saldo — e as anotações do dia |
| **Relatórios** | **Dia**, **Mês** e **Ano**, com setas ◀ ▶ para andar no tempo. Mostra entrou/saiu/saldo, o total por forma de recebimento e o total por fornecedor |
| **Planilha** | Enviar a planilha (WhatsApp, e-mail…), salvar no aparelho, trazer anotações de uma planilha e apagar tudo |

Para anotar: digitar o valor (só os números, como na maquininha: `1250` vira `R$ 12,50`),
tocar em uma opção e em **SALVAR**. O dia já vem preenchido com hoje.

- **Entradas:** Dinheiro, PIX, Crédito, Débito
- **Saídas:** Natura, Boticário, Avon, Mary Kay, Mahogani, Outros

Para **corrigir ou apagar**, tocar na anotação. No relatório do mês, tocar em um dia abre
aquele dia; no do ano, tocar em um mês abre aquele mês.

## Acompanhar o caixa de longe

Os dados ficam **só no celular dela**. Há duas formas de receber:

- **📤 Enviar este relatório** (tela Relatórios): manda o resumo do dia, mês ou ano como
  texto, direto numa conversa do WhatsApp.
- **📤 Enviar planilha** (tela Planilha): manda o arquivo `perfumaria-AAAA-MM-DD.csv` com
  todas as anotações. Abre no Excel com acentos corretos.

Colunas da planilha:

```
Data;Tipo;Categoria;Descrição;Valor (R$);Fluxo de caixa (R$)
01/10/2026;Entrada;PIX;;125,50;125,50
01/10/2026;Saída;Natura;;350,00;-350,00
```

A última coluna repete o valor com sinal (saída negativa): somando-a no Excel sai o saldo, e
uma tabela dinâmica por `Tipo` e `Categoria` dá o fluxo de caixa completo.

A planilha também é o **backup**: se o celular for trocado ou os dados do navegador forem
limpos, as anotações somem. Depois de 30 dias sem enviar, o app mostra um lembrete na tela
inicial. Para restaurar, use **Escolher planilha** — anotações que já existem não são
duplicadas, então dá para trazer o mesmo arquivo duas vezes.

## Mudar as opções

As formas de recebimento e os fornecedores ficam na lista `OPCOES`, no começo do `app.js`.
Para incluir um fornecedor, acrescente uma linha:

```js
{ nome: 'Eudora', icone: '' },
```

Anotações antigas não são afetadas.

## Publicar no GitHub Pages

1. Em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.
2. O app fica em `https://guilherme2reis.github.io/perfumaria/`.

No celular, abra o endereço e use **Adicionar à tela de início** (Android: menu do Chrome;
iPhone: botão de compartilhar no Safari). Depois disso ele abre em tela cheia, com ícone
próprio, e funciona sem internet.

O repositório é público, mas só tem o código: nenhuma venda ou pagamento vai para o GitHub
(o `.gitignore` deixa de fora qualquer `.csv`).

## Ao publicar uma alteração

Basta enviar para a `main`. O `sw.js` busca primeiro na internet e usa o cache só quando
está sem sinal, então a versão nova chega sozinha na próxima vez que o app for aberto com
internet — não precisa trocar nome de cache. Vale subir o `VERSAO` no começo do `app.js`
(é o número do rodapé) para conferir no celular dela qual versão está rodando.

## Rodar no computador

Nesta pasta:

```bash
python -m http.server 8124
```

E abra `http://localhost:8124`.
