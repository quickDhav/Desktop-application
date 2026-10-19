import React, { useState } from "react";

export default function App() {
  const [step, setStep] = useState("setup");
  const [name, setName] = useState("");
  const [urn, setUrn] = useState("");

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
