'use client';
import { useState, useId } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, ApiError, useResource } from '@/lib/api';
import { label, localNow, localToday } from '@/lib/utils';
import type { Cow, List } from '@/lib/types';
export type Field = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'cow';
  required?: boolean;
  options?: string[] | { value: string; label: string }[];
  value?: string | number | boolean;
  min?: number;
  max?: number;
  step?: string;
  help?: string;
};
export const f = (
  name: string,
  caption: string,
  type: Field['type'] = 'text',
  required = false,
  extra: Partial<Field> = {},
): Field => ({ name, label: caption, type, required, ...extra });
export const occurred = (name: string, caption: string) =>
  f(name, caption, 'datetime-local', true, { value: localNow() });
export const dateField = (name: string, caption: string) =>
  f(name, caption, 'date', true, { value: localToday() });
export const notesField = f('notes', 'Notes', 'textarea');
export function Choice({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full min-w-0 bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          return (
            <SelectItem key={v} value={v}>
              {typeof o === 'string' ? label(o) : o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
function CowPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (s: string) => void;
  id: string;
}) {
  const [search, setSearch] = useState('');
  const q = useResource<List<Cow>>(
    `cows?status=ACTIVE&limit=100&search=${encodeURIComponent(search)}`,
  );
  return (
    <div className="space-y-2">
      <Input
        aria-label="Search cattle by tag or name"
        placeholder="Search tag or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Choice
        id={id}
        value={value}
        onChange={onChange}
        options={(q.data?.items || []).map((c) => ({
          value: c.id,
          label: `${c.tagNumber}${c.name ? ' · ' + c.name : ''}`,
        }))}
        placeholder={q.loading ? 'Loading cattle…' : 'Select a cow'}
      />
      {q.error && <p className="text-destructive text-sm">{q.error}</p>}
      {q.data?.total === 0 && (
        <p className="text-sm text-muted-foreground">No matching active cattle. Add a cow first.</p>
      )}
      {(q.data?.total || 0) > 100 && (
        <p className="text-sm text-muted-foreground">Refine your search to find the cow.</p>
      )}
    </div>
  );
}
export function ActionForm({
  title,
  description,
  fields,
  path,
  method = 'POST',
  onSuccess,
  trigger,
  extra = {},
  transform,
  buttonLabel = 'Save record',
  danger = false,
}: {
  title: string;
  description?: string;
  fields: Field[];
  path: string;
  method?: 'POST' | 'PATCH';
  onSuccess: () => void;
  trigger?: React.ReactNode;
  extra?: Record<string, unknown>;
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;
  buttonLabel?: string;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const uid = useId();
  function initialize(isOpen: boolean) {
    if (busy) return;
    setOpen(isOpen);
    if (isOpen) {
      setError('');
      setValues(
        Object.fromEntries(
          fields.map((x) => [x.name, x.value ?? (x.type === 'checkbox' ? false : '')]),
        ),
      );
    }
  }
  return (
    <Dialog open={open} onOpenChange={initialize}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus size={16} />
            {title}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>
            {description ||
              'Enter the details recorded on your farm. Dates and times use Bangladesh time.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 mt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setBusy(true);
            try {
              const data: Record<string, unknown> = { ...extra };
              for (const field of fields) {
                const value = values[field.name];
                if (field.required && (value === '' || value === undefined))
                  throw new Error(`${field.label} is required`);
                if (value === '' || value === undefined) continue;
                data[field.name] =
                  field.type === 'number'
                    ? Number(value)
                    : field.type === 'datetime-local'
                      ? new Date(`${value}:00+06:00`).toISOString()
                      : value;
              }
              await api(path, { method, body: JSON.stringify(transform ? transform(data) : data) });
              toast.success(`${title}: saved`);
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(
                err instanceof ApiError && err.fields.length
                  ? err.fields.map((x) => `${label(x.path)}: ${x.message}`).join('\n')
                  : (err as Error).message,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`${uid}-${field.name}`}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.type === 'cow' ? (
                  <CowPicker
                    id={`${uid}-${field.name}`}
                    value={String(values[field.name] || '')}
                    onChange={(v) => setValues((s) => ({ ...s, [field.name]: v }))}
                  />
                ) : field.type === 'select' ? (
                  <Choice
                    id={`${uid}-${field.name}`}
                    disabled={busy}
                    value={String(values[field.name] || '')}
                    onChange={(v) => setValues((s) => ({ ...s, [field.name]: v }))}
                    options={field.options || []}
                  />
                ) : field.type === 'textarea' ? (
                  <Textarea
                    id={`${uid}-${field.name}`}
                    required={field.required}
                    value={String(values[field.name] || '')}
                    onChange={(e) => setValues((s) => ({ ...s, [field.name]: e.target.value }))}
                  />
                ) : field.type === 'checkbox' ? (
                  <div className="flex gap-2 items-center">
                    <input
                      id={`${uid}-${field.name}`}
                      type="checkbox"
                      className="size-5 accent-emerald-800"
                      checked={!!values[field.name]}
                      onChange={(e) => setValues((s) => ({ ...s, [field.name]: e.target.checked }))}
                    />
                    <span className="text-sm text-muted-foreground">Yes</span>
                  </div>
                ) : (
                  <Input
                    id={`${uid}-${field.name}`}
                    type={field.type || 'text'}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={String(values[field.name] ?? '')}
                    autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                    onChange={(e) => setValues((s) => ({ ...s, [field.name]: e.target.value }))}
                  />
                )}{' '}
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
              </div>
            ))}
          </fieldset>
          {error && (
            <p
              role="alert"
              className="whitespace-pre-line text-sm text-destructive p-3 bg-red-50 rounded-lg"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? 'destructive' : 'default'} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {buttonLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
