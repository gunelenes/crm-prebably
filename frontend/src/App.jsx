import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";

// Sayfalar lazy yüklenir → ilk bundle küçülür, her route ayrı chunk.
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ContactsPage = lazy(() => import("./pages/contacts/ContactsPage"));
const PaymentsPage = lazy(() => import("./pages/payments/PaymentsPage"));
const AdvertisingPage = lazy(() => import("./pages/advertising/AdvertisingPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const QuickRepliesPage = lazy(() => import("./pages/QuickRepliesPage"));
const IssuesPage = lazy(() => import("./pages/issues/IssuesPage"));
const ParametersPage = lazy(() => import("./pages/parameters/ParametersPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="mesajlar" element={<MessagesPage />} />
        <Route path="kisiler" element={<ContactsPage />} />
        <Route path="hatirlatmalar" element={<RemindersPage />} />
        <Route path="odemeler" element={
          <ProtectedRoute adminOnly><PaymentsPage /></ProtectedRoute>
        } />
        <Route path="reklam-analizi" element={
          <ProtectedRoute adminOnly><AdvertisingPage /></ProtectedRoute>
        } />
        <Route path="grafikler" element={
          <ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>
        } />
        <Route path="hazir-mesajlar" element={<QuickRepliesPage />} />
        <Route path="hatalar" element={<IssuesPage />} />
        <Route path="parametreler" element={<ParametersPage />} />
        <Route path="statuler" element={<Navigate to="/parametreler" replace />} />
        <Route path="kullanicilar" element={
          <ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
