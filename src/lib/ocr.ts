// Leitura do comprovante no próprio aparelho (ML Kit no Android, Vision no iOS).
// Nada vai para a rede. As cópias temporárias (imagem, páginas do PDF) são apagadas no fim.

import { File } from 'expo-file-system';
import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import PdfThumbnail from 'react-native-pdf-thumbnail';

export const ocrSupported = isSupported;

const asFileUri = (p: string) => (p.startsWith('file://') || p.startsWith('content://') ? p : `file://${p}`);

function discard(uri: string) {
  try {
    if (uri.startsWith('file://')) new File(uri).delete();
  } catch {
    // o sistema limpa o cache de qualquer forma
  }
}

export async function readImage(uri: string, { keep = false } = {}): Promise<string> {
  try {
    const blocks = await extractTextFromImage(asFileUri(uri));
    return blocks.join('\n');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/download|model/i.test(msg)) throw new Error('A leitura inteligente está terminando de se preparar no celular. Tente de novo em alguns segundos.');
    throw new Error('Não consegui ler essa imagem.');
  } finally {
    if (!keep) discard(asFileUri(uri));
  }
}

/** Renderiza as primeiras páginas do PDF e lê cada uma. */
export async function readPdf(uri: string): Promise<string> {
  const file = asFileUri(uri);
  let pages: { uri: string }[] = [];
  try {
    pages = await PdfThumbnail.generateAllPages(file, { quality: 95 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new Error(code === 'PASSWORD_PROTECTED' ? 'Esse PDF tem senha. Abra no banco e compartilhe como imagem.' : 'Não consegui abrir esse PDF.');
  } finally {
    discard(file);
  }
  try {
    const texts: string[] = [];
    for (const p of pages.slice(0, 2)) texts.push(await readImage(p.uri));
    return texts.join('\n');
  } finally {
    pages.forEach((p) => discard(p.uri));
  }
}

export function readFile(uri: string, mimeType?: string | null): Promise<string> {
  return /pdf/i.test(mimeType ?? '') || /\.pdf$/i.test(uri) ? readPdf(uri) : readImage(uri);
}
