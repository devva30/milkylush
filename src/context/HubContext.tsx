import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { HUB_IDS, isHubId, type HubId } from '../data/hubs';

export interface HubInfo {
  id: string;
  name: string;
  code: string;
  location: string;
  state: string;
  address: string;
  latitude: string;
  longitude: string;
}

// Display details for the hub picker/header. Hub ids must match the database.
export const HUBS: Record<string, HubInfo> = {
  hosur: {
    id: 'hosur',
    name: 'Hosur Hub',
    code: 'TN-HSR',
    location: 'Hosur',
    state: 'Tamil Nadu',
    address: 'Hosur Hub, Tamil Nadu',
    latitude: '12.7409',
    longitude: '77.8253',
  },
  bengaluru: {
    id: 'bengaluru',
    name: 'Bangalore Hub',
    code: 'KA-BLR',
    location: 'Bangalore',
    state: 'Karnataka',
    address: 'Bangalore Hub, Karnataka',
    latitude: '12.8676977',
    longitude: '77.6667214',
  },
};

export type StaffRole = 'super_admin' | 'hub_admin' | 'rider';

export interface StaffProfile {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
  hubIds: HubId[];
  active: boolean;
}

interface HubContextType {
  /** False until Firebase has told us whether someone is signed in. */
  isAuthReady: boolean;
  isAdminLoggedIn: boolean;
  staff: StaffProfile | null;
  isSuperAdmin: boolean;
  /** Hubs this admin may open (super admin: all). */
  allowedHubIds: HubId[];
  selectedHubId: HubId;
  setSelectedHubId: (hubId: string) => void;
  activeHub: HubInfo;
  isHosur: boolean;
  selectedConsole: 'catalog' | 'delivery' | 'commercial' | null;
  setSelectedConsole: (mode: 'catalog' | 'delivery' | 'commercial' | null) => void;
  adminUsername: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  /** Real Firebase sign-in. Resolves to an error message, or null on success. */
  loginAdmin: (email: string, password: string) => Promise<string | null>;
  logoutAdmin: () => void;
  switchHub: (hubId: string) => void;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

function loginErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return 'Login failed. Please try again.';
  }
}

async function loadStaff(uid: string): Promise<StaffProfile | null> {
  const snap = await getDoc(doc(db, 'staff', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    name: d.name ?? '',
    email: d.email ?? '',
    role: d.role,
    hubIds: (d.hubIds ?? []).filter(isHubId),
    active: d.active === true,
  };
}

export const HubContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [staff, setStaff] = useState<StaffProfile | null>(null);

  const [selectedHubId, setSelectedHubIdState] = useState<HubId>(() => {
    const saved = localStorage.getItem('selectedHubId');
    return isHubId(saved) ? saved : 'hosur';
  });

  const [selectedConsole, setSelectedConsoleState] = useState<'catalog' | 'delivery' | 'commercial' | null>(() => {
    return (localStorage.getItem('selectedConsole') as 'catalog' | 'delivery' | 'commercial') || null;
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const isSuperAdmin = staff?.role === 'super_admin';
  const allowedHubIds: HubId[] = isSuperAdmin ? HUB_IDS : (staff?.hubIds ?? []);

  // Session comes from Firebase Auth, never from localStorage, and only active
  // admins (not riders, not customers) get in.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStaff(null);
        setIsAuthReady(true);
        return;
      }
      try {
        const profile = await loadStaff(user.uid);
        if (profile && profile.active && (profile.role === 'super_admin' || profile.role === 'hub_admin')) {
          setStaff(profile);
        } else {
          setStaff(null);
          await signOut(auth);
        }
      } catch {
        setStaff(null);
      }
      setIsAuthReady(true);
    });
  }, []);

  // Keep the selected hub inside what this admin may open.
  useEffect(() => {
    if (staff && !allowedHubIds.includes(selectedHubId) && allowedHubIds.length > 0) {
      setSelectedHubIdState(allowedHubIds[0]);
      localStorage.setItem('selectedHubId', allowedHubIds[0]);
    }
  }, [staff, allowedHubIds, selectedHubId]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setSelectedHubId = (hubId: string) => {
    if (!isHubId(hubId)) return;
    if (staff && !allowedHubIds.includes(hubId)) return; // hub admin can't switch to another hub
    setSelectedHubIdState(hubId);
    localStorage.setItem('selectedHubId', hubId);
  };

  const setSelectedConsole = (mode: 'catalog' | 'delivery' | 'commercial' | null) => {
    setSelectedConsoleState(mode);
    if (mode) {
      localStorage.setItem('selectedConsole', mode);
    } else {
      localStorage.removeItem('selectedConsole');
    }
  };

  const loginAdmin = async (email: string, password: string): Promise<string | null> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile = await loadStaff(cred.user.uid);
      if (!profile || !profile.active || (profile.role !== 'super_admin' && profile.role !== 'hub_admin')) {
        await signOut(auth);
        return 'This account does not have admin access.';
      }
      setStaff(profile);
      return null;
    } catch (err) {
      return loginErrorMessage((err as { code?: string }).code);
    }
  };

  const logoutAdmin = () => {
    setSelectedConsole(null);
    signOut(auth);
  };

  const activeHub = HUBS[selectedHubId] || HUBS.hosur;
  const isHosur = selectedHubId === 'hosur';

  return (
    <HubContext.Provider
      value={{
        isAuthReady,
        isAdminLoggedIn: !!staff,
        staff,
        isSuperAdmin,
        allowedHubIds,
        selectedHubId,
        setSelectedHubId,
        activeHub,
        isHosur,
        selectedConsole,
        setSelectedConsole,
        adminUsername: staff?.email ?? '',
        theme,
        toggleTheme,
        loginAdmin,
        logoutAdmin,
        switchHub: setSelectedHubId,
      }}
    >
      {children}
    </HubContext.Provider>
  );
};

export const useHubContext = () => {
  const context = useContext(HubContext);
  if (!context) {
    throw new Error('useHubContext must be used within a HubContextProvider');
  }
  return context;
};
