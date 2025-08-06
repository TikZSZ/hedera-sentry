import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RouterProvider } from 'react-router-dom'
import { router } from './router.tsx'
import "./scrollbar.css";

createRoot(document.getElementById('root')!).render(
  <Suspense>
      <RouterProvider router={router} />
  </Suspense>
)
