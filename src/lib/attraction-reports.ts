export const ATTRACTION_REPORT_REASON_LABELS = {
  WRONG_LOCATION: "Неверная геопозиция",
  WRONG_DESCRIPTION: "Ошибка в описании",
  WRONG_PHOTO: "Неверная фотография",
  OUTDATED_DATA: "Данные неактуальны",
  OTHER: "Другая ошибка в карточке",
} as const;

export const ATTRACTION_REPORT_REASON_HINTS = {
  WRONG_LOCATION: "Метка на карте, адрес или ориентир указаны неправильно.",
  WRONG_DESCRIPTION: "В тексте есть неточность, ошибка или важное упущение.",
  WRONG_PHOTO: "Фото не относится к этому месту или вводит в заблуждение.",
  OUTDATED_DATA: "Место изменилось, закрыто или информация устарела.",
  OTHER: "Ошибка есть, но она не подходит под варианты выше.",
} as const;

export const ATTRACTION_REPORT_STATUS_LABELS = {
  PENDING: "Новая",
  IN_PROGRESS: "В работе",
  RESOLVED: "Исправлено",
  DISMISSED: "Отклонено",
} as const;

export type AttractionReportReasonCode = keyof typeof ATTRACTION_REPORT_REASON_LABELS;
export type AttractionReportStatusCode = keyof typeof ATTRACTION_REPORT_STATUS_LABELS;

export const ATTRACTION_REPORT_REASON_OPTIONS = Object.entries(
  ATTRACTION_REPORT_REASON_LABELS,
).map(([value, label]) => ({
  value: value as AttractionReportReasonCode,
  label,
  hint: ATTRACTION_REPORT_REASON_HINTS[value as AttractionReportReasonCode],
}));
