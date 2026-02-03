import slugify from 'slugify';

export function generateSlug(text: string, maxLength: number = 32): string {
    let slug = (slugify as any)(text, {lower: true, strict: true}) || 'untitled';
    if (slug.length > maxLength) {
        slug = slug.substring(0, maxLength).replace(/-+$/, '');
    }
    return slug;
}
