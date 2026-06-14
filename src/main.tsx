import {StrictMode} from 'react';
// @ts-ignore: allow import from react-dom/client without explicit typings
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// @ts-ignore: allow CSS side-effect import without explicit typings
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
