const CLASSIFIER_TO_DB: Record<string, string> = {
  '维修': '家政',
  '按摩': '按摩',
  '保洁': '家政',
  '社交': '交友',
  '其他': '家政',
}

const DB_CATEGORY_LABELS: Record<string, string> = {
  '家政': '家政',
  '交友': '交友',
  '按摩': '按摩',
  '医疗陪护': '医疗陪护',
}

export function mapClassifierToDbCategory(classifierCategory: string): string {
  return CLASSIFIER_TO_DB[classifierCategory] ?? '家政'
}

export function getDbCategoryLabel(category: string): string {
  return DB_CATEGORY_LABELS[category] ?? category
}
