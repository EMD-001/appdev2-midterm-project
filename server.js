const http = require('http');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');
const path = require('path');


const logger = new EventEmitter();

const logFilePath = path.join(__dirname, 'logs.txt');


logger.on('log', (message) => {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
});


const readTodos = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'todos.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

// Helper function to write to todos.json
const writeTodos = (todos) => {
  fs.writeFileSync(path.join(__dirname, 'todos.json'), JSON.stringify(todos, null, 2));
};

// Helper function to send JSON response
const sendResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;
  const method = req.method;

  // Log the request
  logger.emit('log', `${method} ${pathname}`);

  // Route: GET /todos
  if (method === 'GET' && pathname === '/todos') {
    const todos = readTodos();
    if (query.completed) {
      const completed = query.completed === 'true';
      const filtered = todos.filter((todo) => todo.completed === completed);
      sendResponse(res, 200, filtered);
    } else {
      sendResponse(res, 200, todos);
    }
  }

  // Route: GET /todos/:id
  else if (method === 'GET' && pathname.match(/^\/todos\/\d+$/)) {
    const id = parseInt(pathname.split('/')[2]);
    const todos = readTodos();
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      sendResponse(res, 200, todo);
    } else {
      sendResponse(res, 404, { error: 'Todo not found' });
    }
  }

  // Route: POST /todos
  else if (method === 'POST' && pathname === '/todos') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { title, completed } = JSON.parse(body);
        if (!title) {
          sendResponse(res, 400, { error: 'Title is required' });
          return;
        }
        const todos = readTodos();
        const newId = todos.length ? Math.max(...todos.map((t) => t.id)) + 1 : 1;
        const newTodo = {
          id: newId,
          title,
          completed: completed ?? false,
        };
        todos.push(newTodo);
        writeTodos(todos);
        sendResponse(res, 201, newTodo);
      } catch (err) {
        sendResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
  }

  // Route: PUT /todos/:id
  else if (method === 'PUT' && pathname.match(/^\/todos\/\d+$/)) {
    const id = parseInt(pathname.split('/')[2]);
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { title, completed } = JSON.parse(body);
        const todos = readTodos();
        const index = todos.findIndex((t) => t.id === id);
        if (index === -1) {
          sendResponse(res, 404, { error: 'Todo not found' });
          return;
        }
        if (title !== undefined) todos[index].title = title;
        if (completed !== undefined) todos[index].completed = completed;
        writeTodos(todos);
        sendResponse(res, 200, todos[index]);
      } catch (err) {
        sendResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
  }

  // Route: DELETE /todos/:id
  else if (method === 'DELETE' && pathname.match(/^\/todos\/\d+$/)) {
    const id = parseInt(pathname.split('/')[2]);
    const todos = readTodos();
    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) {
      sendResponse(res, 404, { error: 'Todo not found' });
      return;
    }
    const deleted = todos.splice(index, 1)[0];
    writeTodos(todos);
    sendResponse(res, 200, deleted);
  }

  // Route not found
  else {
    sendResponse(res, 404, { error: 'Route not found' });
  }
});

// Start the server
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
