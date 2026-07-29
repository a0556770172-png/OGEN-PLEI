"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Code2, Mail, Lock, AtSign, User, Phone, AlertCircle } from "lucide-react";

export default function DeveloperSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", fullName: "", phone: "" });
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    sessionStorage.setItem("dev_signup_form", JSON.stringify(form));
    router.push("/signup/developer/terms");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary shadow-glow">
            <Code2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black">הרשמה כמפתח</h1>
          <p className="text-sm text-gray-400">מסלול פרסום אפליקציות ותוכנות בעוגן פליי</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">שם מלא</label>
            <div className="relative">
              <User className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field pr-10" placeholder="שם פרטי ומשפחה" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">שם משתמש (יוצג כמפתח)</label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" required minLength={3} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input-field pr-10" placeholder="שם משתמש" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">אימייל</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field pl-10" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">טלפון (אופציונלי)</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field pr-10" placeholder="05X-XXXXXXX" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">סיסמה</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input dir="rtl" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field pl-10" placeholder="לפחות 6 תווים" />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-2 w-full">המשך לתנאי שימוש למפתחים</button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          יש לך כבר חשבון? <Link href="/login" className="font-semibold text-primary-light hover:underline">התחבר</Link>
        </div>
      </motion.div>
    </div>
  );
}
