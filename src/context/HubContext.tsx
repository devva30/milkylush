import React, { createContext, useContext, useState, useEffect } from 'react';

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

export const HUBS: Record<string, HubInfo> = {
  hub_hosur_main: {
    id: 'hub_hosur_main',
    name: 'Hosur Central Hub',
    code: 'TN-HSR',
    location: 'Hosur',
    state: 'Tamil Nadu',
    address: 'Hosur Central Hub, Tamil Nadu',
    latitude: '12.7409',
    longitude: '77.8253',
  },
  hub_bangalore_main: {
    id: 'hub_bangalore_main',
    name: 'Bangalore Electronic City Hub',
    code: 'KA-BLR',
    location: 'Bangalore',
    state: 'Karnataka',
    address: 'Electronic City Phase 1, Bengaluru',
    latitude: '12.8676977',
    longitude: '77.6667214',
  },
};

interface HubContextType {
  isAdminLoggedIn: boolean;
  setIsAdminLoggedIn: (val: boolean) => void;
  selectedHubId: string;
  setSelectedHubId: (hubId: string) => void;
  activeHub: HubInfo;
  isHosur: boolean;
  selectedConsole: 'catalog' | 'delivery' | 'commercial' | null;
  setSelectedConsole: (mode: 'catalog' | 'delivery' | 'commercial' | null) => void;
  adminUsername: string;
  setAdminUsername: (email: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  loginAdmin: (username: string, hubId: string) => void;
  logoutAdmin: () => void;
  switchHub: (hubId: string) => void;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

export const HubContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('isAdminLoggedIn') === 'true';
  });

  const [selectedHubId, setSelectedHubIdState] = useState<string>(() => {
    return localStorage.getItem('selectedHubId') || 'hub_bangalore_main';
  });

  const [selectedConsole, setSelectedConsoleState] = useState<'catalog' | 'delivery' | 'commercial' | null>(() => {
    return (localStorage.getItem('selectedConsole') as 'catalog' | 'delivery' | 'commercial') || null;
  });

  const [adminUsername, setAdminUsername] = useState<string>(() => {
    return localStorage.getItem('adminUsername') || 'tomadmin@gmail.com';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

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

  const loginAdmin = (username: string, hubId: string) => {
    setIsAdminLoggedIn(true);
    localStorage.setItem('isAdminLoggedIn', 'true');
    setAdminUsername(username);
    localStorage.setItem('adminUsername', username);
    setSelectedHubId(hubId);
  };

  const logoutAdmin = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('isAdminLoggedIn');
    setSelectedConsole(null);
  };

  const switchHub = (hubId: string) => {
    setSelectedHubId(hubId);
  };

  const activeHub = HUBS[selectedHubId] || HUBS.hub_bangalore_main;
  const isHosur = selectedHubId === 'hub_hosur_main';

  return (
    <HubContext.Provider
      value={{
        isAdminLoggedIn,
        setIsAdminLoggedIn,
        selectedHubId,
        setSelectedHubId,
        activeHub,
        isHosur,
        selectedConsole,
        setSelectedConsole,
        adminUsername,
        setAdminUsername,
        theme,
        toggleTheme,
        loginAdmin,
        logoutAdmin,
        switchHub,
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
