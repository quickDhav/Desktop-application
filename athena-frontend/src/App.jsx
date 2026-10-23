import React, { useState, useEffect, useRef } from "react";

const DEFAULT_QUESTIONS = [
  {
    id: 1,
    question: "Which Electron process is responsible for creating BrowserWindow?",
    options: ["Renderer Process", "Main Process", "React Process", "Preload Process"],
    correctAnswer: 1,
  },
  {
    id: 2,
    question: "Which Electron API is commonly used in the renderer to invoke a handler in the main process?",
    options: ["ipcRenderer.invoke", "BrowserWindow.loadURL", "fs.writeFileSync", "dialog.showMessageBox"],
    correctAnswer: 0,
  },
  {
    id: 3,
    question: "Why is a preload script commonly used in Electron?",
    options: [
      "To style the React application",
      "To expose controlled APIs safely to the renderer",
      "To create the Express server",
      "To replace the main process",
    ],
    correctAnswer: 1,
  },
];

export default function App() {
  const [step, setStep] = useState("setup");
  const [name, setName] = useState("");
  const [urn, setUrn] = useState("");
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [score, setScore] = useState(0);

  const finishExam = async () => {
    let confirmed = true;
    if (window.electronAPI?.confirmSubmit) {
      confirmed = await window.electronAPI.confirmSubmit();
    }
    if (confirmed) {
      setStep("result");
    }
  };

  useEffect(() => {
    if (step !== "exam") return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const requestCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraAllowed(true);
    } catch (e) {
      alert("Camera access denied");
    }
  };

  const requestMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicAllowed(true);
    } catch (e) {
      alert("Microphone access denied");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Student Verification</h1>
        <p className="text-sm text-slate-500 mb-6">Enter your details to begin the exam session.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">University Roll No (URN)</label>
            <input
              type="text"
              value={urn}
              onChange={(e) => setUrn(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. 2104010"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
