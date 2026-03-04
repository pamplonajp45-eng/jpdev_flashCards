import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Hard-clear caches to ensure rebranding (v2.1 launch fix)
if ('caches' in window) {
  caches.keys().then(names => {
    for (let name of names) caches.delete(name);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
