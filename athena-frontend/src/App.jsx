import React, { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:3000";

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
  {
    id: 4,
    question: "Which HTTP method is normally used to fetch exam questions?",
    options: ["GET", "DELETE", "PATCH", "CONNECT"],
    correctAnswer: 0,
  },
  {
    id: 5,
    question: "What does fs.writeFileSync() do?",
    options: [
      "Reads camera frames",
      "Writes data to a file and waits until it finishes",
      "Starts the Electron renderer",
      "Sends an IPC event",
    ],
    correctAnswer: 1,
  },
];

export default function App() {
  const [step, setStep] = useState("setup"); // setup | exam | result

  // Student inputs
  const [name, setName] = useState("");
  const [urn, setUrn] = useState("");

  // Permissions state
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const videoRef = useRef(null);
  const miniVideoRef = useRef(null);
  const streamRef = useRef(null);

  // Exam state
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sessionId, setSessionId] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [score, setScore] = useState({ total: 0, correct: 0 });

  // Attach camera stream to video tag whenever camera is allowed
  useEffect(() => {
    if (streamRef.current) {
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      if (miniVideoRef.current) miniVideoRef.current.srcObject = streamRef.current;
    }
  }, [cameraAllowed, step]);

  // Request Camera
  async function enableCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraAllowed(true);
    } catch (err) {
      alert("Could not access camera. Please allow camera permissions.");
      console.error(err);
    }
  }

  // Request Microphone
  async function enableMicrophone() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicAllowed(true);
    } catch (err) {
      alert("Could not access microphone. Please allow microphone permissions.");
      console.error(err);
    }
  }

  // Timer
  useEffect(() => {
    if (step !== "exam") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          finishExam();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Start Exam
  async function startExam() {
    if (!name.trim() || !urn.trim()) {
      alert("Please enter both your Name and Roll Number.");
      return;
    }
    if (!cameraAllowed || !micAllowed) {
      alert("Please enable both Camera and Microphone before starting.");
      return;
    }

    // Go Fullscreen via Electron IPC
    if (window.electronAPI?.setFullScreen) {
      window.electronAPI.setFullScreen(true);
    }

    // Try starting session on backend
    try {
      const res = await fetch(`${BACKEND_URL}/exam/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: urn, name }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.sessionId);

        // Fetch questions from backend
        const qRes = await fetch(`${BACKEND_URL}/exam/mcq`);
        if (qRes.ok) {
          const qData = await qRes.json();
          if (Array.isArray(qData) && qData.length > 0) setQuestions(qData);
        }
      }
    } catch {
      console.log("Backend offline, running in local mode");
    }

    setStep("exam");
    setCurrentIdx(0);
    setAnswers({});
    setTimeLeft(600);
  }

  // Select Option
  async function selectAnswer(optIdx) {
    const q = questions[currentIdx];
    if (!q) return;

    setAnswers((prev) => ({ ...prev, [q.id]: optIdx }));

    // Send answer to backend if connected
    if (sessionId) {
      try {
        await fetch(`${BACKEND_URL}/exam/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: q.id,
            selectedAnswer: optIdx,
          }),
        });
      } catch (e) {
        console.log("Answer saved locally");
      }
    }
  }

  // Finish / Submit Exam
  async function finishExam() {
    let confirmed = true;
    if (window.electronAPI?.confirmSubmit) {
      confirmed = await window.electronAPI.confirmSubmit();
    } else {
      confirmed = window.confirm("Are you sure you want to submit your exam?");
    }

    if (!confirmed) return;

    // Exit fullscreen
    if (window.electronAPI?.setFullScreen) {
      window.electronAPI.setFullScreen(false);
    }

    // Calculate score
    let correctCount = 0;
    questions.forEach((q) => {
      if (answers[q.id] !== undefined && answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    setScore({ total: questions.length, correct: correctCount });
    setStep("result");
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <nav className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            EP
          </div>
          <div>
            <span className="text-slate-900 font-bold text-base block leading-tight">College Exam Portal</span>
            <span className="text-[11px] text-slate-500 block">Desktop Examination Client</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            System Online
          </span>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 p-6 flex justify-center items-center">
        {/* ================= STEP 1: SETUP ================= */}
        {step === "setup" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full shadow-sm space-y-6">
            <div className="text-center pb-2 border-b border-slate-100">
              <h1 className="text-2xl font-bold text-slate-900">Student Verification</h1>
              <p className="text-xs text-slate-500 mt-1">
                Enter your student credentials and grant hardware permissions.
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Roll Number (URN)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2026-CS-101"
                  value={urn}
                  onChange={(e) => setUrn(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              {/* Camera Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-700 block mb-2">Camera Feed</span>
                <div className="h-28 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden mb-3 border border-slate-300 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraAllowed ? "block" : "hidden"}`}
                  />
                  {!cameraAllowed && (
                    <span className="text-xs text-slate-400">Preview Inactive</span>
                  )}
                </div>
                {!cameraAllowed ? (
                  <button
                    onClick={enableCamera}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition shadow-xs"
                  >
                    Allow Camera
                  </button>
                ) : (
                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 py-1.5 rounded-lg block">
                    Camera Ready ✅
                  </span>
                )}
              </div>

              {/* Mic Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-700 block mb-2">Microphone</span>
                <div className="h-28 bg-white rounded-lg flex flex-col items-center justify-center mb-3 border border-slate-200 shadow-inner">
                  <span className="text-3xl mb-1">{micAllowed ? "🎙️" : "🔇"}</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {micAllowed ? "Microphone Active" : "Microphone Off"}
                  </span>
                </div>
                {!micAllowed ? (
                  <button
                    onClick={enableMicrophone}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition shadow-xs"
                  >
                    Allow Microphone
                  </button>
                ) : (
                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 py-1.5 rounded-lg block">
                    Mic Ready ✅
                  </span>
                )}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={startExam}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
            >
              Start Exam Now
            </button>
          </div>
        )}

        {/* ================= STEP 2: EXAM ================= */}
        {step === "exam" && (
          <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            {/* Top Exam Info & Mini Video */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-base font-bold text-slate-900 block">{name}</span>
                <span className="text-xs text-slate-500 font-mono">Roll No: {urn}</span>
              </div>

              {/* Timer */}
              <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center">
                <span className="text-[10px] text-amber-700 font-bold block uppercase tracking-wider">Time Left</span>
                <span className="text-base font-mono font-bold text-amber-900">{formatTime(timeLeft)}</span>
              </div>

              {/* Mini webcam preview */}
              <div className="w-20 h-14 bg-black rounded-lg overflow-hidden border border-slate-300 relative shadow-sm">
                <video ref={miniVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 text-[8px] bg-red-600 text-white font-bold px-1 rounded">
                  REC
                </span>
              </div>
            </div>

            {/* Question Counter & Pills */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                Question {currentIdx + 1} of {questions.length}
              </span>

              {/* Question Pills */}
              <div className="flex gap-1.5">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                      currentIdx === i
                        ? "bg-blue-600 text-white shadow-xs"
                        : answers[q.id] !== undefined
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Text */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <p className="text-base font-medium text-slate-900 leading-relaxed">
                {questions[currentIdx]?.question}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {questions[currentIdx]?.options.map((opt, optIdx) => {
                const isSelected = answers[questions[currentIdx].id] === optIdx;
                return (
                  <div
                    key={optIdx}
                    onClick={() => selectAnswer(optIdx)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3.5 text-sm ${
                      isSelected
                        ? "bg-blue-50/80 border-blue-500 text-blue-900 font-semibold ring-1 ring-blue-500 shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </div>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Previous
              </button>

              <div className="flex gap-2">
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={finishExam}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    Submit Exam
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: RESULT ================= */}
        {step === "result" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-sm text-center space-y-6">
            <span className="text-5xl block">🎓</span>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Exam Submitted!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Candidate: <strong className="text-slate-800">{name}</strong> ({urn})
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
              <span className="text-xs text-slate-500 uppercase font-bold block mb-1 tracking-wider">
                Total Score
              </span>
              <span className="text-4xl font-extrabold text-blue-600 block">
                {score.correct} / {score.total}
              </span>
              <span className="text-xs text-slate-500 block mt-1.5 font-medium">
                {Math.round((score.correct / (score.total || 1)) * 100)}% Accuracy
              </span>
            </div>

            <button
              onClick={() => {
                setStep("setup");
                setAnswers({});
                setCameraAllowed(false);
                setMicAllowed(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-xs"
            >
              Take Another Test
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
