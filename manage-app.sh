#!/bin/bash

# Script to manage both frontend and backend services
# Usage: ./manage-app.sh [build|start|stop|restart|status|kill|start-frontend|stop-frontend|start-backend|stop-backend|start-frontend-fg|start-backend-fg]

set -e

# Default values
FRONTEND_PORT=3000
BACKEND_PORT=3001
BACKEND_DIR="./backend"

# PIDs file to track running processes
PIDS_FILE=".app-pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[STATUS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    if command -v netstat &> /dev/null; then
        netstat -an | grep ":$port " | grep LISTEN > /dev/null
    elif command -v ss &> /dev/null; then
        ss -tuln | grep ":$port " > /dev/null
    else
        lsof -i :$port > /dev/null 2>&1
    fi
}

# Function to get PID by port
get_pid_by_port() {
    local port=$1
    if command -v lsof &> /dev/null; then
        lsof -t -i :$port 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Function to save PIDs
save_pids() {
    local frontend_pid=$1
    local backend_pid=$2
    echo "FRONTEND_PID=$frontend_pid" > $PIDS_FILE
    echo "BACKEND_PID=$backend_pid" >> $PIDS_FILE
}

# Function to load PIDs
load_pids() {
    if [ -f $PIDS_FILE ]; then
        source $PIDS_FILE
    else
        FRONTEND_PID=""
        BACKEND_PID=""
    fi
}

# Function to build the application
build_app() {
    print_status "Building the React frontend application..."
    npm run build
    
    print_status "Frontend build completed successfully!"
    
    print_status "Backend is ready (no build required for Node.js)"
}

# Function to start only the frontend
start_frontend() {
    # Check if already running
    load_pids
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        print_warning "Frontend is already running (PID: $FRONTEND_PID)"
        return 0
    fi
    
    print_status "Starting frontend application..."
    if ! command -v serve &> /dev/null; then
        print_status "Installing serve globally..."
        npm install -g serve
    fi
    
    serve -s build > frontend.log 2>&1 &
    FRONTEND_PID=$!
    sleep 2
    
    # Check if frontend started successfully
    if is_port_in_use $FRONTEND_PORT; then
        print_status "Frontend application started successfully (PID: $FRONTEND_PID)"
        # Save PID
        save_pids $FRONTEND_PID $BACKEND_PID
    else
        print_error "Failed to start frontend application. Check frontend.log for details."
        exit 1
    fi
}

# Function to start only the backend
start_backend() {
    # Check if already running
    load_pids
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        print_warning "Backend is already running (PID: $BACKEND_PID)"
        return 0
    fi
    
    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "Backend directory $BACKEND_DIR not found"
        exit 1
    fi
    
    print_status "Starting backend server..."
    cd $BACKEND_DIR
    npm start > ../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    sleep 2
    
    # Check if backend started successfully
    if is_port_in_use $BACKEND_PORT; then
        print_status "Backend server started successfully (PID: $BACKEND_PID)"
        # Save PID
        save_pids $FRONTEND_PID $BACKEND_PID
    else
        print_error "Failed to start backend server. Check backend.log for details."
        exit 1
    fi
}

# Function to start only the frontend in foreground (for container use)
start_frontend_fg() {
    print_status "Starting frontend application in foreground..."
    if ! command -v serve &> /dev/null; then
        print_status "Installing serve globally..."
        npm install -g serve
    fi
    
    # Start frontend in foreground
    serve -s build
}

# Function to start only the backend in foreground (for container use)
start_backend_fg() {
    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "Backend directory $BACKEND_DIR not found"
        exit 1
    fi
    
    print_status "Starting backend server in foreground..."
    cd $BACKEND_DIR
    npm start
}

# Function to start the application
start_app() {
    # Check if already running
    load_pids
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        print_warning "Frontend is already running (PID: $FRONTEND_PID)"
        frontend_running=true
    else
        frontend_running=false
    fi
    
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        print_warning "Backend is already running (PID: $BACKEND_PID)"
        backend_running=true
    else
        backend_running=false
    fi
    
    if [ "$frontend_running" = true ] && [ "$backend_running" = true ]; then
        print_warning "Both frontend and backend are already running"
        return 0
    fi
    
    # Start backend if not running
    if [ "$backend_running" = false ]; then
        if [ ! -d "$BACKEND_DIR" ]; then
            print_error "Backend directory $BACKEND_DIR not found"
            exit 1
        fi
        
        print_status "Starting backend server..."
        cd $BACKEND_DIR
        npm start > ../backend.log 2>&1 &
        BACKEND_PID=$!
        cd ..
        sleep 2
        
        # Check if backend started successfully
        if is_port_in_use $BACKEND_PORT; then
            print_status "Backend server started successfully (PID: $BACKEND_PID)"
        else
            print_error "Failed to start backend server. Check backend.log for details."
            exit 1
        fi
    fi
    
    # Start frontend if not running
    if [ "$frontend_running" = false ]; then
        print_status "Starting frontend application..."
        if ! command -v serve &> /dev/null; then
            print_status "Installing serve globally..."
            npm install -g serve
        fi
        
        serve -s build > frontend.log 2>&1 &
        FRONTEND_PID=$!
        sleep 2
        
        # Check if frontend started successfully
        if is_port_in_use $FRONTEND_PORT; then
            print_status "Frontend application started successfully (PID: $FRONTEND_PID)"
        else
            print_error "Failed to start frontend application. Check frontend.log for details."
            # Kill backend if frontend failed to start
            if [ ! -z "$BACKEND_PID" ]; then
                kill $BACKEND_PID 2>/dev/null || true
            fi
            exit 1
        fi
    fi
    
    # Save PIDs
    save_pids $FRONTEND_PID $BACKEND_PID
    
    print_status "Application is running!"
    print_status "Frontend: http://localhost:$FRONTEND_PORT"
    print_status "Backend: http://localhost:$BACKEND_PORT"
    print_status "API Health Check: http://localhost:$BACKEND_PORT/api/health"
}

# Function to stop the application using stored PIDs
stop_app() {
    load_pids
    
    stopped=false
    
    # Stop frontend
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        wait $FRONTEND_PID 2>/dev/null || true
        print_status "Frontend stopped"
        stopped=true
    else
        print_warning "Frontend is not running or PID not found"
    fi
    
    # Stop backend
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        wait $BACKEND_PID 2>/dev/null || true
        print_status "Backend stopped"
        stopped=true
    else
        print_warning "Backend is not running or PID not found"
    fi
    
    # Remove PIDs file
    if [ -f $PIDS_FILE ]; then
        rm $PIDS_FILE
    fi
    
    if [ "$stopped" = true ]; then
        print_status "Application stopped"
    else
        print_warning "No running processes found"
    fi
}

# Function to stop only the frontend
stop_frontend() {
    load_pids
    
    # Stop frontend
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        wait $FRONTEND_PID 2>/dev/null || true
        print_status "Frontend stopped"
        # Clear frontend PID
        FRONTEND_PID=""
        # Save updated PIDs
        save_pids $FRONTEND_PID $BACKEND_PID
    else
        print_warning "Frontend is not running or PID not found"
    fi
}

# Function to stop only the backend
stop_backend() {
    load_pids
    
    # Stop backend
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        wait $BACKEND_PID 2>/dev/null || true
        print_status "Backend stopped"
        # Clear backend PID
        BACKEND_PID=""
        # Save updated PIDs
        save_pids $FRONTEND_PID $BACKEND_PID
    else
        print_warning "Backend is not running or PID not found"
    fi
}

# Function to forcefully kill all processes on the ports
kill_app() {
    killed=false
    
    # Kill frontend processes
    if is_port_in_use $FRONTEND_PORT; then
        PIDS=$(get_pid_by_port $FRONTEND_PORT)
        if [ ! -z "$PIDS" ]; then
            for PID in $PIDS; do
                print_status "Killing frontend process on port $FRONTEND_PORT (PID: $PID)..."
                kill -9 $PID 2>/dev/null || true
                killed=true
            done
        fi
    fi
    
    # Kill backend processes
    if is_port_in_use $BACKEND_PORT; then
        PIDS=$(get_pid_by_port $BACKEND_PORT)
        if [ ! -z "$PIDS" ]; then
            for PID in $PIDS; do
                print_status "Killing backend process on port $BACKEND_PORT (PID: $PID)..."
                kill -9 $PID 2>/dev/null || true
                killed=true
            done
        fi
    fi
    
    # Remove PIDs file
    if [ -f $PIDS_FILE ]; then
        rm $PIDS_FILE
    fi
    
    if [ "$killed" = true ]; then
        print_status "All application processes killed"
    else
        print_warning "No processes found on ports $FRONTEND_PORT or $BACKEND_PORT"
    fi
}

# Function to check application status
status_app() {
    load_pids
    
    print_status "Application Status:"
    
    # Check ports directly and determine current PIDs
    local current_frontend_pid=""
    local current_backend_pid=""
    
    if is_port_in_use $FRONTEND_PORT; then
        PIDS=$(get_pid_by_port $FRONTEND_PORT)
        if [ ! -z "$PIDS" ]; then
            current_frontend_pid=$(echo $PIDS | awk '{print $1}') # Take first PID if multiple
        fi
    fi
    
    if is_port_in_use $BACKEND_PORT; then
        PIDS=$(get_pid_by_port $BACKEND_PORT)
        if [ ! -z "$PIDS" ]; then
            current_backend_pid=$(echo $PIDS | awk '{print $1}') # Take first PID if multiple
        fi
    fi
    
    # Display current status based on actual running processes
    if [ ! -z "$current_frontend_pid" ]; then
        print_status "Frontend is running (PID: $current_frontend_pid, Port: $FRONTEND_PORT)"
    else
        print_warning "Frontend is not running"
    fi
    
    if [ ! -z "$current_backend_pid" ]; then
        print_status "Backend is running (PID: $current_backend_pid, Port: $BACKEND_PORT)"
    else
        print_warning "Backend is not running"
    fi
    
    # Check if stored PIDs match current PIDs and update if needed
    local updated=false
    
    if [ ! -z "$current_frontend_pid" ] && [ "$current_frontend_pid" != "$FRONTEND_PID" ]; then
        print_warning "Frontend PID changed from $FRONTEND_PID to $current_frontend_pid"
        FRONTEND_PID=$current_frontend_pid
        updated=true
    fi
    
    if [ ! -z "$current_backend_pid" ] && [ "$current_backend_pid" != "$BACKEND_PID" ]; then
        print_warning "Backend PID changed from $BACKEND_PID to $current_backend_pid"
        BACKEND_PID=$current_backend_pid
        updated=true
    fi
    
    # Save updated PIDs if they changed
    if [ "$updated" = true ]; then
        save_pids $FRONTEND_PID $BACKEND_PID
        print_status "Updated PIDs file with current process IDs"
    fi
}

# Main script logic
case "$1" in
    build)
        build_app
        ;;
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    kill)
        kill_app
        ;;
    restart)
        stop_app
        sleep 2
        start_app
        ;;
    status)
        status_app
        ;;
    start-frontend)
        start_frontend
        ;;
    stop-frontend)
        stop_frontend
        ;;
    start-backend)
        start_backend
        ;;
    stop-backend)
        stop_backend
        ;;
    start-frontend-fg)
        start_frontend_fg
        ;;
    start-backend-fg)
        start_backend_fg
        ;;
    *)
        echo "Usage: $0 [build|start|stop|kill|restart|status|start-frontend|stop-frontend|start-backend|stop-backend|start-frontend-fg|start-backend-fg]"
        echo ""
        echo "Commands:"
        echo "  build             - Build the frontend application"
        echo "  start             - Start both frontend and backend services"
        echo "  stop              - Stop both frontend and backend services (graceful)"
        echo "  kill              - Forcefully kill all processes on the ports"
        echo "  restart           - Restart both services"
        echo "  status            - Check the status of running services"
        echo "  start-frontend    - Start only the frontend service"
        echo "  stop-frontend     - Stop only the frontend service"
        echo "  start-backend     - Start only the backend service"
        echo "  stop-backend      - Stop only the backend service"
        echo "  start-frontend-fg - Start only the frontend service in foreground (for containers)"
        echo "  start-backend-fg  - Start only the backend service in foreground (for containers)"
        echo ""
        echo "Examples:"
        echo "  $0 build"
        echo "  $0 start"
        echo "  $0 stop"
        echo "  $0 kill"
        echo "  $0 start-frontend"
        echo "  $0 stop-backend"
        echo "  $0 start-frontend-fg"
        echo "  $0 start-backend-fg"
        exit 1
        ;;
esac