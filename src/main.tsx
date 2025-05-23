import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// import { AuthProvider } from "./supabase/auth.tsx"; // Commented out due to path issue
import { BrowserRouter } from "react-router-dom";

import { TempoDevtools } from "tempo-devtools";
TempoDevtools.init();

const basename = import.meta.env.BASE_URL || "/";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      {/* <AuthProvider> */}
        <App />
      {/* </AuthProvider> */}
    </BrowserRouter>
  </React.StrictMode>,
);

if (import.meta.env.MODE === 'development') {
  const stagewiseConfig = {
    plugins: []
  };
  const toolbarRootElement = document.createElement('div');
  toolbarRootElement.id = 'stagewise-toolbar-root';
  document.body.appendChild(toolbarRootElement);
  Promise.all([
    import('@stagewise/toolbar-react'),
    import('react-dom/client')
  ]).then(([{ StagewiseToolbar }, { createRoot }]) => {
    createRoot(toolbarRootElement).render(
      <React.StrictMode>
        <StagewiseToolbar config={stagewiseConfig} />
      </React.StrictMode>
    );
  });
}
