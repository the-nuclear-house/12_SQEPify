import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True when both values are present. The Login page uses this to show a clear
// message rather than failing silently if the environment is not configured.
export const isSupabaseConfigured = Boolean(url && anonKey);

const client = createClient(url ?? '', anonKey ?? '', {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/*
 * Read-only mode.
 *
 * While a superadmin is viewing SQEPify as someone else, nothing may be written.
 * The session still belongs to the superadmin, so the database would happily
 * accept the write and it would be recorded against the wrong person. Rather
 * than guard every call site, every write goes through this one choke point.
 *
 * Blocked: insert, update, upsert and delete on any table, the two RPCs that
 * write, and edge function calls. Reads and anything under supabase.auth are
 * untouched, so signing out of view-as always works.
 */
const READ_ONLY_MESSAGE =
  'You are viewing SQEPify as another user, which is read-only. Exit view-as to make changes.';

const WRITING_RPCS = new Set(['request_training_move', 'decide_training_move']);

let readOnly = false;
export function setClientReadOnly(next: boolean) {
  readOnly = next;
}

/**
 * Stands in for a query builder: every method returns itself, and awaiting it
 * yields the same shape a real call would, so existing `const { error } = await`
 * call sites report the refusal instead of throwing.
 */
function blocked(): never | unknown {
  const result = { data: null, error: { message: READ_ONLY_MESSAGE } };
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
        }
        if (prop === 'catch' || prop === 'finally') return () => proxy;
        return () => proxy;
      },
    },
  );
  return proxy;
}

const MUTATORS = new Set(['insert', 'update', 'upsert', 'delete']);

export const supabase = new Proxy(client, {
  get(target, prop) {
    // Functions are always bound to the real client, never to this proxy, so
    // supabase-js keeps working on its own internals.
    const bind = (value: unknown) => (typeof value === 'function' ? value.bind(target) : value);
    const raw = Reflect.get(target, prop);
    if (!readOnly) return bind(raw);

    if (prop === 'from') {
      return (table: string) => {
        const builder = target.from(table);
        return new Proxy(builder, {
          get(b, p) {
            if (MUTATORS.has(p as string)) return () => blocked();
            const v = Reflect.get(b, p);
            return typeof v === 'function' ? v.bind(b) : v;
          },
        });
      };
    }

    if (prop === 'rpc') {
      return (fn: string, args?: unknown) =>
        WRITING_RPCS.has(fn) ? blocked() : target.rpc(fn, args as never);
    }

    if (prop === 'functions') {
      return { invoke: async () => ({ data: null, error: { message: READ_ONLY_MESSAGE } }) };
    }

    return bind(raw);
  },
}) as typeof client;
