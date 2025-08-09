# React Chat App with LiteLLM Integration

A modern, Apple-style chat application built with React and TypeScript that integrates with LiteLLM endpoints. Features include dark/light theme switching, code syntax highlighting, and a clean, responsive interface.

## Features

- 🎨 **Modern Apple-style UI** - Clean, minimalist design with smooth animations
- 🌙 **Dark/Light Theme** - Toggle between themes with persistent preferences
- 💬 **Real-time Chat** - Send messages to any LiteLLM-compatible endpoint
- 🎨 **Code Highlighting** - Automatic syntax highlighting for code blocks in responses
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ⚡ **Fast & Lightweight** - Built with modern React and TypeScript

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A running LiteLLM server or compatible API endpoint

## Configuration

Configure your environment variables by editing the `.env` file:

```bash
# Update these values in .env
REACT_APP_LITELLM_ENDPOINT=http://localhost:4000
REACT_APP_LITELLM_MODEL=gpt-3.5-turbo
REACT_APP_API_KEY=your-api-key-here
```

### LiteLLM Setup

If you don't have LiteLLM running, you can set it up using:

```bash
# Install LiteLLM
pip install litellm

# Start LiteLLM server
litellm --model gpt-3.5-turbo --drop_params
```

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
