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
