"use client";

import { useEffect, useState } from "react";

import { EMPLOYEE_DOCUMENT_CATEGORIES } from "../../../../lib/documents/constants";
import { ONBOARDING_ASSIGNEE_TYPES } from "../../../../lib/onboarding/constants";

type TemplateTaskDocumentRequirement = {
  id: string;
  label: string;
  documentCategory: string;
  isRequired: boolean;
  sortOrder: number;
};

type TemplateTask = {
  id: string;
  title: string;
  description: string | null;
  assigneeType: string;
  dueOffsetDays: number | null;
  sortOrder: number;
  isRequired: boolean;
  documentRequirements: TemplateTaskDocumentRequirement[];
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
  documentRequirements: RequirementDraft[];
};

type RequirementDraft = {
  label: string;
  documentCategory: string;
  isRequired: boolean;
  sortOrder: string;
};

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: "",
  description: "",
  assigneeType: "HR",
  dueOffsetDays: "",
  sortOrder: "0",
  isRequired: true,
  documentRequirements: [],
};

export default function OnboardingTemplatesAdminClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [editingTaskIds, setEditingTaskIds] = useState<Record<string, boolean>>({});
  const [taskEditDrafts, setTaskEditDrafts] = useState<Record<string, TaskDraft>>({});

  function nextRequirementSortOrder(
    requirements: Array<{ sortOrder: number | string }>
  ) {
    if (requirements.length === 0) {
      return "0";
    }

    return String(
      Math.max(...requirements.map((item) => Number(item.sortOrder) || 0)) + 1
    );
  }

  function emptyRequirementDraft(
    sortOrder: string = "0"
  ): RequirementDraft {
    return {
      label: "",
      documentCategory: EMPLOYEE_DOCUMENT_CATEGORIES[0],
      isRequired: true,
      sortOrder,
    };
  }

  function buildTaskDraftFromTask(task: TemplateTask): TaskDraft {
    return {
      title: task.title,
      description: task.description ?? "",
      assigneeType: task.assigneeType,
      dueOffsetDays:
        task.dueOffsetDays == null ? "" : String(task.dueOffsetDays),
      sortOrder: String(task.sortOrder),
      isRequired: task.isRequired,
      documentRequirements: task.documentRequirements.map((requirement) => ({
        label: requirement.label,
        documentCategory: requirement.documentCategory,
        isRequired: requirement.isRequired,
        sortOrder: String(requirement.sortOrder),
      })),
    };
  }

  async function loadTemplates() {
    try {
      const response = await fetch("/api/admin/onboarding/templates");
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load onboarding templates.");
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
      setMessage("Unable to load onboarding templates.");
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
      const response = await fetch("/api/admin/onboarding/templates", {
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
        setMessage(data.error || "Unable to create onboarding template.");
        return;
      }

      setNewTemplateName("");
      setMessage("Onboarding template created successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to create onboarding template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSaveTemplate(template: Template) {
    setMessage("");

    try {
      const response = await fetch(`/api/admin/onboarding/templates/${template.id}`, {
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
        setMessage(data.error || "Unable to update onboarding template.");
        return;
      }

      setMessage("Onboarding template updated successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to update onboarding template.");
    }
  }

  async function handleAddTask(templateId: string, e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const draft = taskDrafts[templateId];

    try {
      const response = await fetch(
        `/api/admin/onboarding/templates/${templateId}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            assigneeType: draft.assigneeType,
            dueOffsetDays: draft.dueOffsetDays,
            sortOrder: draft.sortOrder,
            isRequired: draft.isRequired,
            documentRequirements: draft.documentRequirements,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to add onboarding task.");
        return;
      }

      setTaskDrafts((current) => ({
        ...current,
        [templateId]: {
          ...EMPTY_TASK_DRAFT,
        },
      }));
      setMessage("Onboarding task added successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to add onboarding task.");
    }
  }

  async function handleSaveTask(taskId: string) {
    setMessage("");
    const draft = taskEditDrafts[taskId];

    try {
      const response = await fetch(
        `/api/admin/onboarding/templates/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            assigneeType: draft.assigneeType,
            dueOffsetDays: draft.dueOffsetDays,
            sortOrder: draft.sortOrder,
            isRequired: draft.isRequired,
            documentRequirements: draft.documentRequirements,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update onboarding task.");
        return;
      }

      setEditingTaskIds((current) => ({
        ...current,
        [taskId]: false,
      }));
      setMessage("Onboarding task updated successfully.");
      await loadTemplates();
    } catch {
      setMessage("Unable to update onboarding task.");
    }
  }

  function renderRequirementEditor(params: {
    draft: TaskDraft;
    onChange: (nextDraft: TaskDraft) => void;
  }) {
    const { draft, onChange } = params;

    return (
      <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-900">
            Document Requirements
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                documentRequirements: [
                  ...draft.documentRequirements,
                  emptyRequirementDraft(
                    nextRequirementSortOrder(draft.documentRequirements)
                  ),
                ],
              })
            }
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-white"
          >
            Add Requirement
          </button>
        </div>

        {draft.documentRequirements.length === 0 ? (
          <div className="text-sm text-slate-500">
            No document requirements configured.
          </div>
        ) : (
          <div className="space-y-3">
            {draft.documentRequirements.map((requirement, index) => (
              <div
                key={`${requirement.label}-${index}`}
                className="rounded border border-slate-200 bg-white p-3"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Label</label>
                    <input
                      type="text"
                      value={requirement.label}
                      onChange={(event) => {
                        const next = [...draft.documentRequirements];
                        next[index] = {
                          ...requirement,
                          label: event.target.value,
                        };
                        onChange({
                          ...draft,
                          documentRequirements: next,
                        });
                      }}
                      className="w-full rounded border px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Document Category</label>
                    <select
                      value={requirement.documentCategory}
                      onChange={(event) => {
                        const next = [...draft.documentRequirements];
                        next[index] = {
                          ...requirement,
                          documentCategory: event.target.value,
                        };
                        onChange({
                          ...draft,
                          documentRequirements: next,
                        });
                      }}
                      className="w-full rounded border px-3 py-2"
                    >
                      {EMPLOYEE_DOCUMENT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Sort Order</label>
                    <input
                      type="number"
                      min="0"
                      value={requirement.sortOrder}
                      onChange={(event) => {
                        const next = [...draft.documentRequirements];
                        next[index] = {
                          ...requirement,
                          sortOrder: event.target.value,
                        };
                        onChange({
                          ...draft,
                          documentRequirements: next,
                        });
                      }}
                      className="w-full rounded border px-3 py-2"
                    />
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={requirement.isRequired}
                        onChange={(event) => {
                          const next = [...draft.documentRequirements];
                          next[index] = {
                            ...requirement,
                            isRequired: event.target.checked,
                          };
                          onChange({
                            ...draft,
                            documentRequirements: next,
                          });
                        }}
                      />
                      Required document
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...draft,
                          documentRequirements:
                            draft.documentRequirements.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-600">Loading onboarding templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Onboarding Templates</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage checklist templates for HR, manager, IT, and employee onboarding tasks.
        </p>
      </div>

      <div className="rounded bg-white p-4 shadow sm:p-6">
        <form onSubmit={handleCreateTemplate} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newTemplateName}
            onChange={(event) => setNewTemplateName(event.target.value)}
            placeholder="New onboarding template name"
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

      {message && (
        <div className="text-sm text-slate-700">{message}</div>
      )}

      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="rounded bg-white p-4 text-sm text-slate-500 shadow">
            No onboarding templates found.
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

                        <div className="mt-3">
                          {task.documentRequirements.length === 0 ? (
                            <div className="text-xs text-slate-500">
                              No document requirements.
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Document Requirements
                              </div>
                              {task.documentRequirements.map((requirement) => (
                                <div
                                  key={requirement.id}
                                  className="text-sm text-slate-600"
                                >
                                  {requirement.sortOrder}. {requirement.label} •{" "}
                                  {requirement.documentCategory}
                                  {requirement.isRequired ? " • Required" : " • Optional"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
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
                        </div>

                        {editingTaskIds[task.id] &&
                          taskEditDrafts[task.id] && (
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
                                    {ONBOARDING_ASSIGNEE_TYPES.map((assigneeType) => (
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

                              {renderRequirementEditor({
                                draft: taskEditDrafts[task.id],
                                onChange: (nextDraft) =>
                                  setTaskEditDrafts((current) => ({
                                    ...current,
                                    [task.id]: nextDraft,
                                  })),
                              })}

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
                        {ONBOARDING_ASSIGNEE_TYPES.map((assigneeType) => (
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

                  {renderRequirementEditor({
                    draft: taskDrafts[template.id] ?? EMPTY_TASK_DRAFT,
                    onChange: (nextDraft) =>
                      setTaskDrafts((current) => ({
                        ...current,
                        [template.id]: nextDraft,
                      })),
                  })}

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
