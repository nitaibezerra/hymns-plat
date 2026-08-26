/**
 * Sub-marco 5.F — Ciclo 5F.13.
 *
 * Porta do `clean()` de `DisambiguationChoiceForm` (`apps/hymns/forms.py:260`):
 * só `add_version` tem pré-requisitos, e são dois — hinário selecionado **e**
 * nome da versão. As mensagens são as do Django.
 */

export const CHOICE_CREATE_NEW = "create_new";
export const CHOICE_ADD_VERSION = "add_version";
export const CHOICE_CANCEL = "cancel";

export type ChoiceKind =
  | typeof CHOICE_CREATE_NEW
  | typeof CHOICE_ADD_VERSION
  | typeof CHOICE_CANCEL;

export interface ChoiceValues {
  kind: ChoiceKind;
  hymnbookSlug: string;
  versionName: string;
}

export function validateChoice(values: ChoiceValues): string | null {
  if (values.kind !== CHOICE_ADD_VERSION) return null;
  if (!values.hymnbookSlug) {
    return "Você deve selecionar um hinário para adicionar a versão";
  }
  if (!values.versionName.trim()) {
    return "Você deve fornecer um nome para a versão";
  }
  return null;
}
