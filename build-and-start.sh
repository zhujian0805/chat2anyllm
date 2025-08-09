#!/bin/bash

# Script to build the React app and start the built version

# Exit immediately if a command exits with a non-zero status
set -e

echo "Building the React application..."
npm run build

echo "Build completed successfully!"

# Check if serve is installed, if not install it
if ! command -v serve &> /dev/null
then
    echo "Installing serve globally..."
    npm install -g serve
fi

echo "Starting the built application on http://localhost:3000"
echo "Press Ctrl+C to stop the server"
serve -s build