const fs = require("fs");
const path = require("path");
const http = require("http");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Exam Portal",
    width: 1050,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const distPath = path.join(__dirname, "..", "dist", "index.html");
  const devUrl = "http://localhost:5180";

  // Check if dev server is running on 5180, otherwise load dist directly
  const req = http.get(devUrl, () => {
    mainWindow.loadURL(devUrl);
  });
  req.on("error", () => {
    mainWindow.loadFile(distPath);
  });
}

// IPC Handlers
ipcMain.handle("set-fullscreen", (event, flag) => {
  if (mainWindow) {
    mainWindow.setFullScreen(flag);
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle("confirm-submit", async () => {
  if (!mainWindow) return true;
  const res = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancel", "Submit"],
    defaultId: 1,
    title: "Submit Exam",
    message: "Are you sure you want to finish and submit the exam?",
  });
  return res.response === 1;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
