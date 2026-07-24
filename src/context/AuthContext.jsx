// ============================================================
// AUTENTICAÇÃO (Google) + papel do usuário na pelada
// ============================================================
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = carregando

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const entrar = () => signInWithPopup(auth, googleProvider);
  const sair = () => signOut(auth);

  return (
    <AuthCtx.Provider value={{ user, entrar, sair }}>
      {children}
    </AuthCtx.Provider>
  );
}

// Define o papel a partir do doc da pelada.
export function papelDoUsuario(pelada, uid) {
  if (!pelada || !uid) return "visitante";
  if (pelada.presidenteUid === uid) return "presidente";
  if ((pelada.adminUids || []).includes(uid)) return "admin";
  return "jogador";
}

// Resolve uma permissão de 3 níveis ("todos" | "admins" | "presidente").
function permite(cfg, papel, padrao = "presidente") {
  const c = cfg || padrao;
  if (c === "todos") return true;
  if (c === "admins") return papel === "presidente" || papel === "admin";
  return papel === "presidente";
}

export function podeEditarNiveis(pelada, papel) {
  return !!pelada && permite(pelada.configNiveis, papel);
}

export function podeVerCaixa(pelada, papel) {
  return !!pelada && permite(pelada.configCaixa, papel);
}

// Quem pode lançar partidas / operar o dia de jogo (gols, empate, sorteio...).
// Padrão: presidente + admins. O presidente pode liberar para todos.
export function podeLancarPartidas(pelada, papel) {
  return !!pelada && permite(pelada.configPartidas, papel, "admins");
}
