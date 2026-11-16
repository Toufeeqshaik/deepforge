import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Analyze from "./pages/Analyze";
import History from "./pages/History";
import AnalysisDetail from "./pages/AnalysisDetail";
import About from "./pages/About";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/history" element={<History />} />
        <Route path="/analysis/:id" element={<AnalysisDetail />} />
        <Route path="/about" element={<About />} />
        <Route
          path="*"
          element={
            <div className="py-20 text-center">
              <h1 className="text-5xl font-bold">
                <span className="text-gradient">404</span>
              </h1>
              <p className="mt-3 text-sm text-text-secondary">
                That page doesn't exist. Nothing was fabricated to fill it.
              </p>
            </div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </BrowserRouter>
  );
}
