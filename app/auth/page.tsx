"use client";
import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username,
          email,
          createdAt: new Date(),
        });
      }
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Arka plan efekti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"/>
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"/>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">C</div>
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">ChordHub</span>
        </div>

        {/* Kart */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-gray-100 mb-1">
            {isLogin ? "Tekrar hoş geldin 👋" : "Hesap oluştur 🎸"}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {isLogin ? "Devam etmek için giriş yap" : "Müzik yolculuğuna başla"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!isLogin && (
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Kullanıcı Adı</label>
                <input
                  type="text"
                  placeholder="kullanici_adin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-gray-800/80 transition-all"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">E-posta</label>
              <input
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-gray-800/80 transition-all"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Şifre</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-gray-800/80 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20 mt-1"
            >
              {isLogin ? "Giriş Yap" : "Kayıt Ol"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-sm text-gray-500 hover:text-indigo-400 transition-colors"
            >
              {isLogin ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
              <span className="text-indigo-400 font-medium">
                {isLogin ? "Kayıt ol" : "Giriş yap"}
              </span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          ChordHub · Müzisyenler için dijital platform
        </p>
      </div>
    </div>
  );
}