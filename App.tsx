import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useAppContext } from "./context/AppContext";
import { Header } from "./components/common/Header";
import { DisclaimerBanner } from "./components/common/DisclaimerBanner";
// import { TradeFeedbackModal } from "./components/common/TradeFeedbackModal";
// import { FloatingInsightButton } from "./components/common/FloatingInsightButton";
// import { PortfolioInsightModal } from "HoloTradeMentor/components/common/PortfolioInsightModal.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Trade from "./pages/Trade";
import Learn from "./pages/Learn";
import NewsPage from "./pages/News";
import StockDetailPage from "./pages/StockDetailPage";
import DemoPage from "./pages/DemoPage";

function AppContent() {
  const { state, dispatch } = useAppContext();

  const handleCloseFeedback = () => {
    dispatch({ type: "CLOSE_TRADE_FEEDBACK" });
  };

  const handleOpenInsightModal = () => {
    dispatch({ type: "OPEN_INSIGHT_MODAL" });
  };

  const handleCloseInsightModal = () => {
    dispatch({ type: "CLOSE_INSIGHT_MODAL" });
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-background pb-8 sm:pb-7">
        <Header />
        <main className="flex-grow">
          <ErrorBoundary label="Page">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/trade/:symbol" element={<StockDetailPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </ErrorBoundary>
        </main>

        {/* {state.tradeFeedback && (
          <TradeFeedbackModal
            feedbackContext={state.tradeFeedback}
            onClose={handleCloseFeedback}
          />
        )} */}
        {/* <FloatingInsightButton onClick={handleOpenInsightModal} /> */}
        {/* {state.isInsightModalOpen && (
          <PortfolioInsightModal onClose={handleCloseInsightModal} />
        )} */}
        <DisclaimerBanner />
      </div>
    </HashRouter>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
