import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Leaf,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import type {
  DietaryTag,
  DietaryTagCategory,
} from '@/features/dietary-tags/api/dietary-tags.api';
import {
  useCreateDietaryTag,
  useDeleteDietaryTag,
  useDietaryTags,
  useUpdateDietaryTag,
} from '@/features/dietary-tags/hooks/useDietaryTags';

type CategoryFilter = 'all' | DietaryTagCategory;

interface TagDraft {
  name: string;
  slug: string;
  description: string;
  category: DietaryTagCategory;
  isActive: boolean;
  slugEdited: boolean;
}

const FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dietary', label: 'Dietary' },
  { id: 'lifestyle', label: 'Lifestyle' },
];

const CATEGORY_META = {
  dietary: {
    label: 'Dietary',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  lifestyle: {
    label: 'Lifestyle',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
} satisfies Record<DietaryTagCategory, { label: string; badge: string }>;

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function emptyDraft(): TagDraft {
  return {
    name: '',
    slug: '',
    description: '',
    category: 'dietary',
    isActive: true,
    slugEdited: false,
  };
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'The request could not be completed.';
}

export function DietaryTagsPage() {
  const { data = [], isLoading, error: listError } = useDietaryTags();
  const createMutation = useCreateDietaryTag();
  const updateMutation = useUpdateDietaryTag();
  const toggleMutation = useUpdateDietaryTag();
  const deleteMutation = useDeleteDietaryTag();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TagDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const stats = useMemo(() => {
    let dietary = 0;
    let lifestyle = 0;
    let active = 0;
    for (const item of data) {
      if (item.category === 'dietary') dietary += 1;
      else lifestyle += 1;
      if (item.isActive) active += 1;
    }
    return { total: data.length, dietary, lifestyle, active };
  }, [data]);

  const counts = useMemo(
    () => ({
      all: data.length,
      dietary: data.filter((item) => item.category === 'dietary').length,
      lifestyle: data.filter((item) => item.category === 'lifestyle').length,
    }),
    [data],
  );

  const filteredTags = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.slug.includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    });
  }, [data, filter, search]);

  function beginCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError(null);
    setNotice(null);
    setActionError(null);
    setIsEditorOpen(true);
  }

  function beginEdit(tag: DietaryTag) {
    setEditingId(tag.id);
    setDraft({
      name: tag.name,
      slug: tag.slug,
      description: tag.description ?? '',
      category: tag.category,
      isActive: tag.isActive,
      slugEdited: true,
    });
    setFormError(null);
    setNotice(null);
    setActionError(null);
    setIsEditorOpen(true);
  }

  function resetEditor() {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError(null);
    setIsEditorOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    setActionError(null);
    const name = draft.name.trim();
    const slug = draft.slug.trim();
    if (name.length < 2) {
      setFormError('Name must be at least 2 characters.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setFormError('Slug must use lowercase letters, numbers, and hyphens.');
      return;
    }

    const payload = {
      name,
      slug,
      description: draft.description.trim(),
      category: draft.category,
      isActive: draft.isActive,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, dto: payload });
        setNotice(`Updated ${name}.`);
      } else {
        await createMutation.mutateAsync(payload);
        setNotice(`Created ${name}.`);
      }
      resetEditor();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error));
    }
  }

  async function handleToggle(tag: DietaryTag) {
    setNotice(null);
    setActionError(null);
    try {
      await toggleMutation.mutateAsync({
        id: tag.id,
        dto: { isActive: !tag.isActive },
      });
      setNotice(`${tag.name} is now ${tag.isActive ? 'inactive' : 'active'}.`);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error));
    }
  }

  async function confirmDelete(tag: DietaryTag) {
    setNotice(null);
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(tag.id);
      setPendingDeleteId(null);
      if (editingId === tag.id) resetEditor();
      setNotice(`Deleted ${tag.name}.`);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error));
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Catalog"
        title="Dietary & Lifestyle Tags"
        subtitle="Manage the reusable labels restaurants can assign to menu items."
        icon={<Leaf className="h-6 w-6" />}
        actions={
          <Button
            onClick={beginCreate}
            className="gap-2 shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> New Tag
          </Button>
        }
      />
      {notice && (
        <div
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {actionError && (
        <div
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {listError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{getErrorMessage(listError)}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<Tag className="h-5 w-5 text-blue-600" />}
          label="Total Tags"
          value={stats.total}
          tone="blue"
        />
        <SummaryCard
          icon={<Leaf className="h-5 w-5 text-emerald-600" />}
          label="Dietary"
          value={stats.dietary}
          tone="green"
        />
        <SummaryCard
          icon={<Sparkles className="h-5 w-5 text-violet-600" />}
          label="Lifestyle"
          value={stats.lifestyle}
          tone="violet"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-amber-600" />}
          label="Active"
          value={stats.active}
          tone="amber"
        />
      </div>
      <div className="space-y-6">
        <section className="min-w-0 space-y-4" aria-label="Tag catalog">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, slug, or description"
                className="pl-9"
                aria-label="Search tags"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => {
                const active = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-on-surface-variant hover:bg-surface-container'}`}
                    aria-pressed={active}
                  >
                    {item.label}
                    <span
                      className={
                        active
                          ? 'rounded-full bg-white/20 px-1.5 text-xs'
                          : 'rounded-full bg-surface-container px-1.5 text-xs text-muted-foreground'
                      }
                    >
                      {counts[item.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {isLoading ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground">
              Loading tag catalog...
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center">
              <Tag className="mx-auto h-7 w-7 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-on-surface">
                No tags found
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the filters or add a new tag.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTags.map((tag) => {
                const category = CATEGORY_META[tag.category];
                return (
                  <article
                    key={tag.id}
                    className={`rounded-2xl border bg-card p-4 transition-shadow hover:shadow-sm ${tag.isActive ? '' : 'opacity-75'}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-on-surface">
                            {tag.name}
                          </h2>
                          <Badge className={category.badge}>
                            {category.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              tag.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }
                          >
                            {tag.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {tag.slug}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                          {tag.description || 'No description provided.'}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Updated{' '}
                          {dateFormatter.format(new Date(tag.updatedAt))}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleToggle(tag)}
                          disabled={toggleMutation.isPending}
                        >
                          {tag.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => beginEdit(tag)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => setPendingDeleteId(tag.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                    {pendingDeleteId === tag.id && (
                      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-red-800">
                          Delete <strong>{tag.name}</strong>? Existing menu
                          items keep their historical label.
                        </p>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingDeleteId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => void confirmDelete(tag)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending
                              ? 'Deleting...'
                              : 'Delete tag'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={(open) => {
        if (!open) resetEditor();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Update catalog entry' : 'Add catalog entry'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Edit the details of this dietary tag.' : 'Create a new dietary tag.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="space-y-5 mt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    name,
                    slug: current.slugEdited ? current.slug : slugify(name),
                  }));
                }}
                placeholder="e.g. High Protein"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-slug">Slug</Label>
              <Input
                id="tag-slug"
                value={draft.slug}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slug: slugify(event.target.value),
                    slugEdited: true,
                  }))
                }
                placeholder="high-protein"
                maxLength={80}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Stable identifier used by clients and search filters.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-on-surface">
                Category
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['dietary', 'lifestyle'] as const).map((category) => {
                  const selected = draft.category === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({ ...current, category }))
                      }
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${selected ? 'border-primary bg-primary-200/50 text-primary-700' : 'border-border text-on-surface-variant hover:bg-surface-container'}`}
                      aria-pressed={selected}
                    >
                      {CATEGORY_META[category].label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="tag-description">Description</Label>
              <textarea
                id="tag-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Explain when restaurants should use this tag."
                maxLength={500}
                rows={4}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm text-on-surface outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-surface-container/30 p-3 hover:bg-surface-container/60">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-on-surface">
                  Active option
                </span>
                <span className="block text-xs text-muted-foreground">
                  Active tags appear in restaurant menu-item forms.
                </span>
              </span>
            </label>
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetEditor}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving
                  ? 'Saving...'
                  : editingId
                    ? 'Save changes'
                    : 'Create tag'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'violet' | 'amber';
}) {
  const backgrounds = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-emerald-200 bg-emerald-50',
    violet: 'border-violet-200 bg-violet-50',
    amber: 'border-amber-200 bg-amber-50',
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 ${backgrounds[tone]}`}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-on-surface">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
