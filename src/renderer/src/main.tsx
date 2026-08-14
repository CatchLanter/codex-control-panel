import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import App from './App'
import './styles/theme.css'
import './styles/app.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}
