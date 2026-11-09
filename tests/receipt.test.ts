/// <reference types="node" />
// Textos como saem do OCR. Nomes, CPFs, chaves e códigos são FICTÍCIOS.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchMember, nameCase, parseReceipt, redactReceipt, shortName } from '../src/lib/receipt.ts';

// Tela de sucesso do app do banco (formato do Itaú).
const ITAU_TELA = `16:25
Transferência realizada!
Valor
R$ 250,00 via Pix
Para
Maria Aparecida de Souza Lima
Data
06 nov 2026 às 16:24
Fazer nova
transferência
Compartilhar
comprovante`;

// Comprovante completo (formato do Itaú).
const ITAU_COMPROVANTE = `itaú
Comprovante de Pix
R$ 250,00
Realizado em 06/11/2026 às 16:24:44
De
JOAO CARLOS PEREIRA SANTOS
CPF: ***.123.456-**
Instituição: ITAÚ UNIBANCO S.A
Para
MARIA APARECIDA DE SOUZA LIMA
CPF: ***654321**
Instituição: BANCO BRADESCO S.A.
Chave Pix: 11987654321
Dados da transação
Autenticação:
AB12CD34EF56AB78CD90EF12AB34CD56EF78AB90
ID da transação:
E60701190202611061924ZZ00TESTE00
Realizada em: Celular
Central de atendimento
Capitais e regiões metropolitanas: 4004 4828
SAC 24 horas: 0800 728 0728`;

// Variações sintéticas de rótulos comuns em outros bancos.
const ROTULO_NOME = `Comprovante de transferência
06 NOV 2026 - 16:24:44
Valor
R$ 1.250,90
Tipo de transferência
Pix
Destino
Nome
Maria Souza
CPF
•••.456.789-••
Origem
Nome
João Pereira`;

const INLINE = `Pix enviado
Valor: R$ 89,90
Data: 05/11/26 14:02
Favorecido: PADARIA PAO QUENTE LTDA
Pagador: Joao Pereira
Saldo disponível R$ 3.000,00`;

const FRASE = `Você pagou R$ 45,00 para Ana Lima em 3 de novembro de 2026`;

const BOLETO = `Comprovante de pagamento de boleto
Beneficiário: Escola Pequenos Passos LTDA
Data de vencimento 10/11/2026
Valor do documento R$ 980,00
Desconto R$ 49,00
Valor pago R$ 931,00
Data do pagamento 06/11/2026`;

test('Itaú: tela de transferência realizada', () => {
  const r = parseReceipt(ITAU_TELA);
  assert.equal(r.amountCents, 25000);
  assert.equal(r.amountConfidence, 'high');
  assert.equal(r.date, '2026-11-06');
  assert.equal(r.toName, 'Maria Aparecida de Souza Lima');
  assert.equal(r.method, 'pix');
  assert.equal(r.title, 'Pix para Maria Lima');
});

test('Itaú: comprovante completo, sem confundir telefones, CPF ou "Realizada em: Celular"', () => {
  const r = parseReceipt(ITAU_COMPROVANTE);
  assert.equal(r.amountCents, 25000);
  assert.equal(r.amountConfidence, 'high');
  assert.equal(r.date, '2026-11-06');
  assert.equal(r.dateConfidence, 'high');
  assert.equal(r.toName, 'Maria Aparecida de Souza Lima');
  assert.equal(r.fromName, 'Joao Carlos Pereira Santos');
  // Nada sensível sai do leitor.
  const out = JSON.stringify(r);
  for (const s of ['123.456', '654321', '11987654321', 'AB12CD', 'E6070119', 'BRADESCO']) assert.ok(!out.includes(s), s);
});

test('rótulo seguido de "Nome", mês por extenso abreviado e milhar', () => {
  const r = parseReceipt(ROTULO_NOME);
  assert.equal(r.amountCents, 125090);
  assert.equal(r.date, '2026-11-06');
  assert.equal(r.toName, 'Maria Souza');
  assert.equal(r.fromName, 'João Pereira');
});

test('rótulos na mesma linha, ano com 2 dígitos e saldo ignorado', () => {
  const r = parseReceipt(INLINE);
  assert.equal(r.amountCents, 8990);
  assert.equal(r.date, '2026-11-05');
  assert.equal(r.toName, 'Padaria Pao Quente LTDA');
  assert.equal(r.title, 'Pix para Padaria Pao Quente LTDA');
});

test('frase corrida', () => {
  const r = parseReceipt(FRASE);
  assert.equal(r.amountCents, 4500);
  assert.equal(r.date, '2026-11-03');
  assert.equal(r.toName, 'Ana Lima');
});

test('boleto: valor pago e data do pagamento (não vencimento nem desconto)', () => {
  const r = parseReceipt(BOLETO);
  assert.equal(r.amountCents, 93100);
  assert.equal(r.date, '2026-11-06');
  assert.equal(r.method, 'boleto');
  assert.equal(r.toName, 'Escola Pequenos Passos LTDA');
  assert.equal(r.title, 'Boleto Escola Pequenos Passos LTDA');
});

test('texto sem comprovante: não inventa nada', () => {
  const r = parseReceipt('Foto da praia\nbom dia');
  assert.equal(r.amountCents, null);
  assert.equal(r.date, null);
  assert.equal(r.toName, null);
  assert.equal(r.title, null);
});

