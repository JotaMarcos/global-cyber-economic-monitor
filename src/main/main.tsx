import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DashboardPage } from "../presentation/components/DashboardPage";
import { DashboardProvider } from "../presentation/context/dashboard-context";
import "../index.css";
import { createDashboardDependencies } from "./composition-root";

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
