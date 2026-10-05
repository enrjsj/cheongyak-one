export function appendUniqueNotices<T extends { id: number }>(current: T[], incoming: T[]) {
  const seen = new Set(current.map(item => item.id));
  const added = incoming.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return { items: [...current, ...added], added };
}
