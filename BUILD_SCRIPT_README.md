# Application Management Script

This script automates the process of building, starting, and managing both the frontend and backend services.

## Usage

Run the script from the project root directory:

```bash
./manage-app.sh [build|start|stop|restart|status]
```

## Commands

- `build` - Build the frontend React application
- `start` - Start both frontend and backend services
- `stop` - Stop both frontend and backend services
- `restart` - Restart both services
- `status` - Check the status of running services

## Examples

```bash
# Build the frontend application
./manage-app.sh build

# Start both services
./manage-app.sh start

# Check status
./manage-app.sh status

# Stop both services
./manage-app.sh stop

# Restart everything
./manage-app.sh restart
```

## Service Details

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Backend API Health Check: http://localhost:3001/api/health

## What the script does

1. **Build**: Builds the React application using `npm run build`
2. **Start**: 
   - Starts the Node.js backend server on port 3001
   - Starts the frontend application using `serve -s build` on port 3000
3. **Stop**: Gracefully stops both services
4. **Status**: Shows the current status of both services

To stop the servers, press `Ctrl+C` or run `./manage-app.sh stop`.