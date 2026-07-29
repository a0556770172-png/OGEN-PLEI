"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, Tag } from "lucide-react";
import type { Category } from "@/types/database";

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      setCategories(json.categories ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), value: newValue.trim() || undefined })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה ביצירת קטגוריה");
      setNewLabel("");
      setNewValue("");
      await load();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditLabel(c.label);
  }

  async function saveEdit(id: string) {
    setError("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בשמירה");
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setSavingId(null);
    }
  }

  async function removeCategory(c: Category) {
    setError("");
    if (!confirm(`למחוק את הקטגוריה "${c.label}"?`)) return;
    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה במחיקה");
      await load();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={createCategory} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm text-gray-400">שם הקטגוריה (מוצג לכולם)</label>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="input-field" placeholder='למשל: "מוזיקה"' />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm text-gray-400">מזהה פנימי (אנגלית, אופציונלי)</label>
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} className="input-field" placeholder="music" dir="ltr" />
        </div>
        <button type="submit" disabled={creating || !newLabel.trim()} className="btn-primary shrink-0">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          הוספת קטגוריה
        </button>
      </form>

      <div className="card divide-y divide-border/60 p-0">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">אין קטגוריות עדיין.</div>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
              <Tag className="h-4 w-4 shrink-0 text-primary-light" />
              {editingId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="input-field flex-1"
                  />
                  <button
                    onClick={() => saveEdit(c.id)}
                    disabled={savingId === c.id || !editLabel.trim()}
                    className="btn-ghost text-accent"
                  >
                    {savingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost text-gray-400">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white">{c.label}</p>
                    <p className="text-xs text-gray-500" dir="ltr">{c.value}</p>
                  </div>
                  <button onClick={() => startEdit(c)} className="btn-ghost text-sm">
                    <Pencil className="h-4 w-4" /> שינוי שם
                  </button>
                  <button
                    onClick={() => removeCategory(c)}
                    disabled={deletingId === c.id}
                    className="btn-ghost text-sm text-red-400"
                  >
                    {deletingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    מחיקה
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-gray-500">
        לא ניתן למחוק קטגוריה שיש לה אפליקציות משויכות - יש לשנות קודם את הקטגוריה של האפליקציות הללו.
      </p>
    </div>
  );
}