test('nomes: caixa, título curto e participante do grupo', () => {
  assert.equal(nameCase('MARIA DA SILVA E SOUZA'), 'Maria da Silva e Souza');
  assert.equal(shortName('Maria Aparecida de Souza Lima'), 'Maria Lima');
  const members = [{ id: 'r', display_name: 'João' }, { id: 'p', display_name: 'Maria' }];
  assert.equal(matchMember('Joao Carlos Pereira Santos', members)?.id, 'r');
  assert.equal(matchMember('Maria Aparecida de Souza Lima', members)?.id, 'p');
  assert.equal(matchMember('Padaria Pao Quente LTDA', members), null);
});

test('texto para suporte: sem nomes, documentos, chaves nem códigos', () => {
  const red = redactReceipt(ITAU_COMPROVANTE);
  for (const s of ['JOAO', 'MARIA', '123.456', '654321', '11987654321', 'AB12CD34', 'E60701190202611061924']) {
    assert.ok(!red.includes(s), `vazou ${s}:\n${red}`);
  }
  assert.ok(red.includes('R$ 250,00') && red.includes('06/11/2026'), 'mantém valor e data');
  const inline = redactReceipt(INLINE);
  assert.ok(!inline.includes('PADARIA') && !inline.includes('Joao'), inline);
});

// Nota fiscal de mercado (NFC-e). Dados fictícios.
const NFCE_LINHAS = `SUPERMERCADO BOM PRECO LTDA
CNPJ: 12.345.678/0001-90
Rua das Flores, 100 - Sao Paulo
Documento Auxiliar da Nota Fiscal de Consumidor Eletronica
049 259385 MELAO AMAR REI KG 2,525 kg X 17,99 45,42
050 1413613 BISCUIT BAUD NET 80G 1 UN X 9,99 9,99
desconto sobre item -3,00
QTD. TOTAL DE ITENS 55
VALOR TOTAL R$ 900,11
DESCONTO R$ 67,62
ACRESCIMO R$ 0,00
VALOR A PAGAR R$ 832,49
CARTAO 832,49
Consulte pela Chave de Acesso em
https://www.nfce.fazenda.sp.gov.br/consulta
3526 1111 2222 3333 4444 5555 6666 7777 8888 9999 0000
NFC-e 000123456 Serie 107 08/11/2026 17:31:48
Protocolo de autorizacao: 135260000000000
Data de autorizacao 08/11/2026 17:31:48
Nome/Razao Social: FULANO DE TAL
Tributos Totais Incidentes (Lei Fed 12.741/2012): R$ 258,36`;

// Como na foto: valores numa coluna separada e deslocada dos rótulos.
const NFCE_COLUNA = `050 1413613 BISCUIT BAUD NET 80G 1 UN X 9,99 (2,20)
9,99
desconto sobre item
-3,00
051 66662 FILEZINHO BJA SEARA
25,02
0,738 kg X 33,90 (7,87)
055 2010854 GELEIA HOM MOR 320G 1 UN X 26,99 (8,49)
26,99
55
QTD. TOTAL DE ITENS
900,11
VALOR TOTAL R$
67,62
DESCONTO R$
0,00
ACRESCIMO R$
832,49
VALOR A PAGAR R$
832,49
CARTAOON
Consulte pela Chave de Acesso em
NFC-e 000123456 Serie 107 08/11/2026 17:31:
Data de autorizacao 08/11/2026 17:31:48
Nome/Razao Social: FULANO DE TAL
Volumes: 65
(Lei Fed 12.741/2012): R$ 258,36`;

test('nota fiscal de mercado: valor a pagar, data e loja (não o cliente)', () => {
  const r = parseReceipt(NFCE_LINHAS);
  assert.equal(r.invoice, true);
  assert.equal(r.amountCents, 83249);
  assert.equal(r.amountConfidence, 'high');
  assert.equal(r.date, '2026-11-08');
  assert.equal(r.toName, 'Supermercado Bom Preco LTDA');
  assert.equal(r.fromName, null);
  assert.equal(r.title, 'Compra Supermercado Bom Preco LTDA');
  assert.equal(r.method, 'card');
  assert.ok(!JSON.stringify(r).includes('Fulano'), 'nome do cliente fica de fora');
});

test('nota fiscal com a coluna de valores deslocada (foto): acha o total pela conta', () => {
  const r = parseReceipt(NFCE_COLUNA);
  assert.equal(r.amountCents, 83249, 'total 900,11 − desconto 67,62 + acréscimo 0,00');
  assert.equal(r.amountConfidence, 'high');
  assert.equal(r.date, '2026-11-08');
  assert.equal(r.toName, null, 'loja fora da foto: não inventa (e não usa o cliente)');
  assert.equal(r.title, 'Compra (nota fiscal)');
});

test('nota fiscal: texto para suporte sem cliente, chave de acesso nem protocolo', () => {
  const red = redactReceipt(NFCE_LINHAS);
  for (const s of ['FULANO', '3526 1111', '135260000000000', '12.345.678']) assert.ok(!red.includes(s), `vazou ${s}:\n${red}`);
  assert.ok(red.includes('832,49'));
});

test('data no futuro fica marcada para conferir', () => {
  const r = parseReceipt('Pix enviado\nValor: R$ 10,00\nData: 08/11/2028 14:02', '2026-11-09');
  assert.equal(r.date, '2028-11-08');
  assert.equal(r.dateConfidence, 'low');
});
