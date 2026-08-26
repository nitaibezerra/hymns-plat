/**
 * Sub-marco 5.F — Ciclo 5F.7.
 *
 * Espelha `HymnBookPdfUploadForm` (`apps/hymns/forms.py:132`) no cliente pra
 * que o usuário não espere um upload de dezenas de MB só pra receber erro:
 *
 *   - `name` e `owner_name` obrigatórios (o OCR não consegue inferir);
 *   - `pdf_file` obrigatório, extensão `.pdf`, no máximo 50 MB
 *     (`clean_pdf_file`, `apps/hymns/forms.py:163`).
 *
 * As mensagens de extensão e tamanho são as do Django, palavra por palavra:
 * se algum arquivo escapar da checagem do cliente, o servidor responde com
 * o mesmo texto e o usuário não vê duas versões da mesma regra.
 *
 * A capa (`cover_image`) é opcional e não tem validação no form Django além
 * do `ImageField`, então não inventamos regra aqui.
 */

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export interface UploadFormValues {
  name: string;
  ownerName: string;
  pdfFile: File | null;
}

export type UploadFormField = "name" | "ownerName" | "pdfFile";
export type UploadFormErrors = Partial<Record<UploadFormField, string>>;

export function validatePdfFile(file: File | null): string | null {
  if (!file) return "Escolha o arquivo PDF do hinário.";
  if (!file.name.toLowerCase().endsWith(".pdf")) return "O arquivo deve ter extensão .pdf";
  // `>` e não `>=`: paridade exata com o Django, que aceita 50 MB cravados.
  if (file.size > MAX_PDF_BYTES) return "O arquivo não pode ser maior que 50MB";
  return null;
}

export function validateUploadForm(values: UploadFormValues): UploadFormErrors {
  const errors: UploadFormErrors = {};
  if (!values.name.trim()) errors.name = "Informe o nome do hinário.";
  if (!values.ownerName.trim()) errors.ownerName = "Informe o dono do hinário.";
  const pdfError = validatePdfFile(values.pdfFile);
  if (pdfError) errors.pdfFile = pdfError;
  return errors;
}

export function isUploadFormValid(values: UploadFormValues): boolean {
  return Object.keys(validateUploadForm(values)).length === 0;
}
