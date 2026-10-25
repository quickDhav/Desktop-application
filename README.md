# Desktop Exam Application

A lightweight desktop examination application built with Electron, React, and an Express backend.

## Prerequisites
- Node.js (v18 or later)
- npm

## How to Run

### 1. Start the Backend
```bash
cd athena-backend
npm install
npm start
```
Runs the exam API on http://localhost:3000.

### 2. Launch the Desktop Application
```bash
cd athena-frontend
npm install
npm run dev:electron
```
Opens the Electron desktop window.

### 3. Build DMG Executable (macOS)
```bash
./build_dmg.sh
```
Creates the lightweight native ExamPortal.dmg executable on Desktop.
