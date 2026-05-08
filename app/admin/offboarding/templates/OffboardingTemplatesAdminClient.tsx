"use client";

import { useEffect, useState } from "react";

import { OFFBOARDING_ASSIGNEE_TYPES } from "../../../../lib/server/offboarding/types";

type TemplateTask = {
  id: string;
  title: string;
  description: string | null;
  assigneeType: string;
  dueOffsetDays: number | null;
  sortOrder: number;
  isRequired: boolean;
};

type Template = {
  id: string;
  name: string;
  isActive: boolean;
  tasks: TemplateTask[];
};

type TaskDraft = {
  title: string;
  description: string;
  assigneeType: string;
  dueOffsetDays: string;
  sortOrder: string;
  isRequired: boolean;
};

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: "",
  description: "",
  assigneeType: "HR",
  dueOffsetDays: "",
  sortOrder: "0",
  isRequired: true,
};

export default function OffboardingTemplatesAdminClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [editingTaskIds, setEditingTaskIds] = useState<Record<string, boolean>>(
    {}
  );
  const [taskEditDrafts, setTaskEditDrafts] = useState<
    Record<string, TaskDraft>
  >({});

  function buildTaskDraftFromTask(task: TemplateTask): TaskDraft {
    return {
      title: task.title,
      description: task.description ?? "",
      assigneeType: task.assigneeType,
      dueOffsetDays:
        task.dueOffsetDays == null ? "" : String(task.dueOffsetDays),
      sortOrder: String(task.sortOrder),
      isRequired: task.isRequired,
    };
  }

  async function loadTemplates() {
    try {
      const response = await fetch("/api/admin/offboarding/templates");
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load offboarding templates.");
        return;
      }

      setTemplates(data.templates);
      setTaskDrafts((current) => {
        const next = { ...current };
        for (const template of data.templates as Template[]) {
          if (!next[template.id]) {
            const nextSortOrder = template.tasks.length
              ? Math.max(...template.tasks.map((task) => task.sortOrder)) + 1
              : 0;
            next[template.id] = {
              ...EMPTY_TASK_DRAFT,
              sortOrder: String(nextSortOrder),
            };
          }
        }
        return next;
      });
      setTaskEditDrafts((current) => {
        const next = { ...current };
        for (const template of data.templates as Template[]) {
          for (const task of template.tasks) {
            next[task.id] = buildTaskDraftFromTask(task);
          }
        }
        return next;
      });
    } catch {
      setMessage("Unable to load offboarding templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSavingTemplate(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/offboarding/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newTemplateName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to create offboarding template.");
        return;
      }

      setNewTemplateName("");
      setMessage("Offboarding template created successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to create offboarding template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSaveTemplate(template: Template) {
    setMessage("");

    try {
      const response = await fetch(`/api/admin/offboarding/templates/${template.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: template.name,
          isActive: template.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update offboarding template.");
        return;
      }

      setMessage("Offboarding template updated successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to update offboarding template.");
    }
  }

  async function handleAddTask(templateId: string, e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const draft = taskDrafts[templateId];

    try {
      const response = await fetch(
        `/api/admin/offboarding/templates/${templateId}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to add offboarding task.");
        return;
      }

      setTaskDrafts((current) => ({
        ...current,
        [templateId]: {
          ...EMPTY_TASK_DRAFT,
        },
      }));
      setMessage("Offboarding task added successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to add offboarding task.");
    }
  }

  async function handleSaveTask(taskId: string) {
    setMessage("");
    const draft = taskEditDrafts[taskId];

    try {
      const response = await fetch(
        `/api/admin/offboarding/templates/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update offboarding task.");
        return;
      }

      setEditingTaskIds((current) => ({
        ...current,
        [taskId]: false,
      }));
      setMessage("Offboarding task updated successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to update offboarding task.");
    }
  }

  async function handleDeleteTask(taskId: string) {
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/offboarding/templates/tasks/${taskId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to remove offboarding task.");
        return;
      }

      setMessage("Offboarding task removed successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to remove offboarding task.");
    }
  }

  if (loading) {
    return <div className="text-slate-600">Loading offboarding templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Offboarding Templates</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage checklist templates for HR, manager, and IT offboarding tasks.
        </p>
      </div>

      <div className="rounded bg-white p-4 shadow sm:p-6">
        <form onSubmit={handleCreateTemplate} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newTemplateName}
            onChange={(event) => setNewTemplateName(event.target.value)}
            placeholder="New offboarding template name"
            className="w-full rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={savingTemplate}
            className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingTemplate ? "Creating..." : "Create Template"}
          </button>
        </form>
      </div>

      {message && <div className="text-sm text-slate-700">{message}</div>}

      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="rounded bg-white p-4 text-sm text-slate-500 shadow">
            No offboarding templates found.
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="rounded bg-white p-4 shadow sm:p-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={template.name}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((item) =>
                          item.id === template.id
                            ? { ...item, name: event.target.value }
                            : item
                        )
                      )
                    }
                    className="w-full rounded border px-3 py-2"
                  />

                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={template.isActive}
                      onChange={(event) =>
                        setTemplates((current) =>
                          current.map((item) =>
                            item.id === template.id
                              ? { ...item, isActive: event.target.checked }
                              : item
                          )
                        )
                      }
                    />
                    Active template
                  </label>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleSaveTemplate(template)}
                    className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Save Template
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold">Template Tasks</h3>

                <div className="mt-3 space-y-3">
                  {template.tasks.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      No tasks have been added yet.
                    </div>
                  ) : (
                    template.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded border border-slate-200 px-4 py-3"
                      >
                        <div className="font-medium text-slate-900">
                          {task.sortOrder}. {task.title}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {task.assigneeType}
                          {task.dueOffsetDays != null
                            ? ` • Due +${task.dueOffsetDays} days`
                            : " • No due date"}
                          {task.isRequired ? " • Required" : " • Optional"}
                        </div>
                        {task.description && (
                          <div className="mt-2 text-sm text-slate-700">
                            {task.description}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTaskIds((current) => ({
                                ...current,
                                [task.id]: !current[task.id],
                              }))
                            }
                            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          >
                            {editingTaskIds[task.id] ? "Cancel Edit" : "Edit Task"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                          >
                            Remove Task
                          </button>
                        </div>

                        {editingTaskIds[task.id] && taskEditDrafts[task.id] && (
                          <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-sm font-medium">Task Title</label>
                                <input
                                  type="text"
                                  value={taskEditDrafts[task.id].title}
                                  onChange={(event) =>
                                    setTaskEditDrafts((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...current[task.id],
                                        title: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded border px-3 py-2"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium">Assignee Type</label>
                                <select
                                  value={taskEditDrafts[task.id].assigneeType}
                                  onChange={(event) =>
                                    setTaskEditDrafts((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...current[task.id],
                                        assigneeType: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded border px-3 py-2"
                                >
                                  {OFFBOARDING_ASSIGNEE_TYPES.map((assigneeType) => (
                                    <option key={assigneeType} value={assigneeType}>
                                      {assigneeType}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium">Due Offset Days</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={taskEditDrafts[task.id].dueOffsetDays}
                                  onChange={(event) =>
                                    setTaskEditDrafts((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...current[task.id],
                                        dueOffsetDays: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded border px-3 py-2"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium">Sort Order</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={taskEditDrafts[task.id].sortOrder}
                                  onChange={(event) =>
                                    setTaskEditDrafts((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...current[task.id],
                                        sortOrder: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded border px-3 py-2"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-medium">Description</label>
                                <textarea
                                  value={taskEditDrafts[task.id].description}
                                  onChange={(event) =>
                                    setTaskEditDrafts((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...current[task.id],
                                        description: event.target.value,
                                      },
                                    }))
                                  }
                                  className="min-h-24 w-full rounded border px-3 py-2"
                                />
                              </div>
                            </div>

                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={taskEditDrafts[task.id].isRequired}
                                onChange={(event) =>
                                  setTaskEditDrafts((current) => ({
                                    ...current,
                                    [task.id]: {
                                      ...current[task.id],
                                      isRequired: event.target.checked,
                                    },
                                  }))
                                }
                              />
                              Required task
                            </label>

                            <div>
                              <button
                                type="button"
                                onClick={() => handleSaveTask(task.id)}
                                className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                              >
                                Save Task
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={(event) => handleAddTask(template.id, event)}
                  className="mt-4 space-y-4 border-t pt-4"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Task Title</label>
                      <input
                        type="text"
                        value={taskDrafts[template.id]?.title ?? ""}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [template.id]: {
                              ...(current[template.id] ?? EMPTY_TASK_DRAFT),
                              title: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Assignee Type</label>
                      <select
                        value={taskDrafts[template.id]?.assigneeType ?? "HR"}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [template.id]: {
                              ...(current[template.id] ?? EMPTY_TASK_DRAFT),
                              assigneeType: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border px-3 py-2"
                      >
                        {OFFBOARDING_ASSIGNEE_TYPES.map((assigneeType) => (
                          <option key={assigneeType} value={assigneeType}>
                            {assigneeType}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Due Offset Days</label>
                      <input
                        type="number"
                        min="0"
                        value={taskDrafts[template.id]?.dueOffsetDays ?? ""}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [template.id]: {
                              ...(current[template.id] ?? EMPTY_TASK_DRAFT),
                              dueOffsetDays: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Sort Order</label>
                      <input
                        type="number"
                        min="0"
                        value={taskDrafts[template.id]?.sortOrder ?? "0"}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [template.id]: {
                              ...(current[template.id] ?? EMPTY_TASK_DRAFT),
                              sortOrder: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium">Description</label>
                      <textarea
                        value={taskDrafts[template.id]?.description ?? ""}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [template.id]: {
                              ...(current[template.id] ?? EMPTY_TASK_DRAFT),
                              description: event.target.value,
                            },
                          }))
                        }
                        className="min-h-24 w-full rounded border px-3 py-2"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={taskDrafts[template.id]?.isRequired ?? true}
                      onChange={(event) =>
                        setTaskDrafts((current) => ({
                          ...current,
                          [template.id]: {
                            ...(current[template.id] ?? EMPTY_TASK_DRAFT),
                            isRequired: event.target.checked,
                          },
                        }))
                      }
                    />
                    Required task
                  </label>

                  <div>
                    <button
                      type="submit"
                      className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      Add Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
