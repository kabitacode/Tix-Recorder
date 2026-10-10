import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AreaPicker from "./windows/AreaPicker";
import CameraOverlay from "./windows/CameraOverlay";
import "./index.css";

const Root = location.hash === "#area" ? AreaPicker : location.hash === "#camera" ? CameraOverlay : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
