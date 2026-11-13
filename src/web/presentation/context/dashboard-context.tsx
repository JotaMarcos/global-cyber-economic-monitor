import { createContext, useContext, type ReactNode } from "react";
import type { DashboardDependencies } from "../dashboard-dependencies.ts";

const DashboardContext = createContext<DashboardDependencies | null>(null);

interface DashboardProviderProps {
  readonly dependencies: DashboardDependencies;
  readonly children: ReactNode;
}

export function DashboardProvider({ dependencies, children }: DashboardProviderProps) {
  return (
    <DashboardContext.Provider value={dependencies}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardDependencies {
  const dependencies = useContext(DashboardContext);
  if (!dependencies) {
    throw new Error("useDashboard deve ser usado dentro de <DashboardProvider>.");
  }
  return dependencies;
}
