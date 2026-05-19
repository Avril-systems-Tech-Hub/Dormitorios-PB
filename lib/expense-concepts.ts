import type { ExpenseConcept } from "@/types/domain";

export const EXPENSE_CONCEPTS: ExpenseConcept[] = [
  "sueldos",
  "lavanderia",
  "limpieza",
  "papeleria",
  "papel_bano",
  "basura",
  "medicamento",
  "jabon_bano",
  "gas",
  "mantenimiento",
  "internet",
  "agua",
  "luz",
  "cobijas",
  "extras",
];

export const EXPENSE_CONCEPT_LABELS: Record<ExpenseConcept, string> = {
  sueldos: "Sueldos",
  lavanderia: "Lavandería",
  limpieza: "Limpieza",
  papeleria: "Papelería",
  papel_bano: "Papel baño",
  basura: "Basura",
  medicamento: "Medicamento",
  jabon_bano: "Jabón baño",
  gas: "Gas",
  mantenimiento: "Mantenimiento",
  internet: "Internet",
  agua: "Agua",
  luz: "Luz",
  cobijas: "Cobijas",
  extras: "Extras",
};

export function getExpenseConceptLabel(concept: ExpenseConcept | string | null | undefined) {
  if (!concept) return "—";
  return EXPENSE_CONCEPT_LABELS[concept as ExpenseConcept] ?? concept;
}
