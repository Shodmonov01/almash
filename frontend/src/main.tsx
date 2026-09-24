import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);

// The bundle loaded fine: allow index.html's one-time stale-asset reload again.
try {
    sessionStorage.removeItem("asset-reload");
} catch {
    // storage blocked — nothing to reset
}
