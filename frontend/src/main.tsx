import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Tambahkan ./ di depan nama file

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);