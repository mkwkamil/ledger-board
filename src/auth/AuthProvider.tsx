import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "../firebase";
import { isAdminEmail } from "./admin";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      if (next && !isAdminEmail(next.email)) {
        void signOut(auth);
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(next);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    if (!isAdminEmail(email)) {
      throw Object.assign(new Error("To konto nie ma uprawnień admina."), { code: "auth/admin-only" });
    }
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (!isAdminEmail(cred.user.email)) {
      await signOut(auth);
      throw Object.assign(new Error("To konto nie ma uprawnień admina."), { code: "auth/admin-only" });
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth poza AuthProvider");
  return ctx;
}
