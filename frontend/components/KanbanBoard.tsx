"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "../lib/api";
import { useToast } from "./Providers";
import TaskForm from "./TaskForm";
import Modal from "./Modal";

const COLUMNS: {
  key: TaskStatus;
  label: string;
  accent: string;
  dot: string;
}[] = [
  {
    key: "todo",
    label: "Do zrobienia",
    accent: "from-slate-400/20 to-slate-200/0",
    dot: "bg-slate-400",
  },
  {
    key: "in_progress",
    label: "W toku",
    accent: "from-amber-400/30 to-amber-200/0",
    dot: "bg-amber-400",
  },
  {
    key: "done",
    label: "Zrobione",
    accent: "from-emerald-400/30 to-emerald-200/0",
    dot: "bg-emerald-500",
  },
];

export default function KanbanBoard() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createInStatus, setCreateInStatus] = useState<TaskStatus | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listTasks();
      setTasks(data);
    } catch (err) {
      toast.push(
        "error",
        err instanceof Error ? err.message : "Błąd pobierania",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) map[t.status].push(t);
    for (const k of Object.keys(map) as TaskStatus[]) {
      map[k].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }
    return map;
  }, [tasks]);

  const counts = useMemo(
    () => ({
      todo: grouped.todo.length,
      in_progress: grouped.in_progress.length,
      done: grouped.done.length,
      total: tasks.length,
    }),
    [grouped, tasks.length],
  );

  const handleCreate = async (input: TaskInput) => {
    const target: TaskInput = {
      ...input,
      status: input.status ?? createInStatus ?? "todo",
    };
    const created = await createTask(target);
    setTasks((prev) => [created, ...prev]);
    toast.push("success", "Zadanie utworzone");
    setCreateInStatus(null);
  };

  const handleEdit = async (input: TaskInput) => {
    if (!editing) return;
    const updated = await updateTask(editing.id, input);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    toast.push("success", "Zaktualizowano");
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTask(confirmDelete.id);
      setTasks((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      toast.push("success", "Usunięto zadanie");
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Błąd usuwania");
    } finally {
      setConfirmDelete(null);
    }
  };

  const moveTask = async (taskId: string, to: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === to) return;
    const optimistic = { ...task, status: to };
    setTasks((prev) => prev.map((t) => (t.id === taskId ? optimistic : t)));
    try {
      const updated = await updateTask(taskId, { status: to });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
      toast.push(
        "error",
        err instanceof Error ? err.message : "Nie udało się przenieść",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tablica Kanban</h1>
          <p className="text-sm text-slate-500 mt-1">
            {counts.total === 0
              ? "Brak zadań — utwórz pierwsze, aby rozpocząć."
              : `Razem ${counts.total} zadań · ${counts.todo} do zrobienia · ${counts.in_progress} w toku · ${counts.done} zrobione`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateInStatus("todo")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium hover:from-indigo-500 hover:to-violet-500 shadow-sm shadow-indigo-500/20 transition"
        >
          <span className="text-lg leading-none">+</span> Nowe zadanie
        </button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((c) => (
            <div
              key={c.key}
              className="h-72 rounded-2xl border border-slate-800/70 bg-slate-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = grouped[col.key];
            const isOver = dragOver === col.key;
            return (
              <section
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() =>
                  setDragOver((d) => (d === col.key ? null : d))
                }
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/task-id");
                  setDragOver(null);
                  if (id) void moveTask(id, col.key);
                }}
                className={`flex flex-col rounded-2xl border bg-slate-900/60 backdrop-blur-sm transition shadow-sm ${
                  isOver
                    ? "border-indigo-400 ring-2 ring-indigo-400/30"
                    : "border-slate-800/70"
                }`}
              >
                <header
                  className={`flex items-center justify-between px-4 py-3 rounded-t-2xl bg-gradient-to-b ${col.accent}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                    <h2 className="font-semibold tracking-tight">
                      {col.label}
                    </h2>
                    <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
                      {items.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateInStatus(col.key)}
                    title="Dodaj zadanie"
                    className="text-slate-500 hover:text-slate-100 text-xl leading-none px-2"
                  >
                    +
                  </button>
                </header>

                <div className="kanban-col flex-1 overflow-y-auto p-3 space-y-2 min-h-[14rem] max-h-[calc(100vh-18rem)]">
                  {items.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8 select-none">
                      Upuść zadanie tutaj
                    </p>
                  ) : (
                    items.map((t) => (
                      <KanbanCard
                        key={t.id}
                        task={t}
                        onEdit={() => setEditing(t)}
                        onDelete={() => setConfirmDelete(t)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={createInStatus !== null}
        title="Nowe zadanie"
        onClose={() => setCreateInStatus(null)}
      >
        <TaskForm
          submitLabel="Utwórz"
          initial={{ status: createInStatus ?? "todo" }}
          onSubmit={handleCreate}
          onCancel={() => setCreateInStatus(null)}
        />
      </Modal>

      <Modal
        open={editing !== null}
        title="Edytuj zadanie"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <TaskForm
            initial={editing}
            submitLabel="Zapisz zmiany"
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        title="Usunąć zadanie?"
        size="sm"
        onClose={() => setConfirmDelete(null)}
      >
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          &ldquo;{confirmDelete?.title}&rdquo; zostanie trwale usunięte.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-sm transition"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-500 transition"
          >
            Usuń
          </button>
        </div>
      </Modal>
    </div>
  );
}

function KanbanCard({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const overdue =
    deadline && task.status !== "done" && deadline.getTime() < Date.now();

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group rounded-xl bg-slate-900 border border-slate-800 p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm leading-snug break-words">
          {task.title}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={onEdit}
            title="Edytuj"
            className="text-xs text-slate-500 hover:text-indigo-600 px-1"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Usuń"
            className="text-xs text-slate-500 hover:text-rose-600 px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-3 whitespace-pre-wrap">
          {task.description}
        </p>
      )}

      {deadline && (
        <div
          className={`mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
            overdue
              ? "bg-rose-950/60 text-rose-300"
              : "bg-slate-800 text-slate-300"
          }`}
        >
          <span>📅</span>
          <span>
            {deadline.toLocaleDateString()}{" "}
            {deadline.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {overdue && <span className="font-medium">· po terminie</span>}
        </div>
      )}
    </article>
  );
}
