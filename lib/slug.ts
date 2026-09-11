// URL path helpers for activity detail pages:
// /activities/<id>/<title-slug> — id stays exact, slug is cosmetic.
export function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'detail';
}

export function activityPath(id: string, title: string): string {
  return `/activities/${encodeURIComponent(id)}/${slugify(title)}`;
}
