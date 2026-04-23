#!/bin/bash
echo ""
echo "🔗 Starting Bond App..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install it from https://nodejs.org"
  exit 1
fi

# Check .env
if [ ! -f backend/.env ]; then
  echo "⚠️  No .env file found. Creating from example..."
  cp backend/.env.example backend/.env
  echo ""
  echo "👉 Open backend/.env and add your ANTHROPIC_API_KEY"
  echo "   Get your key at: https://console.anthropic.com"
  echo ""
  read -p "Press Enter once you've added your key..."
fi

# Install deps if needed
if [ ! -d backend/node_modules ]; then
  echo "📦 Installing backend dependencies..."
  cd backend && npm install && cd ..
fi
if [ ! -d frontend/node_modules ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

echo ""
echo "✅ Launching Bond..."
echo "   Backend  → http://localhost:5000"
echo "   Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start both
trap 'kill 0' SIGINT
cd backend && npm run dev &
cd frontend && npm run dev &
wait
