import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { performanceOptimizer } from "./utils/performanceOptimization";

// 初始化性能优化
performanceOptimizer.init();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
