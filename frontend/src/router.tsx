import { createBrowserRouter } from "react-router-dom";
import Home from "@/components/pages/Home";
import App from "./App";
import { lazy } from "react";
import RouterErrorPage from "./components/pages/ErrorPage";
import AnalysisPage from "./components/pages/AnalysisPage";


const PageWrapper = ( { children }: { children: React.ReactNode } ) => (
  <div className="w-full transition-all duration-300 ease-in-out transform">
    {children}
  </div>
);


export const router = createBrowserRouter( [
  {
    path: "/",
    element: <App />,
    errorElement: <RouterErrorPage />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path:'/analysis',
        element: <AnalysisPage />
      }
    ],
  },
] );