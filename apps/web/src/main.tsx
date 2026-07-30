import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/auth-context";
import { App } from "@/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          richColors
          closeButton
          position="top-right"
          duration={2800}
          visibleToasts={3}
          expand={false}
          gap={10}
          offset={16}
          toastOptions={{
            className: "frs-toast",
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
