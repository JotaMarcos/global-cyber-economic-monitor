import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { DashboardPage } from "../presentation/components/DashboardPage.tsx";
import { DashboardProvider } from "../presentation/context/dashboard-context.tsx";
import { createDashboardDependencies } from "./composition-root.ts";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Elemento raiz "#root" não encontrado em index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <DashboardProvider dependencies={createDashboardDependencies()}>
      <DashboardPage />
    </DashboardProvider>
  </StrictMode>,
);
