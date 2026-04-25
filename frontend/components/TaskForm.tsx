"use client";

import { useState } from "react";
import type { Task, TaskInput, TaskStatus } from "../lib/api";

interface Props {
  initial?: Partial<Task>;
  submitLabel?: string;
  onSubmit: (input: TaskInput) => Promise<void> | void;
  onCancel?: () => void;
}

function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition";

export default function TaskForm({
  initial,
  submitLabel = "Zapisz",
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(
    (initial?.status as TaskStatus) ?? "todo",
  );
  const [deadline, setDeadline] = useState<string>(
    toLocalInput(initial?.deadline),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Tytuł jest wymagany");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        status,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
          Tytuł *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          maxLength={200}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
          Opis
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={`${inputCls} resize-y`}
          maxLength={2000}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className={inputCls}
          >
            <option value="todo">Do zrobienia</option>
            <option value="in_progress">W toku</option>
            <option value="done">Zrobione</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            Termin
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-950/40 border border-rose-900 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm transition"
          >
            Anuluj
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium hover:from-indigo-500 hover:to-violet-500 shadow-sm shadow-indigo-500/20 disabled:opacity-60 transition"
        >
          {submitting ? "Zapisywanie…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
