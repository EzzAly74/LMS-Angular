import type { LocalizedText } from '../../../core/models/localized.types';

/** Author badge shown on list rows (server resolves anonymous → org name). */
export interface BlogAuthor {
  name: string;
  image: string | null;
  is_anonymous: boolean;
}

export interface BlogQualification {
  id: number;
  name: string;
}

/** Management-row shape (localized, from BlogListResource). */
export interface BlogListItem {
  id: number;
  title: string;
  subtitle: string | null;
  slug: string;
  image: string | null;
  level: string | null;
  reading_time: number | null;
  /** First qualification, kept for backward compatibility. */
  qualification: BlogQualification | null;
  qualifications: BlogQualification[];
  author: BlogAuthor;
  added_by: string | null;
  published_at: string | null;
  created_at: string | null;
  active: boolean;
}

/** One editable section (bilingual, from AdminBlogSectionResource). */
export interface AdminBlogSection {
  id?: number;
  title: LocalizedText;
  image: string | null;
  image_url: string | null;
  body: LocalizedText;
  quote: LocalizedText;
  sort_order: number;
}

/** Full edit shape (bilingual, from AdminBlogResource). */
export interface AdminBlog {
  id: number;
  title: LocalizedText;
  subtitle: LocalizedText;
  slug: string;
  image: string | null;
  image_url: string | null;
  level: string | null;
  author_user_id: number | null;
  author_name: string | null;
  is_anonymous: boolean;
  reading_time: number | null;
  qualification_skill_ids: number[];
  qualifications: BlogQualification[];
  active: boolean;
  published_at: string | null;
  sections: AdminBlogSection[];
}

/** Owner picker option (from /users). */
export interface UserOption {
  id: number;
  name: string;
}

export interface QualificationOption {
  id: number;
  name: string;
}
