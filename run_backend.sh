#!/bin/bash
cd ./backend
echo "Installing backend dependencies..."
npm install
echo "Starting backend server..."
npm run dev
