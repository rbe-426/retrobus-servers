export function feedbackSlug(name) {
  const slug = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
  return slug || 'membre';
}

export function formatFeedbackReference(authorName, rank) {
  return `${feedbackSlug(authorName)}-${String(rank).padStart(3, '0')}`;
}

// Le numéro du ticket est son rang chronologique parmi les remontées du même auteur.
export function withFeedbackReferences(itemsOldestFirst) {
  return itemsOldestFirst.map((item, index) => ({ ...item, reference: formatFeedbackReference(item.authorName, index + 1) }));
}
